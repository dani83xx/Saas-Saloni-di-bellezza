-- Piano commerciale del salone. Non applicata da questo ambiente.
-- Se plan e trial_ends_at sono NULL, l'app tratta il salone come in prova con accesso PRO.

ALTER TABLE public.salons
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS plan_interval text,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

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

COMMENT ON COLUMN public.salons.plan IS 'base o pro. NULL = nessun piano salvato: l''app concede l''accesso PRO.';
COMMENT ON COLUMN public.salons.plan_interval IS 'mese o anno. NULL finché non c''è un abbonamento pagato.';
COMMENT ON COLUMN public.salons.trial_ends_at IS 'Fine prova ISO. Se è nel futuro e plan è NULL, l''app concede il PRO.';
