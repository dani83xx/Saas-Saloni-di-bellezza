-- Ambito operatore: solo i propri appuntamenti e i clienti collegati.
-- Il cloud agent NON applica questo file: incollalo nel SQL Editor di Supabase ed eseguilo.
-- Si può rieseguire. Non rinomina tabelle. Non tocca prezzi né chiavi Stripe.
-- Owner e admin restano sul salone intero. Il ruolo operator (e il legacy staff) no.
-- I servizi restano leggibili: servono per prenotare.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_by_staff_id uuid;

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_created_by_fkey'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_created_by_staff_id_fkey'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_created_by_staff_id_fkey
      FOREIGN KEY (created_by_staff_id) REFERENCES public.staff (id) ON DELETE SET NULL;
  END IF;
END
$fk$;

CREATE INDEX IF NOT EXISTS clients_created_by_staff_idx
  ON public.clients (created_by_staff_id);

CREATE INDEX IF NOT EXISTS appointments_salon_staff_client_idx
  ON public.appointments (salon_id, staff_id, client_id);

COMMENT ON COLUMN public.clients.created_by IS 'auth.users.id di chi ha inserito il cliente.';
COMMENT ON COLUMN public.clients.created_by_staff_id IS 'Scheda staff di chi ha inserito il cliente, se è un operatore.';
COMMENT ON COLUMN public.staff.access_role IS 'operator = solo i propri appuntamenti e clienti. admin = come il titolare, senza abbonamento.';

-- Scheda staff collegata all'utente che sta chiamando. Null se non è un operatore.
CREATE OR REPLACE FUNCTION public.nuvia_operator_staff_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.staff s
  JOIN public.salon_users su ON su.id = auth.uid() AND su.salon_id = s.salon_id
  WHERE s.auth_user_id = auth.uid()
    AND s.active IS NOT FALSE
    AND coalesce(su.role, 'owner') IN ('operator', 'staff')
    AND public.nuvia_staff_feature_open(s.salon_id)
  ORDER BY s.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.nuvia_appointment_visible(p_salon text, p_staff_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.nuvia_can_access_salon(p_salon)
    AND (
      public.nuvia_is_salon_manager(p_salon)
      OR (
        public.nuvia_operator_staff_id() IS NOT NULL
        AND p_staff_id IS NOT NULL
        AND p_staff_id = public.nuvia_operator_staff_id()::text
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.nuvia_client_visible(
  p_salon text,
  p_client uuid,
  p_phone text,
  p_created_by uuid,
  p_created_by_staff uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.nuvia_can_access_salon(p_salon) THEN false
    WHEN public.nuvia_is_salon_manager(p_salon) THEN true
    WHEN public.nuvia_operator_staff_id() IS NULL THEN false
    WHEN p_created_by = auth.uid() OR p_created_by_staff = public.nuvia_operator_staff_id() THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.salon_id::text = p_salon
        AND a.staff_id = public.nuvia_operator_staff_id()::text
        AND (
          a.client_id = p_client
          OR (
            length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 6
            AND regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g')
              = regexp_replace(p_phone, '\D', '', 'g')
          )
        )
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.nuvia_operator_staff_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_appointment_visible(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nuvia_client_visible(text, uuid, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nuvia_operator_staff_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.nuvia_appointment_visible(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nuvia_client_visible(text, uuid, text, uuid, uuid) TO authenticated;

-- In inserimento l'appuntamento dell'operatore è sempre il suo.
-- In modifica non può riassegnarlo a un altro collaboratore.
CREATE OR REPLACE FUNCTION public.nuvia_force_operator_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := '';
  staff_row public.staff%ROWTYPE;
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
  IF public.nuvia_operator_staff_id() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO staff_row
  FROM public.staff
  WHERE id = public.nuvia_operator_staff_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operatore senza scheda personale';
  END IF;

  NEW.staff_id := staff_row.id::text;
  NEW.staff_name := staff_row.name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nuvia_force_operator_appointment ON public.appointments;
CREATE TRIGGER nuvia_force_operator_appointment
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.nuvia_force_operator_appointment();

-- Il cliente creato dall'operatore resta suo anche prima del primo appuntamento.
CREATE OR REPLACE FUNCTION public.nuvia_stamp_operator_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text := '';
  staff_id uuid;
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

  staff_id := public.nuvia_operator_staff_id();
  IF staff_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_by_staff_id := staff_id;
    RETURN NEW;
  END IF;

  NEW.created_by := OLD.created_by;
  NEW.created_by_staff_id := OLD.created_by_staff_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nuvia_stamp_operator_client ON public.clients;
CREATE TRIGGER nuvia_stamp_operator_client
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.nuvia_stamp_operator_client();

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nuvia_appointments_member_all ON public.appointments;
CREATE POLICY nuvia_appointments_member_all
  ON public.appointments FOR ALL TO authenticated
  USING (public.nuvia_appointment_visible(salon_id::text, staff_id::text))
  WITH CHECK (public.nuvia_appointment_visible(salon_id::text, staff_id::text));

DROP POLICY IF EXISTS nuvia_clients_member_all ON public.clients;
CREATE POLICY nuvia_clients_member_all
  ON public.clients FOR ALL TO authenticated
  USING (public.nuvia_client_visible(salon_id::text, id, phone, created_by, created_by_staff_id))
  WITH CHECK (public.nuvia_client_visible(salon_id::text, id, phone, created_by, created_by_staff_id));

-- Select servizi: owner, admin e operator del salone (serve per prenotare).
DROP POLICY IF EXISTS nuvia_services_member_select ON public.services;
CREATE POLICY nuvia_services_member_select
  ON public.services FOR SELECT TO authenticated
  USING (public.nuvia_can_access_salon(salon_id::text));
