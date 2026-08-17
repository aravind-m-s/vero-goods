import { z } from 'zod';

/**
 * Catalog write schemas. Admin forms are denominated in rupees (what a human
 * types); everything below the API boundary is in paise. Conversion happens
 * once, in `features/admin/server/product-input.ts`.
 */

export const SpecificationRowSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Label is required').max(120),
  value: z.string().min(1, 'Value is required').max(500),
});

export const SpecificationSchema = z.object({
  id: z.string().optional(),
  heading: z.string().min(1, 'Heading is required').max(120),
  rows: z.array(SpecificationRowSchema).max(50),
});

export const SupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(120),
  sku: z.string().min(1, 'Supplier SKU is required').max(80),
  url: z.union([z.url('Must be a valid URL'), z.literal('')]).optional(),
  costPrice: z.coerce.number().min(0, 'Cost price cannot be negative'),
  leadTimeDays: z.coerce.number().int().min(0).max(120),
});

export const VariantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Variant name is required').max(120),
  sku: z
    .string()
    .min(2, 'SKU must be at least 2 characters')
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, 'SKU may contain letters, numbers, dot, underscore and hyphen only'),
  price: z.coerce.number().min(1, 'Price must be at least ₹1'),
  compareAtPrice: z.coerce.number().min(0).optional().nullable(),
  stockQty: z.coerce.number().int().min(0, 'Stock cannot be negative'),
  allowBackorder: z.boolean().default(false),
  weightGrams: z.coerce.number().int().min(0).max(200000),
  isActive: z.boolean().default(true),
  supplier: SupplierSchema,
});

export const ProductFormSchema = z
  .object({
    title: z.string().min(2, 'Title must be at least 2 characters').max(200),
    slug: z
      .string()
      .min(2, 'Slug must be at least 2 characters')
      .max(120)
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only'),
    description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
    isActive: z.boolean().default(true),
    gstRatePercent: z.coerce.number().min(0).max(28).default(18),
    hsnCode: z.string().max(12).optional(),
    /** Which payment methods checkout offers for this product. */
    paymentSupport: z.enum(['BOTH', 'ONLINE', 'COD']).default('BOTH'),
    /** Delivery charge in rupees. Zero is legal and means free delivery. */
    shippingPrice: z.coerce
      .number()
      .min(0, 'Shipping charge cannot be negative')
      .max(100000)
      .default(0),
    imageUrls: z
      .array(z.url('Must be a valid URL'))
      .min(1, 'At least one product image URL is required')
      .max(10),
    /** Direct mp4/webm files or YouTube/Vimeo links. Optional. */
    videoUrls: z.array(z.url('Must be a valid URL')).max(6).default([]),
    variants: z.array(VariantSchema).min(1, 'At least one variant is required').max(50),
    specifications: z.array(SpecificationSchema).max(20).default([]),
  })
  .refine(
    (data) => new Set(data.variants.map((v) => v.sku.toLowerCase())).size === data.variants.length,
    { message: 'Variant SKUs must be unique within a product', path: ['variants'] }
  );

export type ProductFormValues = z.input<typeof ProductFormSchema>;

/** Key used for issues that belong to the form as a whole, not to one field. */
export const FORM_ERROR_KEY = '_form';

/**
 * Flattens a ZodError into `dotted.path -> message`, e.g.
 * `variants.0.supplier.costPrice`. Zod's own `.flatten()` keeps only
 * depth-1 paths, which silently drops every variant, supplier, specification
 * and image error — the admin form then reported "invalid" with nothing marked.
 */
export function issuesToFieldErrors(error: z.ZodError): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : FORM_ERROR_KEY;
    if (!messages[key]) messages[key] = issue.message;
  }
  return messages;
}
