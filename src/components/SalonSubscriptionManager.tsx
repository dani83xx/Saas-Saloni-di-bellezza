import React, { useState } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  Sparkles,
  Clock,
  FileText,
} from 'lucide-react';
import { SubscriptionPlan } from '../types';
import { isDefaultSeedSubscription } from '../lib/subscription';
import { resolvePlanAccess, resolvePlanAccessFromBilling, type SalonBilling } from '../lib/plan';
import { STRIPE_PRICE_IDS } from '../lib/pricing';

export type BillingInterval = 'mese' | 'anno';
export type PaidPlanId = 'base' | 'pro';

/** Listino netto. Cambia solo questi numeri: risparmio ed equivalente mensile si ricalcolano. */
export const PLAN_PRICING = {
  /** Se true, i prezzi sono IVA esclusa e in UI compare "+ IVA" e la nota sotto. */
  vatExcluded: true,
  vatNote: 'Prezzi IVA esclusa',
  plans: [
    {
      id: 'base' as const,
      name: 'BASE',
      recommended: false,
      monthly: 39,
      annual: 390,
      stripePrice: STRIPE_PRICE_IDS.base,
      features: [
        'Appuntamenti illimitati e agenda calendario',
        'Anagrafica clienti completa con note tecniche',
        'Listino servizi e categorie personalizzabili',
        'Promemoria WhatsApp manuali',
      ],
    },
    {
      id: 'pro' as const,
      name: 'PRO',
      recommended: true,
      monthly: 69,
      annual: 590,
      stripePrice: STRIPE_PRICE_IDS.pro,
      features: [
        'Multi-collaboratore e gestione staff',
        'Statistiche, KPI e incassi',
        'Monitoraggio no-show e storico affidabilità cliente',
        'Template WhatsApp veloci e link recensioni Google',
        'Logo salone personalizzato',
      ],
    },
  ],
  /** Voci aggiunte solo quando il toggle è su Annuale. */
  annualExtras: ['Tariffa bloccata per 12 mesi'],
};

function formatEuroAmount(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function annualMonthlyLabel(annual: number): string {
  const perMonth = annual / 12;
  const nearest = Math.round(perMonth);
  if (Math.abs(perMonth - nearest) < 0.2) return `~${nearest} €/mese`;
  return `~${formatEuroAmount(perMonth)} €/mese`;
}

interface SalonSubscriptionManagerProps {
  subscription?: SubscriptionPlan;
  salonName: string;
  billing?: SalonBilling | null;
  showToast: (message: string) => void;
  onSelectPlan: (planId: PaidPlanId, interval: BillingInterval) => Promise<void> | void;
  onOpenPortal?: () => Promise<void> | void;
}

function formatIsoDate(iso?: string): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Date(time).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return Math.max(0, Math.ceil((time - Date.now()) / 86_400_000));
}

function isTrial(sub: SubscriptionPlan): boolean {
  return sub.status === 'trial' || sub.status === 'In prova';
}

