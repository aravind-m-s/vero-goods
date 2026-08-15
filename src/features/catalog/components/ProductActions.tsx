'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, HandHeart, Minus, PackageX, Plus, ShieldCheck, ShoppingCart, Truck, Zap } from 'lucide-react';
import { trackCartAdd } from '@/features/analytics/lib/beacon';
import { useCartStore, useDirectBuyStore } from '@/features/cart/store/cart.store';
import { ProductMedia } from '@/features/catalog/components/ProductMedia';
import { GetItForMeDialog } from '@/features/requests/components/GetItForMeDialog';
import type { ProductImage, ProductVariant, ProductVideo } from '@/features/catalog/types';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { useToast } from '@/shared/ui/toast';
import { formatMinor } from '@/shared/lib/money';
import { cn } from '@/shared/lib/utils';

interface ProductActionsProps {
  productId: string;
  productTitle: string;
  images: ProductImage[];
  videos: ProductVideo[];
  variants: ProductVariant[];
}

const MAX_PER_ORDER = 20;

export function ProductActions({
  productId,
  productTitle,
  images,
  videos,
  variants,
}: ProductActionsProps) {
  const router = useRouter();
  // Actions are stable store references, so this component never re-renders
  // because something elsewhere changed the cart.
  const addToCart = useCartStore((state) => state.addToCart);
  const startDirectBuy = useDirectBuyStore((state) => state.start);
  const { success, error } = useToast();

  const sellable = useMemo(() => variants.filter((variant) => variant.isActive), [variants]);
  // An out-of-stock product stays fully browsable, so the selection falls back
  // to an unavailable option rather than blanking the page.
  const options = sellable.length > 0 ? sellable : variants;

  const [selectedId, setSelectedId] = useState(
    () => options.find((v) => v.stockQty > 0 || v.allowBackorder)?.id ?? options[0]?.id
  );
  const [quantity, setQuantity] = useState(1);
  const [isRequestOpen, setIsRequestOpen] = useState(false);

  const selected = options.find((variant) => variant.id === selectedId) ?? options[0];

  const purchasable = Boolean(
    selected && selected.isActive && (selected.allowBackorder || selected.stockQty > 0)
  );
  const showVariantPicker = options.length > 1;
  const maxQuantity = !selected
    ? 1
    : selected.allowBackorder
      ? MAX_PER_ORDER
      : Math.max(1, Math.min(MAX_PER_ORDER, selected.stockQty));
  const discount =
    selected?.compareAtPriceMinor && selected.compareAtPriceMinor > selected.priceMinor
      ? Math.round(
          ((selected.compareAtPriceMinor - selected.priceMinor) / selected.compareAtPriceMinor) *
            100
        )
      : 0;
  const savedMinor = selected?.compareAtPriceMinor
    ? selected.compareAtPriceMinor - selected.priceMinor
    : 0;

  const handleAdd = () => {
    if (!selected || !purchasable) {
      error('This option is out of stock');
      return;
    }
    addToCart(selected.id, quantity);
    trackCartAdd(productId, selected.id);
    success(
      `${productTitle}${selected.name === 'Default' ? '' : ` · ${selected.name}`} added to cart`
    );
  };

  // Straight to checkout with this item alone. Nothing is written to the cart,
  // so an existing cart is neither charged for nor lost.
  const handleBuyNow = () => {
    if (!selected || !purchasable) {
      error('This option is out of stock');
      return;
    }
    // Skipping the cart is a stronger decision, not a different one — counting
    // it separately would make every product bought this way look like it
    // converts out of nowhere.
    startDirectBuy(selected.id, quantity);
    trackCartAdd(productId, selected.id);
    router.push('/checkout');
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
      <ProductMedia
        productTitle={productTitle}
        images={images}
        videos={videos}
        badge={
          <>
            {discount > 0 && purchasable && <Badge variant="accent">{discount}% off</Badge>}
            {!purchasable && <Badge variant="danger">Out of stock</Badge>}
          </>
        }
      />

      <div className="space-y-6">
        {selected ? (
          <div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-black tracking-tight text-ink tabular-nums sm:text-4xl">
                {formatMinor(selected.priceMinor)}
              </span>
              {selected.compareAtPriceMinor &&
                selected.compareAtPriceMinor > selected.priceMinor && (
                  <span className="text-base text-ink-subtle line-through tabular-nums">
                    {formatMinor(selected.compareAtPriceMinor)}
                  </span>
                )}
            </div>
            {savedMinor > 0 && (
              <p className="mt-1.5 text-sm font-semibold text-accent">
                You save {formatMinor(savedMinor)}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-subtle">
              Inclusive of all taxes ·{' '}
              {purchasable ? 'Dispatched in 1–4 working days' : 'Currently unavailable to order'}
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">
            This product has no purchasable options right now.
          </p>
        )}

        {showVariantPicker && (
          <fieldset className="space-y-2.5">
            <legend className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
              Choose an option
            </legend>
            <div className="flex flex-wrap gap-2">
              {options.map((variant) => {
                const available =
                  variant.isActive && (variant.allowBackorder || variant.stockQty > 0);
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(variant.id);
                      setQuantity(1);
                    }}
                    aria-pressed={variant.id === selected?.id}
                    // Unavailable options stay selectable: that is how a
                    // customer asks us to source that exact option.
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 rounded-control border px-3.5 py-2 text-xs font-semibold transition-colors',
                      variant.id === selected?.id
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line-strong text-ink-muted hover:border-ink-subtle hover:text-ink',
                      !available && 'opacity-70'
                    )}
                  >
                    {variant.name}
                    {!available && (
                      <span className="text-3xs font-medium text-danger">· out of stock</span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {selected && <StockLine variant={selected} />}

        {/* Stepper and the primary CTA share one row at every width. In stock
            that CTA is Add to cart; out of stock it becomes Get it for me, so
            the page never dead-ends. */}
        <div className="space-y-3">
          <div className="flex items-stretch gap-3">
            <div className="flex h-12 shrink-0 items-center rounded-control border border-line-strong">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className="cursor-pointer px-3.5 py-3 text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center text-sm font-bold tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                disabled={quantity >= maxQuantity}
                aria-label="Increase quantity"
                className="cursor-pointer px-3.5 py-3 text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {purchasable ? (
              <Button variant="outline" size="lg" onClick={handleAdd} className="min-w-0 flex-1">
                <ShoppingCart className="h-4 w-4 shrink-0" />
                <span className="truncate">Add to cart</span>
              </Button>
            ) : (
              <Button
                variant="accent"
                size="lg"
                onClick={() => setIsRequestOpen(true)}
                className="min-w-0 flex-1"
              >
                <HandHeart className="h-4 w-4 shrink-0" />
                <span className="truncate">Get it for me</span>
              </Button>
            )}
          </div>

          {purchasable ? (
            <Button variant="accent" size="lg" onClick={handleBuyNow} className="w-full">
              <Zap className="h-4 w-4 shrink-0" />
              Buy now · {formatMinor((selected?.priceMinor ?? 0) * quantity)}
            </Button>
          ) : (
            <p className="text-2xs leading-relaxed text-ink-subtle">
              Tell us you want it and our team will try to source it from our suppliers. No payment
              now — we contact you first with price and timeline.
            </p>
          )}
        </div>

        {selected && (
          <dl className="space-y-2.5 rounded-card border border-line bg-surface-raised p-4 text-xs">
            <Row label="SKU" value={<span className="font-mono">{selected.sku}</span>} />
            <Row
              label={
                <span className="flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" /> Dispatch
                </span>
              }
              value={
                !purchasable
                  ? 'On request'
                  : selected.supplier.leadTimeDays === 0
                    ? 'Same working day'
                    : `In ${selected.supplier.leadTimeDays} working day${selected.supplier.leadTimeDays > 1 ? 's' : ''}`
              }
            />
            <Row
              label={
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Replacement
                </span>
              }
              value="24 hours, Pack opening video required"
            />
          </dl>
        )}
      </div>

      <GetItForMeDialog
        open={isRequestOpen}
        onClose={() => setIsRequestOpen(false)}
        productId={productId}
        productTitle={productTitle}
        variantId={selected?.id}
        variantName={selected?.name}
        quantity={quantity}
      />
    </div>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-ink-subtle">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

function StockLine({ variant }: { variant: ProductVariant }) {
  if (variant.isActive && variant.stockQty > 5) {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
        <Check className="h-4 w-4" /> In stock, ready to dispatch
      </p>
    );
  }
  if (variant.isActive && variant.stockQty > 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
        </span>
        Only {variant.stockQty} left in stock
      </p>
    );
  }
  if (variant.isActive && variant.allowBackorder) {
    return (
      <p className="text-xs font-semibold text-warning">
        On backorder — ships in about {variant.supplier.leadTimeDays} days
      </p>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
      <PackageX className="h-4 w-4" /> Out of stock
    </p>
  );
}
