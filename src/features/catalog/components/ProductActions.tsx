'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { Check, Minus, Plus, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { useCart } from '@/features/cart/components/CartContext';
import type { ProductImage, ProductVariant } from '@/features/catalog/types';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { useToast } from '@/shared/ui/toast';
import { formatMinor } from '@/shared/lib/money';
import { cn } from '@/shared/lib/utils';

interface ProductActionsProps {
  productTitle: string;
  images: ProductImage[];
  variants: ProductVariant[];
}

const MAX_PER_ORDER = 20;

export function ProductActions({ productTitle, images, variants }: ProductActionsProps) {
  const { addToCart } = useCart();
  const { success, error } = useToast();

  const sellable = useMemo(() => variants.filter((variant) => variant.isActive), [variants]);
  const [selectedId, setSelectedId] = useState(
    () => sellable.find((v) => v.stockQty > 0 || v.allowBackorder)?.id ?? sellable[0]?.id
  );
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const selected = sellable.find((variant) => variant.id === selectedId);

  if (!selected) {
    return (
      <div className="rounded-card border border-dashed border-line-strong p-6 text-sm text-ink-muted">
        This product is currently unavailable.
      </div>
    );
  }

  const showVariantPicker = sellable.length > 1;
  const maxQuantity = selected.allowBackorder
    ? MAX_PER_ORDER
    : Math.min(MAX_PER_ORDER, selected.stockQty);
  const purchasable = selected.allowBackorder || selected.stockQty > 0;
  const discount =
    selected.compareAtPriceMinor && selected.compareAtPriceMinor > selected.priceMinor
      ? Math.round(
          ((selected.compareAtPriceMinor - selected.priceMinor) / selected.compareAtPriceMinor) * 100
        )
      : 0;
  const savedMinor = selected.compareAtPriceMinor
    ? selected.compareAtPriceMinor - selected.priceMinor
    : 0;

  const handleAdd = () => {
    if (!purchasable) {
      error('This option is out of stock');
      return;
    }
    addToCart(selected.id, quantity);
    success(
      `${productTitle}${selected.name === 'Default' ? '' : ` · ${selected.name}`} added to cart`
    );
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
      <div className="space-y-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-card border border-line bg-surface-raised">
          {images[activeImage] ? (
            <Image
              src={images[activeImage].url}
              alt={images[activeImage].alt ?? productTitle}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              // Main product image is the LCP element on this page.
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-ink-subtle">
              No image
            </div>
          )}
          {discount > 0 && (
            <div className="absolute left-4 top-4">
              <Badge variant="accent">{discount}% off</Badge>
            </div>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveImage(index)}
                aria-label={`Show image ${index + 1} of ${images.length}`}
                aria-current={index === activeImage}
                className={cn(
                  'relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-control border-2 transition-colors',
                  index === activeImage
                    ? 'border-accent'
                    : 'border-line hover:border-line-strong'
                )}
              >
                <Image src={image.url} alt="" fill sizes="64px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-3xl font-black tracking-tight text-ink tabular-nums sm:text-4xl">
              {formatMinor(selected.priceMinor)}
            </span>
            {selected.compareAtPriceMinor && selected.compareAtPriceMinor > selected.priceMinor && (
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
            Inclusive of all taxes · Free shipping over ₹2,000
          </p>
        </div>

        {showVariantPicker && (
          <fieldset className="space-y-2.5">
            <legend className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
              Choose an option
            </legend>
            <div className="flex flex-wrap gap-2">
              {sellable.map((variant) => {
                const available = variant.allowBackorder || variant.stockQty > 0;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(variant.id);
                      setQuantity(1);
                    }}
                    disabled={!available}
                    aria-pressed={variant.id === selected.id}
                    className={cn(
                      'cursor-pointer rounded-control border px-3.5 py-2 text-xs font-semibold transition-colors',
                      variant.id === selected.id
                        ? 'border-accent bg-accent-soft text-accent-ink'
                        : 'border-line-strong text-ink-muted hover:border-ink-subtle hover:text-ink',
                      !available && 'cursor-not-allowed line-through opacity-40'
                    )}
                  >
                    {variant.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <StockLine variant={selected} />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex h-12 w-fit items-center rounded-control border border-line-strong">
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

          <Button
            variant="accent"
            size="lg"
            onClick={handleAdd}
            disabled={!purchasable}
            className="flex-1"
          >
            <ShoppingCart className="h-4 w-4" />
            {purchasable ? 'Add to cart' : 'Out of stock'}
          </Button>
        </div>

        <dl className="space-y-2.5 rounded-card border border-line bg-surface-raised p-4 text-xs">
          <Row label="SKU" value={<span className="font-mono">{selected.sku}</span>} />
          <Row
            label={
              <span className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5" /> Dispatch
              </span>
            }
            value={
              selected.supplier.leadTimeDays === 0
                ? 'Same working day'
                : `In ${selected.supplier.leadTimeDays} working day${selected.supplier.leadTimeDays > 1 ? 's' : ''}`
            }
          />
          <Row
            label={
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Returns
              </span>
            }
            value="7 days, unopened"
          />
        </dl>
      </div>
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
  if (variant.stockQty > 5) {
    return (
      <p className="flex items-center gap-1.5 text-xs font-semibold text-success">
        <Check className="h-4 w-4" /> In stock, ready to dispatch
      </p>
    );
  }
  if (variant.stockQty > 0) {
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
  if (variant.allowBackorder) {
    return (
      <p className="text-xs font-semibold text-warning">
        On backorder — ships in about {variant.supplier.leadTimeDays} days
      </p>
    );
  }
  return <p className="text-xs font-semibold text-danger">Out of stock</p>;
}
