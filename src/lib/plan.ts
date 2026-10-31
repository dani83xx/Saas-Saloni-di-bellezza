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
  if (access.tier === 'pro') return true;
  return !PRO_ONLY.has(feature);
}

export function usePlan(sub?: SubscriptionPlan | null) {
  return useMemo(() => {
    const access = resolvePlanAccess(sub);
    return {
      ...access,
      hasFeature: (feature: PlanFeature) => hasFeature(sub, feature),
    };
  }, [sub]);
}
