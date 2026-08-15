import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import { getOrderById, getOrderItems } from '@/features/orders/server/orders.repo';
import {
  applyAdminStatusChange,
  statusChangeHttpStatus,
} from '@/features/orders/server/admin-status';
import { OrderStatus } from '@/features/orders/types';
import { sendEmail } from '@/shared/email/send';
import { statusUpdateEmail } from '@/shared/email/templates';
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
