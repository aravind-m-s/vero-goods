import 'server-only';

import {
  InvalidTransitionError,
  PaymentNotSettledError,
  recordRefund,
  updateOrderStatus,
  type StatusUpdateInput,
} from '@/features/orders/server/orders.repo';
import { PaymentStatus, type Order } from '@/features/orders/types';
import { createRefund, razorpayKeys } from '@/features/payments/server/razorpay';

export type StatusChangeFailure = 'not_found' | 'invalid_transition' | 'payment_not_settled';

export type StatusChangeResult =
  | { ok: true; order: Order }
  | { ok: false; reason: StatusChangeFailure; message: string };

/**
 * The admin status change, minus the email.
 *
 * Shared by the single-order route and the bulk route so the refund path cannot
 * drift between them. It returns a result instead of throwing, because a bulk
 * run has to carry on past an order that refuses the transition and report it,
 * rather than abandoning the orders behind it in the queue.
 *
 * Sending the customer email is deliberately left to the caller: one order can
 * afford to await it, a hundred cannot.
 */
export async function applyAdminStatusChange(
  orderId: string,
  input: Omit<StatusUpdateInput, 'by'>
): Promise<StatusChangeResult> {
  let order: Order | null;
  try {
    order = await updateOrderStatus(orderId, { ...input, by: 'admin' });
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return { ok: false, reason: 'invalid_transition', message: error.message };
    }
    if (error instanceof PaymentNotSettledError) {
      return { ok: false, reason: 'payment_not_settled', message: error.message };
    }
    throw error;
  }

  if (!order) return { ok: false, reason: 'not_found', message: 'Order not found' };

  // Cancelling or returning a paid online order triggers a gateway refund.
  if (
    order.paymentStatus === PaymentStatus.REFUND_PENDING &&
    order.paymentMethod === 'RAZORPAY' &&
    order.razorpayPaymentId &&
    razorpayKeys()
  ) {
    try {
      const refund = await createRefund(order.razorpayPaymentId, order.totalMinor);
      order = (await recordRefund(order.id, refund.id, order.totalMinor)) ?? order;
    } catch (error) {
      // Leave it REFUND_PENDING for manual follow-up rather than failing the status change.
      console.error(`[admin] refund failed for ${order.orderNumber}`, error);
    }
  }

  return { ok: true, order };
}

/** Maps a failure onto the status code the API should answer with. */
export function statusChangeHttpStatus(reason: StatusChangeFailure): number {
  return reason === 'not_found' ? 404 : 409;
}
