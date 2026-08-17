import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import {
  ShipmentNotEditableError,
  getOrderById,
  getOrderItems,
  updateShipment,
} from '@/features/orders/server/orders.repo';
import {
  applyAdminStatusChange,
  statusChangeHttpStatus,
} from '@/features/orders/server/admin-status';
import { OrderStatus, type Order } from '@/features/orders/types';
import { sendEmail } from '@/shared/email/send';
import { statusUpdateEmail } from '@/shared/email/templates';
import {
  OrderShipmentUpdateSchema,
  OrderStatusUpdateSchema,
} from '@/features/orders/schemas';

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

  // Explicit state machine — no more jumping straight from PLACED to DELIVERED.
  const result = await applyAdminStatusChange(id, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: statusChangeHttpStatus(result.reason) }
    );
  }

  const email = statusUpdateEmail(result.order);
  if (email) await sendEmail(email);

  return NextResponse.json({ success: true, order: result.order });
}

/**
 * Courier and AWB only, with no status move.
 *
 * Shipping an order no longer requires a tracking number: the courier issues it
 * after the parcel is handed over, and blocking the status change on it meant
 * either waiting or typing a placeholder. This is where it lands afterwards.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/admin/orders/[id]'>) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = OrderShipmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid shipment update', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const before = await getOrderById(id);
  if (!before) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  let order: Order | null;
  try {
    order = await updateShipment(id, { ...parsed.data, by: 'admin' });
  } catch (error) {
    if (error instanceof ShipmentNotEditableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // The customer is told only when a dispatched order gains a tracking number
  // it did not have — that is the mail they are waiting for. Correcting a typo
  // or naming the courier is not worth an inbox.
  const isDispatched =
    order.orderStatus === OrderStatus.SHIPPED ||
    order.orderStatus === OrderStatus.OUT_FOR_DELIVERY;
  const trackingChanged = Boolean(order.trackingNumber) && order.trackingNumber !== before.trackingNumber;

  let emailed = false;
  if (isDispatched && trackingChanged) {
    const email = statusUpdateEmail(order);
    if (email) {
      await sendEmail(email);
      emailed = true;
    }
  }

  return NextResponse.json({ success: true, order, emailed });
}

/** Customer-initiated cancellation is handled elsewhere; this is the admin path. */
export async function DELETE(_request: NextRequest, ctx: RouteContext<'/api/admin/orders/[id]'>) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const result = await applyAdminStatusChange(id, {
    status: OrderStatus.CANCELLED,
    note: 'Cancelled from admin portal',
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: statusChangeHttpStatus(result.reason) }
    );
  }

  const email = statusUpdateEmail(result.order);
  if (email) await sendEmail(email);

  return NextResponse.json({ success: true, order: result.order });
}
