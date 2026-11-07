import { describe, expect, test } from 'bun:test';
import { hasFeature, resolvePlanAccessFromBilling, type SalonBilling } from './plan';
import type { SubscriptionPlan } from '../types';
import {
  WHATSAPP_SETUP_SECRETS,
  buildTemplateMessage,
  classifySendResponse,
  evaluateTemplateList,
  normalizeWhatsAppPhone,
  publicWhatsAppSetup,
  readWhatsAppCredentials,
  resolveLiveWhatsAppSetup,
} from './whatsappCloud';
import { deliverWhatsAppReminders, type DeliveryDeps } from './whatsappDelivery';
import type { WhatsAppClaim } from './whatsappCloud';

const TOKEN = 'EAAJB_test_token_value_not_real_123456';

function billing(partial: Partial<SalonBilling>): SalonBilling {
  return {
    plan: null,
    planInterval: null,
    subscriptionStatus: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

function env(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    WHATSAPP_ACCESS_TOKEN: TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: '109876543210987',
    WHATSAPP_BUSINESS_ACCOUNT_ID: '102290129340398',
    WHATSAPP_TEMPLATE_NAME: 'nuvia_promemoria_appuntamento',
    WHATSAPP_TEMPLATE_LANGUAGE: 'it',
    WHATSAPP_GRAPH_API_VERSION: 'v23.0',
    WHATSAPP_CRON_SECRET: 'cron-secret-value-16',
    ...overrides,
  };
}

function claim(partial: Partial<WhatsAppClaim> = {}): WhatsAppClaim {
  return {
    id: 'appt-1',
    claim_id: 'claim-1',
    client_name: 'Giulia\nRossi',
    phone: '+39 340 123 4567',
    service_names: 'Taglio',
    appointment_date: '2026-11-20',
    start_time: '10:30:00',
    salon_name: 'Luce & Stile',
    salon_id: 'salon-a',
    ...partial,
  };
}

function approvedBody() {
  return {
    data: [{
      name: 'nuvia_promemoria_appuntamento',
      status: 'APPROVED',
      category: 'UTILITY',
      language: 'it',
    }],
  };
}

describe('piano PRO', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  test('BASE mensile e annuale non hanno il canale', () => {
    for (const interval of ['mese', 'anno'] as const) {
      const row = billing({ plan: 'base', planInterval: interval, subscriptionStatus: 'active' });
      expect(resolvePlanAccessFromBilling(row, now).tier).toBe('base');
      expect(row.planInterval).toBe(interval);
    }
  });

  test('PRO mensile, annuale e past_due hanno il canale', () => {
    for (const interval of ['mese', 'anno'] as const) {
      const row = billing({ plan: 'pro', planInterval: interval, subscriptionStatus: 'active' });
      expect(resolvePlanAccessFromBilling(row, now).tier).toBe('pro');
    }
    expect(resolvePlanAccessFromBilling(billing({ plan: 'pro', planInterval: 'anno', subscriptionStatus: 'past_due' }), now).tier).toBe('pro');
  });

  test('la prova aperta è PRO e quella scaduta no', () => {
    expect(resolvePlanAccessFromBilling(billing({ trialEndsAt: '2026-11-10T00:00:00Z' }), now).tier).toBe('pro');
    expect(resolvePlanAccessFromBilling(billing({ trialEndsAt: '2026-11-01T00:00:00Z' }), now).tier).toBe('base');
  });

  test('una prova scaduta nel modello locale non sblocca WhatsApp', () => {
    const expired: SubscriptionPlan = {
      name: 'BASE (7gg di Prova)',
      status: 'trial',
      price: 0,
      interval: 'mese',
      nextRenewalDate: '1 novembre 2026',
      renewalFullDate: '1 novembre 2026',
      trialEndsAt: '2026-11-01T00:00:00Z',
      paymentMethod: { brand: 'Prova Gratuita', last4: '0000', expiry: '7gg' },
      features: [],
      invoices: [],
    };
    expect(hasFeature(expired, 'automatic_whatsapp_reminders', now)).toBe(false);
    expect(hasFeature({ ...expired, trialEndsAt: '2026-11-10T00:00:00Z' }, 'automatic_whatsapp_reminders', now)).toBe(true);
    expect(hasFeature(expired, 'automatic_reminders', now)).toBe(false);
  });
});

describe('configurazione Meta', () => {
  test('senza segreti lo stato è da configurare e non si può accendere', () => {
    const result = readWhatsAppCredentials({});
    expect(result.credentials).toBeNull();
    expect(result.missing).toEqual([...WHATSAPP_SETUP_SECRETS]);
    const view = publicWhatsAppSetup({ missing: result.missing, ready: false, enabled: false });
    expect(view.state).toBe('da_configurare');
    expect(view.canEnable).toBe(false);
    expect(JSON.stringify(view)).not.toContain(TOKEN);
  });

  test('template marketing o non approvato non abilita', () => {
    const credentials = readWhatsAppCredentials(env()).credentials!;
    expect(evaluateTemplateList({
      data: [{ name: credentials.templateName, status: 'APPROVED', category: 'MARKETING', language: 'it' }],
    }, credentials)).toEqual({ ok: false, reason: 'template_non_utility' });
    expect(evaluateTemplateList({
      data: [{ name: credentials.templateName, status: 'PENDING', category: 'UTILITY', language: 'it' }],
    }, credentials)).toEqual({ ok: false, reason: 'template_non_approvato' });
    expect(evaluateTemplateList({
      data: [{ name: credentials.templateName, status: 'APPROVED', category: 'utility', language: 'en_US' }],
    }, credentials)).toEqual({ ok: false, reason: 'template_assente' });
  });

  test('la vista pubblica non contiene il token nemmeno se il template è pronto', async () => {
    const view = await resolveLiveWhatsAppSetup({
      env: env(),
      enabled: false,
      fetchImpl: async () => new Response(JSON.stringify(approvedBody()), { status: 200 }),
    });
    expect(view.state).toBe('pronto');
    expect(view.canEnable).toBe(true);
    expect(view.sender).toBe('nuvia_shared');
    expect(JSON.stringify(view)).not.toContain(TOKEN);
    expect(JSON.stringify(view)).not.toContain('109876543210987');
  });
});

