import 'server-only';

import { rateLimitsCollection } from '@/shared/db/collections';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter backed by Mongo, with a TTL index doing the cleanup.
 *
 * Shared state matters here: an in-memory limiter is useless the moment the app
 * runs more than one instance, which is exactly when brute force becomes cheap.
 * The endpoints this guards (OTP send, OTP verify, admin login) previously had
 * no limit at all — a 6-digit OTP with unlimited attempts is not a secret.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const collection = await rateLimitsCollection();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

  // Reset the window in the same round trip that increments it: if the stored
  // window has already lapsed, overwrite it instead of counting into the past.
  const existing = await collection.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
    { upsert: true, returnDocument: 'after' }
  );

  if (!existing) {
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.expiresAt <= now) {
    await collection.updateOne({ key }, { $set: { count: 1, expiresAt } });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

/** Clears a limiter after a legitimate success, so one user's typo streak does not lock them out. */
export async function resetRateLimit(key: string): Promise<void> {
  const collection = await rateLimitsCollection();
  await collection.deleteOne({ key });
}

/**
 * Best-effort client IP. Behind a proxy the socket address is the proxy's, so
 * the forwarded headers are used first. Spoofable if the app is exposed
 * directly — deploy behind a proxy that overwrites these.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
