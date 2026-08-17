import { NextResponse, type NextRequest } from 'next/server';
import { getVariantsByIds } from '@/features/catalog/server/products.repo';
import { productsCollection, stripIds } from '@/shared/db/collections';
import { calculateTotals } from '@/features/checkout/server/pricing';
import { PriceQuoteSchema } from '@/features/checkout/schemas';
import { basketPaymentMethods, type PaymentSupport } from '@/features/catalog/types';

export const dynamic = 'force-dynamic';

/**
 * Authoritative pricing for a basket.
 *
 * The cart lives in localStorage and can be arbitrarily stale — a price changed
 * last month is still sitting in some shopper's browser. The client calls this
 * on load and before checkout so the totals on screen are the totals that will
 * be charged, and so shipping and GST are never guessed client-side.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = PriceQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid cart payload' }, { status: 400 });
  }

  const { items, paymentMethod } = parsed.data;
  if (items.length === 0) {
    return NextResponse.json({
      lines: [],
      totals: calculateTotals([], paymentMethod),
      unavailableVariantIds: [],
      availablePaymentMethods: basketPaymentMethods([]),
    });
  }

  const variantIds = [...new Set(items.map((item) => item.variantId))];
  const variants = await getVariantsByIds(variantIds);
  const productsCol = await productsCollection();
  const products = stripIds(
    await productsCol.find({ id: { $in: [...new Set(variants.map((v) => v.productId))] } }).toArray()
  );

  const unavailableVariantIds: string[] = [];
  const lines = [];
  /** Payment rules of the products actually being bought, in basket order. */
  const supports: Array<PaymentSupport | undefined> = [];

  for (const item of items) {
    const variant = variants.find((v) => v.id === item.variantId);
    const product = products.find((p) => p.id === variant?.productId);

    if (!variant || !product || !variant.isActive || !product.isActive) {
      unavailableVariantIds.push(item.variantId);
      continue;
    }

    const availableQty = variant.allowBackorder ? item.quantity : variant.stockQty;
    const quantity = Math.min(item.quantity, availableQty);

    if (quantity > 0) supports.push(product.paymentSupport);

    lines.push({
      variantId: variant.id,
      productId: product.id,
      productTitle: product.title,
      productSlug: product.slug,
      variantName: variant.name,
      sku: variant.sku,
      unitPriceMinor: variant.priceMinor,
      compareAtPriceMinor: variant.compareAtPriceMinor,
      requestedQuantity: item.quantity,
      quantity,
      totalMinor: variant.priceMinor * quantity,
      gstRatePercent: product.gstRatePercent,
      stockQty: variant.stockQty,
      allowBackorder: variant.allowBackorder,
      inStock: quantity > 0,
    });
  }

  // A method the basket does not accept cannot price it either: quoting a COD
  // fee on a prepaid-only basket would show a total nobody can ever be charged.
  const availablePaymentMethods = basketPaymentMethods(supports);
  const effectiveMethod = availablePaymentMethods.includes(paymentMethod)
    ? paymentMethod
    : availablePaymentMethods[0] ?? 'RAZORPAY';

  const totals = calculateTotals(
    lines
      .filter((line) => line.quantity > 0)
      .map((line) => ({
        unitPriceMinor: line.unitPriceMinor,
        quantity: line.quantity,
        totalMinor: line.totalMinor,
        gstRatePercent: line.gstRatePercent,
      })),
    effectiveMethod
  );

  return NextResponse.json({ lines, totals, unavailableVariantIds, availablePaymentMethods });
}
