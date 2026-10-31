-- Staff roster and salon logos for Nuvia.
-- Safe to re-run. Does not rename existing tables.
-- appointments.staff_id is left unchanged (text in this app) so legacy ids can be rewritten to staff uuids.

ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS logo_url text;

CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id uuid NOT NULL REFERENCES public.salons (id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'Collaboratore',
  color text NOT NULL DEFAULT 'purple',
  phone text,
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS staff_salon_id_idx ON public.staff (salon_id);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_select_owner ON public.staff;
DROP POLICY IF EXISTS staff_insert_owner ON public.staff;
DROP POLICY IF EXISTS staff_update_owner ON public.staff;
DROP POLICY IF EXISTS staff_delete_owner ON public.staff;

-- Same salon_users membership check as salons, limited to the owner.
-- coalesce(role, 'owner') keeps older owner rows that never stored a role.
CREATE POLICY staff_select_owner
  ON public.staff FOR SELECT TO authenticated
  USING (
    salon_id IN (
      SELECT salon_id FROM public.salon_users
      WHERE id = auth.uid()
        AND coalesce(role, 'owner') = 'owner'
    )
  );

CREATE POLICY staff_insert_owner
  ON public.staff FOR INSERT TO authenticated
  WITH CHECK (
    salon_id IN (
      SELECT salon_id FROM public.salon_users
      WHERE id = auth.uid()
        AND coalesce(role, 'owner') = 'owner'
    )
  );

CREATE POLICY staff_update_owner
  ON public.staff FOR UPDATE TO authenticated
  USING (
    salon_id IN (
      SELECT salon_id FROM public.salon_users
      WHERE id = auth.uid()
        AND coalesce(role, 'owner') = 'owner'
    )
  )
  WITH CHECK (
    salon_id IN (
      SELECT salon_id FROM public.salon_users
      WHERE id = auth.uid()
        AND coalesce(role, 'owner') = 'owner'
    )
  );

CREATE POLICY staff_delete_owner
  ON public.staff FOR DELETE TO authenticated
  USING (
    salon_id IN (
      SELECT salon_id FROM public.salon_users
      WHERE id = auth.uid()
        AND coalesce(role, 'owner') = 'owner'
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('salon-logos', 'salon-logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS salon_logos_public_read ON storage.objects;
DROP POLICY IF EXISTS salon_logos_insert_owner ON storage.objects;
DROP POLICY IF EXISTS salon_logos_update_owner ON storage.objects;
DROP POLICY IF EXISTS salon_logos_delete_owner ON storage.objects;

CREATE POLICY salon_logos_public_read
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'salon-logos');

CREATE POLICY salon_logos_insert_owner
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'salon-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT salon_id::text FROM public.salon_users
      WHERE id = auth.uid()
        AND coalesce(role, 'owner') = 'owner'
    )
  );

CREATE POLICY salon_logos_update_owner
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'salon-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT salon_id::text FROM public.salon_users
      WHERE id = auth.uid()
        AND coalesce(role, 'owner') = 'owner'
    )
  )
  WITH CHECK (
    bucket_id = 'salon-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT salon_id::text FROM public.salon_users
      WHERE id = auth.uid()
        AND coalesce(role, 'owner') = 'owner'
    )
  );

CREATE POLICY salon_logos_delete_owner
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'salon-logos'
    AND (storage.foldername(name))[1] IN (
      SELECT salon_id::text FROM public.salon_users
      WHERE id = auth.uid()
        AND coalesce(role, 'owner') = 'owner'
    )
  );
