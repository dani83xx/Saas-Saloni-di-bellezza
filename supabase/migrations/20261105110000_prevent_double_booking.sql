-- Impedisce due appuntamenti sovrapposti per lo stesso collaboratore,
-- nello stesso salone, nello stesso giorno.
-- Il cloud agent NON applica questo file: eseguilo nel SQL Editor di Supabase dopo il merge.
-- Si può rieseguire. Non modifica le policy RLS, non tocca salon_users e non cambia lo schema dello staff.
--
-- Sovrapposizione: intervalli [start_time, end_time).
-- Se end_time manca, oppure non è successivo a start_time, la fine è start_time + duration_minutes.
--
-- Non occupano lo slot (stati dell'app e varianti già possibili in tabella):
--   Annullato, Cancellato, cancelled, canceled, No-Show, no_show, noshow, no show.
-- Occupano lo slot: Confermato, In corso, Completato e qualsiasi altro stato
-- (pagato, vuoto, confirmed, booked, in-progress, ...).
--
-- Le righe già sovrapposte restano in tabella. Il trigger blocca i nuovi inserimenti
-- e gli aggiornamenti che spostano lo slot o che riportano un annullato/no-show su uno slot occupato.
-- Note, incasso e cambio tra stati che occupano lo stesso slot restano consentiti.
-- Il controllo usa un lock di transazione per collaboratore+giorno, quindi due salvataggi
-- contemporanei (titolare e operatore) non possono prenotare lo stesso orario.
-- Operatori e titolari restano soggetti alle policy già presenti su appointments.

CREATE OR REPLACE FUNCTION public.nuvia_appointment_frees_slot(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(btrim(coalesce(p_status, ''))) IN (
    'annullato',
    'cancellato',
    'cancelled',
    'canceled',
    'no-show',
    'no_show',
    'noshow',
    'no show'
  );
$$;

CREATE OR REPLACE FUNCTION public.nuvia_appointment_minute_range(
  p_start time,
  p_end time,
  p_duration numeric
)
RETURNS int4range
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_start IS NULL THEN NULL
    ELSE int4range(
      (EXTRACT(HOUR FROM p_start)::integer * 60) + EXTRACT(MINUTE FROM p_start)::integer,
      CASE
        WHEN p_end IS NOT NULL
          AND ((EXTRACT(HOUR FROM p_end)::integer * 60) + EXTRACT(MINUTE FROM p_end)::integer)
            > ((EXTRACT(HOUR FROM p_start)::integer * 60) + EXTRACT(MINUTE FROM p_start)::integer)
        THEN (EXTRACT(HOUR FROM p_end)::integer * 60) + EXTRACT(MINUTE FROM p_end)::integer
        ELSE ((EXTRACT(HOUR FROM p_start)::integer * 60) + EXTRACT(MINUTE FROM p_start)::integer)
          + GREATEST(COALESCE(p_duration, 0), 0)::integer
      END,
      '[)'
    )
  END;
$$;

COMMENT ON FUNCTION public.nuvia_appointment_frees_slot(text) IS
  'true per Annullato / No-Show (e varianti): lo slot torna disponibile.';
COMMENT ON FUNCTION public.nuvia_appointment_minute_range(time, time, numeric) IS
  'Intervallo [inizio, fine) in minuti. Se end_time manca o non è dopo start_time, usa duration_minutes.';

CREATE OR REPLACE FUNCTION public.nuvia_prevent_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_range int4range;
BEGIN
  IF NEW.staff_id IS NULL OR NEW.salon_id IS NULL OR NEW.appointment_date IS NULL THEN
    RETURN NEW;
  END IF;

  -- Stesso slot già occupato: note, incasso e passaggio tra stati attivi non riaprono il controllo.
  IF TG_OP = 'UPDATE'
    AND NOT public.nuvia_appointment_frees_slot(OLD.status)
    AND NOT public.nuvia_appointment_frees_slot(NEW.status)
    AND OLD.salon_id IS NOT DISTINCT FROM NEW.salon_id
    AND OLD.staff_id IS NOT DISTINCT FROM NEW.staff_id
    AND OLD.appointment_date IS NOT DISTINCT FROM NEW.appointment_date
    AND public.nuvia_appointment_minute_range(OLD.start_time, OLD.end_time, OLD.duration_minutes)
      IS NOT DISTINCT FROM public.nuvia_appointment_minute_range(NEW.start_time, NEW.end_time, NEW.duration_minutes)
  THEN
    RETURN NEW;
  END IF;

  -- Il lock resta fino al commit: una disdetta e una nuova prenotazione sullo stesso orario si serializzano.
  PERFORM pg_advisory_xact_lock(
    hashtext(NEW.salon_id::text),
    hashtext(NEW.staff_id::text || '|' || NEW.appointment_date::text)
  );

  IF public.nuvia_appointment_frees_slot(NEW.status) OR NEW.start_time IS NULL THEN
    RETURN NEW;
  END IF;

  new_range := public.nuvia_appointment_minute_range(NEW.start_time, NEW.end_time, NEW.duration_minutes);
  IF new_range IS NULL OR isempty(new_range) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointments AS existing
    WHERE existing.salon_id = NEW.salon_id
      AND existing.staff_id = NEW.staff_id
      AND existing.appointment_date = NEW.appointment_date
      AND existing.id IS DISTINCT FROM NEW.id
      AND NOT public.nuvia_appointment_frees_slot(existing.status)
      AND public.nuvia_appointment_minute_range(existing.start_time, existing.end_time, existing.duration_minutes) && new_range
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'APPOINTMENT_OVERLAP: Questo collaboratore ha già un appuntamento in quell''orario';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.nuvia_prevent_appointment_overlap() IS
  'Blocca la doppia prenotazione dello stesso collaboratore. SECURITY DEFINER: il controllo vede anche le righe che una policy RLS più stretta nasconderebbe, senza cambiarle.';

REVOKE ALL ON FUNCTION public.nuvia_appointment_frees_slot(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_appointment_minute_range(time, time, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_prevent_appointment_overlap() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.nuvia_appointment_frees_slot(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.nuvia_appointment_minute_range(time, time, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.nuvia_prevent_appointment_overlap() TO authenticated, service_role;

DROP TRIGGER IF EXISTS nuvia_prevent_appointment_overlap ON public.appointments;
CREATE TRIGGER nuvia_prevent_appointment_overlap
  BEFORE INSERT OR UPDATE OF status, staff_id, salon_id, appointment_date, start_time, end_time, duration_minutes
  ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.nuvia_prevent_appointment_overlap();

CREATE INDEX IF NOT EXISTS appointments_staff_day_idx
  ON public.appointments (salon_id, staff_id, appointment_date);

-- Rete di sicurezza concorrente. Se in tabella ci sono già sovrapposizioni, o se btree_gist
-- non è disponibile, l'errore resta in questo blocco: il DROP viene annullato e il trigger resta attivo.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_no_double_booking;
  ALTER TABLE public.appointments
    ADD CONSTRAINT appointments_no_double_booking
    EXCLUDE USING gist (
      salon_id WITH =,
      staff_id WITH =,
      appointment_date WITH =,
      public.nuvia_appointment_minute_range(start_time, end_time, duration_minutes) WITH &&
    )
    WHERE (
      staff_id IS NOT NULL
      AND salon_id IS NOT NULL
      AND appointment_date IS NOT NULL
      AND NOT public.nuvia_appointment_frees_slot(status)
    );
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE NOTICE 'Sovrapposizioni già presenti: vincolo appointments_no_double_booking non creato. Il trigger blocca i nuovi salvataggi.';
  WHEN OTHERS THEN
    RAISE NOTICE 'Vincolo appointments_no_double_booking non creato (%). Il trigger blocca i nuovi salvataggi.', SQLERRM;
END $$;
