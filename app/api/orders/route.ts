import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, Order, OrderItem, OrderStatus, PaymentStatus } from '@/lib/db/db';
import { getSessionCustomer } from '@/lib/auth/auth';
import { generateSecureToken } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface CartItemPayload {
  productId: string;
  quantity: number;
}

interface ShippingDetails {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
}

export async function POST(request: NextRequest) {
  try {
    const customer = await getSessionCustomer();
    if (!customer) {
      return NextResponse.json({ error: 'Authentication required to place an order' }, { status: 401 });
    }

    const body = await request.json();
    const { shippingDetails, paymentMethod, items: cartItems } = body as {
      shippingDetails: ShippingDetails;
      paymentMethod: 'COD' | 'RAZORPAY';
      items: CartItemPayload[];
    };

    if (!shippingDetails || !paymentMethod || !cartItems || cartItems.length === 0) {
      return NextResponse.json({ error: 'Missing required checkout fields' }, { status: 400 });
    }

    // Validate country restriction
    if (shippingDetails.country !== 'India') {
      return NextResponse.json({ error: 'Shipping is only available within India' }, { status: 400 });
    }

    const db = await getDb();

    // 1. Validate products server-side and compute totals (never trust client prices)
    const resolvedItems: Array<{ productId: string; productTitle: string; unitPrice: number; quantity: number; total: number }> = [];
    let totalAmount = 0;

    for (const cartItem of cartItems) {
      const product = db.products.find((p) => p.id === cartItem.productId && p.isActive);
      if (!product) {
        return NextResponse.json({ error: `Product ${cartItem.productId} is unavailable or inactive` }, { status: 400 });
      }

      const quantity = Math.max(1, Math.floor(cartItem.quantity));
      const lineTotal = product.price * quantity;
      totalAmount += lineTotal;

      resolvedItems.push({
        productId: product.id,
        productTitle: product.title,
        unitPrice: product.price,
        quantity,
        total: lineTotal,
      });
    }

    // 2. Generate order number and tracking token
    const existingOrdersCount = db.orders.length;
    const orderNumber = `VG-${String(1000 + existingOrdersCount + 1).padStart(4, '0')}`;
    const trackingToken = generateSecureToken(32);
    const orderId = `ord-${Math.random().toString(36).substr(2, 12)}`;
    const now = new Date().toISOString();

    // 3. Determine initial payment and order status
    const paymentStatus: PaymentStatus = paymentMethod === 'COD' ? PaymentStatus.COD : PaymentStatus.PENDING;
    const orderStatus: OrderStatus = paymentMethod === 'COD' ? OrderStatus.PLACED : OrderStatus.PLACED;

    // 4. Create order record
    const newOrder: Order = {
      id: orderId,
      orderNumber,
      userId: customer.id,
      email: customer.email,
      customerName: customer.name || body.name || customer.email.split('@')[0],
      phone: body.phone || '',
      shippingAddress: {
        line1: shippingDetails.line1,
        line2: shippingDetails.line2,
        city: shippingDetails.city,
        state: shippingDetails.state,
        pinCode: shippingDetails.pinCode,
        country: shippingDetails.country,
      },
      totalAmount,
      paymentMethod,
      paymentStatus,
      orderStatus,
      trackingToken,
      createdAt: now,
      updatedAt: now,
    };

    db.orders.push(newOrder);

    // 5. Create order items (snapshot product title + price at time of purchase)
    for (const item of resolvedItems) {
      const orderItem: OrderItem = {
        id: `item-${Math.random().toString(36).substr(2, 9)}`,
        orderId,
        productId: item.productId,
        productTitle: item.productTitle,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        total: item.total,
      };
      db.orderItems.push(orderItem);
    }

    await saveDb(db);

    // Log tracking URL to terminal
    console.log(`\n===============================================\n[ORDER CREATED] #${orderNumber}\nTracking URL: http://localhost:3000/order/track/${trackingToken}\nPayment Method: ${paymentMethod}\nTotal: ₹${totalAmount}\n===============================================\n`);

    return NextResponse.json({
      success: true,
      orderId,
      orderNumber,
      trackingToken,
      totalAmount,
      paymentMethod,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Internal server error during order creation' }, { status: 500 });
  }
}
