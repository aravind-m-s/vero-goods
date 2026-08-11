import type { VariantDraft } from '@/features/admin/components/VariantBuilder';
import type { ProductFormInitialValues } from '@/features/admin/components/ProductForm';

/**
 * Blank-form factories.
 *
 * These live outside the client components so a server component (the "new
 * product" page) can build the initial props without importing across the
 * client boundary.
 */
export function emptyVariant(index: number): VariantDraft {
  return {
    name: index === 0 ? 'Default' : '',
    sku: '',
    price: '',
    compareAtPrice: '',
    stockQty: 0,
    allowBackorder: false,
    weightGrams: 0,
    isActive: true,
    supplier: { name: '', sku: '', url: '', costPrice: '', leadTimeDays: 3 },
  };
}

export function emptyProductForm(): ProductFormInitialValues {
  return {
    title: '',
    slug: '',
    description: '',
    isActive: true,
    gstRatePercent: 18,
    hsnCode: '',
    imageUrls: [],
    variants: [emptyVariant(0)],
    specifications: [],
  };
}
