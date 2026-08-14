import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCustomer } from '@/features/auth/server/auth';
import { normalisePhone } from '@/features/auth/server/users.repo';
import { getProductById } from '@/features/catalog/server/products.repo';
import {
  createProductRequest,
  findRecentDuplicate,
} from '@/features/requests/server/requests.repo';
import { ProductRequestSchema } from '@/features/requests/schemas';
import { sendEmail } from '@/shared/email/send';
import { productRequestAdminEmail, productRequestCustomerEmail } from '@/shared/email/templates';
import { clientIp, rateLimit } from '@/shared/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * POST — "Get it for me": a customer asks the seller to source an out-of-stock
 * product. Open to guests, because demand from someone who has not signed up is
 * still demand; contact details are what make it actionable.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request);
  const limit = await rateLimit(`product-request:${ip}`, 10, 60 * 60);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = ProductRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Check the details and try again' },
      { status: 400 }
    );
  }

  const input = parsed.data;
  // Product title, slug and SKU are read from the catalogue, never from the
  // client — the payload only says *which* product.
  const detail = await getProductById(input.productId);
  if (!detail || !detail.product.isActive) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const variant = input.variantId
    ? detail.variants.find((item) => item.id === input.variantId)
    : undefined;
  if (input.variantId && !variant) {
    return NextResponse.json({ error: 'That option no longer exists' }, { status: 404 });
  }

  const phone = normalisePhone(input.phone);
  const duplicate = await findRecentDuplicate(detail.product.id, phone);
  if (duplicate) {
    return NextResponse.json({
      success: true,
      duplicate: true,
      requestId: duplicate.id,
      message: 'You have already asked us for this — our team is on it.',
    });
  }

  const customer = await getSessionCustomer();
  const created = await createProductRequest({
    productId: detail.product.id,
    productSlug: detail.product.slug,
    productTitle: detail.product.title,
    variantId: variant?.id,
    variantName: variant?.name,
    sku: variant?.sku,
    userId: customer?.id,
    customerName: input.customerName,
    email: input.email || customer?.email || undefined,
    phone,
    quantity: input.quantity,
    note: input.note || undefined,
  });

  // Neither email is allowed to fail the request — the demand signal is already
  // recorded, and `sendEmail` swallows provider errors by design.
  await Promise.all([
    sendEmail(productRequestCustomerEmail(created)),
    sendEmail(productRequestAdminEmail(created)),
  ]);

  return NextResponse.json(
    {
      success: true,
      requestId: created.id,
      message: 'Request received. Our team will get back to you.',
    },
    { status: 201 }
  );
}
