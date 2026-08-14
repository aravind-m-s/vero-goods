import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCustomer } from '@/features/auth/server/auth';
import {
  getOrderById,
  getOrderItems,
  markOrderPaid,
  markPaymentFailed,
  nextInvoiceNumber,
  setInvoiceNumber,
} from '@/features/orders/server/orders.repo';
import { PaymentStatus } from '@/features/orders/types';
import { sendEmail } from '@/shared/email/send';
import { orderReceivedEmail } from '@/shared/email/templates';
import {
  SIMULATED_SIGNATURE,
  fetchRazorpayPayment,
  isSimulationMode,
  razorpayKeys,
  verifyCheckoutSignature,
} from '@/features/payments/server/razorpay';
import { clientIp, rateLimit } from '@/shared/lib/rate-limit';
import { PaymentVerifySchema } from '@/features/payments/schemas';

export const dynamic = 'force-dynamic';

/**
 * Settles an online payment from the browser callback.
 *
 * The webhook at /api/payments/razorpay/webhook is the authoritative path — this
 * endpoint exists so the shopper gets an instant confirmation screen. Both call
 * `markOrderPaid`, which is a guarded single-document update, so whichever
 * arrives second is a harmless no-op.
 *
 * Fixed here versus the previous implementation:
 *  - required a session and order ownership (was fully unauthenticated, so
 *    anyone could flip a stranger's order to FAILED);
 *  - requires `razorpay_order_id` to match the id we stored when creating the
 *    payment (a valid signature from another order could previously settle this one);
 *  - re-fetches the payment from Razorpay and checks status, amount and currency;
 *  - the simulated-signature branch is gated behind explicit non-production
 *    simulation mode instead of "no secret configured".
 */
export async function POST(request: NextRequest) {
  const customer = await getSessionCustomer();
  if (!customer) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const limit = await rateLimit(`payment-verify:${customer.id}:${clientIp(request)}`, 20, 60 * 10);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many verification attempts' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = PaymentVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing payment verification fields' }, { status: 400 });
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = parsed.data;

  const order = await getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  if (order.userId !== customer.id) {
    return NextResponse.json({ error: 'This order belongs to another customer' }, { status: 403 });
  }

  if (order.paymentStatus === PaymentStatus.PAID) {
    return NextResponse.json({
      success: true,
      alreadyVerified: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
    });
  }

  if (!order.razorpayOrderId || order.razorpayOrderId !== razorpay_order_id) {
    return NextResponse.json(
      { error: 'Payment does not belong to this order' },
      { status: 400 }
    );
  }

  const keys = razorpayKeys();
  let verified = false;

  if (keys) {
    if (!verifyCheckoutSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      await markPaymentFailed(order.id, 'signature mismatch');
      return NextResponse.json({ error: 'Payment signature verification failed' }, { status: 400 });
    }

    // A valid signature only proves the callback came from Razorpay. It does
    // not prove the payment captured, nor that it was for the right amount.
    try {
      const payment = await fetchRazorpayPayment(razorpay_payment_id);
      const settled = payment.status === 'captured' || payment.status === 'authorized';

      if (!settled || payment.order_id !== razorpay_order_id) {
        await markPaymentFailed(order.id, `payment status ${payment.status}`);
        return NextResponse.json({ error: 'Payment was not completed' }, { status: 400 });
      }
      if (payment.amount !== order.totalMinor || payment.currency !== order.currency) {
        console.error(
          `[payments] amount mismatch on ${order.orderNumber}: charged ${payment.amount} ${payment.currency}, expected ${order.totalMinor} ${order.currency}`
        );
        await markPaymentFailed(order.id, 'amount mismatch');
        return NextResponse.json({ error: 'Paid amount does not match the order' }, { status: 400 });
      }
      verified = true;
    } catch (error) {
      console.error('[payments] gateway lookup failed', error);
      // Do not mark failed — the webhook will settle it once the gateway is reachable.
      return NextResponse.json(
        { error: 'Could not confirm payment yet. We will email you once it settles.' },
        { status: 202 }
      );
    }
  } else if (isSimulationMode()) {
    verified = razorpay_signature === SIMULATED_SIGNATURE;
  } else {
    console.error('[payments] verification attempted with no gateway configured');
    return NextResponse.json({ error: 'Payments are not configured' }, { status: 503 });
  }

  if (!verified) {
    await markPaymentFailed(order.id, 'verification failed');
    return NextResponse.json({ error: 'Payment signature verification failed' }, { status: 400 });
  }

  const paid = await markOrderPaid(order.id, razorpay_payment_id, razorpay_order_id);
  if (!paid) {
    // The webhook won the race and already settled it.
    return NextResponse.json({
      success: true,
      alreadyVerified: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
    });
  }

  const invoiceNumber = await nextInvoiceNumber();
  await setInvoiceNumber(paid.id, invoiceNumber);

  const items = await getOrderItems(paid.id);
  await sendEmail(orderReceivedEmail({ ...paid, invoiceNumber }, items));

  return NextResponse.json({
    success: true,
    orderId: paid.id,
    orderNumber: paid.orderNumber,
    trackingToken: paid.trackingToken,
  });
}
