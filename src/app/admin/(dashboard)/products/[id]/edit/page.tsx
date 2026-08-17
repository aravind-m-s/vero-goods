import React from 'react';
import { notFound } from 'next/navigation';
import { ProductForm } from '@/features/admin/components/ProductForm';
import { ProductInsightsPanel } from '@/features/admin/components/ProductInsightsPanel';
import { getProductById } from '@/features/catalog/server/products.repo';
import { DEFAULT_PAYMENT_SUPPORT } from '@/features/catalog/types';
import { minorToRupees } from '@/shared/lib/money';

export const dynamic = 'force-dynamic';

/**
 * Loaded on the server. The old page fetched itself from its own API on mount,
 * which meant an authenticated round trip and a loading spinner for data the
 * server already had.
 */
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getProductById(id);
  if (!detail) notFound();

  const { product, variants, images, videos, specifications } = detail;

  return (
    <div className="space-y-6">
      {/* Above the form on purpose: the decision to change a price is made
          before the field is touched, not after. Loaded client-side so the
          aggregations never delay the form itself. */}
      <ProductInsightsPanel productId={product.id} />

      <ProductForm
        mode="edit"
        initial={{
          id: product.id,
          title: product.title,
          slug: product.slug,
          description: product.description,
          isActive: product.isActive,
          gstRatePercent: product.gstRatePercent,
          hsnCode: product.hsnCode ?? '',
          paymentSupport: product.paymentSupport ?? DEFAULT_PAYMENT_SUPPORT,
          imageUrls: images.map((image) => image.url),
          videoUrls: videos.map((video) => video.url),
          variants: variants.map((variant) => ({
            id: variant.id,
            name: variant.name,
            sku: variant.sku,
            price: minorToRupees(variant.priceMinor),
            compareAtPrice: variant.compareAtPriceMinor
              ? minorToRupees(variant.compareAtPriceMinor)
              : '',
            stockQty: variant.stockQty,
            allowBackorder: variant.allowBackorder,
            weightGrams: variant.weightGrams,
            isActive: variant.isActive,
            supplier: {
              name: variant.supplier.name,
              sku: variant.supplier.sku,
              url: variant.supplier.url ?? '',
              costPrice: minorToRupees(variant.supplier.costPriceMinor),
              leadTimeDays: variant.supplier.leadTimeDays,
            },
          })),
          specifications: specifications.map((spec, index) => ({
            id: spec.id,
            heading: spec.heading,
            sortOrder: index,
            rows: spec.rows.map((row, rowIndex) => ({
              id: row.id,
              label: row.label,
              value: row.value,
              sortOrder: rowIndex,
            })),
          })),
        }}
      />
    </div>
  );
}
