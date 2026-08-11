// Order domain types. Pure — safe in both Client and Server Components.

export interface OrderAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
}

export enum OrderStatus {
  PLACED = 'PLACED',
  CONFIRMED = 'CONFIRMED',
  PACKED = 'PACKED',
  SHIPPED = 'SHIPPED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURN_REQUESTED = 'RETURN_REQUESTED',
  RETURNED = 'RETURNED',
}

export enum PaymentStatus {
  /** Online payment initiated, not yet confirmed by the gateway. */
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  /** Cash on delivery — becomes PAID on delivery. */
  COD = 'COD',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
}

/** Legal, non-skippable transitions. Anything not listed is rejected by the API. */
export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PLACED]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PACKED, OrderStatus.CANCELLED],
  [OrderStatus.PACKED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.CANCELLED],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURN_REQUESTED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURNED, OrderStatus.DELIVERED],
  [OrderStatus.RETURNED]: [],
};

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
  /** 'admin' | 'system' | 'customer' */
  by: string;
  note?: string;
}

/** GST is charged on the tax-exclusive value; retail prices here are tax-INCLUSIVE. */
export interface TaxLine {
  ratePercent: number;
  /** Tax-exclusive value of the goods at this rate, in paise. */
  taxableMinor: number;
  taxMinor: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  invoiceNumber?: string;
  userId: string;
  email: string;
  customerName: string;
  phone: string;
  shippingAddress: OrderAddress;

  /** Sum of item totals (GST-inclusive), in paise. */
  subtotalMinor: number;
  shippingMinor: number;
  codFeeMinor: number;
  /** GST contained within subtotal + shipping. Informational, NOT added to the total. */
  taxMinor: number;
  taxLines: TaxLine[];
  /** subtotal + shipping + codFee. What the customer actually pays. */
  totalMinor: number;
  currency: string;

  paymentMethod: 'COD' | 'RAZORPAY';
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  statusHistory: OrderStatusEvent[];

  trackingToken: string;
  /** Courier AWB, set by admin on SHIPPED. */
  trackingNumber?: string;
  courier?: string;
  estimatedDeliveryDate?: string;

  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpayRefundId?: string;
  refundedAmountMinor?: number;

  /** Client-supplied key that makes order creation safe to retry. */
  idempotencyKey?: string;
  cancellationReason?: string;

  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId: string;
  /** Snapshot at purchase time — product records may change or be deleted later. */
  productTitle: string;
  variantName: string;
  sku: string;
  imageUrl?: string;
  unitPriceMinor: number;
  quantity: number;
  totalMinor: number;
  gstRatePercent: number;
  /** Snapshot of our cost, so margin reporting survives supplier price changes. */
  costPriceMinor: number;
  supplierName: string;
  supplierSku: string;
}