describe('invio', () => {
  test('numero internazionale e payload sul Phone Number ID di Nuvia', () => {
    expect(normalizeWhatsAppPhone('340 123 4567')).toBe('393401234567');
    expect(normalizeWhatsAppPhone('+39 340 123 4567')).toBe('393401234567');
    expect(normalizeWhatsAppPhone('abc')).toBeNull();
    expect(normalizeWhatsAppPhone('123')).toBeNull();
    const credentials = readWhatsAppCredentials(env()).credentials!;
    const message = buildTemplateMessage(credentials, claim());
    expect(message.url).toBe('https://graph.facebook.com/v23.0/109876543210987/messages');
    expect(message.body.to).toBe('+393401234567');
    const parameters = (message.body.template as { components: Array<{ parameters: Array<{ text: string }> }> }).components[0].parameters;
    expect(parameters.map((item) => item.text)).toEqual([
      'Giulia Rossi',
      'Luce & Stile',
      'venerdì 20 novembre 2026',
      '10:30',
      'Taglio',
    ]);
    expect(JSON.stringify(message.body)).not.toContain(TOKEN);
  });

  test('esiti ambigui non diventano inviati', () => {
    expect(classifySendResponse(200, { messages: [{ id: 'wamid.1' }] }, false)).toEqual({ outcome: 'accepted', wamid: 'wamid.1' });
    expect(classifySendResponse(200, {}, false).outcome).toBe('ambiguous');
    expect(classifySendResponse(0, null, true).outcome).toBe('ambiguous');
    expect(classifySendResponse(500, { error: { message: 'boom' } }, false).outcome).toBe('ambiguous');
    expect(classifySendResponse(429, null, false).outcome).toBe('ambiguous');
    expect(classifySendResponse(400, null, false).outcome).toBe('recipient_rejected');
    expect(classifySendResponse(401, null, false).outcome).toBe('config_rejected');
  });

  test('senza template approvato non riserva invii', async () => {
    let claimed = 0;
    const deps = fakeDeps({
      fetchImpl: async () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
      claim: async () => {
        claimed += 1;
        return [claim()];
      },
    });
    const report = await deliverWhatsAppReminders(deps);
    expect(report.state).toBe('da_configurare');
    expect(claimed).toBe(0);
    expect(report.sent).toBe(0);
  });

  test('ricontrolla prima del POST e non rilascia un timeout', async () => {
    const calls: string[] = [];
    let posts = 0;
    const report = await deliverWhatsAppReminders(fakeDeps({
      fetchImpl: async (url) => {
        if (String(url).includes('/messages')) {
          posts += 1;
          throw new Error('timeout');
        }
        return new Response(JSON.stringify(approvedBody()), { status: 200 });
      },
      recheck: async () => {
        calls.push('recheck');
        return true;
      },
      ambiguous: async () => {
        calls.push('ambiguous');
      },
      release: async () => {
        calls.push('release');
      },
      commit: async () => {
        calls.push('commit');
      },
    }));
    expect(posts).toBe(1);
    expect(calls).toEqual(['recheck', 'ambiguous']);
    expect(report.ambiguous).toBe(1);
    expect(report.sent).toBe(0);
  });

  test('un rifiuto del destinatario non viene rimandato e un consenso caduto non parte', async () => {
    const calls: string[] = [];
    await deliverWhatsAppReminders(fakeDeps({
      fetchImpl: async (url) => {
        if (String(url).includes('/messages')) return new Response('{}', { status: 400 });
        return new Response(JSON.stringify(approvedBody()), { status: 200 });
      },
      reject: async () => {
        calls.push('reject');
      },
    }));
    expect(calls).toEqual(['reject']);

    calls.length = 0;
    let posts = 0;
    await deliverWhatsAppReminders(fakeDeps({
      fetchImpl: async (url) => {
        if (String(url).includes('/messages')) posts += 1;
        return new Response(JSON.stringify(approvedBody()), { status: 200 });
      },
      recheck: async () => false,
      release: async () => {
        calls.push('release');
      },
    }));
    expect(posts).toBe(0);
    expect(calls).toEqual(['release']);
  });

  test('un 401 rilascia anche i claim non ancora inviati', async () => {
    const released: string[] = [];
    let posts = 0;
    const report = await deliverWhatsAppReminders(fakeDeps({
      claim: async () => [claim({ id: 'a' }), claim({ id: 'b', claim_id: 'claim-b' })],
      fetchImpl: async (url) => {
        if (String(url).includes('/messages')) {
          posts += 1;
          return new Response('{}', { status: 401 });
        }
        return new Response(JSON.stringify(approvedBody()), { status: 200 });
      },
      release: async (id) => {
        released.push(id);
      },
    }));
    expect(posts).toBe(1);
    expect(released).toEqual(['a', 'b']);
    expect(report.sent).toBe(0);
  });
});

function fakeDeps(partial: Partial<DeliveryDeps> & { fetchImpl?: typeof fetch }): DeliveryDeps {
  return {
    env: env(),
    claim: async () => [claim()],
    recheck: async () => true,
    release: async () => undefined,
    commit: async () => undefined,
    ambiguous: async () => undefined,
    reject: async () => undefined,
    ...partial,
  };
}
