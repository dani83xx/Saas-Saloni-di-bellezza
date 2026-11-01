import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

async function messageFromInvokeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      if (payload && typeof payload.error === 'string' && payload.error.trim()) return payload.error;
    } catch {
      // body already consumed or not JSON
    }
  }
  const raw = error instanceof Error ? error.message : '';
  if (/failed to send a request|function not found|404/i.test(raw)) {
    return 'Pagamento non ancora attivo. Controlla che le funzioni Stripe siano pubblicate.';
  }
  if (raw && !/non-2xx|edge function/i.test(raw)) return raw;
  return 'Impossibile aprire il pagamento. Riprova tra poco.';
}

async function invokeFunction(name: string, body?: Record<string, string>): Promise<string> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw new Error(await messageFromInvokeError(error));
  const url = data && typeof data.url === 'string' ? data.url : '';
  if (!url) throw new Error('Risposta di pagamento incompleta.');
  return url;
}

export async function startStripeCheckout(planId: 'base' | 'pro', interval: 'mese' | 'anno'): Promise<void> {
  const url = await invokeFunction('create-checkout-session', { planId, interval });
  window.location.assign(url);
}

export async function openStripePortal(): Promise<void> {
  const url = await invokeFunction('create-portal-session');
  window.location.assign(url);
}
