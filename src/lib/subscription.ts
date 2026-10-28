import { SubscriptionPlan } from '../types';

const TRIAL_FEATURES = [
  'Accesso completo a tutte le funzioni',
  '7 giorni di prova gratuita inclusi',
  'Agenda appuntamenti e calendario',
  'Anagrafica clienti e messaggi WhatsApp',
];

/** Seed PRO from data.ts / demo defaults — not a real paid subscription. */
export function isDefaultSeedSubscription(sub?: SubscriptionPlan | null): boolean {
  if (!sub) return true;
  if (sub.trialEndsAt) return false;
  const name = (sub.name || '').trim();
  const isProName = name === 'PRO (Mensile)' || name === 'Piano Pro';
  return (
    isProName &&
    sub.status === 'Attivo' &&
    sub.price === 69 &&
    (sub.paymentMethod?.last4 === '4242' ||
      sub.nextRenewalDate === '15 Novembre' ||
      sub.renewalFullDate === '15 Novembre 2026')
  );
}

function formatItalianDate(d: Date): string {
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isTrialStatus(status: SubscriptionPlan['status'] | undefined): boolean {
  return status === 'trial' || status === 'In prova';
}

function parseEndDate(sub: SubscriptionPlan): number | null {
  if (sub.trialEndsAt) {
    const t = Date.parse(sub.trialEndsAt);
    if (!Number.isNaN(t)) return t;
  }
  for (const raw of [sub.renewalFullDate, sub.nextRenewalDate]) {
    if (!raw) continue;
    const iso = Date.parse(raw);
    if (!Number.isNaN(iso)) return iso;
    // Italian-ish long dates are not reliably parseable cross-browser; skip.
  }
  return null;
}

/** 7-day BASE trial starting at `now`. */
export function createTrialSubscription(now: Date = new Date()): SubscriptionPlan {
  const end = new Date(now.getTime());
  end.setDate(end.getDate() + 7);
  const trialEndsAt = end.toISOString();
  const italian = formatItalianDate(end);
  return {
    id: `sub-trial-${now.getTime()}`,
    name: 'BASE (7gg di Prova)',
    price: 0,
    interval: 'mese',
    status: 'trial',
    nextRenewalDate: italian,
    renewalFullDate: italian,
    trialEndsAt,
    features: [...TRIAL_FEATURES],
    paymentMethod: {
      brand: 'Prova Gratuita',
      last4: '0000',
      expiry: '7gg',
    },
    invoices: [],
  };
}

/**
 * If an old trial has no trialEndsAt, migrate once to now+7.
 * Returns the (possibly updated) subscription and whether it changed.
 */
export function migrateTrialEndsAtIfNeeded(
  sub: SubscriptionPlan,
  now: Date = new Date()
): { subscription: SubscriptionPlan; changed: boolean } {
  if (!isTrialStatus(sub.status) || sub.trialEndsAt) {
    return { subscription: sub, changed: false };
  }
  const end = new Date(now.getTime());
  end.setDate(end.getDate() + 7);
  const trialEndsAt = end.toISOString();
  const italian = formatItalianDate(end);
  return {
    subscription: {
      ...sub,
      trialEndsAt,
      nextRenewalDate: sub.nextRenewalDate || italian,
      renewalFullDate: sub.renewalFullDate || italian,
    },
    changed: true,
  };
}

/** Attivo / In scadenza ok; trial only while trialEndsAt (or parseable end) is in the future. */
export function isSubscriptionCurrentlyValid(sub?: SubscriptionPlan | null): boolean {
  if (!sub) return false;
  const status = sub.status;
  if (status === 'Scaduto' || status === 'Annullato') return false;
  if (status === 'Attivo' || status === 'In scadenza') return true;
  if (isTrialStatus(status)) {
    const endMs = parseEndDate(sub);
    if (endMs == null) return false;
    return Date.now() < endMs;
  }
  return false;
}

/** If trial is past end, return status Scaduto; otherwise unchanged. */
export function expireSubscriptionIfNeeded(
  sub: SubscriptionPlan,
  now: Date = new Date()
): SubscriptionPlan {
  if (!isTrialStatus(sub.status)) return sub;
  const endMs = parseEndDate(sub);
  if (endMs == null) {
    // No end date after migration path — treat as expired for safety
    return { ...sub, status: 'Scaduto' };
  }
  if (now.getTime() >= endMs) {
    return { ...sub, status: 'Scaduto' };
  }
  return sub;
}

/**
 * Normalize subscription on load: migrate old trials, then expire if past end.
 */
export function normalizeSubscriptionOnLoad(
  sub: SubscriptionPlan | undefined | null,
  now: Date = new Date()
): { subscription: SubscriptionPlan | undefined; changed: boolean } {
  if (!sub) return { subscription: undefined, changed: false };
  const migrated = migrateTrialEndsAtIfNeeded(sub, now);
  const expired = expireSubscriptionIfNeeded(migrated.subscription, now);
  const changed =
    migrated.changed ||
    expired.status !== migrated.subscription.status ||
    expired.trialEndsAt !== migrated.subscription.trialEndsAt;
  return { subscription: expired, changed };
}
