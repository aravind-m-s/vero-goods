import { z } from 'zod';
import { ProductRequestStatus } from '@/features/requests/types';

/** What "Get it for me" posts. Contact details are how the seller replies. */
export const ProductRequestSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  customerName: z.string().trim().min(2, 'Enter your name').max(80),
  email: z.email('Enter a valid email address').optional().or(z.literal('')),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?91[-\s]?|0)?[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
  quantity: z.coerce.number().int().min(1, 'At least one').max(100),
  note: z.string().trim().max(500).optional().or(z.literal('')),
});

export const ProductRequestUpdateSchema = z.object({
  status: z.enum(ProductRequestStatus),
  adminNote: z.string().trim().max(500).optional(),
});

export type ProductRequestValues = z.input<typeof ProductRequestSchema>;
