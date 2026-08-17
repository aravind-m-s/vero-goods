import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { ProductViewBeacon } from '@/features/analytics/components/ProductViewBeacon';
import { ProductActions } from '@/features/catalog/components/ProductActions';
import {
  getActiveProductSlugs,
  getProductBySlug,
} from '@/features/catalog/server/products.repo';
import { SHIPPING_FLAT_MINOR } from '@/features/checkout/server/pricing';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { appUrl } from '@/shared/lib/config';
import { minorToRupees } from '@/shared/lib/money';

export const revalidate = 3600;

/** Pre-renders the catalogue at build time; new products fall back to on-demand. */
export async function generateStaticParams() {
  const slugs = await getActiveProductSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}

export async function generateMetadata(props: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const detail = await getProductBySlug(slug);
  if (!detail) return { title: 'Product not found' };

  const { product, images } = detail;
  const description = product.description.slice(0, 155);

  return {
    title: product.title,
    description,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.title,
      description,
      type: 'website',
      url: `${appUrl()}/products/${product.slug}`,
      images: images[0] ? [{ url: images[0].url, alt: images[0].alt ?? product.title }] : undefined,
    },
  };
}

export default async function ProductDetailPage(props: PageProps<'/products/[slug]'>) {
  const { slug } = await props.params;
  const detail = await getProductBySlug(slug);

  if (!detail || !detail.product.isActive) {
    notFound();
  }

  const { product, variants, images, videos, specifications } = detail;
  const sellable = variants.filter((variant) => variant.isActive);
  const cheapest = sellable.reduce(
    (min, variant) => (variant.priceMinor < min ? variant.priceMinor : min),
    sellable[0]?.priceMinor ?? 0
  );
  const anyInStock = sellable.some((variant) => variant.stockQty > 0 || variant.allowBackorder);
  const availability = anyInStock
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock';

  // Price, availability and SKU are what earn a rich result in search.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.description,
    image: images.map((image) => image.url),
    sku: sellable[0]?.sku,
    offers:
      sellable.length === 1
        ? {
            '@type': 'Offer',
            url: `${appUrl()}/products/${product.slug}`,
            priceCurrency: product.currency,
            price: minorToRupees(cheapest).toFixed(2),
            availability,
          }
        : {
            '@type': 'AggregateOffer',
            url: `${appUrl()}/products/${product.slug}`,
            priceCurrency: product.currency,
            lowPrice: minorToRupees(cheapest).toFixed(2),
            highPrice: minorToRupees(
              Math.max(...sellable.map((variant) => variant.priceMinor))
            ).toFixed(2),
            offerCount: sellable.length,
            availability,
          },
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />

      {/* Client-side on purpose: this page is statically generated and counting
          the view on the server would make every product page dynamic. */}
      <ProductViewBeacon productId={product.id} />

      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-ink-subtle">
        <Link href="/" className="transition-colors hover:text-accent">
          Catalog
        </Link>
        <ChevronRight className="h-3 w-3" aria-hidden="true" />
        <span className="truncate text-ink-muted">{product.title}</span>
      </nav>

      <h1 className="mt-4 max-w-3xl text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl">
        {product.title}
      </h1>

      {/* Out of stock is stated once, prominently, at the top — the rest of the
          page stays exactly as it is for an in-stock product. Nothing is
          hidden, greyed out or disabled. */}
      {!anyInStock && (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-danger/40 bg-danger/5 px-4 py-3">
          <Badge variant="danger">Out of stock</Badge>
          <p className="text-xs text-ink-muted">
            This product is unavailable right now. You can still see everything about it — and ask
            us to source it with <span className="font-semibold text-ink">Get it for me</span>.
          </p>
        </div>
      )}

      <div className="mt-8">
        <ProductActions
          productId={product.id}
          productTitle={product.title}
          images={images}
          videos={videos}
          variants={variants}
          shippingMinor={product.shippingMinor ?? SHIPPING_FLAT_MINOR()}
        />
      </div>

      <section className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>About this product</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">
              {product.description}
            </p>
          </CardContent>
        </Card>

        {specifications.length > 0 && (
          <div className="space-y-6">
            {specifications.map((spec) => (
              <Card key={spec.id}>
                <CardHeader>
                  <CardTitle>{spec.heading}</CardTitle>
                </CardHeader>
                <CardContent className="pt-1">
                  {/* A description list, not a table: this is label/value data,
                      and it reflows on mobile without horizontal scrolling. */}
                  <dl className="divide-y divide-line">
                    {spec.rows.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-2.5"
                      >
                        <dt className="text-xs text-ink-subtle">{row.label}</dt>
                        <dd className="wrap-break-word text-xs font-medium text-ink">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
