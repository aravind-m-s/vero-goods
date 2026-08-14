import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCustomer } from '@/features/auth/server/auth';
import { attachRazorpayOrderId, getOrderById } from '@/features/orders/server/orders.repo';
import { PaymentStatus } from '@/features/orders/types';
import { createRazorpayOrder, isSimulationMode, razorpayKeys } from '@/features/payments/server/razorpay';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const customer = await getSessionCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = (await request.json()) as { orderId?: string };
    if (!body.orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const order = await getOrderById(body.orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (order.userId !== customer.id) {
      return NextResponse.json({ error: 'This order belongs to another customer' }, { status: 403 });
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      return NextResponse.json({ error: 'This order is already paid' }, { status: 409 });
    }
    if (order.paymentMethod !== 'RAZORPAY') {
      return NextResponse.json({ error: 'This order is not an online payment order' }, { status: 400 });
    }

    const keys = razorpayKeys();

    if (keys) {
      const rzpOrder = await createRazorpayOrder({
        amountMinor: order.totalMinor,
        receipt: order.orderNumber,
        notes: { orderId: order.id, customerEmail: order.email || customer.email || '' },
      });

      // Persisted so verification can require that the callback refers to THIS
      // order — a signature from a cheap order can no longer settle an expensive one.
      await attachRazorpayOrderId(order.id, rzpOrder.id);

      return NextResponse.json({
        razorpayOrderId: rzpOrder.id,
        amountMinor: order.totalMinor,
        currency: 'INR',
        keyId: keys.keyId,
        isSandbox: false,
      });
    }

    if (isSimulationMode()) {
      const simulatedId = `rzp_sim_${order.id}`;
      await attachRazorpayOrderId(order.id, simulatedId);
      return NextResponse.json({
        razorpayOrderId: simulatedId,
        amountMinor: order.totalMinor,
        currency: 'INR',
        keyId: 'rzp_test_simulation',
        isSandbox: true,
      });
    }

    // Fail loudly rather than silently pretending a payment succeeded.
    console.error('[payments] Razorpay keys are not configured');
    return NextResponse.json(
      { error: 'Online payments are temporarily unavailable. Please choose Cash on Delivery.' },
      { status: 503 }
    );
  } catch (error) {
    console.error('[payments] create order failed', error);
    return NextResponse.json({ error: 'Payment gateway error' }, { status: 502 });
  }
}
