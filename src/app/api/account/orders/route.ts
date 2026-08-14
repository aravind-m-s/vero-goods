import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCustomer } from '@/features/auth/server/auth';
import { listCustomerOrders } from '@/features/orders/server/orders.repo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const page = Number(params.get('page')) || 1;
  const pageSize = Number(params.get('pageSize')) || 10;

  const { orders, total } = await listCustomerOrders(customer.id, { page, pageSize });
  return NextResponse.json({ orders, total, page, pageSize });
}