export const SalonSubscriptionManager: React.FC<SalonSubscriptionManagerProps> = ({
  subscription,
  salonName,
  billing = null,
  showToast,
  onSelectPlan,
  onOpenPortal,
}) => {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('mese');
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null);

  const choosePlan = async (planId: PaidPlanId, interval: BillingInterval) => {
    setBusy('checkout');
    try {
      await onSelectPlan(planId, interval);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossibile aprire il pagamento.';
      showToast(message);
      setBusy(null);
    }
  };

  const openPortal = async () => {
    if (!onOpenPortal) return;
    setBusy('portal');
    try {
      await onOpenPortal();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossibile aprire il portale.';
      showToast(message);
      setBusy(null);
    }
  };

  if (!subscription) {
    return (
      <div className="bg-white rounded-2xl border border-pink-100 p-6 space-y-2">
        <h3 className="font-bold text-[#1E1B2E]">Abbonamento</h3>
        <p className="text-sm text-slate-600">
          Nessun piano è associato a questo salone. I pagamenti online sono in arrivo: per ora non viene
          addebitato nulla.
        </p>
      </div>
    );
  }

  const trial = isTrial(subscription);
  const expired = subscription.status === 'Scaduto' || subscription.status === 'Annullato';
  const demoSeed = !billing && isDefaultSeedSubscription(subscription);
  const access = billing ? resolvePlanAccessFromBilling(billing) : resolvePlanAccess(subscription);
  const billingStatus = (billing?.subscriptionStatus || '').toLowerCase();
  const paidStatuses = new Set(['active', 'trialing', 'past_due']);
  const hasCustomer = !!billing?.stripeCustomerId;
  const subscribed = hasCustomer && paidStatuses.has(billingStatus);
  const trialEndLabel = billing
    ? formatIsoDate(billing.trialEndsAt) || (billing.createdAt
      ? formatIsoDate(new Date(Date.parse(billing.createdAt) + 7 * 86_400_000).toISOString())
      : null)
    : formatIsoDate(subscription.trialEndsAt) || subscription.renewalFullDate;
  const remaining = billing
    ? access.source === 'trial'
      ? access.trialDaysLeft
      : null
    : trial
      ? daysUntil(subscription.trialEndsAt)
      : null;
  const upgradeStatus = access.source === 'trial' && remaining != null
    ? remaining === 0
      ? 'Sei in prova gratuita: termina oggi'
      : remaining === 1
        ? 'Sei in prova gratuita: 1 giorno rimasto'
        : `Sei in prova gratuita: ${remaining} giorni rimasti`
    : access.source === 'trial'
      ? 'Sei in prova gratuita'
      : access.source === 'paid'
        ? billingStatus === 'past_due'
          ? 'Pagamento da aggiornare. L’accesso resta attivo.'
          : `Piano ${access.tier === 'pro' ? 'PRO' : 'BASE'} attivo.`
        : 'Nessun piano a pagamento è attivo.';

  const statusLabel = access.source === 'trial'
    ? 'In prova gratuita'
    : access.source === 'paid'
      ? billingStatus === 'past_due'
        ? 'Pagamento in ritardo'
        : 'Attivo'
      : expired
        ? subscription.status
        : demoSeed
          ? 'Dati dimostrativi'
          : subscription.status;

  const planTitle = access.source === 'paid'
    ? access.tier === 'pro' ? 'PRO' : 'BASE'
    : access.source === 'trial'
      ? 'PRO (prova)'
      : subscription.name;
  const renewalLabel = formatIsoDate(billing?.currentPeriodEnd || undefined);
  const listPrice = access.tier === 'pro' ? PLAN_PRICING.plans[1] : PLAN_PRICING.plans[0];
  const intervalLabel = billing?.planInterval === 'anno' ? 'anno' : 'mese';
  const shownPrice = access.source === 'paid'
    ? `${intervalLabel === 'anno' ? listPrice.annual : listPrice.monthly} € / ${intervalLabel}`
    : '0 € — nessun addebito';

  const statusClass = expired
    ? 'bg-rose-50 text-rose-800 border-rose-200'
    : 'bg-emerald-50 text-emerald-800 border-emerald-200';

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-white via-pink-50/20 to-purple-50/20 rounded-2xl border border-pink-100 shadow-sm p-5 md:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-pink-100/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E95F8F] to-[#8B5CF6] text-white flex items-center justify-center shadow-sm">
                <CreditCard className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-[#1E1B2E] text-base md:text-lg">Abbonamento Salone</h3>
            </div>
            <p className="text-sm text-slate-600">
              Piano e prova gratuita per {salonName}. Il pagamento si apre su Stripe.
            </p>
          </div>
          {hasCustomer && (
            <button
              type="button"
              onClick={openPortal}
              disabled={busy !== null}
              className="px-3.5 py-2 rounded-xl border border-[#8B5CF6] text-[#8B5CF6] text-xs font-bold disabled:opacity-60"
            >
              {busy === 'portal' ? 'Apertura...' : 'Gestisci abbonamento'}
            </button>
          )}
          <div className={`inline-flex items-center gap-2 border px-3.5 py-1.5 rounded-full text-xs font-bold self-start sm:self-auto ${statusClass}`}>
            <span className={`w-2 h-2 rounded-full ${expired ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            <span>{statusLabel}</span>
          </div>
        </div>

        {demoSeed && (
          <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Questo è il piano dimostrativo del salone demo. Non corrisponde a un pagamento reale.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/90 p-4 rounded-xl border border-pink-100/70 space-y-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
              Piano corrente
            </span>
            <p className="text-lg font-black text-[#1E1B2E]">{planTitle}</p>
            <p className="text-sm font-semibold text-[#E95F8F]">
              {shownPrice}
              {access.source === 'paid' && PLAN_PRICING.vatExcluded ? ' + IVA' : ''}
            </p>
          </div>

          <div className="bg-white/90 p-4 rounded-xl border border-pink-100/70 space-y-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
              Stato
            </span>
            <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {access.source === 'paid' && renewalLabel
                ? `Rinnovo il ${renewalLabel}`
                : access.source === 'trial' && trialEndLabel
                  ? `Prova fino al ${trialEndLabel}`
                  : expired
                    ? 'Prova o piano non più attivo'
                    : 'Nessun rinnovo automatico'}
            </p>
            {remaining != null && (
              <p className="text-xs text-slate-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {remaining === 0 ? 'Termina oggi' : `${remaining} giorn${remaining === 1 ? 'o' : 'i'} rimanenti`}
              </p>
            )}
          </div>

          <div className="bg-white/90 p-4 rounded-xl border border-pink-100/70 space-y-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
              Pagamento
            </span>
            <p className="text-sm font-bold text-slate-800">
              {subscribed ? 'Gestito su Stripe' : 'Nessuna carta collegata'}
            </p>
            <p className="text-xs text-slate-600">
              {subscribed
                ? 'Fatture, carta e disdetta sono nel portale cliente.'
                : 'Attivando un piano verrai reindirizzato a Stripe. Nessun addebito prima del pagamento.'}
            </p>
          </div>
        </div>

        <div className="bg-white/80 rounded-xl p-4 border border-pink-50">
          <h4 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E95F8F]" />
            Cosa include il piano mostrato
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-700">
            {(access.tier === 'pro'
              ? [...PLAN_PRICING.plans[0].features, ...PLAN_PRICING.plans[1].features]
              : PLAN_PRICING.plans[0].features
            ).map((feat) => (
              <div key={feat} className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-pink-100 shadow-sm p-5 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h3 className="font-bold text-[#1E1B2E]">Passa a un piano a pagamento</h3>
            <p className="text-sm font-semibold text-[#8B5CF6]">{upgradeStatus}</p>
            <p className="text-xs text-slate-500">Verrai reindirizzato a Stripe per il pagamento.</p>
          </div>
          <div className="inline-flex bg-slate-100 p-1 rounded-xl text-xs font-bold self-start shrink-0" role="group" aria-label="Periodo di fatturazione">
            <button
              type="button"
              onClick={() => setBillingInterval('mese')}
              className={`px-3 py-1.5 rounded-lg transition ${
                billingInterval === 'mese' ? 'bg-white text-[#8B5CF6] shadow-sm' : 'text-slate-600'
              }`}
              aria-pressed={billingInterval === 'mese'}
            >
              Mensile
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval('anno')}
              className={`px-3 py-1.5 rounded-lg transition ${
                billingInterval === 'anno' ? 'bg-white text-[#8B5CF6] shadow-sm' : 'text-slate-600'
              }`}
              aria-pressed={billingInterval === 'anno'}
            >
              Annuale
            </button>
          </div>
        </div>

        {PLAN_PRICING.vatExcluded && (
          <p className="text-xs text-slate-500">{PLAN_PRICING.vatNote}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLAN_PRICING.plans.map((plan) => {
            const yearlyList = plan.monthly * 12;
            const savings = yearlyList - plan.annual;
            const priceLabel = billingInterval === 'mese'
              ? `${formatEuroAmount(plan.monthly)} €/mese`
              : `${formatEuroAmount(plan.annual)} €/anno`;
            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-4 space-y-3 ${
                  plan.recommended
                    ? 'border-[#8B5CF6] ring-2 ring-[#8B5CF6]/25 bg-purple-50/50'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                {plan.recommended && (
                  <span className="absolute -top-2.5 right-3 text-[11px] font-bold uppercase tracking-wide bg-[#8B5CF6] text-white px-2 py-0.5 rounded-full">
                    Consigliato
                  </span>
                )}
                <p className="font-bold text-sm text-slate-900">{plan.name}</p>
                <div>
                  <p className="text-lg font-black text-[#8B5CF6] leading-tight">
                    {priceLabel}
                    {PLAN_PRICING.vatExcluded ? <span className="text-xs font-semibold text-slate-500"> + IVA</span> : null}
                  </p>
                  {billingInterval === 'anno' && (
                    <p className="text-xs text-slate-600 mt-1">
                      {annualMonthlyLabel(plan.annual)} · Risparmi {formatEuroAmount(savings)} € rispetto a {formatEuroAmount(yearlyList)} €
                    </p>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {plan.id === 'pro' && (
                    <li className="text-sm font-semibold text-[#1E1B2E]">Tutto il BASE, più:</li>
                  )}
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  {billingInterval === 'anno' && PLAN_PRICING.annualExtras.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={busy !== null || (subscribed && billing?.plan === plan.id && billing?.planInterval === billingInterval)}
                  onClick={() => choosePlan(plan.id, billingInterval)}
                  className="w-full mt-1 px-3 py-2 rounded-xl bg-[#1E1B2E] text-white text-xs font-bold disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
                >
                  {busy === 'checkout'
                    ? 'Reindirizzamento...'
                    : subscribed && billing?.plan === plan.id && billing?.planInterval === billingInterval
                      ? 'Piano attuale'
                      : 'Attiva piano'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-pink-100 shadow-sm p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div className="space-y-2 min-w-0">
          <h3 className="font-bold text-sm text-[#1E1B2E]">Fatture</h3>
          {hasCustomer ? (
            <>
              <p className="text-sm text-slate-600">
                Le fatture e le ricevute sono nel portale Stripe.
              </p>
              <button
                type="button"
                onClick={openPortal}
                disabled={busy !== null}
                className="px-3 py-2 rounded-xl bg-[#8B5CF6] text-white text-xs font-bold disabled:opacity-60"
              >
                {busy === 'portal' ? 'Apertura...' : 'Apri fatture nel portale'}
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Ancora nessuna fattura. Quando attiverai un piano, i documenti saranno nel portale Stripe.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
