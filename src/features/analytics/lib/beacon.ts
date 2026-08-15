/**
 * Browser side of the product funnel.
 *
 * Every beacon shares three rules: a stable per-browser id so views can be
 * counted as people, a throttle so a reload is not a new event, and total
 * silence on failure — analytics must never delay or break the page it is
 * measuring.
 */

const VISITOR_KEY = 'vg_visitor_id';

/**
 * A stable random id for this browser.
 *
 * Not an account and not a person — it exists so "300 views" can also be read
 * as "180 people", and nothing else. Clearing site data or opening a private
 * window produces a new one, which is why unique viewers is an estimate rather
 * than a count.
 */
export function visitorId(): string | null {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    // Storage blocked (private mode, cookie settings). No id, no tracking.
    return null;
  }
}

/**
 * True the first time in `windowMs`, false while still inside it.
 *
 * Marks the moment it returns true, so a caller that fires on every render
 * still records one event.
 */
export function passesThrottle(key: string, windowMs: number): boolean {
  try {
    const last = Number(localStorage.getItem(key) ?? 0);
    if (Date.now() - last < windowMs) return false;
    localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Fire and forget. `keepalive` so it survives the shopper clicking away. */
export function send(path: string, body: Record<string, string>): void {
  void fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // A lost event is not the shopper's problem.
  });
}

/** A reload inside this window is the same visit, not a new one. */
export const VIEW_THROTTLE_MS = 30 * 60 * 1000;

/**
 * Shorter than the view window on purpose: adding the same item again half an
 * hour later is a real second decision, and cart intent is rare enough that
 * losing one matters more than double-counting one.
 */
export const CART_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Records cart intent — the middle of the funnel.
 *
 * Without this step, "viewed but never ordered" cannot distinguish a listing
 * nobody was convinced by from a checkout that scared people off, and those two
 * need opposite fixes.
 */
export function trackCartAdd(productId: string, variantId: string): void {
  const visitor = visitorId();
  if (!visitor) return;
  if (!passesThrottle(`vg_cart_${variantId}`, CART_THROTTLE_MS)) return;

  send('/api/products/cart-adds', { productId, variantId, visitorId: visitor });
}
