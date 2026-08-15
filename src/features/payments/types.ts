// Payment domain types. Pure — safe in both Client and Server Components.

/**
 * Why a settled payment could not be matched to an order.
 *
 * `unknown_order` — the gateway captured money against a Razorpay order id we
 * have no local record of. Usually a race with order creation, occasionally a
 * webhook pointed at the wrong environment, rarely something worse.
 *
 * `amount_mismatch` — the captured amount or currency is not what the order
 * says it should be. Retrying cannot fix this; a human has to decide whether to
 * refund the difference or settle the order manually.
 */
export type PaymentAlertKind = 'unknown_order' | 'amount_mismatch';

/**
 * A payment the webhook refused to settle automatically.
 *
 * The dead letter for money that arrived without a home. These used to be a
 * `console.error` and a 200, which meant the gateway stopped retrying and
 * nothing on the system knew a customer had paid for an order still sitting in
 * PENDING. Persisted so the situation survives a log rotation and can be worked
 * through deliberately.
 */
export interface PaymentAlert {
  id: string;
  kind: PaymentAlertKind;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  /** Set when the order was found but disagreed with the payment. */
  orderId?: string;
  orderNumber?: string;
  expectedMinor?: number;
  receivedMinor?: number;
  expectedCurrency?: string;
  receivedCurrency?: string;
  message: string;
  /** How many times the gateway has reported this same problem. */
  occurrences: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Set by hand once someone has refunded, settled or dismissed it. */
  resolvedAt?: Date;
}
