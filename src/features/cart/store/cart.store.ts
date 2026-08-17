'use client';

import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PersistStorage } from 'zustand/middleware';

const STORAGE_KEY = 'vero_cart_v2';

/**
 * "Buy now" purchases live here instead of in the cart, so buying one item
 * directly never picks up whatever else the shopper had saved — and never
 * disturbs it either. Session storage, not local: a direct purchase should not
 * outlive the tab.
 */
const DIRECT_BUY_KEY = 'vero_direct_buy_v1';

/** Nobody may order more than this of one variant in a single go. */
const MAX_QTY = 20;

/**
 * How long to wait after a quantity change before asking the server to reprice.
 *
 * Tapping "+" four times used to fire four round-trips, and the drawer sat on a
 * spinner until the last one landed. One request after the shopper stops is
 * enough — the quantity itself updates optimistically in the meantime.
 */
const QUOTE_DEBOUNCE_MS = 300;

export type PaymentMethod = 'COD' | 'RAZORPAY';

/**
 * The cart stores identifiers and quantities only.
 *
 * An earlier version cached the whole product object — price included — in
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
  /** What COD would cost, whether or not it is the selected method. */
  codFeeIfSelectedMinor: number;
  taxMinor: number;
  taxLines: Array<{ ratePercent: number; taxableMinor: number; taxMinor: number }>;
  totalMinor: number;
}

export const EMPTY_TOTALS: QuoteTotals = {
  subtotalMinor: 0,
  shippingMinor: 0,
  codFeeMinor: 0,
  codFeeIfSelectedMinor: 0,
  taxMinor: 0,
  taxLines: [],
  totalMinor: 0,
};

const EMPTY_LINES: QuoteLine[] = [];

function clampQty(quantity: number): number {
  return Math.min(MAX_QTY, Math.max(1, Math.floor(quantity)));
}

function isEntryish(value: unknown): value is CartEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CartEntry).variantId === 'string' &&
    Number.isFinite((value as CartEntry).quantity)
  );
}

function sanitizeEntries(value: unknown): CartEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isEntryish)
    .map((entry) => ({ variantId: entry.variantId, quantity: clampQty(entry.quantity) }));
}

interface QuoteResponse {
  lines: QuoteLine[];
  totals: QuoteTotals;
  unavailableVariantIds: string[];
  /** Methods every product in this basket accepts. Server-decided, per product. */
  availablePaymentMethods: PaymentMethod[];
}

/** Assumed until a quote says otherwise, so checkout never starts with nothing offered. */
const ALL_PAYMENT_METHODS: PaymentMethod[] = ['COD', 'RAZORPAY'];

async function requestQuote(
  items: CartEntry[],
  paymentMethod: PaymentMethod
): Promise<QuoteResponse | null> {
  const response = await fetch('/api/cart/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, paymentMethod }),
  });
  if (!response.ok) return null;
  return (await response.json()) as QuoteResponse;
}

/**
 * The persisted shape stays the bare array these keys have always held, rather
 * than zustand's `{ state, version }` envelope, so carts already sitting in a
 * shopper's browser survive this change without a migration.
 */
function rawArrayStorage<T>(read: (raw: unknown) => T): PersistStorage<T> {
  return {
    getItem: (name) => {
      try {
        const raw = localStorageFor(name).getItem(name);
        if (!raw) return null;
        return { state: read(JSON.parse(raw)) };
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        localStorageFor(name).setItem(name, JSON.stringify(unwrap(value.state)));
      } catch {
        // Storage blocked or full — the cart still works for this page view.
      }
    },
    removeItem: (name) => {
      try {
        localStorageFor(name).removeItem(name);
      } catch {
        // Nothing to do if storage is unavailable.
      }
    },
  };
}

/** The cart outlives the tab; a direct purchase does not. */
function localStorageFor(name: string): Storage {
  return name === DIRECT_BUY_KEY ? sessionStorage : localStorage;
}

