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
import { sendDiscord } from '@/shared/discord/send';
import { orderPlacedDiscord } from '@/shared/discord/templates';
import { verifyWebhookSignature } from '@/features/payments/server/razorpay';
import { recordPaymentAlert, resolvePaymentAlert } from '@/features/payments/server/alerts.repo';

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

/**
 * What the handler decided about an event.
 *
 * `retry` is the important one: it maps onto a 5xx, which is the only way to
 * ask Razorpay to deliver the event again. A problem that a later attempt could
 * resolve (the order row not visible yet) must retry; a problem that no number
 * of attempts will fix (the amount is simply wrong) must not, or the same
 * unfixable event is redelivered for hours.
 */
type EventOutcome = 'handled' | 'retry';

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
  //
  // The marker is claimed *before* the work and released again if the work
  // fails. Inserting it and leaving it there meant a handler that threw
  // returned 500, and the retry that 500 asked for was then rejected as a
  // duplicate — the event was dropped for good, and an order stayed PENDING
  // with the money already taken. The insert still has to come first, because
  // two concurrent deliveries of the same event would otherwise both process it.
  const eventId = request.headers.get('x-razorpay-event-id');
  const events = eventId ? await webhookEventsCollection() : null;

  if (events && eventId) {
    try {
      await events.insertOne({ eventId, receivedAt: new Date() });
    } catch {
      // Duplicate key — already processed, or in flight on another instance.
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  let outcome: EventOutcome;
  try {
    outcome = await handleEvent(event);
  } catch (error) {
    console.error('[webhook] handler failed', error);
    await releaseEventClaim(events, eventId);
    // 500 makes Razorpay retry, which is what we want for a transient failure.
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  if (outcome === 'retry') {
    await releaseEventClaim(events, eventId);
    return NextResponse.json({ error: 'Not settled yet' }, { status: 503 });
  }

  return NextResponse.json({ received: true });
}

/** Lets the gateway's next delivery of this event be processed rather than deduplicated. */
async function releaseEventClaim(
  events: Awaited<ReturnType<typeof webhookEventsCollection>> | null,
  eventId: string | null
): Promise<void> {
  if (!events || !eventId) return;
  try {
    await events.deleteOne({ eventId });
  } catch (error) {
    console.error(`[webhook] could not release the dedupe claim on ${eventId}`, error);
  }
}

async function handleEvent(event: RazorpayWebhookPayload): Promise<EventOutcome> {
  switch (event.event) {
    case 'payment.captured':
    case 'order.paid': {
      const payment = event.payload.payment?.entity;
      if (!payment) return 'handled';

      const order = await getOrderByRazorpayOrderId(payment.order_id);
      if (!order) {
        // Money captured against an order id we cannot resolve. Possibly a race
        // with `attachRazorpayOrderId`, in which case a retry lands it — so ask
        // for one, and record it either way so an exhausted retry chain does not
        // end in silence.
        await recordPaymentAlert({
          kind: 'unknown_order',
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id,
          receivedMinor: payment.amount,
          receivedCurrency: payment.currency,
          message: `Captured ${payment.amount} ${payment.currency} against an unknown local order`,
        });
        return 'retry';
      }

      if (payment.amount !== order.totalMinor || payment.currency !== order.currency) {
        // No retry will make these agree. Settle it by hand — refund the
        // difference, or accept it and mark the order paid from the admin side.
        await recordPaymentAlert({
          kind: 'amount_mismatch',
          razorpayOrderId: payment.order_id,
          razorpayPaymentId: payment.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          expectedMinor: order.totalMinor,
          receivedMinor: payment.amount,
          expectedCurrency: order.currency,
          receivedCurrency: payment.currency,
          message:
            `Order ${order.orderNumber} expects ${order.totalMinor} ${order.currency}, ` +
            `gateway captured ${payment.amount} ${payment.currency}`,
        });
        return 'handled';
      }

      const paid = await markOrderPaid(order.id, payment.id, payment.order_id);
      // null means the browser callback already settled it — and sent both
      // notifications — so there is nothing to do here.
      if (paid) {
        const invoiceNumber = await nextInvoiceNumber();
        await setInvoiceNumber(paid.id, invoiceNumber);
        const items = await getOrderItems(paid.id);
        const settled = { ...paid, invoiceNumber };
        // Awaited rather than deferred: Razorpay is the caller here, not a
        // shopper waiting on a screen, and a 2xx sent before the work finished
        // would retire an event whose side effects had not happened yet.
        await sendEmail(orderReceivedEmail(settled, items));
        await sendDiscord(orderPlacedDiscord(settled, items));
      }

      // A retry that finally found its order closes the alert the earlier
      // attempts raised.
      await resolvePaymentAlert(payment.order_id, 'unknown_order');
      return 'handled';
    }

    case 'payment.failed': {
      const payment = event.payload.payment?.entity;
      if (!payment) return 'handled';
      const order = await getOrderByRazorpayOrderId(payment.order_id);
      if (order) {
        await markPaymentFailed(order.id, payment.error_description ?? 'gateway reported failure');
      }
      return 'handled';
    }

    case 'refund.processed': {
      const refund = event.payload.refund?.entity;
      if (!refund) return 'handled';
      const payment = event.payload.payment?.entity;
      const order = payment ? await getOrderByRazorpayOrderId(payment.order_id) : null;
      if (order) {
        await recordRefund(order.id, refund.id, refund.amount);
      }
      return 'handled';
    }

    default:
      return 'handled';
  }
}
