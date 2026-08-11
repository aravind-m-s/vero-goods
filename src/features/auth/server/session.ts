/**
 * Signed, expiring session cookies.
 *
 * The previous implementation stored the literal string
 * `authenticated_admin_active` for admins and a bare user id for customers.
 * Both were forgeable from the browser devtools console — anyone could paste a
 * cookie and become an admin, or become any customer whose id they had seen.
 * Every session value is now HMAC-signed with a server-side secret and carries
 * its own expiry, so a cookie the server did not issue is rejected.
 *
 * Built on Web Crypto rather than `node:crypto` so the same code verifies
 * sessions in Proxy (edge runtime) and in Route Handlers (Node runtime).
 */

export interface SessionPayload {
  /** Subject: user id for customers, 'admin' for the admin portal. */
  sub: string;
  role: 'admin' | 'customer';
  /** Issued-at and expiry, seconds since epoch. */
  iat: number;
  exp: number;
}

let cachedKey: CryptoKey | undefined;
let cachedSecret: string | undefined;

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // Fail closed. A weak or absent secret means unforgeable sessions are
    // impossible, and silently degrading to "no security" is how the old
    // hardcoded-cookie bug happened in the first place.
    throw new Error(
      'SESSION_SECRET is missing or shorter than 32 characters. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (!cachedKey || cachedSecret !== secret) {
    cachedKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    cachedSecret = secret;
  }
  return cachedKey;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
}

async function sign(data: string): Promise<string> {
  const key = await getKey();
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return toBase64Url(signature);
}

/** Constant-time string compare — no early exit on first differing byte. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionValue(
  sub: string,
  role: 'admin' | 'customer',
  ttlSeconds: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub, role, iat: now, exp: now + ttlSeconds };
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encoded}.${await sign(encoded)}`;
}

export async function verifySessionValue(
  value: string | undefined
): Promise<SessionPayload | null> {
  if (!value) return null;

  const separator = value.lastIndexOf('.');
  if (separator <= 0) return null;

  const encoded = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  if (!constantTimeEqual(signature, await sign(encoded))) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encoded)) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== 'admin' && payload.role !== 'customer') return null;
    return payload;
  } catch {
    return null;
  }
}

export const ADMIN_COOKIE_NAME = 'vero_admin_session';
export const CUSTOMER_COOKIE_NAME = 'vero_customer_session';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;
export const CUSTOMER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // 'strict' would drop the session on any inbound link (email tracking links,
  // the Razorpay return hop), so 'lax' is the correct trade-off here. It still
  // blocks cross-site POSTs, which is the CSRF case that matters.
  sameSite: 'lax' as const,
  path: '/',
};