function unwrap(state: unknown): unknown {
  const record = state as { entries?: unknown; entry?: unknown };
  return 'entries' in record ? record.entries : record.entry;
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------

interface CartState {
  entries: CartEntry[];
  /** The last server quote. Authoritative for prices, stock and totals. */
  lines: QuoteLine[];
  totals: QuoteTotals;
  unavailableVariantIds: string[];
  availablePaymentMethods: PaymentMethod[];
  isPricing: boolean;
  isHydrated: boolean;
  paymentMethod: PaymentMethod;

  addToCart: (variantId: string, quantity?: number) => void;
  removeFromCart: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  priceCart: () => Promise<void>;
}

/**
 * Request bookkeeping lives outside the store because none of it belongs in
 * React state — nothing renders from it. Module scope is safe here: the file is
 * client-only, so there is one set of these per browser tab.
 */
let quoteTimer: ReturnType<typeof setTimeout> | null = null;
let quoteSeq = 0;
let hasQuoted = false;

/** Coalesces a burst of quantity taps into the one request that matters. */
function scheduleQuote(): void {
  if (quoteTimer) clearTimeout(quoteTimer);
  // The first quote after hydration should be immediate; so should an emptied
  // cart, which needs no round-trip at all.
  const immediate = !hasQuoted || useCartStore.getState().entries.length === 0;
  quoteTimer = setTimeout(
    () => {
      hasQuoted = true;
      void useCartStore.getState().priceCart();
    },
    immediate ? 0 : QUOTE_DEBOUNCE_MS
  );
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      entries: [],
      lines: EMPTY_LINES,
      totals: EMPTY_TOTALS,
      unavailableVariantIds: [],
      availablePaymentMethods: ALL_PAYMENT_METHODS,
      isPricing: false,
      isHydrated: false,
      paymentMethod: 'RAZORPAY',

      addToCart: (variantId, quantity = 1) => {
        const prev = get().entries;
        const existing = prev.find((entry) => entry.variantId === variantId);
        set({
          entries: existing
            ? prev.map((entry) =>
                entry.variantId === variantId
                  ? { ...entry, quantity: Math.min(MAX_QTY, entry.quantity + quantity) }
                  : entry
              )
            : [...prev, { variantId, quantity: Math.min(MAX_QTY, quantity) }],
        });
        scheduleQuote();
      },

      removeFromCart: (variantId) => {
        set({ entries: get().entries.filter((entry) => entry.variantId !== variantId) });
        scheduleQuote();
      },

      updateQuantity: (variantId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(variantId);
          return;
        }
        set({
          entries: get().entries.map((entry) =>
            entry.variantId === variantId
              ? { ...entry, quantity: Math.min(MAX_QTY, quantity) }
              : entry
          ),
        });
        scheduleQuote();
      },

      clearCart: () => {
        set({ entries: [] });
        scheduleQuote();
      },

      priceCart: async () => {
        // Bumping the sequence also invalidates any request still in flight.
        const seq = ++quoteSeq;
        const items = get().entries;

        if (items.length === 0) {
          set({
            lines: EMPTY_LINES,
            totals: EMPTY_TOTALS,
            unavailableVariantIds: [],
            availablePaymentMethods: ALL_PAYMENT_METHODS,
            isPricing: false,
          });
          return;
        }

        set({ isPricing: true });
        try {
          const data = await requestQuote(items, get().paymentMethod);
          if (!data || seq !== quoteSeq) return;

          // Drop anything the catalogue no longer sells, and clamp quantities
          // that exceed the stock now on hand. Both are written straight to
          // `entries` rather than through an action: this response already
          // priced the corrected basket, so re-quoting it would be a wasted
          // round-trip.
          let entries = get().entries;
          if (data.unavailableVariantIds.length > 0) {
            entries = entries.filter(
              (entry) => !data.unavailableVariantIds.includes(entry.variantId)
            );
          }
          const clamped = data.lines.filter(
            (line) => line.quantity > 0 && line.quantity !== line.requestedQuantity
          );
          if (clamped.length > 0) {
            entries = entries.map((entry) => {
              const line = clamped.find((l) => l.variantId === entry.variantId);
              return line ? { ...entry, quantity: line.quantity } : entry;
            });
          }

          set({
            lines: data.lines,
            totals: data.totals,
            unavailableVariantIds: data.unavailableVariantIds,
            availablePaymentMethods: data.availablePaymentMethods ?? ALL_PAYMENT_METHODS,
            entries,
          });
        } catch {
          // Offline or transient failure — keep showing the last known good quote.
        } finally {
          if (seq === quoteSeq) set({ isPricing: false });
        }
      },
    }),
    {
      name: STORAGE_KEY,
      storage: rawArrayStorage<Pick<CartState, 'entries'>>((raw) => ({
        entries: sanitizeEntries(raw),
      })),
      partialize: (state) => ({ entries: state.entries }),
      // Reading storage during render would produce server and client markup
      // that disagree, so hydration is driven from an effect instead.
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useCartStore.setState({ isHydrated: true });
        scheduleQuote();
      },
    }
  )
);

