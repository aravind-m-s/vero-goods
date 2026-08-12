'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'vero_cart_v2';

/**
 * "Buy now" purchases live here instead of in the cart, so buying one item
 * directly never picks up whatever else the shopper had saved — and never
 * disturbs it either. Session storage, not local: a direct purchase should not
 * outlive the tab.
 */
const DIRECT_BUY_KEY = 'vero_direct_buy_v1';

const CHECKOUT_PATH = '/checkout';

/**
 * The cart stores identifiers and quantities only.
 *
 * The previous version cached the whole product object — price included — in
 * localStorage forever, so a shopper could come back weeks later and see a
 * price the server would never honour. Prices, stock and totals now always come
 * from `/api/cart/quote`, which is the same code path the order uses.
 */
export interface CartEntry {
  variantId: string;
  quantity: number;
}

export interface QuoteLine {
  variantId: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  variantName: string;
  sku: string;
  unitPriceMinor: number;
  compareAtPriceMinor?: number;
  requestedQuantity: number;
  quantity: number;
  totalMinor: number;
  gstRatePercent: number;
  stockQty: number;
  allowBackorder: boolean;
  inStock: boolean;
}

export interface QuoteTotals {
  subtotalMinor: number;
  shippingMinor: number;
  codFeeMinor: number;
  taxMinor: number;
  taxLines: Array<{ ratePercent: number; taxableMinor: number; taxMinor: number }>;
  totalMinor: number;
}

interface CartContextValue {
  entries: CartEntry[];
  /** The cart itself — what the drawer and the badge show. */
  lines: QuoteLine[];
  totals: QuoteTotals;
  cartCount: number;
  isHydrated: boolean;
  isPricing: boolean;
  /** Variants that vanished from the catalogue since they were added. */
  unavailableVariantIds: string[];
  addToCart: (variantId: string, quantity?: number) => void;
  removeFromCart: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  refreshQuote: (paymentMethod?: 'COD' | 'RAZORPAY') => Promise<void>;

  /**
   * What checkout is actually buying: the single "buy now" item when one is in
   * flight, otherwise the cart. Priced by the same server endpoint either way.
   */
  checkoutLines: QuoteLine[];
  checkoutTotals: QuoteTotals;
  checkoutCount: number;
  isCheckoutPricing: boolean;
  isDirectBuy: boolean;
  startDirectBuy: (variantId: string, quantity?: number) => void;
  clearDirectBuy: () => void;
  /** Empties whichever source the placed order came from. */
  clearPurchased: () => void;
}

const EMPTY_TOTALS: QuoteTotals = {
  subtotalMinor: 0,
  shippingMinor: 0,
  codFeeMinor: 0,
  taxMinor: 0,
  taxLines: [],
  totalMinor: 0,
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}

function readStoredCart(): CartEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is CartEntry =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as CartEntry).variantId === 'string' &&
          Number.isFinite((item as CartEntry).quantity)
      )
      .map((item) => ({
        variantId: item.variantId,
        quantity: Math.min(20, Math.max(1, Math.floor(item.quantity))),
      }));
  } catch {
    return [];
  }
}

