import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { buildReminderEmail } from '../_shared/reminderEmail.ts';

/**
 * Invio orario dei promemoria email. Non accetta un elenco di appuntamenti dal client:
 * le righe le sceglie nuvia_claim_due_reminders, che verifica piano PRO, interruttore
 * del salone, stato, email e finestra delle 24 ore.
 *
 * Segreti (Edge Function, mai nel codice):
 * - BREVO_API_KEY
 * - BREVO_SENDER_EMAIL  (mittente verificato su Brevo; il nome mostrato è quello del salone)
 * - REMINDER_CRON_SECRET  (stesso valore del secret vault nuvia_reminder_cron_secret)
 * SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono già iniettati da Supabase.
 */

type ClaimedReminder = {
  id: string;
  claim_id: string;
  client_name: string;
  client_email: string;
  service_names: string | null;
  appointment_date: string;
  start_time: string;
  staff_name: string | null;
  salon_name: string;
  salon_email: string | null;
  address: string | null;
  city: string | null;
};

type SendResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

const BATCH = 40;
const FETCH_TIMEOUT_MS = 8_000;
const BUDGET_MS = 45_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Metodo non consentito' }, 405);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const cronSecret = Deno.env.get('REMINDER_CRON_SECRET') ?? '';
  const headerSecret = req.headers.get('x-reminder-secret') ?? '';
  const authorized =
    (serviceKey.length > 0 && safeEqual(bearer(req), serviceKey)) ||
    (cronSecret.length >= 16 && safeEqual(headerSecret, cronSecret));
  if (!authorized) return jsonResponse({ error: 'Accesso non autorizzato' }, 401);

  const apiKey = Deno.env.get('BREVO_API_KEY') ?? '';
  const senderEmail = Deno.env.get('BREVO_SENDER_EMAIL') ?? '';
  if (!apiKey || !senderEmail) {
    return jsonResponse({ error: 'BREVO_API_KEY o BREVO_SENDER_EMAIL non configurati' }, 500);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Supabase service role non configurato' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc('nuvia_claim_due_reminders', { p_limit: BATCH });
  if (error) {
    const missing = /nuvia_claim_due_reminders|schema cache|does not exist/i.test(error.message);
    return jsonResponse(
      {
        error: missing
          ? 'Manca la funzione nuvia_claim_due_reminders. Esegui supabase/migrations/20261105233000_automatic_reminders.sql.'
          : error.message,
      },
      500
    );
  }

  const rows = asClaims(data);
  let sent = 0;
  let released = 0;
  let failed = 0;
  const started = Date.now();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (Date.now() - started > BUDGET_MS) {
      released += await releaseFrom(admin, rows.slice(index));
      break;
    }

    const result = await sendBrevo(apiKey, senderEmail, row);
    if (result.ok) {
      sent += 1;
      continue;
    }

    // Un 400 dopo almeno un invio riuscito riguarda quel destinatario: non si riprova.
    // Chiave, mittente o errore di rete: si rilascia il claim, così il giro dopo non perde
    // i promemoria e non li segna come inviati.
    const keepClaim = result.status === 400 && sent > 0;
    if (keepClaim) {
      failed += 1;
      continue;
    }
    failed += 1;
    released += await releaseFrom(admin, rows.slice(index));
    return jsonResponse({ sent, released, failed, error: result.message }, 502);
  }

  return jsonResponse({ sent, released, failed, claimed: rows.length });
});

function bearer(req: Request): string {
  const header = req.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? '';
}

function safeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

function asClaims(data: unknown): ClaimedReminder[] {
  const value = typeof data === 'string' ? safeJson(data) : data;
  if (!Array.isArray(value)) return [];
  return value.filter(isClaim);
}

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isClaim(value: unknown): value is ClaimedReminder {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.claim_id === 'string' && typeof row.client_email === 'string';
}

async function sendBrevo(apiKey: string, senderEmail: string, row: ClaimedReminder): Promise<SendResult> {
  const content = buildReminderEmail({
    clientName: row.client_name || 'cliente',
    salonName: row.salon_name || 'il salone',
    appointmentDate: row.appointment_date || '',
    appointmentTime: row.start_time || '',
    serviceNames: row.service_names,
    staffName: row.staff_name,
    address: row.address,
    city: row.city,
  });

  const payload: Record<string, unknown> = {
    sender: {
      email: senderEmail,
      name: (row.salon_name || 'Nuvia').replace(/[\r\n]+/g, ' ').trim().slice(0, 70) || 'Nuvia',
    },
    to: [{ email: row.client_email, name: row.client_name || undefined }],
    subject: content.subject,
    htmlContent: content.html,
    textContent: content.text,
    tags: ['nuvia-promemoria'],
  };

  const replyTo = (row.salon_email || '').trim();
  if (replyTo && replyTo.toLowerCase() !== senderEmail.toLowerCase() && replyTo.includes('@')) {
    payload.replyTo = { email: replyTo, name: row.salon_name || undefined };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (response.status === 201 || response.status === 202) return { ok: true };
    return { ok: false, status: response.status, message: `Brevo ha risposto ${response.status}` };
  } catch {
    return { ok: false, status: 0, message: 'Invio Brevo non riuscito' };
  } finally {
    clearTimeout(timer);
  }
}

async function releaseFrom(
  admin: ReturnType<typeof createClient>,
  rows: ClaimedReminder[]
): Promise<number> {
  let released = 0;
  for (const row of rows) {
    const { error } = await admin.rpc('nuvia_release_reminder_claim', {
      p_id: row.id,
      p_claim_id: row.claim_id,
    });
    if (!error) released += 1;
  }
  return released;
}