// ---------------------------------------------------------------------------
// Direct buy
// ---------------------------------------------------------------------------

interface DirectBuyState {
  entry: CartEntry | null;
  lines: QuoteLine[];
  totals: QuoteTotals;
  availablePaymentMethods: PaymentMethod[];
  isPricing: boolean;

  start: (variantId: string, quantity?: number) => void;
  clear: () => void;
  price: () => Promise<void>;
}

let directSeq = 0;

export const useDirectBuyStore = create<DirectBuyState>()(
  persist(
    (set, get) => ({
      entry: null,
      lines: EMPTY_LINES,
      totals: EMPTY_TOTALS,
      availablePaymentMethods: ALL_PAYMENT_METHODS,
      isPricing: false,

      start: (variantId, quantity = 1) => {
        set({ entry: { variantId, quantity: clampQty(quantity) } });
        void get().price();
      },

      clear: () => {
        directSeq += 1;
        set({
          entry: null,
          lines: EMPTY_LINES,
          totals: EMPTY_TOTALS,
          availablePaymentMethods: ALL_PAYMENT_METHODS,
          isPricing: false,
        });
      },

      price: async () => {
        const seq = ++directSeq;
        const entry = get().entry;
        if (!entry) {
          set({
            lines: EMPTY_LINES,
            totals: EMPTY_TOTALS,
            availablePaymentMethods: ALL_PAYMENT_METHODS,
            isPricing: false,
          });
          return;
        }

        set({ isPricing: true });
        try {
          const data = await requestQuote([entry], useCartStore.getState().paymentMethod);
          if (!data || seq !== directSeq) return;

          // The item went away while the shopper was on their way to checkout.
          if (data.unavailableVariantIds.length > 0 || data.lines.length === 0) {
            set({ entry: null, lines: EMPTY_LINES, totals: EMPTY_TOTALS });
            return;
          }

          const line = data.lines[0];
          set({
            lines: data.lines,
            totals: data.totals,
            availablePaymentMethods: data.availablePaymentMethods ?? ALL_PAYMENT_METHODS,
            // Stock may not cover what they asked for.
            entry:
              line.quantity === line.requestedQuantity
                ? entry
                : { variantId: line.variantId, quantity: line.quantity },
          });
        } catch {
          // Offline or transient failure — keep the last known good quote.
        } finally {
          if (seq === directSeq) set({ isPricing: false });
        }
      },
    }),
    {
      name: DIRECT_BUY_KEY,
      storage: rawArrayStorage<Pick<DirectBuyState, 'entry'>>((raw) => ({
        entry: isEntryish(raw) ? { variantId: raw.variantId, quantity: clampQty(raw.quantity) } : null,
      })),
      partialize: (state) => ({ entry: state.entry }),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        void useDirectBuyStore.getState().price();
      },
    }
  )
);

