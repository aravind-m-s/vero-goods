import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { recordCartAdd } from '@/features/analytics/server/views.repo';
import { shouldRecordEvent } from '@/features/analytics/server/ingest';

export const dynamic = 'force-dynamic';

const CartAddSchema = z.object({
  productId: z.string().min(1).max(64),
  variantId: z.string().min(1).max(64),
  visitorId: z.string().min(8).max(64),
});

/**
 * Records cart intent — the step between looking and buying.
 *
 * This is the measurement that makes the other two readable. A product with
 * views and no orders is ambiguous on its own: the listing may have failed to
 * convince anyone, or checkout may have scared off people who were ready. Those
 * need opposite fixes, and only this step tells them apart.
 *
 * Silent like the view beacon: nothing here is worth interrupting a purchase.
 */
export async function POST(request: NextRequest) {
  if (!(await shouldRecordEvent(request, 'cart-add'))) {
    return new NextResponse(null, { status: 204 });
  }

  let parsed;
  try {
    parsed = CartAddSchema.safeParse(await request.json());
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (!parsed.success) return new NextResponse(null, { status: 204 });

  try {
    await recordCartAdd(parsed.data.productId, parsed.data.variantId, parsed.data.visitorId);
  } catch (error) {
    console.error('[analytics] could not record cart add', error);
  }

  return new NextResponse(null, { status: 204 });
}
