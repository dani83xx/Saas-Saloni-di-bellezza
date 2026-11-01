import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
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

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: member } = await admin
      .from('salon_users')
      .select('salon_id, role')
      .eq('id', userData.user.id)
      .maybeSingle();
    if (!member?.salon_id) return jsonResponse({ error: 'Salone non trovato' }, 404);
    if (member.role && member.role !== 'owner') return jsonResponse({ error: 'Solo il titolare può gestire l’abbonamento' }, 403);

    const { data: salon } = await admin
      .from('salons')
      .select('id, stripe_customer_id')
      .eq('id', member.salon_id)
      .maybeSingle();
    if (!salon?.stripe_customer_id) {
      return jsonResponse({ error: 'Nessun cliente di fatturazione ancora collegato' }, 400);
    }

    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || '';
    if (!origin) return jsonResponse({ error: 'APP_URL non configurato' }, 500);
    const base = origin.replace(/\/$/, '');

    const session = await stripeForm(stripeKey, 'POST', 'billing_portal/sessions', {
      customer: salon.stripe_customer_id as string,
      return_url: `${base}/?billing=portal`,
    });

    return jsonResponse({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Errore imprevisto';
    return jsonResponse({ error: message }, 500);
  }
});
