import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import { listProductRequests } from '@/features/requests/server/requests.repo';
import { ProductRequestStatus } from '@/features/requests/types';

export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const statusParam = params.get('status');
  const status =
    statusParam && statusParam !== 'ALL' && statusParam in ProductRequestStatus
      ? (statusParam as ProductRequestStatus)
      : 'ALL';

  return NextResponse.json(
    await listProductRequests({
      status,
      page: Number(params.get('page')) || 1,
      pageSize: Number(params.get('pageSize')) || 25,
    })
  );
}
