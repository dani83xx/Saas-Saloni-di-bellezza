import {
  buildTemplateMessage,
  classifySendResponse,
  evaluateTemplateList,
  normalizeWhatsAppPhone,
  readWhatsAppCredentials,
  templateLookupUrl,
  type SendClassification,
  type WhatsAppClaim,
  type WhatsAppEnv,
} from './whatsappCloud.ts';

export type DeliveryReport = {
  state: 'da_configurare' | 'inviato';
  reason: string | null;
  claimed: number;
  sent: number;
  ambiguous: number;
  rejected: number;
  released: number;
};

export type DeliveryDeps = {
  env: WhatsAppEnv;
  fetchImpl?: typeof fetch;
  claim: () => Promise<WhatsAppClaim[]>;
  recheck: (id: string) => Promise<boolean>;
  release: (id: string, claimId: string) => Promise<void>;
  commit: (id: string, claimId: string, wamid: string) => Promise<void>;
  ambiguous: (id: string, claimId: string) => Promise<void>;
  reject: (id: string, claimId: string) => Promise<void>;
};

const FETCH_TIMEOUT_MS = 8_000;

/**
 * Non accetta un salon_id dal chiamante. Prima di ogni POST ricontrolla
 * piano, consenso, interruttore e stato appuntamento. Un esito ambiguo
 * non viene rilasciato, così un timeout non genera un secondo invio.
 */
export async function deliverWhatsAppReminders(deps: DeliveryDeps): Promise<DeliveryReport> {
  const report: DeliveryReport = {
    state: 'da_configurare',
    reason: null,
    claimed: 0,
    sent: 0,
    ambiguous: 0,
    rejected: 0,
    released: 0,
  };
  const { credentials, missing } = readWhatsAppCredentials(deps.env);
  if (!credentials) {
    report.reason = missing[0] ? 'segreti_mancanti' : 'segreti_mancanti';
    return report;
  }

  const fetchImpl = deps.fetchImpl || fetch;
  const lookup = await requestJson(fetchImpl, templateLookupUrl(credentials), credentials.accessToken);
  if (lookup.transportFailed || lookup.status === 401 || lookup.status === 403 || lookup.status >= 500 || lookup.status === 0) {
    report.reason = 'verifica_template_non_riuscita';
    return report;
  }
  const verdict = evaluateTemplateList(lookup.body, credentials);
  if (verdict.ok === false) {
    report.reason = verdict.reason;
    return report;
  }

  const rows = await deps.claim();
  report.claimed = rows.length;
  report.state = 'inviato';

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const phone = normalizeWhatsAppPhone(row.phone);
    const stillEligible = phone ? await deps.recheck(row.id) : false;
    if (!stillEligible || !phone) {
      await deps.release(row.id, row.claim_id);
      report.released += 1;
      continue;
    }

    const message = buildTemplateMessage(credentials, { ...row, phone });
    const sent = await requestJson(fetchImpl, message.url, credentials.accessToken, message.body);
    const classification: SendClassification = classifySendResponse(sent.status, sent.body, sent.transportFailed);
    if (classification.outcome === 'accepted') {
      await deps.commit(row.id, row.claim_id, classification.wamid);
      report.sent += 1;
      continue;
    }
    if (classification.outcome === 'recipient_rejected') {
      await deps.reject(row.id, row.claim_id);
      report.rejected += 1;
      continue;
    }
    if (classification.outcome === 'config_rejected') {
      for (const pending of rows.slice(index)) {
        await deps.release(pending.id, pending.claim_id);
        report.released += 1;
      }
      report.reason = 'configurazione_rifiutata';
      break;
    }
    await deps.ambiguous(row.id, row.claim_id);
    report.ambiguous += 1;
  }

  return report;
}

async function requestJson(
  fetchImpl: typeof fetch,
  url: string,
  accessToken: string,
  body?: Record<string, unknown>
): Promise<{ status: number; body: unknown; transportFailed: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    return { status: response.status, body: parseJson(text), transportFailed: false };
  } catch {
    return { status: 0, body: null, transportFailed: true };
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
