-- Promemoria WhatsApp automatici, separati dalle email.
-- Il cloud agent NON applica questo file e NON chiama Meta.
-- Si può rieseguire. Non modifica il cron delle email né i prezzi Stripe.
--
-- Mittente MVP: un solo numero WhatsApp Business di Nuvia (Cloud API).
-- Non è Embedded Signup e nessun salone ha un proprio Phone Number ID.
-- I token non stanno in questa migration e non stanno in tabelle leggibili dal salone.
--
-- Opt-in: nessuna riga di consenso viene creata per i clienti già presenti.
-- Il consenso si registra solo con nuvia_record_whatsapp_consent (owner/admin),
-- con fonte obbligatoria, orario e numero normalizzato. La revoca è un nuovo evento.
--
-- Finestra: la stessa delle email, Europe/Rome, circa 24 ore (tra 22 e 26 ore),
-- prenotazione o ultimo spostamento almeno 26 ore prima e almeno 1 ora fa.
-- Lo stato WhatsApp non legge né scrive reminder_sent_at dell'email.

ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS whatsapp_reminders_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_sender_ready boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.salons.whatsapp_reminders_enabled IS
  'Intenzione del titolare/admin. Default spento. Il client non può metterlo a true: lo fa solo la service role dopo il controllo Meta.';
COMMENT ON COLUMN public.salons.whatsapp_sender_ready IS
  'true solo dopo che la Edge Function ha visto i segreti e un template utility APPROVED. Non contiene token. Mittente unico Nuvia, non il numero del salone.';

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_status text,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_claim_id uuid,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_to text,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_wamid text,
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent_at timestamptz;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_whatsapp_reminder_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_whatsapp_reminder_status_check
  CHECK (
    whatsapp_reminder_status IS NULL
    OR whatsapp_reminder_status IN ('claimed', 'sent', 'rejected', 'ambiguous')
  );

COMMENT ON COLUMN public.appointments.whatsapp_reminder_status IS
  'claimed = preso in carico; sent = Meta ha restituito un wamid; rejected = rifiuto definitivo del destinatario; ambiguous = timeout o risposta senza id, non si riprova.';
COMMENT ON COLUMN public.appointments.whatsapp_reminder_wamid IS
  'Id messaggio Meta, solo dopo un 200 con messages[0].id. Non è un token.';

CREATE TABLE IF NOT EXISTS public.whatsapp_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons (id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  action text NOT NULL,
  source text NOT NULL,
  consented_phone text NOT NULL,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_consent_events_action_check CHECK (action IN ('granted', 'revoked')),
  CONSTRAINT whatsapp_consent_events_source_check CHECK (char_length(btrim(source)) BETWEEN 3 AND 200)
);

CREATE INDEX IF NOT EXISTS whatsapp_consent_events_client_idx
  ON public.whatsapp_consent_events (salon_id, client_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS appointments_whatsapp_reminder_unsent_idx
  ON public.appointments (appointment_date, start_time)
  WHERE whatsapp_reminder_status IS NULL;

ALTER TABLE public.whatsapp_consent_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_consent_select_member ON public.whatsapp_consent_events;
CREATE POLICY whatsapp_consent_select_member
  ON public.whatsapp_consent_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.salon_users su
      WHERE su.id = auth.uid()
        AND su.salon_id = whatsapp_consent_events.salon_id
    )
  );

REVOKE ALL ON public.whatsapp_consent_events FROM PUBLIC;
GRANT SELECT ON public.whatsapp_consent_events TO authenticated;
GRANT ALL ON public.whatsapp_consent_events TO service_role;

-- Stesse regole del normalizzatore TypeScript normalizeWhatsAppPhone.
CREATE OR REPLACE FUNCTION public.nuvia_whatsapp_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  raw text := btrim(coalesce(p_phone, ''));
  has_plus boolean := left(raw, 1) = '+';
  digits text;
