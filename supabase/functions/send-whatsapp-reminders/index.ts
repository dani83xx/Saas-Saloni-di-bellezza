import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { jsonResponse } from '../_shared/cors.ts';
import { safeEqual, type WhatsAppClaim } from '../_shared/whatsappCloud.ts';
import { deliverWhatsAppReminders } from '../_shared/whatsappDelivery.ts';

/**
 * Cron dei promemoria WhatsApp. Non accetta appuntamenti dal client.
 * Segreti, solo nell'ambiente della funzione:
 * WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID,
 * WHATSAPP_TEMPLATE_NAME, WHATSAPP_TEMPLATE_LANGUAGE, WHATSAPP_GRAPH_API_VERSION,
 * WHATSAPP_CRON_SECRET.
 * Non invia se il template utility non risulta APPROVED. Non scrive log con il token,
 * il numero del cliente o il corpo del messaggio.
 */

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'Metodo non consentito' }, 405);

  const env = Deno.env.toObject();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const cronSecret = (env.WHATSAPP_CRON_SECRET ?? '').trim();
  const headerSecret = req.headers.get('x-whatsapp-cron-secret') ?? '';
  const authorized =
    (serviceKey.length > 0 && safeEqual(bearer(req), serviceKey)) ||
    (cronSecret.length >= 16 && safeEqual(headerSecret, cronSecret));
  if (!authorized) return jsonResponse({ error: 'Accesso non autorizzato' }, 401);

  const supabaseUrl = env.SUPABASE_URL ?? '';
  if (!supabaseUrl || !serviceKey) return jsonResponse({ error: 'Supabase service role non configurato' }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const report = await deliverWhatsAppReminders({
    env,
    claim: async () => {
      const { data, error } = await admin.rpc('nuvia_whatsapp_due', { p_limit: 40 });
      if (error) throw new Error(error.code === 'PGRST202' ? 'migration_mancante' : 'claim_non_riuscito');
      return asClaims(data);
    },
    recheck: async (id) => {
      const { data, error } = await admin.rpc('nuvia_recheck_whatsapp_reminder', { p_id: id });
      if (error) return false;
      return data === true;
    },
    release: async (id, claimId) => {
      await admin.rpc('nuvia_release_whatsapp_reminder', { p_id: id, p_claim_id: claimId });
    },
    commit: async (id, claimId, wamid) => {
      await admin.rpc('nuvia_commit_whatsapp_reminder', { p_id: id, p_claim_id: claimId, p_wamid: wamid });
    },
    ambiguous: async (id, claimId) => {
      await admin.rpc('nuvia_finish_whatsapp_reminder', { p_id: id, p_claim_id: claimId, p_outcome: 'ambiguous' });
    },
    reject: async (id, claimId) => {
      await admin.rpc('nuvia_finish_whatsapp_reminder', { p_id: id, p_claim_id: claimId, p_outcome: 'rejected' });
    },
  }).catch(() => null);

  if (!report) return jsonResponse({ error: 'Invio non riuscito' }, 500);
  return jsonResponse(report);
});

function bearer(req: Request): string {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization') ?? '');
  return match?.[1] ?? '';
}

function asClaims(data: unknown): WhatsAppClaim[] {
  const value = typeof data === 'string' ? parse(data) : data;
  if (!Array.isArray(value)) return [];
  return value.filter(isClaim);
}

function parse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isClaim(value: unknown): value is WhatsAppClaim {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string'
    && typeof row.claim_id === 'string'
    && typeof row.phone === 'string'
    && typeof row.salon_id === 'string';
}
