-- Fix: infinite recursion in RLS for public.salon_users
-- Symptom: after Google OAuth, session exists but app stays on Accedi because
-- ensureSalonForAuthUser queries salon_users/salons and gets 42P17.

-- 1) Inspect
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies WHERE tablename IN ('salon_users','salons') ORDER BY 1,2;

-- 2) Remove ALL existing policies on these two tables (recreate clean)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('salon_users', 'salons')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 3) salon_users: never self-reference in policy expressions
ALTER TABLE public.salon_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY salon_users_select_own
  ON public.salon_users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY salon_users_insert_own
  ON public.salon_users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY salon_users_update_own
  ON public.salon_users FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 4) salons: member access via salon_users (safe: does not recurse into salons from salon_users)
ALTER TABLE public.salons ENABLE ROW LEVEL SECURITY;

CREATE POLICY salons_select_member
  ON public.salons FOR SELECT TO authenticated
  USING (id IN (SELECT salon_id FROM public.salon_users WHERE id = auth.uid()));

CREATE POLICY salons_update_member
  ON public.salons FOR UPDATE TO authenticated
  USING (id IN (SELECT salon_id FROM public.salon_users WHERE id = auth.uid()));

CREATE POLICY salons_insert_authenticated
  ON public.salons FOR INSERT TO authenticated
  WITH CHECK (true);
