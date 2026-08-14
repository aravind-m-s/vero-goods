import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCustomer } from '@/features/auth/server/auth';
import {
  OutOfStockError,
  findOrderByIdempotencyKey,
  insertOrder,
  nextOrderNumber,
  releaseStock,
  reserveStock,
} from '@/features/orders/server/orders.repo';
import { getVariantsByIds } from '@/features/catalog/server/products.repo';
import { productsCollection, stripIds } from '@/shared/db/collections';
import { updateCustomerContact } from '@/features/auth/server/users.repo';
import { CURRENCY } from '@/features/catalog/types';
import { OrderStatus, PaymentStatus, type Order, type OrderItem } from '@/features/orders/types';
import { sendEmail } from '@/shared/email/send';
import { orderReceivedEmail } from '@/shared/email/templates';
import { COD_MAX_ORDER_MINOR, calculateTotals, estimateDeliveryDate } from '@/features/checkout/server/pricing';
import { formatMinor } from '@/shared/lib/money';
import { clientIp, rateLimit } from '@/shared/lib/rate-limit';
import { randomId, randomToken } from '@/shared/lib/tokens';
import { CreateOrderSchema } from '@/features/checkout/schemas';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const customer = await getSessionCustomer();
  if (!customer) {
    return NextResponse.json({ error: 'Authentication required to place an order' }, { status: 401 });
  }

  const limit = await rateLimit(`create-order:${customer.id}:${clientIp(request)}`, 15, 60 * 10);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many checkout attempts. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Full server-side validation. Previously only the client validated the
  // address, so a hand-rolled request could store an undeliverable order.
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Retrying a timed-out checkout must not create a second order.
  const existing = await findOrderByIdempotencyKey(customer.id, input.idempotencyKey);
  if (existing) {
    return NextResponse.json({
      success: true,
      idempotentReplay: true,
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      trackingToken: existing.trackingToken,
      totalMinor: existing.totalMinor,
      paymentMethod: existing.paymentMethod,
    });
  }

  // Prices, stock and tax all come from the database. Nothing the client sends
  // about money is trusted — only variant ids and quantities.
  const variantIds = [...new Set(input.items.map((item) => item.variantId))];
  const variants = await getVariantsByIds(variantIds);

  if (variants.length !== variantIds.length) {
    return NextResponse.json({ error: 'One or more items are no longer available' }, { status: 409 });
  }

  const productsCol = await productsCollection();
  const products = stripIds(
    await productsCol.find({ id: { $in: [...new Set(variants.map((v) => v.productId))] } }).toArray()
  );

  const items: OrderItem[] = [];
  const orderId = randomId('ord');
  let maxLeadTimeDays = 0;

  for (const line of input.items) {
    const variant = variants.find((v) => v.id === line.variantId);
    const product = products.find((p) => p.id === variant?.productId);

    if (!variant || !product || !variant.isActive || !product.isActive) {
      return NextResponse.json(
        { error: `An item in your cart is no longer available` },
        { status: 409 }
      );
    }

    if (variant.stockQty < line.quantity && !variant.allowBackorder) {
      return NextResponse.json(
        {
          error: `Only ${variant.stockQty} left of ${product.title}${
            variant.name === 'Default' ? '' : ` (${variant.name})`
          }`,
          variantId: variant.id,
          availableQty: variant.stockQty,
        },
        { status: 409 }
      );
    }

    maxLeadTimeDays = Math.max(maxLeadTimeDays, variant.supplier.leadTimeDays);

    items.push({
      id: randomId('item'),
      orderId,
      productId: product.id,
      variantId: variant.id,
      productTitle: product.title,
      variantName: variant.name,
      sku: variant.sku,
      unitPriceMinor: variant.priceMinor,
      quantity: line.quantity,
      totalMinor: variant.priceMinor * line.quantity,
      gstRatePercent: product.gstRatePercent,
      costPriceMinor: variant.supplier.costPriceMinor,
      supplierName: variant.supplier.name,
      supplierSku: variant.supplier.sku,
    });
  }

  const totals = calculateTotals(
    items.map((item) => ({
      unitPriceMinor: item.unitPriceMinor,
      quantity: item.quantity,
      totalMinor: item.totalMinor,
      gstRatePercent: item.gstRatePercent,
    })),
    input.paymentMethod
  );

  if (input.paymentMethod === 'COD' && totals.totalMinor > COD_MAX_ORDER_MINOR()) {
    return NextResponse.json(
      {
        error: `Cash on delivery is unavailable above ${formatMinor(
          COD_MAX_ORDER_MINOR()
        )}. Please pay online.`,
      },
      { status: 400 }
    );
  }

  // Reserve stock before writing the order, so two shoppers cannot both buy the
  // last unit. Any failure here releases whatever was already reserved.
  const reservation = items.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
    label: `${item.productTitle} (${item.variantName})`,
  }));

  try {
    await reserveStock(reservation);
  } catch (error) {
    if (error instanceof OutOfStockError) {
      return NextResponse.json(
        { error: `${error.variantLabel} sold out while you were checking out`, variantId: error.variantId },
        { status: 409 }
      );
    }
    throw error;
  }

  try {
    const now = new Date().toISOString();
    const order: Order = {
      id: orderId,
      orderNumber: await nextOrderNumber(),
      userId: customer.id,
      email: input.email ?? customer.email ?? '',
      customerName: input.name,
      phone: input.phone,
      shippingAddress: input.shippingAddress,
      subtotalMinor: totals.subtotalMinor,
      shippingMinor: totals.shippingMinor,
      codFeeMinor: totals.codFeeMinor,
      taxMinor: totals.taxMinor,
      taxLines: totals.taxLines,
      totalMinor: totals.totalMinor,
      currency: CURRENCY,
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentMethod === 'COD' ? PaymentStatus.COD : PaymentStatus.PENDING,
      orderStatus: OrderStatus.PLACED,
      statusHistory: [{ status: OrderStatus.PLACED, at: now, by: 'customer' }],
      trackingToken: randomToken(32),
      estimatedDeliveryDate: estimateDeliveryDate(maxLeadTimeDays),
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    await insertOrder(order, items);
    await updateCustomerContact(customer.id, { name: input.name, phone: input.phone });

    // COD gets its receipt now; online orders get theirs once payment settles.
    // Neither is "confirmed" — an admin does that from the orders screen.
    if (order.paymentMethod === 'COD') {
      await sendEmail(orderReceivedEmail(order, items));
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
      totalMinor: order.totalMinor,
      paymentMethod: order.paymentMethod,
    });
  } catch (error) {
    // Never keep stock reserved for an order that failed to persist.
    await releaseStock(reservation);
    console.error('[orders] creation failed', error);
    return NextResponse.json({ error: 'Could not place your order. Please try again.' }, { status: 500 });
  }
}
