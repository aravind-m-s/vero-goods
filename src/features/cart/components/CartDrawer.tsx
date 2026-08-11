'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Trash2, Truck, X } from 'lucide-react';
import { useCart } from '@/features/cart/components/CartContext';
import { Button } from '@/shared/ui/button';
import { formatMinor } from '@/shared/lib/money';
import { cn } from '@/shared/lib/utils';

const FREE_SHIPPING_MINOR = 200000;

/**
 * Line prices and totals come from the server quote held in CartContext, so
 * what the drawer shows is exactly what checkout will charge.
 */
export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lines, totals, updateQuantity, removeFromCart, isPricing, cartCount } = useCart();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const remainingForFreeShipping = FREE_SHIPPING_MINOR - totals.subtotalMinor;
  const freeShippingProgress = Math.min(
    100,
    Math.round((totals.subtotalMinor / FREE_SHIPPING_MINOR) * 100)
  );

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal={open}
        aria-label="Shopping cart"
        aria-hidden={!open}
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-surface-raised shadow-overlay transition-transform duration-250',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <ShoppingBag className="h-4 w-4" /> Your cart
            {cartCount > 0 && <span className="text-ink-subtle">({cartCount})</span>}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="cursor-pointer rounded-control p-1.5 text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {lines.length > 0 && (
          <div className="border-b border-line bg-surface-sunken px-5 py-3">
            {remainingForFreeShipping > 0 ? (
              <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                <Truck className="h-3.5 w-3.5 shrink-0 text-accent" />
                Add <strong className="text-ink">{formatMinor(remainingForFreeShipping)}</strong>{' '}
                for free shipping
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
                <Truck className="h-3.5 w-3.5 shrink-0" /> Free shipping unlocked
              </p>
            )}
            <div
              className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuenow={freeShippingProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progress towards free shipping"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-sunken">
                <ShoppingBag className="h-6 w-6 text-ink-subtle" />
              </div>
              <p className="mt-1 text-sm font-semibold text-ink">Your cart is empty</p>
              <p className="max-w-[16rem] text-xs text-ink-subtle">
                Add something you like and it will show up here.
              </p>
              <Button variant="outline" size="sm" onClick={onClose} className="mt-3">
                Continue shopping
              </Button>
            </div>
          ) : (
            <ul className="space-y-4">
              {lines.map((line) => (
                <li
                  key={line.variantId}
                  className="flex gap-3 border-b border-line pb-4 last:border-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${line.productSlug}`}
                      onClick={onClose}
                      className="text-sm font-semibold leading-snug text-ink hover:text-accent"
                    >
                      {line.productTitle}
                    </Link>
                    {line.variantName !== 'Default' && (
                      <p className="text-xs text-ink-muted">{line.variantName}</p>
                    )}
                    <p className="mt-0.5 text-xs text-ink-subtle tabular-nums">
                      {formatMinor(line.unitPriceMinor)} each
                    </p>

                    {!line.allowBackorder && line.stockQty <= 5 && (
                      <p className="mt-1 text-2xs font-semibold text-warning">
                        Only {line.stockQty} left
                      </p>
                    )}

                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex items-center rounded-control border border-line-strong">
                        <button
                          type="button"
                          onClick={() => updateQuantity(line.variantId, line.quantity - 1)}
                          aria-label={`Decrease quantity of ${line.productTitle}`}
                          className="cursor-pointer p-1.5 text-ink-subtle transition-colors hover:text-ink"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-bold tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(line.variantId, line.quantity + 1)}
                          disabled={!line.allowBackorder && line.quantity >= line.stockQty}
                          aria-label={`Increase quantity of ${line.productTitle}`}
                          className="cursor-pointer p-1.5 text-ink-subtle transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(line.variantId)}
                        aria-label={`Remove ${line.productTitle} from cart`}
                        className="cursor-pointer rounded-control p-1.5 text-ink-subtle transition-colors hover:text-danger"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="text-sm font-bold text-ink tabular-nums">
                    {formatMinor(line.totalMinor)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <footer className="space-y-3 border-t border-line bg-surface-raised px-5 py-4">
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between text-ink-muted">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatMinor(totals.subtotalMinor)}</dd>
              </div>
              <div className="flex justify-between text-ink-muted">
                <dt>Shipping</dt>
                <dd className="tabular-nums">
                  {totals.shippingMinor === 0 ? (
                    <span className="font-semibold text-success">Free</span>
                  ) : (
                    formatMinor(totals.shippingMinor)
                  )}
                </dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatMinor(totals.totalMinor)}</dd>
              </div>
              <p className="text-2xs text-ink-subtle">
                Includes {formatMinor(totals.taxMinor)} GST
              </p>
            </dl>

            <Link href="/checkout" onClick={onClose} className="block">
              <Button variant="accent" size="lg" className="w-full" isLoading={isPricing}>
                Checkout · {formatMinor(totals.totalMinor)}
              </Button>
            </Link>
          </footer>
        )}
      </aside>
    </>
  );
}
