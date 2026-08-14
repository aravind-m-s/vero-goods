import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCustomer } from '@/features/auth/server/auth';
import { getCustomerOrder, getOrderItems } from '@/features/orders/server/orders.repo';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, ctx: RouteContext<'/api/account/orders/[id]'>) {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

  const { id } = await ctx.params;
  // Scoped to the session's own user id, so guessing an order id gets a 404
  // rather than someone else's invoice.
  const order = await getCustomerOrder(customer.id, id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const items = await getOrderItems(order.id);

  // Supplier cost and margin are admin-only; strip them from the customer view.
  return NextResponse.json({
    order,
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      variantId: item.variantId,
      productTitle: item.productTitle,
      variantName: item.variantName,
      sku: item.sku,
      imageUrl: item.imageUrl,
      unitPriceMinor: item.unitPriceMinor,
      quantity: item.quantity,
      totalMinor: item.totalMinor,
      gstRatePercent: item.gstRatePercent,
    })),
  });
}
