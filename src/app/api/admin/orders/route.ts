import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import { listOrders } from '@/features/orders/server/orders.repo';
import { OrderStatus } from '@/features/orders/types';

export const dynamic = 'force-dynamic';

/**
 * Filtered and paginated in Mongo. The previous version returned every order in
 * the database on every request and filtered in the browser.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const statusParam = params.get('status');
  const status =
    statusParam && statusParam !== 'ALL' && statusParam in OrderStatus
      ? (statusParam as OrderStatus)
      : 'ALL';

  const { orders, total } = await listOrders({
    status,
    search: params.get('search') ?? undefined,
    dateFrom: params.get('dateFrom') ?? undefined,
    dateTo: params.get('dateTo') ?? undefined,
    page: Number(params.get('page') ?? 1),
    pageSize: Number(params.get('pageSize') ?? 20),
  });

  return NextResponse.json({ orders, total });
}
