import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import { getProductInsights } from '@/features/analytics/server/insights.repo';

export const dynamic = 'force-dynamic';

/**
 * Funnel, trend and stock cover for one product.
 *
 * Its own endpoint rather than part of the product GET: the aggregations are
 * heavier than the product read, and the edit form must not wait on analytics
 * before it can be typed into.
 */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/api/admin/products/[id]/insights'>
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const { id } = await ctx.params;
  return NextResponse.json(await getProductInsights(id));
}
