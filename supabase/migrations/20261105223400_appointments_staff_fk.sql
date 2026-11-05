-- appointments.staff_id deve riferirsi a public.staff(id), non a salon_users(id).
-- L'app salva l'uuid della scheda collaboratore. salon_users.id è l'utente auth:
-- con la FK vecchia l'insert falliva e l'appuntamento restava solo in memoria.
-- Si può rieseguire. Non tocca le policy RLS, non rinomina tabelle e non cambia lo schema dello staff.
-- Il cloud agent NON applica questo file: eseguilo nel SQL Editor di Supabase dopo il merge.

DO $appointments_staff_fk$
DECLARE
  fk_name text;
  staff_fk_ok boolean;
BEGIN
  -- Togli la FK solo se punta ancora a salon_users (anche con un nome diverso).
  FOR fk_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace
    WHERE c.contype = 'f'
      AND nsp.nspname = 'public'
      AND rel.relname = 'appointments'
      AND ref_ns.nspname = 'public'
      AND ref.relname = 'salon_users'
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) AS cols(attnum)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = cols.attnum
        WHERE a.attname = 'staff_id'
          AND NOT a.attisdropped
      )
  LOOP
    EXECUTE format('ALTER TABLE public.appointments DROP CONSTRAINT %I', fk_name);
  END LOOP;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_class ref ON ref.oid = c.confrelid
    JOIN pg_namespace ref_ns ON ref_ns.oid = ref.relnamespace
    WHERE c.contype = 'f'
      AND c.conname = 'appointments_staff_id_fkey'
      AND nsp.nspname = 'public'
      AND rel.relname = 'appointments'
      AND ref_ns.nspname = 'public'
      AND ref.relname = 'staff'
      AND c.confdeltype = 'n'
      AND EXISTS (
        SELECT 1
        FROM unnest(c.conkey) AS cols(attnum)
        JOIN pg_attribute a
          ON a.attrelid = c.conrelid
         AND a.attnum = cols.attnum
        WHERE a.attname = 'staff_id'
          AND NOT a.attisdropped
      )
  ) INTO staff_fk_ok;

  IF NOT staff_fk_ok THEN
    ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_staff_id_fkey;
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_staff_id_fkey
      FOREIGN KEY (staff_id) REFERENCES public.staff (id) ON DELETE SET NULL;
  END IF;
END
$appointments_staff_fk$;

COMMENT ON CONSTRAINT appointments_staff_id_fkey ON public.appointments IS
  'Scheda collaboratore (public.staff.id). Non è salon_users.id, che è l''utente auth.';
