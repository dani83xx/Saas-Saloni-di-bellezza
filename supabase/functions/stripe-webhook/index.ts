import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { planFromStripePrice } from '../_shared/pricing.ts';
import { stripeForm, verifyStripeSignature } from '../_shared/stripe.ts';

type StripeObject = Record<string, any>;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Metodo non consentito', { status: 405 });

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!secret || !stripeKey || !serviceKey) return new Response('Segreti mancanti', { status: 500 });

  const payload = await req.text();
  const signature = req.headers.get('stripe-signature') ?? '';
  const valid = await verifyStripeSignature(payload, signature, secret);
  if (!valid) return new Response('Firma non valida', { status: 400 });

  const event = JSON.parse(payload) as { type: string; data: { object: StripeObject } };
  const admin = createClient(supabaseUrl, serviceKey);
  const object = event.data.object;

  try {
    if (event.type === 'checkout.session.completed') {
      const subscriptionId = typeof object.subscription === 'string' ? object.subscription : '';
      const salonId = object.metadata?.salon_id || object.client_reference_id;
      if (subscriptionId) {
        const subscription = await stripeForm(stripeKey, 'GET', `subscriptions/${subscriptionId}`);
        await saveSubscription(admin, subscription, salonId);
      } else if (salonId && object.customer) {
        await admin.from('salons').update({ stripe_customer_id: object.customer }).eq('id', salonId);
      }
    } else if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      await saveSubscription(admin, object, object.metadata?.salon_id);
    } else if (event.type === 'customer.subscription.deleted') {
      const customerId = idOf(object.customer);
      const patch = {
        plan: null,
        subscription_status: 'canceled',
        stripe_subscription_id: object.id,
        current_period_end: periodEnd(object),
      };
      if (object.metadata?.salon_id) {
        await admin.from('salons').update(patch).eq('id', object.metadata.salon_id);
      } else if (customerId) {
        await admin.from('salons').update(patch).eq('stripe_customer_id', customerId);
      }
    } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
      const customerId = idOf(object.customer);
      if (customerId) {
        await admin
          .from('salons')
          .update({ subscription_status: event.type === 'invoice.paid' ? 'active' : 'past_due' })
          .eq('stripe_customer_id', customerId);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore webhook';
    return new Response(message, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

function unixToIso(value: unknown): string | null {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function idOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'id' in value && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return '';
}

function periodEnd(subscription: StripeObject): string | null {
  return unixToIso(subscription.current_period_end) || unixToIso(subscription.items?.data?.[0]?.current_period_end);
}

async function saveSubscription(admin: ReturnType<typeof createClient>, subscription: StripeObject, salonId?: string) {
  const priceId = subscription.items?.data?.[0]?.price?.id as string | undefined;
  const mapped = priceId ? planFromStripePrice(priceId) : null;
  const customerId = idOf(subscription.customer);
  const patch: Record<string, unknown> = {
    subscription_status: subscription.status || null,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId || null,
    current_period_end: periodEnd(subscription),
  };
  if (mapped) {
    patch.plan = mapped.plan;
    patch.plan_interval = mapped.interval;
  }

  if (salonId) {
    const { error } = await admin.from('salons').update(patch).eq('id', salonId);
    if (error) throw new Error(error.message);
    return;
  }
  if (!customerId) return;
  const { error } = await admin.from('salons').update(patch).eq('stripe_customer_id', customerId);
  if (error) throw new Error(error.message);
}
