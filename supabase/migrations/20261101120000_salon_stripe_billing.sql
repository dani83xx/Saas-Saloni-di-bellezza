-- Fatturazione Stripe su public.salons.
-- Non applicata da questo ambiente: incollala nel SQL Editor di Supabase.
-- Idempotente: si può eseguire anche se 20261031220000_salon_plan.sql è già stato applicato.

ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS plan_interval text,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz;

ALTER TABLE public.salons
  ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '7 days');

ALTER TABLE public.salons
  DROP CONSTRAINT IF EXISTS salons_plan_check;

ALTER TABLE public.salons
  ADD CONSTRAINT salons_plan_check
  CHECK (plan IS NULL OR plan IN ('base', 'pro'));

ALTER TABLE public.salons
  DROP CONSTRAINT IF EXISTS salons_plan_interval_check;

ALTER TABLE public.salons
  ADD CONSTRAINT salons_plan_interval_check
  CHECK (plan_interval IS NULL OR plan_interval IN ('mese', 'anno'));

COMMENT ON COLUMN public.salons.plan IS 'base o pro. Lo scrive solo il service role (webhook Stripe).';
COMMENT ON COLUMN public.salons.plan_interval IS 'mese o anno.';
COMMENT ON COLUMN public.salons.trial_ends_at IS 'Fine prova. Default now()+7 giorni. Se NULL, l''app usa created_at + 7 giorni.';
COMMENT ON COLUMN public.salons.subscription_status IS 'Stato Stripe: active, trialing, past_due, canceled, ...';
COMMENT ON COLUMN public.salons.stripe_customer_id IS 'cus_... creato al primo checkout.';
COMMENT ON COLUMN public.salons.stripe_subscription_id IS 'sub_... dell''abbonamento corrente.';
COMMENT ON COLUMN public.salons.current_period_end IS 'Fine del periodo pagato, da Stripe.';

-- I membri leggono il salone con la policy esistente salons_select_member.
-- Il trigger impedisce a un utente autenticato di riscrivere le colonne di fatturazione.
-- L'INSERT della prova resta consentito, ma non oltre 8 giorni e senza piano/Stripe.
CREATE OR REPLACE FUNCTION public.protect_salon_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  jwt_role text := '';
BEGIN
  BEGIN
    jwt_role := coalesce(auth.role(), auth.jwt() ->> 'role', '');
  EXCEPTION WHEN OTHERS THEN
    jwt_role := '';
  END;

  IF jwt_role = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.plan := NULL;
    NEW.plan_interval := NULL;
    NEW.subscription_status := NULL;
    NEW.stripe_customer_id := NULL;
    NEW.stripe_subscription_id := NULL;
    NEW.current_period_end := NULL;
    IF NEW.trial_ends_at IS NULL OR NEW.trial_ends_at > now() + interval '8 days' THEN
      NEW.trial_ends_at := now() + interval '7 days';
    END IF;
    RETURN NEW;
  END IF;

  NEW.plan := OLD.plan;
  NEW.plan_interval := OLD.plan_interval;
  NEW.subscription_status := OLD.subscription_status;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  NEW.current_period_end := OLD.current_period_end;
  IF OLD.trial_ends_at IS NOT NULL THEN
    NEW.trial_ends_at := OLD.trial_ends_at;
  ELSIF NEW.trial_ends_at IS NULL OR NEW.trial_ends_at > now() + interval '8 days' THEN
    NEW.trial_ends_at := now() + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_salon_billing_columns ON public.salons;
CREATE TRIGGER protect_salon_billing_columns
  BEFORE INSERT OR UPDATE ON public.salons
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_salon_billing_columns();
