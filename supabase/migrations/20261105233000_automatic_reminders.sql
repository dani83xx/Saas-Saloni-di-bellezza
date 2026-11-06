-- Promemoria automatici via email, solo piano PRO (mensile e annuale) e prova attiva.
-- Il cloud agent NON applica questo file: incollalo nel SQL Editor di Supabase ed eseguilo.
-- Si può rieseguire. Non tocca prezzi, Stripe, staff né il vincolo anti doppia prenotazione.
--
-- Cosa fa
-- 1) public.salons.auto_reminders: interruttore del titolare/admin. Default spento.
--    Un salone BASE non può accenderlo (trigger). Il cron, in più, ricontrolla il piano.
-- 2) Sull'appuntamento: reminder_sent_at, reminder_email, reminder_claim_id, reminder_anchor_at.
--    L'ancora è il momento della prenotazione o dell'ultimo spostamento di data/ora.
-- 3) nuvia_claim_due_reminders / nuvia_release_reminder_claim: le chiama solo la service role.
--    La Edge Function send-appointment-reminders invia con Brevo e, se l'invio fallisce
--    in modo temporaneo, rilascia il claim. Un secondo giro non reinvia le righe già segnate.
--
-- Quando parte l'email (fuso Europe/Rome, orario locale del salone)
-- - Una sola volta, circa 24 ore prima: la visita è tra 22 e 26 ore.
-- - La prenotazione o l'ultimo spostamento risale ad almeno 26 ore prima della visita
--   e ad almeno 1 ora prima dell'invio. Così una prenotazione dell'ultimo giorno
--   non genera un'email immediata. Per quelle resta il promemoria WhatsApp manuale.
-- - Salone con auto_reminders = true e piano PRO aperto
--   (stessa regola di nuvia_staff_feature_open / resolvePlanAccessFromBilling):
--   plan = pro e subscription_status active, trialing o past_due (mese o anno);
--   oppure prova non scaduta (trial_ends_at, oppure created_at + 7 giorni).
--   plan = base, anche a 39€/mese o 390€/anno, non invia. Dopo la prova, BASE non invia.
-- - Cliente con email valida collegata all'appuntamento. Senza email si salta, la prenotazione resta.
-- - Si saltano gli stati Annullato, Cancellato, cancelled, canceled, No-Show, no_show, noshow, no show,
--   Completato e completed.
--
-- Dopo questo SQL, sul progetto:
-- 1. Dashboard → Edge Functions → deploy di send-appointment-reminders
--    (verify_jwt = false: l'autenticazione è il secret, non il JWT dell'utente).
-- 2. Segreti della funzione, senza metterli nel repo:
--      BREVO_API_KEY
--      BREVO_SENDER_EMAIL   (mittente già verificato sullo stesso account Brevo dell'SMTP Auth)
--      REMINDER_CRON_SECRET (stringa lunga, almeno 16 caratteri)
-- 3. Database → Extensions: abilita pg_cron e pg_net, poi riesegui questo file
--    se al primo giro ha scritto che le estensioni mancavano.
-- 4. Secret letto ogni ora dal cron (stesso valore di REMINDER_CRON_SECRET):
--      select vault.create_secret('<REMINDER_CRON_SECRET>', 'nuvia_reminder_cron_secret', 'Cron promemoria Nuvia');
--    Il job nuvia-appointment-reminders gira al minuto 15 di ogni ora.
--    Finché il secret non c'è, il job non chiama la funzione.
--
-- Prova manuale, dopo il deploy, con la service role (non con la anon key):
--   curl -X POST https://izbhxyhepzwsgobtihfc.supabase.co/functions/v1/send-appointment-reminders \
--     -H "Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>" \
--     -H "Content-Type: application/json" \
--     -d '{"source":"manual"}'

ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS auto_reminders boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.salons.auto_reminders IS
  'true = il cron può inviare l''email circa 24 ore prima. Il piano PRO è ricontrollato in invio. BASE non può metterlo a true.';

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_email text,
  ADD COLUMN IF NOT EXISTS reminder_claim_id uuid,
  ADD COLUMN IF NOT EXISTS reminder_anchor_at timestamptz;

UPDATE public.appointments
SET reminder_anchor_at = now()
WHERE reminder_anchor_at IS NULL;

ALTER TABLE public.appointments
  ALTER COLUMN reminder_anchor_at SET DEFAULT now();

ALTER TABLE public.appointments
  ALTER COLUMN reminder_anchor_at SET NOT NULL;

COMMENT ON COLUMN public.appointments.reminder_sent_at IS
  'Quando il claim del promemoria email è stato preso. Resta valorizzato se l''invio è andato a buon fine.';
COMMENT ON COLUMN public.appointments.reminder_email IS
  'Email a cui è stato indirizzato il claim. Non è un consenso marketing separato.';
COMMENT ON COLUMN public.appointments.reminder_claim_id IS
  'Token del claim corrente. Il rilascio dopo un errore Brevo temporaneo usa questo id, non il timestamp.';
COMMENT ON COLUMN public.appointments.reminder_anchor_at IS
  'Prenotazione o ultimo cambio di data/ora. Serve a non inviare un promemoria immediato.';

CREATE INDEX IF NOT EXISTS appointments_reminder_unsent_idx
  ON public.appointments (appointment_date, start_time)
  WHERE reminder_sent_at IS NULL;

-- Stessa regola di public.nuvia_staff_feature_open e di src/lib/plan.ts resolvePlanAccessFromBilling.
-- Se la funzione staff esiste, è lei la fonte. Il ramo interno copre un database che non l'ha ancora.
CREATE OR REPLACE FUNCTION public.nuvia_pro_feature_open(p_salon uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_json jsonb;
  plan text;
  status text;
  trial_end timestamptz;
  created timestamptz;
  paid boolean;
BEGIN
  IF to_regprocedure('public.nuvia_staff_feature_open(uuid)') IS NOT NULL THEN
    RETURN public.nuvia_staff_feature_open(p_salon);
  END IF;

  SELECT to_jsonb(s) INTO row_json FROM public.salons s WHERE s.id = p_salon;
  IF row_json IS NULL THEN
    RETURN false;
  END IF;

  plan := lower(coalesce(row_json->>'plan', ''));
  status := lower(coalesce(row_json->>'subscription_status', ''));
  paid := plan IN ('pro', 'base') AND status IN ('active', 'trialing', 'past_due');
  IF paid THEN
    RETURN plan = 'pro';
  END IF;

  BEGIN
    trial_end := nullif(row_json->>'trial_ends_at', '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    trial_end := NULL;
  END;

  BEGIN
    created := nullif(row_json->>'created_at', '')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    created := NULL;
  END;

  IF trial_end IS NOT NULL THEN
    RETURN trial_end > now();
  END IF;
  IF created IS NOT NULL THEN
    RETURN created + interval '7 days' > now();
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.nuvia_pro_feature_open(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_pro_feature_open(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nuvia_pro_feature_open(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.nuvia_guard_auto_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := '';
BEGIN
  IF NEW.auto_reminders IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.auto_reminders IS TRUE THEN
    RETURN NEW;
  END IF;

  BEGIN
    jwt_role := coalesce(auth.role(), auth.jwt() ->> 'role', '');
  EXCEPTION WHEN OTHERS THEN
    jwt_role := '';
  END;

  IF jwt_role = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF public.nuvia_pro_feature_open(NEW.id) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'REMINDER_PLAN_LOCKED: Disponibile nel piano PRO';
END;
$$;

REVOKE ALL ON FUNCTION public.nuvia_guard_auto_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nuvia_guard_auto_reminders() TO authenticated, service_role;

DROP TRIGGER IF EXISTS nuvia_guard_auto_reminders ON public.salons;
CREATE TRIGGER nuvia_guard_auto_reminders
  BEFORE INSERT OR UPDATE OF auto_reminders ON public.salons
  FOR EACH ROW
  EXECUTE FUNCTION public.nuvia_guard_auto_reminders();

-- Il client non può segnare un promemoria come inviato, né anticipare l'ancora.
-- Lo spostamento di data o ora azzera l'invio e ricalcola l'ancora: se la nuova visita
-- è ancora oltre le 26 ore, il cron ne manderà un altro; se è più vicina, non parte.
CREATE OR REPLACE FUNCTION public.nuvia_guard_appointment_reminder()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  jwt_role text := '';
  privileged boolean := false;
BEGIN
  -- Lo alzano solo nuvia_claim_due_reminders e nuvia_release_reminder_claim.
  -- Il client REST non può eseguire set_config prima dell'UPDATE.
  IF coalesce(current_setting('nuvia.allow_reminder_claim', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  BEGIN
    jwt_role := coalesce(auth.role(), auth.jwt() ->> 'role', '');
  EXCEPTION WHEN OTHERS THEN
    jwt_role := '';
  END;

  privileged := jwt_role = 'service_role'
    OR current_user IN ('postgres', 'supabase_admin', 'service_role');

  IF privileged THEN
    IF TG_OP = 'INSERT' AND NEW.reminder_anchor_at IS NULL THEN
      NEW.reminder_anchor_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.reminder_sent_at := NULL;
    NEW.reminder_email := NULL;
    NEW.reminder_claim_id := NULL;
    IF NEW.reminder_anchor_at IS NULL OR NEW.reminder_anchor_at < now() - interval '5 minutes' THEN
      NEW.reminder_anchor_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.appointment_date IS DISTINCT FROM OLD.appointment_date
     OR NEW.start_time IS DISTINCT FROM OLD.start_time THEN
    NEW.reminder_sent_at := NULL;
    NEW.reminder_email := NULL;
    NEW.reminder_claim_id := NULL;
    NEW.reminder_anchor_at := now();
    RETURN NEW;
  END IF;

  NEW.reminder_sent_at := OLD.reminder_sent_at;
  NEW.reminder_email := OLD.reminder_email;
  NEW.reminder_claim_id := OLD.reminder_claim_id;
  NEW.reminder_anchor_at := OLD.reminder_anchor_at;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.nuvia_guard_appointment_reminder() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nuvia_guard_appointment_reminder() TO authenticated, service_role;

DROP TRIGGER IF EXISTS nuvia_guard_appointment_reminder ON public.appointments;
CREATE TRIGGER nuvia_guard_appointment_reminder
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.nuvia_guard_appointment_reminder();

CREATE OR REPLACE FUNCTION public.nuvia_claim_due_reminders(p_limit integer DEFAULT 40)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lim integer := greatest(1, least(coalesce(p_limit, 40), 50));
  result jsonb;
BEGIN
  PERFORM set_config('nuvia.allow_reminder_claim', '1', true);

  WITH due AS (
    SELECT
      a.id,
      nullif(btrim(c.email), '') AS client_email
    FROM public.appointments AS a
    INNER JOIN public.salons AS s ON s.id = a.salon_id
    INNER JOIN public.clients AS c
      ON c.id::text = a.client_id::text
     AND c.salon_id = a.salon_id
    WHERE a.reminder_sent_at IS NULL
      AND s.auto_reminders IS TRUE
      AND public.nuvia_pro_feature_open(s.id)
      AND a.appointment_date IS NOT NULL
      AND a.start_time IS NOT NULL
      AND nullif(btrim(c.email), '') IS NOT NULL
      AND btrim(c.email) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      AND lower(btrim(coalesce(a.status, ''))) NOT IN (
        'annullato',
        'cancellato',
        'cancelled',
        'canceled',
        'no-show',
        'no_show',
        'noshow',
        'no show',
        'completato',
        'completed'
      )
      AND (a.appointment_date::date + a.start_time::time) AT TIME ZONE 'Europe/Rome'
          >= now() + interval '22 hours'
      AND (a.appointment_date::date + a.start_time::time) AT TIME ZONE 'Europe/Rome'
          < now() + interval '26 hours'
      AND (a.appointment_date::date + a.start_time::time) AT TIME ZONE 'Europe/Rome'
          - coalesce(a.reminder_anchor_at, now()) >= interval '26 hours'
      AND now() - coalesce(a.reminder_anchor_at, now()) >= interval '1 hour'
    ORDER BY a.appointment_date, a.start_time, a.id
    LIMIT lim
    FOR UPDATE OF a SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.appointments AS a
    SET reminder_sent_at = now(),
        reminder_claim_id = gen_random_uuid(),
        reminder_email = due.client_email
    FROM due
    WHERE a.id = due.id
      AND a.reminder_sent_at IS NULL
    RETURNING a.*
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', claimed.id::text,
    'claim_id', claimed.reminder_claim_id,
    'client_name', coalesce(claimed.client_name, 'Cliente'),
    'client_email', claimed.reminder_email,
    'service_names', nullif(btrim(coalesce(claimed.service_names, '')), ''),
    'appointment_date', to_char(claimed.appointment_date::date, 'YYYY-MM-DD'),
    'start_time', to_char(claimed.start_time::time, 'HH24:MI'),
    'staff_name', nullif(btrim(coalesce(claimed.staff_name, '')), ''),
    'salon_name', coalesce(s.name, 'Salone'),
    'salon_email', nullif(btrim(coalesce(s.email, '')), ''),
    'address', nullif(btrim(coalesce(s.address, '')), ''),
    'city', nullif(btrim(coalesce(s.city, '')), '')
  ) ORDER BY claimed.appointment_date, claimed.start_time, claimed.id), '[]'::jsonb)
  INTO result
  FROM claimed
  INNER JOIN public.salons AS s ON s.id = claimed.salon_id;

  RETURN coalesce(result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_release_reminder_claim(p_id text, p_claim_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_id uuid;
BEGIN
  PERFORM set_config('nuvia.allow_reminder_claim', '1', true);

  UPDATE public.appointments
  SET reminder_sent_at = NULL,
      reminder_email = NULL,
      reminder_claim_id = NULL
  WHERE id::text = p_id
    AND reminder_claim_id = p_claim_id
  RETURNING id INTO updated_id;

  RETURN updated_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.nuvia_claim_due_reminders(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_release_reminder_claim(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_claim_due_reminders(integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.nuvia_release_reminder_claim(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nuvia_claim_due_reminders(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.nuvia_release_reminder_claim(text, uuid) TO service_role;

COMMENT ON FUNCTION public.nuvia_claim_due_reminders(integer) IS
  'Segna come in invio i promemoria email dovuti. Solo service role. Non invia nulla da sola.';
COMMENT ON FUNCTION public.nuvia_release_reminder_claim(text, uuid) IS
  'Annulla un claim se Brevo non ha accettato il messaggio. Solo service role.';

-- Cron orario. Se pg_cron o pg_net non sono attivi, il resto della migration resta valido.
DO $$
DECLARE
  existing bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'Promemoria: abilita pg_cron e pg_net (Database → Extensions), poi riesegui questo file per creare il cron orario.';
    RETURN;
  END IF;

  SELECT jobid INTO existing
  FROM cron.job
  WHERE jobname = 'nuvia-appointment-reminders';

  IF existing IS NOT NULL THEN
    PERFORM cron.unschedule(existing);
  END IF;

  PERFORM cron.schedule(
    'nuvia-appointment-reminders',
    '15 * * * *',
    $cmd$
    DO $job$
    DECLARE
      secret text;
    BEGIN
      SELECT decrypted_secret INTO secret
      FROM vault.decrypted_secrets
      WHERE name = 'nuvia_reminder_cron_secret'
      LIMIT 1;

      IF secret IS NULL OR length(secret) < 16 THEN
        RETURN;
      END IF;

      PERFORM net.http_post(
        url := 'https://izbhxyhepzwsgobtihfc.supabase.co/functions/v1/send-appointment-reminders',
        body := '{"source":"cron"}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-reminder-secret', secret
        ),
        timeout_milliseconds := 60000
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'nuvia reminder cron: %', SQLERRM;
    END
    $job$;
    $cmd$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Promemoria: cron non schedulato (%). Colonne e funzioni restano attive. Riesegui questo file dopo pg_cron e pg_net.', SQLERRM;
END $$;
