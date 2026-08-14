import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import { updateProductRequest } from '@/features/requests/server/requests.repo';
import { ProductRequestUpdateSchema } from '@/features/requests/schemas';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/admin/product-requests/[id]'>
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = ProductRequestUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid update' },
      { status: 400 }
    );
  }

  const updated = await updateProductRequest(id, parsed.data);
  if (!updated) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  return NextResponse.json({ success: true, request: updated });
}
