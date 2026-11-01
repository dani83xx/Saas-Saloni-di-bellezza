import { useMemo } from 'react';
import { SubscriptionPlan } from '../types';
import { isDefaultSeedSubscription } from './subscription';

/** Funzioni presenti nell'app e riservate al piano PRO (o alla prova). */
export type PlanFeature =
  | 'staff_management'
  | 'stats'
  | 'noshow'
  | 'whatsapp_templates'
  | 'custom_logo';

export type PlanTier = 'base' | 'pro';
export type PlanSource = 'trial' | 'paid' | 'default';

export interface PlanAccess {
  tier: PlanTier;
  source: PlanSource;
  /** Giorni interi rimasti, solo se la prova ha una data di fine. */
  trialDaysLeft: number | null;
}

const PRO_ONLY = new Set<PlanFeature>([
  'staff_management',
  'stats',
  'noshow',
  'whatsapp_templates',
  'custom_logo',
]);

function trialDaysLeft(sub: SubscriptionPlan, now: number): number | null {
  if (!sub.trialEndsAt) return null;
  const end = Date.parse(sub.trialEndsAt);
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - now) / 86_400_000));
}

function isTrial(sub: SubscriptionPlan): boolean {
  return sub.status === 'trial' || sub.status === 'In prova';
}

function looksLikePro(sub: SubscriptionPlan): boolean {
  const name = (sub.name || '').toUpperCase();
  return name.includes('PRO') || sub.price === 69 || sub.price === 590;
}

function looksLikeBase(sub: SubscriptionPlan): boolean {
  const name = (sub.name || '').toUpperCase();
  return name.includes('BASE') || sub.price === 39 || sub.price === 390;
}

/**
 * Piano effettivo.
 * Senza un abbonamento reale (campo assente o solo dati demo) resta l'accesso PRO,
 * così i saloni già attivi non vengono bloccati prima che il piano sia salvato.
 */
export function resolvePlanAccess(sub?: SubscriptionPlan | null, now = Date.now()): PlanAccess {
  if (!sub || isDefaultSeedSubscription(sub)) {
    return { tier: 'pro', source: 'default', trialDaysLeft: null };
  }

  if (isTrial(sub)) {
    const days = trialDaysLeft(sub, now);
    if (days == null) {
      return { tier: 'pro', source: 'trial', trialDaysLeft: null };
    }
    if (days > 0 || Date.parse(sub.trialEndsAt || '') > now) {
      return { tier: 'pro', source: 'trial', trialDaysLeft: days };
    }
    return { tier: 'base', source: 'trial', trialDaysLeft: 0 };
  }

  if (sub.status === 'Attivo' || sub.status === 'In scadenza') {
    if (looksLikeBase(sub) && !looksLikePro(sub)) {
      return { tier: 'base', source: 'paid', trialDaysLeft: null };
    }
    return { tier: 'pro', source: 'paid', trialDaysLeft: null };
  }

  if (sub.status === 'Scaduto' || sub.status === 'Annullato') {
    return { tier: 'base', source: 'paid', trialDaysLeft: null };
  }

  return { tier: 'pro', source: 'default', trialDaysLeft: null };
}

export function hasFeature(sub: SubscriptionPlan | null | undefined, feature: PlanFeature, now = Date.now()): boolean {
  const access = resolvePlanAccess(sub, now);
  return accessAllows(access, feature);
}

const PAID_STATUSES = new Set(['active', 'trialing', 'past_due']);
const TRIAL_MS = 7 * 86_400_000;

/** Riga di fatturazione letta da public.salons. */
export interface SalonBilling {
  plan: string | null;
  planInterval: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  createdAt: string | null;
}

function accessAllows(access: PlanAccess, feature: PlanFeature): boolean {
  if (access.tier === 'pro') return true;
  return !PRO_ONLY.has(feature);
}

function parseTime(value: string | null): number {
  if (!value) return NaN;
  const time = Date.parse(value);
  return Number.isNaN(time) ? NaN : time;
}

/**
 * Piano letto dal database.
 * Abbonamento Stripe active/trialing/past_due usa plan base|pro.
 * Altrimenti la prova è trial_ends_at, oppure 7 giorni da created_at se la data è nulla.
 * Senza alcuna data non si blocca il salone.
 */
export function resolvePlanAccessFromBilling(billing: SalonBilling, now = Date.now()): PlanAccess {
  const plan = (billing.plan || '').toLowerCase();
  const status = (billing.subscriptionStatus || '').toLowerCase();
  if ((plan === 'pro' || plan === 'base') && PAID_STATUSES.has(status)) {
    return {
      tier: plan === 'base' ? 'base' : 'pro',
      source: 'paid',
      trialDaysLeft: null,
    };
  }

  const explicitEnd = parseTime(billing.trialEndsAt);
  const created = parseTime(billing.createdAt);
  const end = Number.isFinite(explicitEnd) ? explicitEnd : Number.isFinite(created) ? created + TRIAL_MS : NaN;
  if (!Number.isFinite(end)) {
    return { tier: 'pro', source: 'default', trialDaysLeft: null };
  }
  const days = Math.max(0, Math.ceil((end - now) / 86_400_000));
  if (end > now) {
    return { tier: 'pro', source: 'trial', trialDaysLeft: days };
  }
  return { tier: 'base', source: 'trial', trialDaysLeft: 0 };
}

export function usePlan(sub?: SubscriptionPlan | null, billing?: SalonBilling | null) {
  return useMemo(() => {
    const access = billing != null ? resolvePlanAccessFromBilling(billing) : resolvePlanAccess(sub);
    return {
      ...access,
      hasFeature: (feature: PlanFeature) => accessAllows(access, feature),
    };
  }, [sub, billing]);
}
