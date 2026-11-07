/**
 * Promemoria WhatsApp via Cloud API ufficiale (template messages).
 *
 * Architettura MVP: un solo mittente Nuvia (un Phone Number ID e un WhatsApp
 * Business Account). Non è Embedded Signup e non c'è un numero per salone.
 * Il nome del salone viaggia nel template. Token e ID restano nei segreti
 * della Edge Function, mai nel browser e mai in una riga leggibile dal salone.
 *
 * Fonti lette il 6 novembre 2026:
 * - https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
 *   (esempio Graph v23.0, parametri posizionali, status APPROVED, categoria utility)
 * - https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
 * - https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in
 * - https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages/
 * - https://developers.facebook.com/docs/whatsapp/cloud-api/guides/
 * - https://developers.facebook.com/documentation/business-messaging/whatsapp/overview
 *
 * Il template va creato e approvato dal titolare del WABA Nuvia. Questo codice
 * non lo crea e non lo dà per approvato. Corpo posizionale atteso:
 * "Ciao {{1}}, ti ricordiamo l'appuntamento presso {{2}} il {{3}} alle ore {{4}}. Servizio: {{5}}. Se non puoi venire, avvisa il salone."
 * {{1}} cliente, {{2}} salone, {{3}} data, {{4}} ora, {{5}} servizio.
 * Lingua: il codice impostato in WHATSAPP_TEMPLATE_LANGUAGE (es. it), uguale
 * a quello del template approvato. Categoria obbligatoria: utility.
 */

import { formatReminderDate, formatReminderTime } from './reminderEmail.ts';

export const WHATSAPP_SETUP_SECRETS = [
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_TEMPLATE_NAME',
  'WHATSAPP_TEMPLATE_LANGUAGE',
  'WHATSAPP_GRAPH_API_VERSION',
  'WHATSAPP_CRON_SECRET',
] as const;

export type WhatsAppSecretName = (typeof WHATSAPP_SETUP_SECRETS)[number];

export const WHATSAPP_SENDER_MODE = 'nuvia_shared' as const;

/** Testo da sottoporre a revisione Meta. Non è un template già approvato. */
export const WHATSAPP_TEMPLATE_BODY_SUGGESTION =
  "Ciao {{1}}, ti ricordiamo l'appuntamento presso {{2}} il {{3}} alle ore {{4}}. Servizio: {{5}}. Se non puoi venire, avvisa il salone.";

export type WhatsAppEnv = Record<string, string | undefined>;

export type WhatsAppCredentials = {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  templateName: string;
  language: string;
  graphVersion: string;
  cronSecret: string;
};

export type WhatsAppSetupView = {
  state: 'da_configurare' | 'pronto';
  canEnable: boolean;
  enabled: boolean;
  sender: typeof WHATSAPP_SENDER_MODE;
  language: string | null;
  templateName: string | null;
  missing: string[];
  reason: string | null;
};

export type TemplateVerdict =
  | { ok: true }
  | { ok: false; reason: string };

export type SendClassification =
  | { outcome: 'accepted'; wamid: string }
  | { outcome: 'ambiguous' }
  | { outcome: 'recipient_rejected' }
  | { outcome: 'config_rejected' };

export type WhatsAppClaim = {
  id: string;
  claim_id: string;
  client_name: string;
  phone: string;
  service_names: string | null;
  appointment_date: string;
  start_time: string;
  salon_name: string;
  salon_id: string;
};

const GRAPH_VERSION = /^v[0-9]+\.[0-9]+$/;
const META_ID = /^[0-9]{5,25}$/;
const TEMPLATE_NAME = /^[a-z0-9_]{1,512}$/;
const LANGUAGE = /^[a-z]{2}(_[A-Z]{2})?$/;

export function normalizeWhatsAppPhone(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!hasPlus && !(digits.startsWith('39') && digits.length >= 11)) {
    digits = `39${digits}`;
  }
  if (!/^[1-9][0-9]{9,14}$/.test(digits)) return null;
  return digits;
}