BEGIN
  digits := regexp_replace(raw, '\D', '', 'g');
  IF digits = '' THEN
    RETURN NULL;
  END IF;
  IF digits LIKE '00%' THEN
    digits := substring(digits FROM 3);
  END IF;
  IF NOT has_plus AND NOT (digits LIKE '39%' AND length(digits) >= 11) THEN
    digits := '39' || digits;
  END IF;
  IF digits !~ '^[1-9][0-9]{9,14}$' THEN
    RETURN NULL;
  END IF;
  RETURN digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_whatsapp_skips_status(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(btrim(coalesce(p_status, ''))) IN (
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
  );
$$;

CREATE OR REPLACE FUNCTION public.nuvia_guard_whatsapp_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := '';
  privileged boolean := false;
BEGIN
  BEGIN
    jwt_role := coalesce(auth.role(), auth.jwt() ->> 'role', '');
  EXCEPTION WHEN OTHERS THEN
    jwt_role := '';
  END;

  privileged := jwt_role = 'service_role'
    OR (jwt_role = '' AND current_user IN ('postgres', 'supabase_admin', 'service_role'));

  IF TG_OP = 'INSERT' THEN
    IF NOT privileged THEN
      NEW.whatsapp_reminders_enabled := false;
      NEW.whatsapp_sender_ready := false;
    ELSIF NEW.whatsapp_reminders_enabled IS TRUE THEN
      IF NEW.whatsapp_sender_ready IS NOT TRUE THEN
        RAISE EXCEPTION 'WHATSAPP_NOT_CONFIGURED: Da configurare';
      END IF;
      IF NOT public.nuvia_pro_feature_open(NEW.id) THEN
        RAISE EXCEPTION 'REMINDER_PLAN_LOCKED: Disponibile nel piano PRO';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT privileged THEN
    NEW.whatsapp_sender_ready := OLD.whatsapp_sender_ready;
    IF NEW.whatsapp_reminders_enabled IS TRUE AND OLD.whatsapp_reminders_enabled IS NOT TRUE THEN
      RAISE EXCEPTION 'WHATSAPP_ENABLE_SERVER_ONLY: Da configurare';
    END IF;
    IF NEW.whatsapp_reminders_enabled IS DISTINCT FROM OLD.whatsapp_reminders_enabled
       AND NOT EXISTS (
         SELECT 1
         FROM public.salon_users su
         WHERE su.id = auth.uid()
           AND su.salon_id = NEW.id
           AND coalesce(su.role, 'owner') IN ('owner', 'admin')
       ) THEN
      RAISE EXCEPTION 'Permesso negato';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.whatsapp_reminders_enabled IS TRUE AND OLD.whatsapp_reminders_enabled IS NOT TRUE THEN
    IF NEW.whatsapp_sender_ready IS NOT TRUE THEN
      RAISE EXCEPTION 'WHATSAPP_NOT_CONFIGURED: Da configurare';
    END IF;
    IF NOT public.nuvia_pro_feature_open(NEW.id) THEN
      RAISE EXCEPTION 'REMINDER_PLAN_LOCKED: Disponibile nel piano PRO';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nuvia_guard_whatsapp_reminders ON public.salons;
CREATE TRIGGER nuvia_guard_whatsapp_reminders
  BEFORE INSERT OR UPDATE OF whatsapp_reminders_enabled, whatsapp_sender_ready
  ON public.salons
  FOR EACH ROW
  EXECUTE FUNCTION public.nuvia_guard_whatsapp_reminders();

-- Sostituisce il guard delle email aggiungendo le colonne WhatsApp.
-- Le email restano azzerate solo se cambia data o ora, come prima.
CREATE OR REPLACE FUNCTION public.nuvia_guard_appointment_reminder()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  jwt_role text := '';
  privileged boolean := false;
BEGIN
  IF coalesce(current_setting('nuvia.allow_reminder_claim', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  BEGIN
    jwt_role := coalesce(auth.role(), auth.jwt() ->> 'role', '');
  EXCEPTION WHEN OTHERS THEN
    jwt_role := '';
  END;

  -- Il JWT authenticated resta non privilegiato anche se la funzione gira come postgres.
  -- Il claim passa dal GUC nuvia.allow_reminder_claim, non da questo ramo.
  privileged := jwt_role = 'service_role'
    OR (jwt_role = '' AND current_user IN ('postgres', 'supabase_admin', 'service_role'));

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
    NEW.whatsapp_reminder_status := NULL;
    NEW.whatsapp_reminder_claim_id := NULL;
    NEW.whatsapp_reminder_to := NULL;
    NEW.whatsapp_reminder_wamid := NULL;
    NEW.whatsapp_reminder_sent_at := NULL;
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
    NEW.whatsapp_reminder_status := NULL;
    NEW.whatsapp_reminder_claim_id := NULL;
    NEW.whatsapp_reminder_to := NULL;
    NEW.whatsapp_reminder_wamid := NULL;
    NEW.whatsapp_reminder_sent_at := NULL;
    NEW.reminder_anchor_at := now();
    RETURN NEW;
  END IF;

  NEW.reminder_sent_at := OLD.reminder_sent_at;
  NEW.reminder_email := OLD.reminder_email;
  NEW.reminder_claim_id := OLD.reminder_claim_id;
  NEW.whatsapp_reminder_status := OLD.whatsapp_reminder_status;
  NEW.whatsapp_reminder_claim_id := OLD.whatsapp_reminder_claim_id;
  NEW.whatsapp_reminder_to := OLD.whatsapp_reminder_to;
  NEW.whatsapp_reminder_wamid := OLD.whatsapp_reminder_wamid;
  NEW.whatsapp_reminder_sent_at := OLD.whatsapp_reminder_sent_at;
  NEW.reminder_anchor_at := OLD.reminder_anchor_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_whatsapp_due(p_limit integer DEFAULT 40)
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
      public.nuvia_whatsapp_phone(c.phone) AS phone
    FROM public.appointments AS a
    INNER JOIN public.salons AS s ON s.id = a.salon_id
    INNER JOIN public.clients AS c
      ON c.id::text = a.client_id::text
     AND c.salon_id = a.salon_id
    WHERE a.whatsapp_reminder_status IS NULL
      AND s.whatsapp_reminders_enabled IS TRUE
      AND s.whatsapp_sender_ready IS TRUE
      AND public.nuvia_pro_feature_open(s.id)
      AND a.appointment_date IS NOT NULL
      AND a.start_time IS NOT NULL
      AND NOT public.nuvia_whatsapp_skips_status(a.status)
      AND public.nuvia_whatsapp_phone(c.phone) IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM (
          SELECT e.action, e.consented_phone
          FROM public.whatsapp_consent_events e
          WHERE e.salon_id = a.salon_id
            AND e.client_id = c.id
          ORDER BY e.created_at DESC, e.id DESC
          LIMIT 1
        ) latest
        WHERE latest.action = 'granted'
          AND latest.consented_phone = public.nuvia_whatsapp_phone(c.phone)
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
    SET whatsapp_reminder_status = 'claimed',
        whatsapp_reminder_claim_id = gen_random_uuid(),
        whatsapp_reminder_to = due.phone,
        whatsapp_reminder_wamid = NULL,
        whatsapp_reminder_sent_at = NULL
    FROM due
    WHERE a.id = due.id
      AND a.whatsapp_reminder_status IS NULL
    RETURNING a.*
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', claimed.id::text,
    'claim_id', claimed.whatsapp_reminder_claim_id,
    'client_name', coalesce(claimed.client_name, 'Cliente'),
    'phone', claimed.whatsapp_reminder_to,
    'service_names', nullif(btrim(coalesce(claimed.service_names, '')), ''),
    'appointment_date', to_char(claimed.appointment_date::date, 'YYYY-MM-DD'),
    'start_time', to_char(claimed.start_time::time, 'HH24:MI'),
    'salon_name', coalesce(s.name, 'Salone'),
    'salon_id', claimed.salon_id::text
  ) ORDER BY claimed.appointment_date, claimed.start_time, claimed.id), '[]'::jsonb)
  INTO result
  FROM claimed
  INNER JOIN public.salons AS s ON s.id = claimed.salon_id;

  RETURN coalesce(result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_recheck_whatsapp_reminder(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.appointments AS a
    INNER JOIN public.salons AS s ON s.id = a.salon_id
    INNER JOIN public.clients AS c
      ON c.id::text = a.client_id::text
     AND c.salon_id = a.salon_id
    WHERE a.id = p_id
      AND a.whatsapp_reminder_status = 'claimed'
      AND s.whatsapp_reminders_enabled IS TRUE
      AND s.whatsapp_sender_ready IS TRUE
      AND public.nuvia_pro_feature_open(s.id)
      AND NOT public.nuvia_whatsapp_skips_status(a.status)
      AND public.nuvia_whatsapp_phone(c.phone) IS NOT NULL
      AND public.nuvia_whatsapp_phone(c.phone) = a.whatsapp_reminder_to
      AND a.appointment_date IS NOT NULL
      AND a.start_time IS NOT NULL
      AND (a.appointment_date::date + a.start_time::time) AT TIME ZONE 'Europe/Rome'
          >= now() + interval '22 hours'
      AND (a.appointment_date::date + a.start_time::time) AT TIME ZONE 'Europe/Rome'
          < now() + interval '26 hours'
      AND EXISTS (
        SELECT 1
        FROM (
          SELECT e.action, e.consented_phone
          FROM public.whatsapp_consent_events e
          WHERE e.salon_id = a.salon_id
            AND e.client_id = c.id
          ORDER BY e.created_at DESC, e.id DESC
          LIMIT 1
        ) latest
        WHERE latest.action = 'granted'
          AND latest.consented_phone = a.whatsapp_reminder_to
      )
  ) INTO ok;
  RETURN coalesce(ok, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_release_whatsapp_reminder(p_id text, p_claim_id uuid)
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
  SET whatsapp_reminder_status = NULL,
      whatsapp_reminder_claim_id = NULL,
      whatsapp_reminder_to = NULL,
      whatsapp_reminder_wamid = NULL,
      whatsapp_reminder_sent_at = NULL
  WHERE id::text = p_id
    AND whatsapp_reminder_claim_id = p_claim_id
    AND whatsapp_reminder_status = 'claimed'
  RETURNING id INTO updated_id;
  RETURN updated_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_commit_whatsapp_reminder(p_id text, p_claim_id uuid, p_wamid text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_id uuid;
  wamid text := nullif(btrim(coalesce(p_wamid, '')), '');
BEGIN
  IF wamid IS NULL THEN
    RETURN false;
  END IF;
  PERFORM set_config('nuvia.allow_reminder_claim', '1', true);
  UPDATE public.appointments
  SET whatsapp_reminder_status = 'sent',
      whatsapp_reminder_wamid = wamid,
      whatsapp_reminder_sent_at = now()
  WHERE id::text = p_id
    AND whatsapp_reminder_claim_id = p_claim_id
    AND whatsapp_reminder_status = 'claimed'
  RETURNING id INTO updated_id;
  RETURN updated_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_finish_whatsapp_reminder(p_id text, p_claim_id uuid, p_outcome text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_id uuid;
BEGIN
  IF p_outcome NOT IN ('rejected', 'ambiguous') THEN
    RAISE EXCEPTION 'Esito non valido';
  END IF;
  PERFORM set_config('nuvia.allow_reminder_claim', '1', true);
  UPDATE public.appointments
  SET whatsapp_reminder_status = p_outcome,
      whatsapp_reminder_wamid = NULL,
      whatsapp_reminder_sent_at = NULL
  WHERE id::text = p_id
    AND whatsapp_reminder_claim_id = p_claim_id
    AND whatsapp_reminder_status = 'claimed'
  RETURNING id INTO updated_id;
  RETURN updated_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_set_whatsapp_reminders(p_salon uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := '';
BEGIN
  BEGIN
    jwt_role := coalesce(auth.role(), auth.jwt() ->> 'role', '');
  EXCEPTION WHEN OTHERS THEN
    jwt_role := '';
  END;
  IF jwt_role <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    RAISE EXCEPTION 'WHATSAPP_ENABLE_SERVER_ONLY: Da configurare';
  END IF;

  IF p_enabled IS TRUE THEN
    IF NOT public.nuvia_pro_feature_open(p_salon) THEN
      RAISE EXCEPTION 'REMINDER_PLAN_LOCKED: Disponibile nel piano PRO';
    END IF;
    UPDATE public.salons
    SET whatsapp_sender_ready = true,
        whatsapp_reminders_enabled = true
    WHERE id = p_salon;
    RETURN;
  END IF;

  UPDATE public.salons
  SET whatsapp_reminders_enabled = false
  WHERE id = p_salon;
END;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_record_whatsapp_consent(
  p_client_id uuid,
  p_action text,
  p_source text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  caller_role text;
  client_salon uuid;
  client_phone text;
  normalized text;
  clean_source text := btrim(coalesce(p_source, ''));
  inserted public.whatsapp_consent_events%ROWTYPE;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato';
  END IF;
  IF p_action NOT IN ('granted', 'revoked') THEN
    RAISE EXCEPTION 'Azione non valida';
  END IF;
  IF char_length(clean_source) < 3 OR char_length(clean_source) > 200 THEN
    RAISE EXCEPTION 'Indica dove è stato raccolto il consenso';
  END IF;

  SELECT c.salon_id, c.phone
  INTO client_salon, client_phone
  FROM public.clients c
  WHERE c.id = p_client_id;

  IF client_salon IS NULL THEN
    RAISE EXCEPTION 'Cliente non trovato';
  END IF;

  SELECT coalesce(su.role, 'owner')
  INTO caller_role
  FROM public.salon_users su
  WHERE su.id = caller
    AND su.salon_id = client_salon;

  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'WHATSAPP_CONSENT_DENIED: Permesso negato';
  END IF;

  IF p_action = 'granted' AND NOT public.nuvia_pro_feature_open(client_salon) THEN
    RAISE EXCEPTION 'REMINDER_PLAN_LOCKED: Disponibile nel piano PRO';
  END IF;

  normalized := public.nuvia_whatsapp_phone(client_phone);
  IF normalized IS NULL THEN
    RAISE EXCEPTION 'WHATSAPP_PHONE_INVALID: Numero non valido';
  END IF;

  INSERT INTO public.whatsapp_consent_events (
    salon_id, client_id, action, source, consented_phone, recorded_by
  )
  VALUES (client_salon, p_client_id, p_action, clean_source, normalized, caller)
  RETURNING * INTO inserted;

  RETURN jsonb_build_object(
    'id', inserted.id,
    'salon_id', inserted.salon_id,
    'client_id', inserted.client_id,
    'action', inserted.action,
    'source', inserted.source,
    'consented_phone', inserted.consented_phone,
    'recorded_by', inserted.recorded_by,
    'created_at', inserted.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.nuvia_whatsapp_phone(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_whatsapp_due(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_recheck_whatsapp_reminder(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_release_whatsapp_reminder(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_commit_whatsapp_reminder(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_finish_whatsapp_reminder(text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_set_whatsapp_reminders(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_record_whatsapp_consent(uuid, text, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.nuvia_whatsapp_due(integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.nuvia_recheck_whatsapp_reminder(uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.nuvia_release_whatsapp_reminder(text, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.nuvia_commit_whatsapp_reminder(text, uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.nuvia_finish_whatsapp_reminder(text, uuid, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.nuvia_set_whatsapp_reminders(uuid, boolean) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.nuvia_whatsapp_phone(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.nuvia_whatsapp_due(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.nuvia_recheck_whatsapp_reminder(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.nuvia_release_whatsapp_reminder(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.nuvia_commit_whatsapp_reminder(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.nuvia_finish_whatsapp_reminder(text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.nuvia_set_whatsapp_reminders(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.nuvia_record_whatsapp_consent(uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.nuvia_whatsapp_due(integer) IS
  'Riserva i promemoria WhatsApp dovuti. Non invia. Non tocca lo stato email. Solo service role.';
COMMENT ON FUNCTION public.nuvia_set_whatsapp_reminders(uuid, boolean) IS
  'Accende il canale solo per la service role e solo se il piano PRO è aperto. Il controllo del template Meta sta nella Edge Function, prima di questa chiamata.';

-- Cron separato da nuvia-appointment-reminders. Se le estensioni mancano, lo schema resta.
DO $$
DECLARE
  existing bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'WhatsApp: abilita pg_cron e pg_net, poi riesegui questo file per il cron orario.';
    RETURN;
  END IF;

  SELECT jobid INTO existing
  FROM cron.job
  WHERE jobname = 'nuvia-whatsapp-reminders';
  IF existing IS NOT NULL THEN
    PERFORM cron.unschedule(existing);
  END IF;

  PERFORM cron.schedule(
    'nuvia-whatsapp-reminders',
    '15 * * * *',
    $cmd$
    DO $job$
    DECLARE
      secret text;
    BEGIN
      SELECT decrypted_secret INTO secret
      FROM vault.decrypted_secrets
      WHERE name = 'nuvia_whatsapp_cron_secret'
      LIMIT 1;
      IF secret IS NULL OR length(secret) < 16 THEN
        RETURN;
      END IF;
      PERFORM net.http_post(
        url := 'https://izbhxyhepzwsgobtihfc.supabase.co/functions/v1/send-whatsapp-reminders',
        body := '{"source":"cron"}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-whatsapp-cron-secret', secret
        ),
        timeout_milliseconds := 60000
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'nuvia whatsapp cron: %', SQLERRM;
    END
    $job$;
    $cmd$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'WhatsApp: cron non schedulato (%). Tabelle e funzioni restano attive.', SQLERRM;
END $$;
