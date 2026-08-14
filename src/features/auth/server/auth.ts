import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { otpsCollection } from '@/shared/db/collections';
import {
  findOrCreateCustomer,
  getCustomerById,
  normaliseIdentifier,
} from '@/features/auth/server/users.repo';
import { randomNumericCode, safeEqual, sha256 } from '@/shared/lib/tokens';
import type { OtpChannel, OtpPurpose, User } from '@/features/auth/types';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  CUSTOMER_COOKIE_NAME,
  CUSTOMER_SESSION_TTL_SECONDS,
  baseCookieOptions,
  createSessionValue,
  verifySessionValue,
} from '@/features/auth/server/session';

export const OTP_TTL_SECONDS = 10 * 60;
const MAX_OTP_ATTEMPTS = 5;

// ---------------------------------------------------------------- admin auth

/**
 * Verifies the admin password.
 *
 * Prefers `ADMIN_PASSWORD_HASH` (scrypt, `scrypt$<saltHex>$<hashHex>`). Falls
 * back to a constant-time comparison against plaintext `ADMIN_PASSWORD` for
 * local development. There is deliberately **no default password** — the old
 * `|| 'admin123'` fallback meant a deploy that forgot the env var shipped with
 * a publicly known admin credential.
 */
export function verifyAdminPassword(password: string): boolean {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) return verifyScrypt(password, hash);

  const plaintext = process.env.ADMIN_PASSWORD;
  if (!plaintext) {
    throw new Error('Neither ADMIN_PASSWORD_HASH nor ADMIN_PASSWORD is configured');
  }
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[security] ADMIN_PASSWORD is stored in plaintext. Set ADMIN_PASSWORD_HASH instead ' +
        '(generate with: node scripts/hash-password.mjs <password>).'
    );
  }
  return safeEqual(password, plaintext);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyScrypt(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(derived, expected);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = await verifySessionValue(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  return session?.role === 'admin';
}

export async function setAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, await createSessionValue('admin', 'admin', ADMIN_SESSION_TTL_SECONDS), {
    ...baseCookieOptions,
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

// ------------------------------------------------------------- customer auth

export async function getSessionCustomer(): Promise<User | null> {
  const cookieStore = await cookies();
  const session = await verifySessionValue(cookieStore.get(CUSTOMER_COOKIE_NAME)?.value);
  if (!session || session.role !== 'customer') return null;
  return getCustomerById(session.sub);
}

export async function setCustomerSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    CUSTOMER_COOKIE_NAME,
    await createSessionValue(userId, 'customer', CUSTOMER_SESSION_TTL_SECONDS),
    { ...baseCookieOptions, maxAge: CUSTOMER_SESSION_TTL_SECONDS }
  );
}

export async function clearCustomerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_COOKIE_NAME);
}

// ---------------------------------------------------------------------- OTP

export interface OtpRequest {
  identifier: string;
  channel: OtpChannel;
  purpose?: OtpPurpose;
  /** Carried to verification so a first-time signup lands with a real name. */
  name?: string;
}

/**
 * Issues a code for an email address or a phone number. Only the SHA-256 of the
 * code is persisted, so a database leak does not hand over live login codes.
 * The plaintext is returned once for delivery and is never written down again.
 */
export async function createOtp(request: OtpRequest): Promise<string> {
  const identifier = normaliseIdentifier(request.identifier, request.channel);
  const purpose: OtpPurpose = request.purpose ?? 'login';
  const code = randomNumericCode(6);
  const now = new Date();

  const otps = await otpsCollection();
  await otps.updateOne(
    { identifier, purpose },
    {
      $set: {
        identifier,
        channel: request.channel,
        purpose,
        codeHash: sha256(code),
        name: request.name?.trim() || undefined,
        expiresAt: new Date(now.getTime() + OTP_TTL_SECONDS * 1000),
        attempts: 0,
        createdAt: now,
      },
    },
    { upsert: true }
  );

  return code;
}

export type OtpFailure = 'invalid' | 'expired' | 'too_many_attempts';

interface ConsumeSuccess {
  ok: true;
  identifier: string;
  channel: OtpChannel;
  name?: string;
}

/**
 * Checks a code and consumes it. Shared by both purposes — the caller decides
 * what proving the identifier entitles you to (a session, or the right to move
 * an address onto an existing account).
 */
export async function consumeOtp(
  request: { identifier: string; channel: OtpChannel; purpose?: OtpPurpose },
  code: string
): Promise<ConsumeSuccess | { ok: false; reason: OtpFailure }> {
  const identifier = normaliseIdentifier(request.identifier, request.channel);
  const purpose: OtpPurpose = request.purpose ?? 'login';
  const otps = await otpsCollection();

  // Count the attempt before checking it, so a failed guess always costs the
  // attacker one of their five tries even if they abandon the response.
  const record = await otps.findOneAndUpdate(
    { identifier, purpose },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  );

  if (!record) return { ok: false, reason: 'expired' };
  if (record.expiresAt <= new Date()) {
    await otps.deleteOne({ identifier, purpose });
    return { ok: false, reason: 'expired' };
  }
  if (record.attempts > MAX_OTP_ATTEMPTS) {
    await otps.deleteOne({ identifier, purpose });
    return { ok: false, reason: 'too_many_attempts' };
  }
  if (!safeEqual(sha256(code), record.codeHash)) {
    return { ok: false, reason: 'invalid' };
  }

  // Single-use: consume the code the moment it succeeds.
  await otps.deleteOne({ identifier, purpose });
  return { ok: true, identifier, channel: record.channel, name: record.name };
}

/**
 * Login path: proving the identifier creates or returns the customer account.
 *
 * `isNewAccount` is what lets the UI say "welcome back" to a returning customer
 * who happened to tap Create account, instead of sending them round the signup
 * loop for an account they already have.
 */
export async function verifyOtp(
  request: { identifier: string; channel: OtpChannel; name?: string },
  code: string
): Promise<
  { ok: true; user: User; isNewAccount: boolean } | { ok: false; reason: OtpFailure }
> {
  const result = await consumeOtp({ ...request, purpose: 'login' }, code);
  if (!result.ok) return result;

  const { user, created } = await findOrCreateCustomer({
    identifier: result.identifier,
    channel: result.channel,
    // The name typed at request time wins; the one typed at verify time is the
    // fallback for a client that only collected it on the second screen.
    name: result.name ?? request.name,
  });
  return { ok: true, user, isNewAccount: created };
}
