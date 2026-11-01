-- Piano commerciale del salone. Non applicata da questo ambiente.
-- Se hai già eseguito una versione precedente di questo file, esegui anche
-- supabase/migrations/20261101120000_salon_stripe_billing.sql.
-- Prova: trial_ends_at, oppure created_at + 7 giorni se la data è NULL.
-- Le colonne Stripe le scrive solo il service role (vedi il trigger nel file successivo).

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
