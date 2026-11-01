export function stripeAuth(secret: string): string {
  return `Bearer ${secret}`;
}

export async function stripeForm(
  secret: string,
  method: 'POST' | 'GET',
  path: string,
  params?: Record<string, string>,
): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: stripeAuth(secret),
      ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: method === 'POST' && params ? new URLSearchParams(params) : undefined,
  });
  const json = await response.json();
  if (!response.ok) {
    const message = (json as { error?: { message?: string } })?.error?.message || 'Errore Stripe';
    throw new Error(message);
  }
  return json as Record<string, unknown>;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verifica Stripe-Signature (t + v1 HMAC SHA-256). */
export async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const expected = toHex(signed);
  return signatures.some((signature) => safeEqual(signature, expected));
}
