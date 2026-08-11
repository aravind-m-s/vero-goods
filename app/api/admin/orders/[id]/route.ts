import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, OrderStatus, PaymentStatus } from '@/lib/db/db';
import { isAdminAuthenticated } from '@/lib/auth/auth';
import { OrderStatusUpdateSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

// GET a single order with its items for admin (authenticated)
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const { id } = await props.params;
  const db = await getDb();

  const order = db.orders.find((o) => o.id === id);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const items = db.orderItems.filter((item) => item.orderId === id);

  return NextResponse.json({
    order,
    items,
  });
}

// PUT to update the status of an order
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const { id } = await props.params;
  const body = await request.json();

  const parsed = OrderStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status value', details: parsed.error.format() }, { status: 400 });
  }

  const newStatus = parsed.data.status;
  const db = await getDb();
  const order = db.orders.find((o) => o.id === id);

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Controlled status transition logic
  const currentStatus = order.orderStatus;
  
  if (currentStatus === OrderStatus.CANCELLED) {
    return NextResponse.json({ error: 'Cannot update status of a cancelled order' }, { status: 400 });
  }
  
  if (currentStatus === OrderStatus.DELIVERED) {
    return NextResponse.json({ error: 'Cannot update status of a delivered order' }, { status: 400 });
  }

  // Update status
  order.orderStatus = newStatus;
  order.updatedAt = new Date().toISOString();

  // If status transitions to DELIVERED, make sure paymentStatus is PAID if it was COD
  if (newStatus === OrderStatus.DELIVERED && order.paymentMethod === 'COD') {
    order.paymentStatus = PaymentStatus.PAID;
  }

  // If status transitions to CANCELLED, set paymentStatus as REFUNDED if it was already PAID
  if (newStatus === OrderStatus.CANCELLED && order.paymentStatus === PaymentStatus.PAID) {
    order.paymentStatus = PaymentStatus.REFUNDED;
  }

  await saveDb(db);

  // Email Notification Trigger Simulation (logs to terminal)
  console.log(`\n===============================================\n[EMAIL NOTIFICATION] Order #${order.orderNumber} status updated to ${newStatus}.\nCustomer Tracking URL: http://localhost:3000/order/track/${order.trackingToken}\n===============================================\n`);

  return NextResponse.json({ success: true, order });
}
