import type { z } from 'zod';
import type { ProductWriteInput } from '@/features/catalog/server/products.repo';
import { rupeesToMinor } from '@/shared/lib/money';
import type { ProductFormSchema } from '@/features/catalog/schemas';

/** Admin forms are denominated in rupees; storage is in paise. Convert once, here. */
export function toProductWriteInput(
  data: z.output<typeof ProductFormSchema>
): ProductWriteInput {
  return {
    title: data.title,
    slug: data.slug,
    description: data.description,
    isActive: data.isActive,
    gstRatePercent: data.gstRatePercent,
    hsnCode: data.hsnCode || undefined,
    paymentSupport: data.paymentSupport,
    shippingMinor: rupeesToMinor(data.shippingPrice),
    imageUrls: data.imageUrls,
    imageAlts: data.imageAlts,
    videoUrls: data.videoUrls,
    variants: data.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      priceMinor: rupeesToMinor(variant.price),
      compareAtPriceMinor: variant.compareAtPrice
        ? rupeesToMinor(variant.compareAtPrice)
        : undefined,
      stockQty: variant.stockQty,
      allowBackorder: variant.allowBackorder,
      weightGrams: variant.weightGrams,
      isActive: variant.isActive,
      supplier: {
        name: variant.supplier.name,
        sku: variant.supplier.sku,
        url: variant.supplier.url || undefined,
        costPriceMinor: rupeesToMinor(variant.supplier.costPrice),
        leadTimeDays: variant.supplier.leadTimeDays,
      },
    })),
    specifications: data.specifications.map((spec) => ({
      id: spec.id,
      heading: spec.heading,
      rows: spec.rows,
    })),
  };
}
