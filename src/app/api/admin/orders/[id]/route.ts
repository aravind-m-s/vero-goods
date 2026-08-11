import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import {
  InvalidTransitionError,
  getOrderById,
  getOrderItems,
  recordRefund,
  updateOrderStatus,
} from '@/features/orders/server/orders.repo';
import { OrderStatus, PaymentStatus } from '@/features/orders/types';
import { sendEmail } from '@/shared/email/send';
import { statusUpdateEmail } from '@/shared/email/templates';
import { createRefund, razorpayKeys } from '@/features/payments/server/razorpay';
import { OrderStatusUpdateSchema } from '@/features/orders/schemas';

export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }
  return null;
}

export async function GET(_request: NextRequest, ctx: RouteContext<'/api/admin/orders/[id]'>) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const [order, items] = await Promise.all([getOrderById(id), getOrderItems(id)]);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Margin is admin-only information and is computed here rather than stored.
  const costMinor = items.reduce((sum, item) => sum + item.costPriceMinor * item.quantity, 0);
  return NextResponse.json({
    order,
    items,
    margin: {
      costMinor,
      grossMarginMinor: order.subtotalMinor - costMinor,
    },
  });
}

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/admin/orders/[id]'>) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;

  const parsed = OrderStatusUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid status update', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  let order;
  try {
    order = await updateOrderStatus(id, { ...parsed.data, by: 'admin' });
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      // Explicit state machine — no more jumping straight from PLACED to DELIVERED.
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

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

  const email = statusUpdateEmail(order);
  if (email) await sendEmail(email);

  return NextResponse.json({ success: true, order });
}

/** Customer-initiated cancellation is handled elsewhere; this is the admin path. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/admin/orders/[id]'>) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  try {
    const order = await updateOrderStatus(id, {
      status: OrderStatus.CANCELLED,
      by: 'admin',
      note: 'Cancelled from admin portal',
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const email = statusUpdateEmail(order);
    if (email) await sendEmail(email);

    return NextResponse.json({ success: true, order });
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
