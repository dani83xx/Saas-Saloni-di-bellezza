-- Accesso operatori Nuvia (solo piano PRO, prova di 7 giorni inclusa).
-- Il cloud agent NON applica questo file: incollalo nel SQL Editor di Supabase ed eseguilo.
-- Si può rieseguire. Non rinomina tabelle. Non tocca prezzi né chiavi Stripe.
--
-- Gli operatori sono utenti Supabase Auth (email/password, recupero password come i titolari).
-- Il collegamento al salone è public.salon_users (ruolo operator o admin) + public.staff.auth_user_id.
-- La creazione dell'utente usa la signUp pubblica (anon key), come il titolare: la service role
-- non viene mai inviata al browser.
--
-- Dopo il merge, prova:
-- 1) Con piano PRO o trial attivo, da Impostazioni il titolare crea un operatore (nome, email, password).
-- 2) Esci e accedi con quell'email: vedi agenda e clienti, non la voce Abbonamento.
-- 3) Con piano BASE (subscription_status active/trialing/past_due e plan = base, oppure prova scaduta)
--    la creazione è rifiutata e il login operatore resta bloccato.
-- 4) Controlla le policy:
--    SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE schemaname = 'public' AND tablename IN ('staff','appointments','clients','services','salon_users')
--    ORDER BY 1, 2;

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS access_role text NOT NULL DEFAULT 'operator',
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS login_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_access_role_check;
ALTER TABLE public.staff
  ADD CONSTRAINT staff_access_role_check
  CHECK (access_role IN ('operator', 'admin'));

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_auth_user_id_fkey;
ALTER TABLE public.staff
  ADD CONSTRAINT staff_auth_user_id_fkey
  FOREIGN KEY (auth_user_id) REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS staff_auth_user_id_unique
  ON public.staff (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS staff_salon_email_unique
  ON public.staff (salon_id, lower(email))
  WHERE email IS NOT NULL AND length(btrim(email)) > 0;

COMMENT ON COLUMN public.staff.access_role IS 'operator = agenda/clienti/cassa. admin = come il titolare, senza abbonamento.';
COMMENT ON COLUMN public.staff.auth_user_id IS 'auth.users.id dell''accesso personale. Nullo se il nominativo è solo in agenda.';
COMMENT ON COLUMN public.staff.login_enabled IS 'true solo se il titolare ha creato le credenziali. Non basta l''email in anagrafica.';

-- Stessa regola di src/lib/plan.ts resolvePlanAccessFromBilling.
-- Pagato: plan base|pro e status active|trialing|past_due.
-- Altrimenti prova su trial_ends_at, oppure created_at + 7 giorni.
-- Senza alcuna data non si blocca il salone.
CREATE OR REPLACE FUNCTION public.nuvia_staff_feature_open(p_salon uuid)
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

CREATE OR REPLACE FUNCTION public.nuvia_can_access_salon(p_salon text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.salon_users su
    WHERE su.id = auth.uid()
      AND su.salon_id::text = p_salon
      AND (
        coalesce(su.role, 'owner') = 'owner'
        OR (
          coalesce(su.role, 'owner') IN ('admin', 'operator', 'staff')
          AND public.nuvia_staff_feature_open(su.salon_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.nuvia_is_salon_manager(p_salon text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.salon_users su
    WHERE su.id = auth.uid()
      AND su.salon_id::text = p_salon
      AND coalesce(su.role, 'owner') IN ('owner', 'admin')
      AND (
        coalesce(su.role, 'owner') = 'owner'
        OR public.nuvia_staff_feature_open(su.salon_id)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.nuvia_staff_feature_open(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_can_access_salon(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_is_salon_manager(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nuvia_staff_feature_open(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nuvia_can_access_salon(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nuvia_is_salon_manager(text) TO authenticated;

-- Il titolare non può auto-promuoversi da operatore, e un operatore non può
-- riscrivere ruolo o salone. claim_staff_membership alza nuvia.allow_role_change.
CREATE OR REPLACE FUNCTION public.nuvia_guard_salon_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := '';
  account_kind text := '';
BEGIN
  IF coalesce(current_setting('nuvia.allow_role_change', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  BEGIN
    jwt_role := coalesce(auth.role(), auth.jwt() ->> 'role', '');
    account_kind := coalesce(auth.jwt() -> 'user_metadata' ->> 'account_kind', '');
  EXCEPTION WHEN OTHERS THEN
    jwt_role := '';
    account_kind := '';
  END;

  IF jwt_role = 'service_role' OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Operazione non consentita';
    END IF;
    IF account_kind = 'staff' THEN
      RAISE EXCEPTION 'Account operatore non collegato. Chiedi al titolare di creare l''accesso.';
    END IF;
    NEW.role := 'owner';
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.salon_id IS DISTINCT FROM OLD.salon_id THEN
    RAISE EXCEPTION 'Non puoi modificare ruolo o salone';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nuvia_guard_salon_user_role ON public.salon_users;
CREATE TRIGGER nuvia_guard_salon_user_role
  BEFORE INSERT OR UPDATE ON public.salon_users
  FOR EACH ROW
  EXECUTE FUNCTION public.nuvia_guard_salon_user_role();

-- Operatore: niente modifica scheda salone. Admin sì, ma il trigger di fatturazione
-- già impedisce di riscrivere le colonne Stripe / piano.
CREATE OR REPLACE FUNCTION public.nuvia_block_operator_salon_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  jwt_role text := '';
BEGIN
  BEGIN
    jwt_role := coalesce(auth.role(), auth.jwt() ->> 'role', '');
  EXCEPTION WHEN OTHERS THEN
    jwt_role := '';
  END;

  IF jwt_role = 'service_role' OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(role, 'owner') INTO caller_role
  FROM public.salon_users
  WHERE id = auth.uid();

  IF caller_role IN ('operator', 'staff') THEN
    RAISE EXCEPTION 'Solo il titolare può modificare i dati del salone';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nuvia_block_operator_salon_update ON public.salons;
CREATE TRIGGER nuvia_block_operator_salon_update
  BEFORE UPDATE ON public.salons
  FOR EACH ROW
  EXECUTE FUNCTION public.nuvia_block_operator_salon_update();

CREATE OR REPLACE FUNCTION public.nuvia_guard_staff_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
  jwt_role text := '';
BEGIN
  IF coalesce(current_setting('nuvia.allow_role_change', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  BEGIN
    jwt_role := coalesce(auth.role(), auth.jwt() ->> 'role', '');
  EXCEPTION WHEN OTHERS THEN
    jwt_role := '';
  END;

  IF jwt_role = 'service_role' OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(role, 'owner') INTO caller_role
  FROM public.salon_users
  WHERE id = auth.uid()
    AND salon_id = NEW.salon_id;

  IF caller_role IS NULL OR caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permesso negato';
  END IF;

  IF NOT public.nuvia_staff_feature_open(NEW.salon_id) THEN
    RAISE EXCEPTION 'STAFF_PLAN_LOCKED: Disponibile nel piano PRO';
  END IF;

  IF caller_role = 'admin' THEN
    IF TG_OP = 'INSERT' AND (NEW.auth_user_id IS NOT NULL OR NEW.login_enabled IS TRUE) THEN
      RAISE EXCEPTION 'Solo il titolare può creare gli accessi';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id
      OR NEW.login_enabled IS DISTINCT FROM OLD.login_enabled
      OR NEW.access_role IS DISTINCT FROM OLD.access_role
    ) THEN
      RAISE EXCEPTION 'Solo il titolare può gestire gli accessi';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nuvia_guard_staff_write ON public.staff;
CREATE TRIGGER nuvia_guard_staff_write
  BEFORE INSERT OR UPDATE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.nuvia_guard_staff_write();

CREATE OR REPLACE FUNCTION public.nuvia_revoke_staff_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.auth_user_id IS NULL THEN
    RETURN OLD;
  END IF;
  PERFORM set_config('nuvia.allow_role_change', '1', true);
  DELETE FROM public.salon_users
  WHERE id = OLD.auth_user_id
    AND salon_id = OLD.salon_id
    AND coalesce(role, 'owner') IN ('operator', 'admin', 'staff');
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS nuvia_revoke_staff_on_delete ON public.staff;
CREATE TRIGGER nuvia_revoke_staff_on_delete
  BEFORE DELETE ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.nuvia_revoke_staff_on_delete();

-- Chiamata dall'utente appena entrato. Non crea saloni.
-- Collega solo una riga staff con auth_user_id uguale, oppure login_enabled e stessa email.
CREATE OR REPLACE FUNCTION public.claim_staff_membership()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  user_email text;
  existing public.salon_users%ROWTYPE;
  staff_row public.staff%ROWTYPE;
  next_role text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato';
  END IF;

  user_email := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));

  SELECT * INTO existing FROM public.salon_users WHERE id = uid;
  IF FOUND AND coalesce(existing.role, 'owner') = 'owner' THEN
    RETURN jsonb_build_object(
      'salon_id', existing.salon_id,
      'role', 'owner',
      'full_name', existing.full_name
    );
  END IF;

  IF FOUND AND coalesce(existing.role, 'owner') IN ('operator', 'admin', 'staff') THEN
    IF EXISTS (
      SELECT 1 FROM public.staff
      WHERE auth_user_id = uid AND active IS NOT TRUE
    ) AND NOT EXISTS (
      SELECT 1 FROM public.staff
      WHERE auth_user_id = uid AND active IS TRUE
    ) THEN
      RAISE EXCEPTION 'STAFF_DISABLED: Accesso operatore disattivato';
    END IF;
    IF NOT public.nuvia_staff_feature_open(existing.salon_id) THEN
      RAISE EXCEPTION 'STAFF_PLAN_LOCKED: Disponibile nel piano PRO';
    END IF;
    RETURN jsonb_build_object(
      'salon_id', existing.salon_id,
      'role', CASE WHEN existing.role = 'admin' THEN 'admin' ELSE 'operator' END,
      'full_name', existing.full_name
    );
  END IF;

  SELECT * INTO staff_row
  FROM public.staff
  WHERE active IS TRUE
    AND (
      auth_user_id = uid
      OR (
        auth_user_id IS NULL
        AND login_enabled IS TRUE
        AND user_email <> ''
        AND lower(btrim(coalesce(email, ''))) = user_email
      )
    )
  ORDER BY (auth_user_id = uid) DESC, created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF NOT public.nuvia_staff_feature_open(staff_row.salon_id) THEN
    RAISE EXCEPTION 'STAFF_PLAN_LOCKED: Disponibile nel piano PRO';
  END IF;

  next_role := CASE WHEN staff_row.access_role = 'admin' THEN 'admin' ELSE 'operator' END;
  PERFORM set_config('nuvia.allow_role_change', '1', true);

  INSERT INTO public.salon_users (id, salon_id, role, full_name, email)
  VALUES (uid, staff_row.salon_id, next_role, staff_row.name, nullif(user_email, ''))
  ON CONFLICT (id) DO UPDATE
    SET salon_id = EXCLUDED.salon_id,
        role = EXCLUDED.role,
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;

  UPDATE public.staff
  SET auth_user_id = uid
  WHERE id = staff_row.id
    AND (auth_user_id IS NULL OR auth_user_id = uid);

  RETURN jsonb_build_object(
    'salon_id', staff_row.salon_id,
    'role', next_role,
    'full_name', staff_row.name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_staff_membership() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_staff_membership() TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_staff_invite(p_salon uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Accesso non autorizzato';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.salon_users
    WHERE id = auth.uid()
      AND salon_id = p_salon
      AND coalesce(role, 'owner') = 'owner'
  ) THEN
    RAISE EXCEPTION 'Solo il titolare può creare gli accessi operatori';
  END IF;
  IF NOT public.nuvia_staff_feature_open(p_salon) THEN
    RAISE EXCEPTION 'STAFF_PLAN_LOCKED: Disponibile nel piano PRO';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_staff_invite(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_staff_invite(uuid) TO authenticated;

-- Lettura team: chiunque lavori nel salone (se la feature è aperta per i non titolari).
DROP POLICY IF EXISTS staff_select_member ON public.staff;
CREATE POLICY staff_select_member
  ON public.staff FOR SELECT TO authenticated
  USING (public.nuvia_can_access_salon(salon_id::text));

DROP POLICY IF EXISTS staff_insert_admin ON public.staff;
CREATE POLICY staff_insert_admin
  ON public.staff FOR INSERT TO authenticated
  WITH CHECK (public.nuvia_is_salon_manager(salon_id::text));

DROP POLICY IF EXISTS staff_update_admin ON public.staff;
CREATE POLICY staff_update_admin
  ON public.staff FOR UPDATE TO authenticated
  USING (public.nuvia_is_salon_manager(salon_id::text))
  WITH CHECK (public.nuvia_is_salon_manager(salon_id::text));

DROP POLICY IF EXISTS staff_delete_admin ON public.staff;
CREATE POLICY staff_delete_admin
  ON public.staff FOR DELETE TO authenticated
  USING (public.nuvia_is_salon_manager(salon_id::text));

-- Agenda, clienti: il membro vede solo il proprio salone.
-- Il titolare entra anche con piano BASE. Operatore e admin solo con feature staff aperta.
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nuvia_appointments_member_all ON public.appointments;
CREATE POLICY nuvia_appointments_member_all
  ON public.appointments FOR ALL TO authenticated
  USING (public.nuvia_can_access_salon(salon_id::text))
  WITH CHECK (public.nuvia_can_access_salon(salon_id::text));

DROP POLICY IF EXISTS nuvia_clients_member_all ON public.clients;
CREATE POLICY nuvia_clients_member_all
  ON public.clients FOR ALL TO authenticated
  USING (public.nuvia_can_access_salon(salon_id::text))
  WITH CHECK (public.nuvia_can_access_salon(salon_id::text));

DROP POLICY IF EXISTS nuvia_services_member_select ON public.services;
CREATE POLICY nuvia_services_member_select
  ON public.services FOR SELECT TO authenticated
  USING (public.nuvia_can_access_salon(salon_id::text));

DROP POLICY IF EXISTS nuvia_services_manager_insert ON public.services;
CREATE POLICY nuvia_services_manager_insert
  ON public.services FOR INSERT TO authenticated
  WITH CHECK (public.nuvia_is_salon_manager(salon_id::text));

DROP POLICY IF EXISTS nuvia_services_manager_update ON public.services;
CREATE POLICY nuvia_services_manager_update
  ON public.services FOR UPDATE TO authenticated
  USING (public.nuvia_is_salon_manager(salon_id::text))
  WITH CHECK (public.nuvia_is_salon_manager(salon_id::text));

DROP POLICY IF EXISTS nuvia_services_manager_delete ON public.services;
CREATE POLICY nuvia_services_manager_delete
  ON public.services FOR DELETE TO authenticated
  USING (public.nuvia_is_salon_manager(salon_id::text));
