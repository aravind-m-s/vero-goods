import crypto from 'node:crypto';

/**
 * Cryptographically secure random values.
 *
 * `Math.random()` is a PRNG seeded per process and its future output is
 * predictable from past output. It must never generate anything that guards
 * access to data — tracking tokens expose a customer's full name, phone and
 * home address, and OTPs guard account access.
 */
export function randomToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('base64url');
}

export function randomId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Uniformly distributed 6-digit code — `randomInt` avoids modulo bias. */
export function randomNumericCode(digits = 6): string {
  const max = 10 ** digits;
  return String(crypto.randomInt(0, max)).padStart(digits, '0');
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Length-safe constant-time comparison of two hex/ascii strings. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the failure path costs the same as a mismatch.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
