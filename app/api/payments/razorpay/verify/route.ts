import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, saveDb, OrderStatus, PaymentStatus } from '@/lib/db/db';
import { getSessionCustomer } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !orderId) {
      return NextResponse.json({ error: 'Missing required payment verification fields' }, { status: 400 });
    }

    const db = await getDb();
    const order = db.orders.find((o) => o.id === orderId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Idempotency: if already paid, return success without reprocessing
    if (order.paymentStatus === PaymentStatus.PAID) {
      return NextResponse.json({ success: true, message: 'Payment already verified', order });
    }

    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    let isValid = false;

    if (razorpayKeySecret) {
      // Real Razorpay signature verification
      const expectedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      isValid = expectedSignature === razorpay_signature;
    } else {
      // Sandbox simulation: accept special simulation signature
      isValid = razorpay_signature === 'simulated_valid_signature_token';
    }

    if (!isValid) {
      // Mark payment as failed
      order.paymentStatus = PaymentStatus.FAILED;
      order.updatedAt = new Date().toISOString();
      await saveDb(db);
      return NextResponse.json({ error: 'Payment signature verification failed' }, { status: 400 });
    }

    // Verified: update order to paid and placed
    order.paymentStatus = PaymentStatus.PAID;
    order.orderStatus = OrderStatus.PLACED;
    order.razorpayOrderId = razorpay_order_id;
    order.razorpayPaymentId = razorpay_payment_id;
    order.updatedAt = new Date().toISOString();

    await saveDb(db);

    console.log(`\n===============================================\n[PAYMENT VERIFIED] Order #${order.orderNumber} | Payment: ${razorpay_payment_id}\nTracking: http://localhost:3000/order/track/${order.trackingToken}\n===============================================\n`);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
    });
  } catch (error) {
    console.error('Razorpay verification error:', error);
    return NextResponse.json({ error: 'Internal server error during payment verification' }, { status: 500 });
  }
}
