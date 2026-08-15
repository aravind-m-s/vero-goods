'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCartStore, useDirectBuyStore } from '@/features/cart/store/cart.store';

const CHECKOUT_PATH = '/checkout';

/**
 * The two pieces of cart behaviour that need React: reading storage after mount
 * rather than during render, and knowing where the router is.
 *
 * Renders nothing — the stores themselves need no provider, so components read
 * them directly wherever they are mounted.
 */
export function CartEffects() {
  const pathname = usePathname();

  useEffect(() => {
    void useCartStore.persist.rehydrate();
    void useDirectBuyStore.persist.rehydrate();
  }, []);

  // A direct purchase is scoped to the checkout page. Navigating away — whether
  // to the order confirmation or back to browsing — ends it, so the next visit
  // to checkout is the cart again.
  const hasLeftCheckout = useRef(false);
  useEffect(() => {
    if (pathname === CHECKOUT_PATH) {
      hasLeftCheckout.current = true;
      return;
    }
    if (hasLeftCheckout.current) {
      hasLeftCheckout.current = false;
      useDirectBuyStore.getState().clear();
    }
  }, [pathname]);

  return null;
}
