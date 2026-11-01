/** Price ID Stripe di test. Unica mappa usata dalle Edge Functions. */
export const STRIPE_PRICE_IDS = {
  base: {
    mese: 'price_1UWtw2FoM4I9wzRcCxs1O8aY',
    anno: 'price_1UWuHNFoM4I9wzRcNh8kZ1Sn',
  },
  pro: {
    mese: 'price_1UWtxCFoM4I9wzRc8Fri9T7i',
    anno: 'price_1UWuTjFoM4I9wzRc68LYs0k7',
  },
} as const;

export type StripePlanId = keyof typeof STRIPE_PRICE_IDS;
export type StripeInterval = 'mese' | 'anno';

export function stripePriceId(planId: string, interval: string): string | null {
  const plan = STRIPE_PRICE_IDS[planId as StripePlanId];
  if (!plan) return null;
  return plan[interval as StripeInterval] ?? null;
}

export function planFromStripePrice(priceId: string): { plan: StripePlanId; interval: StripeInterval } | null {
  for (const plan of Object.keys(STRIPE_PRICE_IDS) as StripePlanId[]) {
    for (const interval of ['mese', 'anno'] as StripeInterval[]) {
      if (STRIPE_PRICE_IDS[plan][interval] === priceId) return { plan, interval };
    }
  }
  return null;
}
