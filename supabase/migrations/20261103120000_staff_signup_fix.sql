-- Fix signup operatori. Già eseguito sul database: questo file è la copia nel repo.
-- Idempotente. Non rinomina tabelle. Non tocca prezzi né chiavi Stripe.
--
-- Prima: salon_users_role_check rifiutava i ruoli degli accessi, e
-- handle_new_salon_signup() creava un salone nuovo e rendeva owner
-- chiunque si registrasse, anche con raw_user_meta_data->>'account_kind' = 'staff'.
--
-- Ora:
-- 1) il vincolo accetta ('owner','admin','operator','staff')
-- 2) handle_new_salon_signup() esce subito per gli account staff, senza
--    toccare il resto del corpo (creazione salone del titolare).

ALTER TABLE public.salon_users DROP CONSTRAINT IF EXISTS salon_users_role_check;
ALTER TABLE public.salon_users
  ADD CONSTRAINT salon_users_role_check
  CHECK (role IN ('owner', 'admin', 'operator', 'staff'));

-- La funzione vive sul database (trigger su auth.users) e non era nel repo.
-- Si inserisce il ritorno anticipato nel corpo esistente, una sola volta.
DO $patch$
DECLARE
  src text;
  pos_as int;
  pos_begin int;
  guard text := E'\n  IF coalesce(NEW.raw_user_meta_data->>''account_kind'', '''') = ''staff'' THEN\n    RETURN NEW;\n  END IF;\n';
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'handle_new_salon_signup'
  ORDER BY p.oid
  LIMIT 1;

  IF src IS NULL THEN
    RAISE NOTICE 'handle_new_salon_signup assente: aggiornato solo salon_users_role_check';
    RETURN;
  END IF;

  IF src LIKE '%raw_user_meta_data->>''account_kind''%'
     AND src LIKE '%''staff''%'
     AND position('RETURN NEW' in src) > 0 THEN
    RETURN;
  END IF;

  pos_as := position('AS $' in src);
  IF pos_as = 0 THEN
    RAISE EXCEPTION 'handle_new_salon_signup: definizione inattesa, manca AS $';
  END IF;

  pos_begin := position('BEGIN' in upper(substr(src, pos_as)));
  IF pos_begin = 0 THEN
    RAISE EXCEPTION 'handle_new_salon_signup: BEGIN non trovato';
  END IF;
  pos_begin := pos_as + pos_begin - 1;

  EXECUTE substr(src, 1, pos_begin + 4) || guard || substr(src, pos_begin + 5);
END
$patch$;
