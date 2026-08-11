import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { otpsCollection } from '@/shared/db/collections';
import { findOrCreateCustomer, getCustomerById } from '@/features/auth/server/users.repo';
import { randomNumericCode, safeEqual, sha256 } from '@/shared/lib/tokens';
import type { User } from '@/features/auth/types';
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

/**
 * Issues a login code. Only the SHA-256 of the code is persisted, so a database
 * leak does not hand over live login codes. The plaintext is returned once for
 * delivery by email and is never written down again.
 */
export async function createOtp(email: string): Promise<string> {
  const normalised = email.trim().toLowerCase();
  const code = randomNumericCode(6);
  const now = new Date();

  const otps = await otpsCollection();
  await otps.updateOne(
    { email: normalised },
    {
      $set: {
        email: normalised,
        codeHash: sha256(code),
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

export async function verifyOtp(
  email: string,
  code: string
): Promise<{ ok: true; user: User } | { ok: false; reason: OtpFailure }> {
  const normalised = email.trim().toLowerCase();
  const otps = await otpsCollection();

  // Count the attempt before checking it, so a failed guess always costs the
  // attacker one of their five tries even if they abandon the response.
  const record = await otps.findOneAndUpdate(
    { email: normalised },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  );

  if (!record) return { ok: false, reason: 'expired' };
  if (record.expiresAt <= new Date()) {
    await otps.deleteOne({ email: normalised });
    return { ok: false, reason: 'expired' };
  }
  if (record.attempts > MAX_OTP_ATTEMPTS) {
    await otps.deleteOne({ email: normalised });
    return { ok: false, reason: 'too_many_attempts' };
  }
  if (!safeEqual(sha256(code), record.codeHash)) {
    return { ok: false, reason: 'invalid' };
  }

  // Single-use: consume the code the moment it succeeds.
  await otps.deleteOne({ email: normalised });
  const user = await findOrCreateCustomer(normalised);
  return { ok: true, user };
}
