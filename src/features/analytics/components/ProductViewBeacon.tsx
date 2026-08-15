'use client';

import { useEffect } from 'react';
import { VIEW_THROTTLE_MS, passesThrottle, send, visitorId } from '@/features/analytics/lib/beacon';

/**
 * Reports that this product page was looked at.
 *
 * Runs after paint and ignores its own result. The page itself stays statically
 * generated — this is the only part that talks to the server, which is the
 * whole reason the count is not taken during the render.
 */
export function ProductViewBeacon({ productId }: { productId: string }) {
  useEffect(() => {
    const visitor = visitorId();
    if (!visitor) return;

    // Three reloads in a row are one visit; three visits across a week are
    // three views by one viewer. Both are counted the way they read.
    if (!passesThrottle(`vg_seen_${productId}`, VIEW_THROTTLE_MS)) return;

    send('/api/products/views', { productId, visitorId: visitor });
  }, [productId]);

  return null;
}
