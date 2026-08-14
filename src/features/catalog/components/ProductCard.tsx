import React from 'react';
import { SafeImage as Image } from '@/shared/ui/safe-image';
import Link from 'next/link';
import { Badge } from '@/shared/ui/badge';
import { formatMinor } from '@/shared/lib/money';
import type { ProductCard as ProductCardData } from '@/features/catalog/server/products.repo';

/**
 * A server component: the whole tile is a link, so it ships no client JS.
 *
 * Deliberately borderless. In a four-up grid, boxing every product draws more
 * lines than there is product, and the photography stops being the thing you
 * look at. The image panel supplies the shape; type and space do the rest.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductCardData;
  priority?: boolean;
}) {
  const discount =
    product.compareAtPriceMinor && product.compareAtPriceMinor > product.fromPriceMinor
      ? Math.round(
          ((product.compareAtPriceMinor - product.fromPriceMinor) / product.compareAtPriceMinor) *
            100
        )
      : 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex h-full flex-col rounded-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-card bg-surface-sunken">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.imageAlt ?? product.title}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-subtle">
            No image
          </div>
        )}

        {discount > 0 && (
          <div className="absolute left-2.5 top-2.5">
            <Badge variant="accent">{discount}% off</Badge>
          </div>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/70">
            <Badge variant="secondary">Out of stock</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <h3 className="text-sm font-medium leading-snug text-ink transition-colors group-hover:text-accent">
          {product.title}
        </h3>

        {product.variantCount > 1 && (
          <p className="mt-1 text-2xs text-ink-subtle">{product.variantCount} options</p>
        )}

        <div className="mt-auto flex items-baseline gap-2 pt-2">
          {product.variantCount > 1 && <span className="text-2xs text-ink-subtle">from</span>}
          <span className="text-base font-bold tracking-tight text-ink tabular-nums">
            {formatMinor(product.fromPriceMinor)}
          </span>
          {product.compareAtPriceMinor && product.compareAtPriceMinor > product.fromPriceMinor && (
            <span className="text-xs text-ink-subtle line-through tabular-nums">
              {formatMinor(product.compareAtPriceMinor)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
