import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { stripePriceId } from '../_shared/pricing.ts';
import { stripeForm } from '../_shared/stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Metodo non consentito' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
    if (!stripeKey) return jsonResponse({ error: 'STRIPE_SECRET_KEY non configurata' }, 500);

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: 'Accesso non autorizzato' }, 401);

    const body = await req.json().catch(() => ({}));
    const planId = String(body.planId || '');
    const interval = String(body.interval || '');
    const priceId = stripePriceId(planId, interval);
    if (!priceId) return jsonResponse({ error: 'Piano non valido' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: member, error: memberError } = await admin
      .from('salon_users')
      .select('salon_id, role')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (memberError || !member?.salon_id) return jsonResponse({ error: 'Salone non trovato' }, 404);
    if (member.role && member.role !== 'owner') return jsonResponse({ error: 'Solo il titolare può abbonarsi' }, 403);

    const { data: salon, error: salonError } = await admin
      .from('salons')
      .select('id, name, email, stripe_customer_id')
      .eq('id', member.salon_id)
      .maybeSingle();
    if (salonError || !salon) return jsonResponse({ error: 'Salone non trovato' }, 404);

    let customerId = salon.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripeForm(stripeKey, 'POST', 'customers', {
        email: (salon.email as string) || userData.user.email || '',
        name: (salon.name as string) || 'Salone Nuvia',
        'metadata[salon_id]': salon.id as string,
      });
      customerId = String(customer.id);
      const { error: saveError } = await admin
        .from('salons')
        .update({ stripe_customer_id: customerId })
        .eq('id', salon.id);
      if (saveError) return jsonResponse({ error: saveError.message }, 500);
    }

    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || '';
    if (!origin) return jsonResponse({ error: 'APP_URL non configurato' }, 500);
    const base = origin.replace(/\/$/, '');

    const session = await stripeForm(stripeKey, 'POST', 'checkout/sessions', {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${base}/?billing=success`,
      cancel_url: `${base}/?billing=cancel`,
      client_reference_id: salon.id as string,
      'metadata[salon_id]': salon.id as string,
      'subscription_data[metadata][salon_id]': salon.id as string,
      billing_address_collection: 'required',
      'tax_id_collection[enabled]': 'true',
      'customer_update[address]': 'auto',
      'customer_update[name]': 'auto',
      'automatic_tax[enabled]': 'false',
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore imprevisto';
    return jsonResponse({ error: message }, 500);
  }
});
