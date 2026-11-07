import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { resolveLiveWhatsAppSetup } from '../_shared/whatsappCloud.ts';

/**
 * Stato e interruttore per il titolare o l'admin del proprio salone.
 * Ignora qualsiasi salon_id nel body. Non restituisce token né Phone Number ID.
 * "Da configurare" finché i segreti mancano o il template non è utility APPROVED.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Metodo non consentito' }, 405);

  const env = Deno.env.toObject();
  const supabaseUrl = env.SUPABASE_URL ?? '';
  const anonKey = env.SUPABASE_ANON_KEY ?? '';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!supabaseUrl || !anonKey || !serviceKey) return jsonResponse({ error: 'Supabase non configurato' }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return jsonResponse({ error: 'Accesso non autorizzato' }, 401);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: member } = await admin
    .from('salon_users')
    .select('salon_id, role')
    .eq('id', userData.user.id)
    .maybeSingle();
  const role = member?.role || 'owner';
  if (!member?.salon_id || (role !== 'owner' && role !== 'admin')) {
    return jsonResponse({ error: 'Permesso negato' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action === 'enable' || body?.action === 'disable' ? body.action : 'status';
  const salonId = member.salon_id as string;

  const { data: salon } = await admin
    .from('salons')
    .select('whatsapp_reminders_enabled')
    .eq('id', salonId)
    .maybeSingle();
  const enabled = salon?.whatsapp_reminders_enabled === true;

  if (action === 'disable') {
    const { error } = await admin.rpc('nuvia_set_whatsapp_reminders', { p_salon: salonId, p_enabled: false });
    if (error) return jsonResponse({ error: 'Impossibile spegnere i promemoria WhatsApp' }, 500);
    const view = await resolveLiveWhatsAppSetup({ env, enabled: false });
    return jsonResponse({ ...view, enabled: false });
  }

  const view = await resolveLiveWhatsAppSetup({ env, enabled });
  if (action === 'status' || !view.canEnable) {
    return jsonResponse(view);
  }

  const { data: open, error: planError } = await admin.rpc('nuvia_pro_feature_open', { p_salon: salonId });
  if (planError || open !== true) {
    return jsonResponse({ ...view, canEnable: false, state: 'da_configurare', reason: 'piano_non_pro' });
  }

  const { error } = await admin.rpc('nuvia_set_whatsapp_reminders', { p_salon: salonId, p_enabled: true });
  if (error) {
    const locked = /REMINDER_PLAN_LOCKED|Disponibile nel piano PRO/i.test(error.message || '');
    return jsonResponse({
      ...view,
      enabled: false,
      canEnable: false,
      state: 'da_configurare',
      reason: locked ? 'piano_non_pro' : 'attivazione_rifiutata',
    });
  }
  return jsonResponse({ ...view, enabled: true, state: 'pronto', canEnable: true, reason: null });
});
