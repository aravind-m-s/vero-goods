import { NextResponse, type NextRequest } from 'next/server';
import { webhookEventsCollection } from '@/shared/db/collections';
import {
  getOrderByRazorpayOrderId,
  getOrderItems,
  markOrderPaid,
  markPaymentFailed,
  nextInvoiceNumber,
  recordRefund,
  setInvoiceNumber,
} from '@/features/orders/server/orders.repo';
import { sendEmail } from '@/shared/email/send';
import { orderReceivedEmail } from '@/shared/email/templates';
import { verifyWebhookSignature } from '@/features/payments/server/razorpay';

export const dynamic = 'force-dynamic';

/**
 * Razorpay webhook — the authoritative source of payment truth.
 *
 * Without this, a customer who pays and then closes the tab before the
 * redirect leaves an order stuck in PENDING forever while their money is gone.
 * The browser callback is best-effort; this is what actually settles orders.
 *
 * Configure in the Razorpay dashboard:
 *   URL:    <APP_URL>/api/payments/razorpay/webhook
 *   Secret: RAZORPAY_WEBHOOK_SECRET
 *   Events: payment.captured, payment.failed, refund.processed
 */
interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string; amount: number; currency: string; error_description?: string } };
    refund?: { entity: { id: string; payment_id: string; amount: number } };
  };
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-razorpay-signature');
  // Read the raw body: the signature is computed over the exact bytes sent, so
  // re-serialising parsed JSON would break verification.
  const rawBody = await request.text();

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: RazorpayWebhookPayload;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Razorpay retries on non-2xx, so every handler below must be replay-safe.
  const eventId = request.headers.get('x-razorpay-event-id');
  if (eventId) {
    const events = await webhookEventsCollection();
    try {
      await events.insertOne({ eventId, receivedAt: new Date() });
    } catch {
      // Duplicate key — already processed.
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  try {
    switch (event.event) {
      case 'payment.captured':
      case 'order.paid': {
        const payment = event.payload.payment?.entity;
        if (!payment) break;

        const order = await getOrderByRazorpayOrderId(payment.order_id);
        if (!order) {
          console.error(`[webhook] no local order for razorpay order ${payment.order_id}`);
          break;
        }

        if (payment.amount !== order.totalMinor || payment.currency !== order.currency) {
          console.error(
            `[webhook] amount mismatch on ${order.orderNumber}: got ${payment.amount} ${payment.currency}, expected ${order.totalMinor} ${order.currency}`
          );
          break;
        }

        const paid = await markOrderPaid(order.id, payment.id, payment.order_id);
        // null means the browser callback already settled it — nothing to do.
        if (paid) {
          const invoiceNumber = await nextInvoiceNumber();
          await setInvoiceNumber(paid.id, invoiceNumber);
          const items = await getOrderItems(paid.id);
          await sendEmail(orderReceivedEmail({ ...paid, invoiceNumber }, items));
        }
        break;
      }

      case 'payment.failed': {
        const payment = event.payload.payment?.entity;
        if (!payment) break;
        const order = await getOrderByRazorpayOrderId(payment.order_id);
        if (order) {
          await markPaymentFailed(order.id, payment.error_description ?? 'gateway reported failure');
        }
        break;
      }

      case 'refund.processed': {
        const refund = event.payload.refund?.entity;
        if (!refund) break;
        const payment = event.payload.payment?.entity;
        const order = payment ? await getOrderByRazorpayOrderId(payment.order_id) : null;
        if (order) {
          await recordRefund(order.id, refund.id, refund.amount);
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error('[webhook] handler failed', error);
    // 500 makes Razorpay retry, which is what we want for a transient failure.
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
