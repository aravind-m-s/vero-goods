import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { recordProductView } from '@/features/analytics/server/views.repo';
import { shouldRecordEvent } from '@/features/analytics/server/ingest';

export const dynamic = 'force-dynamic';

const ViewSchema = z.object({
  productId: z.string().min(1).max(64),
  visitorId: z.string().min(8).max(64),
});

/**
 * Records one product view.
 *
 * Called from the browser after the product page paints, never from the page
 * render: `/products/[slug]` is statically generated, and counting on the
 * server would turn every product page dynamic — a real cost to every shopper,
 * paid to collect analytics.
 *
 * Always answers 204. A view that fails to record is not worth telling the
 * shopper about, and an error here must never look like a broken page.
 */
export async function POST(request: NextRequest) {
  if (!(await shouldRecordEvent(request, 'product-view'))) {
    return new NextResponse(null, { status: 204 });
  }

  let parsed;
  try {
    parsed = ViewSchema.safeParse(await request.json());
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (!parsed.success) return new NextResponse(null, { status: 204 });

  try {
    await recordProductView(parsed.data.productId, parsed.data.visitorId);
  } catch (error) {
    console.error('[analytics] could not record product view', error);
  }

  return new NextResponse(null, { status: 204 });
}