// ---------------------------------------------------------------------------
// Cross-store operations
// ---------------------------------------------------------------------------

/** Re-prices both baskets, optionally switching the payment method first. */
export async function refreshQuote(paymentMethod?: PaymentMethod): Promise<void> {
  if (paymentMethod) useCartStore.setState({ paymentMethod });
  await Promise.all([useCartStore.getState().priceCart(), useDirectBuyStore.getState().price()]);
}

/** Empties whichever source the placed order came from. */
export function clearPurchased(): void {
  const direct = useDirectBuyStore.getState();
  if (direct.entry) direct.clear();
  else useCartStore.getState().clearCart();
}

// ---------------------------------------------------------------------------
// Derived reads
// ---------------------------------------------------------------------------

/**
 * The cart as the shopper sees it: the last server quote, with quantities and
 * line totals taken from the local entries so a click lands instantly. Unit
 * prices, stock and the footer totals stay server-owned — the quote that
 * follows a moment later is what checkout charges.
 */
export function useCartLines(): QuoteLine[] {
  const entries = useCartStore((state) => state.entries);
  const lines = useCartStore((state) => state.lines);

  return useMemo(
    () =>
      entries.flatMap((entry) => {
        const line = lines.find((l) => l.variantId === entry.variantId);
        if (!line) return [];
        if (line.quantity === entry.quantity) return [line];
        return [
          {
            ...line,
            requestedQuantity: entry.quantity,
            quantity: entry.quantity,
            totalMinor: line.unitPriceMinor * entry.quantity,
          },
        ];
      }),
    [entries, lines]
  );
}

export function useCartCount(): number {
  return useCartStore((state) =>
    state.entries.reduce((sum, entry) => sum + entry.quantity, 0)
  );
}

export function useIsCartHydrated(): boolean {
  return useCartStore((state) => state.isHydrated);
}

export function useIsDirectBuy(): boolean {
  return useDirectBuyStore((state) => state.entry !== null);
}

/**
 * What checkout is actually buying: the single "buy now" item when one is in
 * flight, otherwise the cart. Priced by the same server endpoint either way.
 *
 * These deliberately read the server quote rather than the optimistic lines —
 * checkout must never submit a quantity the server has not confirmed.
 */
export function useCheckoutLines(): QuoteLine[] {
  const isDirect = useIsDirectBuy();
  const directLines = useDirectBuyStore((state) => state.lines);
  const cartLines = useCartStore((state) => state.lines);
  return isDirect ? directLines : cartLines;
}

export function useCheckoutTotals(): QuoteTotals {
  const isDirect = useIsDirectBuy();
  const directTotals = useDirectBuyStore((state) => state.totals);
  const cartTotals = useCartStore((state) => state.totals);
  return isDirect ? directTotals : cartTotals;
}

export function useCheckoutCount(): number {
  const directQty = useDirectBuyStore((state) => state.entry?.quantity ?? null);
  const cartCount = useCartCount();
  return directQty ?? cartCount;
}

/**
 * Which payment methods checkout may offer for what is being bought. Decided
 * per product by the admin and intersected server-side, so a basket mixing a
 * prepaid-only product with a COD one offers online payment alone.
 */
export function useCheckoutPaymentMethods(): PaymentMethod[] {
  const isDirect = useIsDirectBuy();
  const direct = useDirectBuyStore((state) => state.availablePaymentMethods);
  const cart = useCartStore((state) => state.availablePaymentMethods);
  return isDirect ? direct : cart;
}

export function useIsCheckoutPricing(): boolean {
  const isDirect = useIsDirectBuy();
  const directPricing = useDirectBuyStore((state) => state.isPricing);
  const cartPricing = useCartStore((state) => state.isPricing);
  return isDirect ? directPricing : cartPricing;
}
