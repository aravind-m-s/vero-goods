import 'server-only';

import crypto from 'node:crypto';

const API_BASE = 'https://api.razorpay.com/v1';

export function razorpayKeys(): { keyId: string; keySecret: string } | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

/**
 * Offline demo mode.
 *
 * The previous code fell back to accepting the literal signature
 * `simulated_valid_signature_token` whenever `RAZORPAY_KEY_SECRET` was unset —
 * including in production, where a missing env var silently turned every order
 * into a free order. Simulation is now opt-in, refuses to run in production,
 * and is ignored entirely once real keys are present.
 */
export function isSimulationMode(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.RAZORPAY_SANDBOX_SIMULATION === 'true' &&
    razorpayKeys() === null
  );
}

export const SIMULATED_SIGNATURE = 'simulated_valid_signature_token';

function authHeader(keyId: string, keySecret: string): string {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
  receipt?: string;
}

export async function createRazorpayOrder(params: {
  amountMinor: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  const keys = razorpayKeys();
  if (!keys) throw new Error('Razorpay is not configured');

  const response = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(keys.keyId, keys.keySecret),
    },
    body: JSON.stringify({
      // Razorpay works in paise, which is also our storage unit — no float maths.
      amount: params.amountMinor,
      currency: 'INR',
      receipt: params.receipt,
      notes: params.notes,
    }),
  });

  if (!response.ok) {
    throw new Error(`Razorpay order creation failed (${response.status})`);
  }
  return (await response.json()) as RazorpayOrder;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  status: string;
  amount: number;
  currency: string;
  method?: string;
  email?: string;
  contact?: string;
}

/** Authoritative payment state, straight from the gateway. */
export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  const keys = razorpayKeys();
  if (!keys) throw new Error('Razorpay is not configured');

  const response = await fetch(`${API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: authHeader(keys.keyId, keys.keySecret) },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Razorpay payment lookup failed (${response.status})`);
  }
  return (await response.json()) as RazorpayPayment;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Checkout callback signature: HMAC-SHA256 of `order_id|payment_id` with the key secret. */
export function verifyCheckoutSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string
): boolean {
  const keys = razorpayKeys();
  if (!keys) return false;

  const expected = crypto
    .createHmac('sha256', keys.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  return timingSafeEqualHex(expected, signature);
}

/** Webhook signature: HMAC-SHA256 of the raw request body with the webhook secret. */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqualHex(expected, signature);
}

export async function createRefund(
  paymentId: string,
  amountMinor: number
): Promise<{ id: string; status: string }> {
  const keys = razorpayKeys();
  if (!keys) throw new Error('Razorpay is not configured');

  const response = await fetch(`${API_BASE}/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(keys.keyId, keys.keySecret),
    },
    body: JSON.stringify({ amount: amountMinor, speed: 'normal' }),
  });

  if (!response.ok) {
    throw new Error(`Razorpay refund failed (${response.status})`);
  }
  return (await response.json()) as { id: string; status: string };
}
