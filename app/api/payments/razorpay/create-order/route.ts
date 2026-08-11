import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/db';
import { getSessionCustomer } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const customer = await getSessionCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const db = await getDb();
    const order = db.orders.find((o) => o.id === orderId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.userId !== customer.id) {
      return NextResponse.json({ error: 'Unauthorized: order does not belong to this customer' }, { status: 403 });
    }

    // If Razorpay keys are configured, create a real Razorpay order
    // Otherwise, return a simulated order ID for sandbox mode
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (razorpayKeyId && razorpayKeySecret) {
      // Real Razorpay integration
      try {
        const response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64')}`,
          },
          body: JSON.stringify({
            amount: order.totalAmount * 100, // Razorpay expects paise
            currency: 'INR',
            receipt: order.orderNumber,
            notes: {
              orderId: order.id,
              customerEmail: customer.email,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Razorpay API error');
        }

        const rzpOrder = await response.json();
        return NextResponse.json({
          razorpayOrderId: rzpOrder.id,
          amount: order.totalAmount,
          currency: 'INR',
          keyId: razorpayKeyId,
        });
      } catch (e) {
        console.error('Razorpay create order error:', e);
        return NextResponse.json({ error: 'Payment gateway error' }, { status: 500 });
      }
    }

    // Sandbox simulation: return a fake Razorpay order ID
    const simulatedRzpOrderId = `rzp_order_${orderId}`;
    return NextResponse.json({
      razorpayOrderId: simulatedRzpOrderId,
      amount: order.totalAmount,
      currency: 'INR',
      keyId: 'rzp_test_sandbox',
      isSandbox: true,
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
