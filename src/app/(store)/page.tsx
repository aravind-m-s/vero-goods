import React from 'react';
import type { Metadata } from 'next';
import { ProductCard } from '@/features/catalog/components/ProductCard';
import { getActiveProductCards } from '@/features/catalog/server/products.repo';
import { appUrl } from '@/shared/lib/config';

// Served from the static shell; admin writes call revalidateTag('products'),
// so edits appear immediately without a database hit per visitor.
export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

export default async function StoreHomePage() {
  const products = await getActiveProductCards();
  const inStockCount = products.filter((product) => product.inStock).length;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${appUrl()}/products/${product.slug}`,
      name: product.title,
    })),
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      {/*
        No hero. The store opens on merchandise, the way a category page does.
        Hierarchy here comes from type size and whitespace — never from
        inverting the background, which is the rule the rest of the page keeps.
      */}
      <header className="flex flex-col gap-2 pb-6 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            3D printing hardware, stocked in India
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Printers, filament and accessories — GST invoiced, dispatched in 1–4 working days.
          </p>
        </div>
        <p className="shrink-0 text-xs text-ink-subtle">
          <span className="font-semibold text-ink tabular-nums">{inStockCount}</span> of{' '}
          <span className="tabular-nums">{products.length}</span> in stock
        </p>
      </header>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-line-strong bg-surface-raised py-20 text-center">
          <h2 className="text-sm font-semibold text-ink">Nothing here yet</h2>
          <p className="mt-1 max-w-xs text-xs text-ink-subtle">
            Add your first product from the admin portal and it will appear here immediately.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 border-t border-line pt-8 lg:grid-cols-3 lg:gap-x-5 xl:grid-cols-4">
          {products.map((product, index) => (
            <li key={product.id}>
              {/* The first row is above the fold — preload those images for LCP. */}
              <ProductCard product={product} priority={index < 4} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