export function maskPhone(digits: string | null | undefined): string {
  if (!digits) return '';
  const tail = digits.slice(-4);
  return `···${tail}`;
}

export function sanitizeTemplateParameter(value: string | null | undefined, fallback: string): string {
  const cleaned = (value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 200);
  return cleaned || fallback;
}

export function readWhatsAppCredentials(env: WhatsAppEnv): { credentials: WhatsAppCredentials | null; missing: string[] } {
  const missing: string[] = [];
  const read = (name: WhatsAppSecretName) => {
    const value = (env[name] || '').trim();
    if (!value) missing.push(name);
    return value;
  };
  const accessToken = read('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = read('WHATSAPP_PHONE_NUMBER_ID');
  const businessAccountId = read('WHATSAPP_BUSINESS_ACCOUNT_ID');
  const templateName = read('WHATSAPP_TEMPLATE_NAME');
  const language = read('WHATSAPP_TEMPLATE_LANGUAGE');
  const graphVersion = read('WHATSAPP_GRAPH_API_VERSION');
  const cronSecret = read('WHATSAPP_CRON_SECRET');

  if (
    phoneNumberId && !META_ID.test(phoneNumberId)
  ) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (businessAccountId && !META_ID.test(businessAccountId)) missing.push('WHATSAPP_BUSINESS_ACCOUNT_ID');
  if (templateName && !TEMPLATE_NAME.test(templateName)) missing.push('WHATSAPP_TEMPLATE_NAME');
  if (language && !LANGUAGE.test(language)) missing.push('WHATSAPP_TEMPLATE_LANGUAGE');
  if (graphVersion && !GRAPH_VERSION.test(graphVersion)) missing.push('WHATSAPP_GRAPH_API_VERSION');
  if (cronSecret && cronSecret.length < 16) missing.push('WHATSAPP_CRON_SECRET');
  if (accessToken && accessToken.length < 20) missing.push('WHATSAPP_ACCESS_TOKEN');

  const uniqueMissing = [...new Set(missing)];
  if (uniqueMissing.length > 0 || !accessToken) {
    return { credentials: null, missing: uniqueMissing };
  }
  return {
    credentials: {
      accessToken,
      phoneNumberId,
      businessAccountId,
      templateName,
      language,
      graphVersion,
      cronSecret,
    },
    missing: [],
  };
}

export function publicWhatsAppSetup(input: {
  missing: string[];
  reason?: string | null;
  ready: boolean;
  enabled: boolean;
  language?: string | null;
  templateName?: string | null;
}): WhatsAppSetupView {
  const ready = input.ready && input.missing.length === 0;
  return {
    state: ready ? 'pronto' : 'da_configurare',
    canEnable: ready,
    enabled: input.enabled === true,
    sender: WHATSAPP_SENDER_MODE,
    language: ready ? input.language || null : input.language || null,
    templateName: input.templateName || null,
    missing: input.missing,
    reason: ready ? null : input.reason || (input.missing.length ? 'segreti_mancanti' : 'template_non_pronto'),
  };
}

export function templateLookupUrl(credentials: WhatsAppCredentials): string {
  const name = encodeURIComponent(credentials.templateName);
  return `https://graph.facebook.com/${credentials.graphVersion}/${credentials.businessAccountId}/message_templates?name=${name}&fields=name,status,language,category&limit=20`;
}

export function evaluateTemplateList(
  body: unknown,
  credentials: Pick<WhatsAppCredentials, 'templateName' | 'language'>
): TemplateVerdict {
  const rows = templateRows(body);
  const match = rows.find((row) => {
    return row.name === credentials.templateName && templateLanguage(row) === credentials.language;
  });
  if (!match) return { ok: false, reason: 'template_assente' };
  if ((match.status || '').toUpperCase() !== 'APPROVED') return { ok: false, reason: 'template_non_approvato' };
  if ((match.category || '').toLowerCase() !== 'utility') return { ok: false, reason: 'template_non_utility' };
  return { ok: true };
}

export function buildTemplateMessage(credentials: WhatsAppCredentials, claim: WhatsAppClaim): { url: string; body: Record<string, unknown> } {
  const phone = normalizeWhatsAppPhone(claim.phone);
  const service = sanitizeTemplateParameter(claim.service_names, 'trattamento');
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: `+${phone}`,
    type: 'template',
    template: {
      name: credentials.templateName,
      language: { code: credentials.language },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: sanitizeTemplateParameter(claim.client_name, 'cliente') },
            { type: 'text', text: sanitizeTemplateParameter(claim.salon_name, 'salone') },
            { type: 'text', text: sanitizeTemplateParameter(formatReminderDate(claim.appointment_date), 'data concordata') },
            { type: 'text', text: sanitizeTemplateParameter(formatReminderTime(claim.start_time), 'orario concordato') },
            { type: 'text', text: service },
          ],
        },
      ],
    },
  };
  return {
    url: `https://graph.facebook.com/${credentials.graphVersion}/${credentials.phoneNumberId}/messages`,
    body,
  };
}