function readStoredDirectBuy(): CartEntry | null {
  try {
    const raw = sessionStorage.getItem(DIRECT_BUY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const entry = parsed as CartEntry;
    if (typeof entry.variantId !== 'string' || !Number.isFinite(entry.quantity)) return null;
    return {
      variantId: entry.variantId,
      quantity: Math.min(20, Math.max(1, Math.floor(entry.quantity))),
    };
  } catch {
    return null;
  }
}

interface QuoteResponse {
  lines: QuoteLine[];
  totals: QuoteTotals;
  unavailableVariantIds: string[];
}

async function requestQuote(
  items: CartEntry[],
  paymentMethod: 'COD' | 'RAZORPAY'
): Promise<QuoteResponse | null> {
  const response = await fetch('/api/cart/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, paymentMethod }),
  });
  if (!response.ok) return null;
  return (await response.json()) as QuoteResponse;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [totals, setTotals] = useState<QuoteTotals>(EMPTY_TOTALS);
  const [unavailableVariantIds, setUnavailable] = useState<string[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isPricing, setIsPricing] = useState(false);
  const [directBuy, setDirectBuy] = useState<CartEntry | null>(null);
  const [directLines, setDirectLines] = useState<QuoteLine[]>([]);
  const [directTotals, setDirectTotals] = useState<QuoteTotals>(EMPTY_TOTALS);
  const [isDirectPricing, setIsDirectPricing] = useState(false);
  const paymentMethodRef = useRef<'COD' | 'RAZORPAY'>('RAZORPAY');
  const requestSeq = useRef(0);
  const directSeq = useRef(0);

  useEffect(() => {
    // Hydration must happen after mount: reading localStorage during render
    // would produce server/client markup that disagrees.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(readStoredCart());
    setDirectBuy(readStoredDirectBuy());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries, isHydrated]);

  const priceCart = useCallback(
    async (items: CartEntry[], paymentMethod: 'COD' | 'RAZORPAY') => {
      if (items.length === 0) {
        setLines([]);
        setTotals(EMPTY_TOTALS);
        setUnavailable([]);
        return;
      }

      // Discard responses that arrive out of order after a rapid quantity change.
      const seq = ++requestSeq.current;
      setIsPricing(true);
      try {
        const data = await requestQuote(items, paymentMethod);
        if (!data) return;
        if (seq !== requestSeq.current) return;

        setLines(data.lines);
        setTotals(data.totals);
        setUnavailable(data.unavailableVariantIds);

        // Drop anything the catalogue no longer sells, and clamp quantities that
        // exceed the stock now on hand.
        if (data.unavailableVariantIds.length > 0) {
          setEntries((prev) =>
            prev.filter((entry) => !data.unavailableVariantIds.includes(entry.variantId))
          );
        }
        const clamped = data.lines.filter(
          (line) => line.quantity > 0 && line.quantity !== line.requestedQuantity
        );
        if (clamped.length > 0) {
          setEntries((prev) =>
            prev.map((entry) => {
              const line = clamped.find((l) => l.variantId === entry.variantId);
              return line ? { ...entry, quantity: line.quantity } : entry;
            })
          );
        }
      } catch {
        // Offline or transient failure — keep showing the last known good quote.
      } finally {
        if (seq === requestSeq.current) setIsPricing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isHydrated) return;
    void priceCart(entries, paymentMethodRef.current);
  }, [entries, isHydrated, priceCart]);

  const addToCart = useCallback((variantId: string, quantity = 1) => {
    setEntries((prev) => {
      const existing = prev.find((entry) => entry.variantId === variantId);
      if (existing) {
        return prev.map((entry) =>
          entry.variantId === variantId
            ? { ...entry, quantity: Math.min(20, entry.quantity + quantity) }
            : entry
        );
      }
      return [...prev, { variantId, quantity: Math.min(20, quantity) }];
    });
  }, []);

  const removeFromCart = useCallback((variantId: string) => {
    setEntries((prev) => prev.filter((entry) => entry.variantId !== variantId));
  }, []);

  const updateQuantity = useCallback(
    (variantId: string, quantity: number) => {
      if (quantity <= 0) {
        removeFromCart(variantId);
        return;
      }
      setEntries((prev) =>
        prev.map((entry) =>
          entry.variantId === variantId ? { ...entry, quantity: Math.min(20, quantity) } : entry
        )
      );
    },
    [removeFromCart]
  );

  const clearCart = useCallback(() => setEntries([]), []);

  const priceDirect = useCallback(
    async (entry: CartEntry | null, paymentMethod: 'COD' | 'RAZORPAY') => {
      if (!entry) {
        setDirectLines([]);
        setDirectTotals(EMPTY_TOTALS);
        return;
      }

      const seq = ++directSeq.current;
      setIsDirectPricing(true);
      try {
        const data = await requestQuote([entry], paymentMethod);
        if (!data || seq !== directSeq.current) return;

        // The item went away while the shopper was on their way to checkout.
        if (data.unavailableVariantIds.length > 0 || data.lines.length === 0) {
          setDirectBuy(null);
          setDirectLines([]);
          setDirectTotals(EMPTY_TOTALS);
          return;
        }

        setDirectLines(data.lines);
        setDirectTotals(data.totals);

        const line = data.lines[0];
        if (line.quantity !== line.requestedQuantity) {
          setDirectBuy({ variantId: line.variantId, quantity: line.quantity });
        }
      } catch {
        // Offline or transient failure — keep the last known good quote.
      } finally {
        if (seq === directSeq.current) setIsDirectPricing(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (directBuy) sessionStorage.setItem(DIRECT_BUY_KEY, JSON.stringify(directBuy));
      else sessionStorage.removeItem(DIRECT_BUY_KEY);
    } catch {
      // Storage blocked — the purchase still works for this page view.
    }
    void priceDirect(directBuy, paymentMethodRef.current);
  }, [directBuy, isHydrated, priceDirect]);

  const clearDirectBuy = useCallback(() => setDirectBuy(null), []);

  const startDirectBuy = useCallback((variantId: string, quantity = 1) => {
    setDirectBuy({ variantId, quantity: Math.min(20, Math.max(1, quantity)) });
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
      setDirectBuy(null);
    }
  }, [pathname]);

  const clearPurchased = useCallback(() => {
    if (directBuy) setDirectBuy(null);
    else setEntries([]);
  }, [directBuy]);

  const refreshQuote = useCallback(
    async (paymentMethod?: 'COD' | 'RAZORPAY') => {
      if (paymentMethod) paymentMethodRef.current = paymentMethod;
      await Promise.all([
        priceCart(entries, paymentMethodRef.current),
        priceDirect(directBuy, paymentMethodRef.current),
      ]);
    },
    [entries, directBuy, priceCart, priceDirect]
  );

  const value = useMemo<CartContextValue>(
    () => ({
      entries,
      lines,
      totals,
      cartCount: entries.reduce((sum, entry) => sum + entry.quantity, 0),
      isHydrated,
      isPricing,
      unavailableVariantIds,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refreshQuote,

      checkoutLines: directBuy ? directLines : lines,
      checkoutTotals: directBuy ? directTotals : totals,
      checkoutCount: directBuy
        ? directBuy.quantity
        : entries.reduce((sum, entry) => sum + entry.quantity, 0),
      isCheckoutPricing: directBuy ? isDirectPricing : isPricing,
      isDirectBuy: directBuy !== null,
      startDirectBuy,
      clearDirectBuy,
      clearPurchased,
    }),
    [
      entries,
      lines,
      totals,
      isHydrated,
      isPricing,
      unavailableVariantIds,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      refreshQuote,
      directBuy,
      directLines,
      directTotals,
      isDirectPricing,
      startDirectBuy,
      clearDirectBuy,
      clearPurchased,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
