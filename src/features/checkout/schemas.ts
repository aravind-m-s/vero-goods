import { z } from 'zod';

/** Address, checkout form, and the payloads the cart/order endpoints accept. */

export const AddressSchema = z.object({
  line1: z.string().min(5, 'Address Line 1 must be at least 5 characters').max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2, 'City is required').max(80),
  state: z.string().min(2, 'State is required').max(80),
  pinCode: z.string().regex(/^\d{6}$/, 'Invalid Indian PIN code (must be 6 digits)'),
  country: z.literal('India', { message: 'Shipping is restricted to India only' }),
});

/**
 * What the checkout form itself still collects. The delivery address is no
 * longer typed here — it is picked from the saved address list (or saved to it
 * first), so the form is down to the receipt email and the payment method.
 */
export const CheckoutFormSchema = z.object({
  email: z.email('Invalid email address'),
  paymentMethod: z.enum(['COD', 'RAZORPAY']),
});

/**
 * The address as it is frozen onto the order. Recipient name and phone travel
 * with it so the snapshot is self-contained.
 */
export const OrderAddressSchema = AddressSchema.extend({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(20).optional(),
  label: z.string().max(40).optional(),
  sourceAddressId: z.string().max(80).optional(),
});

export const CartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1').max(20),
});

/**
 * What `POST /api/orders` accepts. The old route validated none of this
 * server-side and read `body.phone`, which the client never sent — every order
 * was stored with an empty phone number.
 */
export const CreateOrderSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  /**
   * Where the receipt goes. Optional because a customer who signed in with a
   * mobile number may have no email on file; the session address is used when
   * this is absent. Never written back to the account — it is unverified.
   */
  email: z.email('Invalid email address').optional(),
  shippingAddress: OrderAddressSchema,
  paymentMethod: z.enum(['COD', 'RAZORPAY']),
  items: z.array(CartItemSchema).min(1, 'Cart is empty').max(50),
  /** Makes a retried checkout return the original order instead of creating a second one. */
  idempotencyKey: z.string().min(8).max(100),
});

export const PriceQuoteSchema = z.object({
  items: z.array(CartItemSchema).max(50),
  paymentMethod: z.enum(['COD', 'RAZORPAY']).default('RAZORPAY'),
});