export function classifySendResponse(status: number, body: unknown, failedTransport: boolean): SendClassification {
  if (failedTransport || status === 0 || status === 408 || status === 429 || status >= 500) {
    return { outcome: 'ambiguous' };
  }
  if (status === 401 || status === 403) return { outcome: 'config_rejected' };
  if (status >= 400) return { outcome: 'recipient_rejected' };
  const wamid = messageId(body);
  if ((status === 200 || status === 201) && wamid) return { outcome: 'accepted', wamid };
  return { outcome: 'ambiguous' };
}

export async function resolveLiveWhatsAppSetup(input: {
  env: WhatsAppEnv;
  enabled: boolean;
  fetchImpl?: typeof fetch;
}): Promise<WhatsAppSetupView> {
  const { credentials, missing } = readWhatsAppCredentials(input.env);
  if (!credentials) {
    return publicWhatsAppSetup({ missing, ready: false, enabled: input.enabled, reason: 'segreti_mancanti' });
  }
  const fetchImpl = input.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchImpl(templateLookupUrl(credentials), {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
      signal: controller.signal,
    });
    const text = await response.text();
    const body = parseJson(text);
    if (!response.ok) {
      return publicWhatsAppSetup({
        missing: [],
        ready: false,
        enabled: input.enabled,
        language: credentials.language,
        templateName: credentials.templateName,
        reason: 'verifica_template_non_riuscita',
      });
    }
    const verdict = evaluateTemplateList(body, credentials);
    return publicWhatsAppSetup({
      missing: [],
      ready: verdict.ok,
      enabled: input.enabled,
      language: credentials.language,
      templateName: credentials.templateName,
      reason: verdict.ok === false ? verdict.reason : null,
    });
  } catch {
    return publicWhatsAppSetup({
      missing: [],
      ready: false,
      enabled: input.enabled,
      language: credentials.language,
      templateName: credentials.templateName,
      reason: 'verifica_template_non_riuscita',
    });
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function safeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

function templateRows(body: unknown): Array<{ name?: string; status?: string; category?: string; language?: unknown }> {
  if (!body || typeof body !== 'object') return [];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return data.filter((row) => row && typeof row === 'object') as Array<{ name?: string; status?: string; category?: string; language?: unknown }>;
}

function templateLanguage(row: { language?: unknown }): string {
  if (typeof row.language === 'string') return row.language;
  if (row.language && typeof row.language === 'object' && 'code' in row.language) {
    const code = (row.language as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
  }
  return '';
}

function messageId(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || !messages[0] || typeof messages[0] !== 'object') return '';
  const id = (messages[0] as { id?: unknown }).id;
  return typeof id === 'string' ? id.trim() : '';
}
