import { z } from 'zod';
import { OrderStatus, PaymentStatus } from './db/types';

export const ProductSpecificationRowSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, 'Label is required'),
  value: z.string().min(1, 'Value is required'),
  sortOrder: z.number().default(0),
});

export const ProductSpecificationSchema = z.object({
  id: z.string().optional(),
  heading: z.string().min(1, 'Heading is required'),
  sortOrder: z.number().default(0),
  rows: z.array(ProductSpecificationRowSchema),
});

export const ProductFormSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.coerce.number().min(1, 'Price must be at least 1 INR'),
  compareAtPrice: z.coerce.number().optional().nullable(),
  isActive: z.boolean().default(true),
  imageUrls: z.array(z.string().url('Must be a valid URL')).min(1, 'At least one product image URL is required'),
  specifications: z.array(ProductSpecificationSchema).default([]),
});

export const CheckoutFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number (must be 10 digits starting with 6-9)'),
  line1: z.string().min(5, 'Address Line 1 must be at least 5 characters'),
  line2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pinCode: z.string().regex(/^\d{6}$/, 'Invalid Indian PIN code (must be 6 digits)'),
  country: z.literal('India').refine((v) => v === 'India', {
    message: 'Shipping is restricted to India only',
  }),
  paymentMethod: z.enum(['COD', 'RAZORPAY']),
});

export const OrderStatusUpdateSchema = z.object({
  status: z.nativeEnum(OrderStatus),
});

export const ExportFilterSchema = z.object({
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
