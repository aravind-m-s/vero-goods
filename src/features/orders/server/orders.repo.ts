import 'server-only';

import {
  nextSequence,
  orderItemsCollection,
  ordersCollection,
  productImagesCollection,
  stripId,
  stripIds,
  variantsCollection,
} from '@/shared/db/collections';
import { ALLOWED_STATUS_TRANSITIONS, OrderStatus, PaymentStatus, type Order, type OrderItem } from '@/features/orders/types';

export async function getOrderById(id: string): Promise<Order | null> {
  const orders = await ordersCollection();
  return stripId(await orders.findOne({ id }));
}

export async function getOrderByTrackingToken(token: string): Promise<Order | null> {
  const orders = await ordersCollection();
  return stripId(await orders.findOne({ trackingToken: token }));
}

export async function getOrderByRazorpayOrderId(razorpayOrderId: string): Promise<Order | null> {
  const orders = await ordersCollection();
  return stripId(await orders.findOne({ razorpayOrderId }));
}

export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  const itemsCol = await orderItemsCollection();
  const items = stripIds(await itemsCol.find({ orderId }).toArray());

  // Orders placed before the line image was snapshotted have none stored, and
  // rendered a grey placeholder forever. Fall back to the product's current
  // image for those — the snapshot on newer orders is still preferred, so a
  // product changing its photo does not rewrite the picture on an old receipt.
  const missing = items.filter((item) => !item.imageUrl);
  if (missing.length === 0) return items;

  const imagesCol = await productImagesCollection();
  const images = stripIds(
    await imagesCol
      .find({ productId: { $in: [...new Set(missing.map((item) => item.productId))] }, sortOrder: 0 })
      .toArray()
  );
  if (images.length === 0) return items;

  return items.map((item) =>
    item.imageUrl
      ? item
      : { ...item, imageUrl: images.find((image) => image.productId === item.productId)?.url }
  );
}

export async function findOrderByIdempotencyKey(
  userId: string,
  idempotencyKey: string
): Promise<Order | null> {
  const orders = await ordersCollection();
  return stripId(await orders.findOne({ userId, idempotencyKey }));
}

export interface OrderPage {
  orders: Order[];
  total: number;
}

/** Paginated + filtered at the database, not in application memory. */
export async function listOrders(opts: {
  status?: OrderStatus | 'ALL';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}): Promise<OrderPage> {
  const orders = await ordersCollection();
  const filter = buildOrderFilter(opts);
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));

  const [docs, total] = await Promise.all([
    orders
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    orders.countDocuments(filter),
  ]);

  return { orders: stripIds(docs), total };
}

/** One customer's own order history, newest first. Always scoped by `userId`. */
export async function listCustomerOrders(
  userId: string,
  opts: { page?: number; pageSize?: number } = {}
): Promise<OrderPage> {
  const orders = await ordersCollection();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, opts.pageSize ?? 10));

  const [docs, total] = await Promise.all([
    orders
      .find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    orders.countDocuments({ userId }),
  ]);

  return { orders: stripIds(docs), total };
}

/** Reads an order only if it belongs to this customer. */
export async function getCustomerOrder(userId: string, orderId: string): Promise<Order | null> {
  const orders = await ordersCollection();
  return stripId(await orders.findOne({ id: orderId, userId }));
}

/** Streams matching orders for CSV export without loading the collection into memory. */
export async function* iterateOrders(opts: {
  status?: OrderStatus | 'ALL';
  dateFrom?: string;
  dateTo?: string;
}): AsyncGenerator<Order> {
  const orders = await ordersCollection();
  const cursor = orders.find(buildOrderFilter(opts)).sort({ createdAt: -1 });
  for await (const doc of cursor) {
    yield stripId(doc) as Order;
  }
}

function buildOrderFilter(opts: {
  status?: OrderStatus | 'ALL';
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (opts.status && opts.status !== 'ALL') {
    filter.orderStatus = opts.status;
  }

  if (opts.dateFrom || opts.dateTo) {
    const createdAt: Record<string, string> = {};
    if (opts.dateFrom) createdAt.$gte = new Date(`${opts.dateFrom}T00:00:00.000Z`).toISOString();
    if (opts.dateTo) createdAt.$lte = new Date(`${opts.dateTo}T23:59:59.999Z`).toISOString();
    filter.createdAt = createdAt;
  }

  if (opts.search) {
    // Escaped so a customer-supplied string cannot inject regex operators.
    const escaped = opts.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = { $regex: escaped, $options: 'i' };
    filter.$or = [{ orderNumber: rx }, { email: rx }, { customerName: rx }, { phone: rx }];
  }

  return filter;
}

export async function nextOrderNumber(): Promise<string> {
  const seq = await nextSequence('orderNumber', 1000);
  return `VG-${String(seq).padStart(4, '0')}`;
}

export async function nextInvoiceNumber(): Promise<string> {
  const seq = await nextSequence('invoiceNumber', 0);
  const fy = indianFinancialYear(new Date());
  return `VG/${fy}/${String(seq).padStart(5, '0')}`;
}

/** Indian FY runs April–March, e.g. "2026-27". */
function indianFinancialYear(date: Date): string {
  const year = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export class OutOfStockError extends Error {
  constructor(public readonly variantId: string, public readonly variantLabel: string) {
    super(`Insufficient stock for ${variantLabel}`);
    this.name = 'OutOfStockError';
  }
}

/**
 * Reserves stock for each line atomically.
 *
 * `updateOne` with a `stockQty: { $gte: qty }` guard is a compare-and-set: two
 * concurrent checkouts for the last unit cannot both succeed. If any line fails,
 * previously reserved lines are released before throwing, so we never leave
 * phantom reservations behind.
 */
export async function reserveStock(
  lines: Array<{ variantId: string; quantity: number; label: string }>
): Promise<void> {
  const variants = await variantsCollection();
  const reserved: Array<{ variantId: string; quantity: number }> = [];

  for (const line of lines) {
    const result = await variants.updateOne(
      {
        id: line.variantId,
        $or: [{ stockQty: { $gte: line.quantity } }, { allowBackorder: true }],
      },
      { $inc: { stockQty: -line.quantity } }
    );

    if (result.matchedCount === 0) {
      await releaseStock(reserved);
      throw new OutOfStockError(line.variantId, line.label);
    }
    reserved.push({ variantId: line.variantId, quantity: line.quantity });
  }
}

export async function releaseStock(
  lines: Array<{ variantId: string; quantity: number }>
): Promise<void> {
  if (lines.length === 0) return;
  const variants = await variantsCollection();
  for (const line of lines) {
    await variants.updateOne({ id: line.variantId }, { $inc: { stockQty: line.quantity } });
  }
}

export async function insertOrder(order: Order, items: OrderItem[]): Promise<void> {
  const [orders, orderItems] = await Promise.all([ordersCollection(), orderItemsCollection()]);
  await orders.insertOne({ ...order });
  if (items.length > 0) {
    await orderItems.insertMany(items.map((item) => ({ ...item })));
  }
}

export async function deleteOrder(orderId: string): Promise<void> {
  const [orders, orderItems] = await Promise.all([ordersCollection(), orderItemsCollection()]);
  await Promise.all([orders.deleteOne({ id: orderId }), orderItems.deleteMany({ orderId })]);
}

export async function attachRazorpayOrderId(
  orderId: string,
  razorpayOrderId: string
): Promise<void> {
  const orders = await ordersCollection();
  await orders.updateOne(
    { id: orderId },
    { $set: { razorpayOrderId, updatedAt: new Date().toISOString() } }
  );
}

/**
 * Marks an order paid exactly once.
 *
 * The `paymentStatus: { $ne: PAID }` guard makes this idempotent: the client
 * callback and the Razorpay webhook race each other by design, and whichever
 * arrives second is a no-op rather than a double-processing.
 * Returns the updated order, or null if it was already paid.
 *
 * Payment settles the money only — `orderStatus` is deliberately left alone.
 * Confirming an order is a human decision (stock actually on hand, address
 * sane, fraud check), so it stays PLACED until an admin moves it to CONFIRMED.
 */
export async function markOrderPaid(
  orderId: string,
  razorpayPaymentId: string,
  razorpayOrderId: string
): Promise<Order | null> {
  const orders = await ordersCollection();
  const now = new Date().toISOString();

  const result = await orders.findOneAndUpdate(
    { id: orderId, paymentStatus: { $ne: PaymentStatus.PAID } },
    // Pipeline update: the history entry records the status the order is
    // already in, so a payment never reads as a fulfilment step.
    [
      {
        $set: {
          paymentStatus: PaymentStatus.PAID,
          razorpayPaymentId,
          razorpayOrderId,
          updatedAt: now,
          statusHistory: {
            $concatArrays: [
              { $ifNull: ['$statusHistory', []] },
              [
                {
                  status: '$orderStatus',
                  at: now,
                  by: 'system',
                  note: `Payment ${razorpayPaymentId} verified`,
                },
              ],
            ],
          },
        },
      },
    ],
    { returnDocument: 'after' }
  );

  return stripId(result);
}

export async function markPaymentFailed(orderId: string, reason: string): Promise<void> {
  const orders = await ordersCollection();
  await orders.updateOne(
    { id: orderId, paymentStatus: PaymentStatus.PENDING },
    {
      $set: { paymentStatus: PaymentStatus.FAILED, updatedAt: new Date().toISOString() },
      $push: {
        statusHistory: {
          status: OrderStatus.PLACED,
          at: new Date().toISOString(),
          by: 'system',
          note: `Payment failed: ${reason}`,
        },
      },
    }
  );
}

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus) {
    super(`Cannot move an order from ${from} to ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export class PaymentNotSettledError extends Error {
  constructor(orderNumber: string) {
    super(`Order ${orderNumber} cannot be confirmed until its payment is captured`);
    this.name = 'PaymentNotSettledError';
  }
}

export interface StatusUpdateInput {
  status: OrderStatus;
  by: string;
  note?: string;
  trackingNumber?: string;
  courier?: string;
}

export async function updateOrderStatus(
  orderId: string,
  input: StatusUpdateInput
): Promise<Order | null> {
  const current = await getOrderById(orderId);
  if (!current) return null;

  if (!ALLOWED_STATUS_TRANSITIONS[current.orderStatus].includes(input.status)) {
    throw new InvalidTransitionError(current.orderStatus, input.status);
  }

  // Prepaid orders are only confirmable once the money is actually captured;
  // COD collects at delivery, so it confirms on the admin's judgement alone.
  if (
    input.status === OrderStatus.CONFIRMED &&
    current.paymentMethod !== 'COD' &&
    current.paymentStatus !== PaymentStatus.PAID
  ) {
    throw new PaymentNotSettledError(current.orderNumber);
  }

  const now = new Date().toISOString();
  const set: Record<string, unknown> = { orderStatus: input.status, updatedAt: now };

  if (input.trackingNumber) set.trackingNumber = input.trackingNumber;
  if (input.courier) set.courier = input.courier;

  // COD is collected by the courier at handover.
  if (input.status === OrderStatus.DELIVERED && current.paymentMethod === 'COD') {
    set.paymentStatus = PaymentStatus.PAID;
  }

  if (input.status === OrderStatus.CANCELLED) {
    set.cancellationReason = input.note ?? 'Cancelled by admin';
    if (current.paymentStatus === PaymentStatus.PAID) {
      set.paymentStatus = PaymentStatus.REFUND_PENDING;
    }
  }

  if (input.status === OrderStatus.RETURNED && current.paymentStatus === PaymentStatus.PAID) {
    set.paymentStatus = PaymentStatus.REFUND_PENDING;
  }

  // Cancelling or returning puts the units back on the shelf.
  if (input.status === OrderStatus.CANCELLED || input.status === OrderStatus.RETURNED) {
    const items = await getOrderItems(orderId);
    await releaseStock(items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })));
  }

  const orders = await ordersCollection();
  const result = await orders.findOneAndUpdate(
    { id: orderId, orderStatus: current.orderStatus },
    {
      $set: set,
      $push: {
        statusHistory: { status: input.status, at: now, by: input.by, note: input.note },
      },
    },
    { returnDocument: 'after' }
  );

  return stripId(result);
}

export class ShipmentNotEditableError extends Error {
  constructor(orderNumber: string, status: OrderStatus) {
    super(`Order ${orderNumber} is ${status} and its shipment can no longer be edited`);
    this.name = 'ShipmentNotEditableError';
  }
}

/**
 * Sets the courier and AWB without moving the order.
 *
 * Shipping no longer waits on the tracking number — the courier issues it after
 * the handover — so this is how it gets attached later. The change is recorded
 * in the history against whatever status the order is already in, the same way
 * a payment is, so filling in an AWB never reads as a fulfilment step.
 *
 * An empty string clears the field: an AWB typed in wrong has to be removable.
 */
export async function updateShipment(
  orderId: string,
  input: { trackingNumber?: string; courier?: string; by: string }
): Promise<Order | null> {
  const current = await getOrderById(orderId);
  if (!current) return null;

  if (current.orderStatus === OrderStatus.CANCELLED || current.orderStatus === OrderStatus.RETURNED) {
    throw new ShipmentNotEditableError(current.orderNumber, current.orderStatus);
  }

  const now = new Date().toISOString();
  const set: Record<string, unknown> = { updatedAt: now };
  const unset: Record<string, ''> = {};

  if (input.trackingNumber !== undefined) {
    if (input.trackingNumber) set.trackingNumber = input.trackingNumber;
    else unset.trackingNumber = '';
  }
  if (input.courier !== undefined) {
    if (input.courier) set.courier = input.courier;
    else unset.courier = '';
  }

  const note = [
    input.courier !== undefined ? `courier ${input.courier || 'cleared'}` : null,
    input.trackingNumber !== undefined ? `AWB ${input.trackingNumber || 'cleared'}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const orders = await ordersCollection();
  const result = await orders.findOneAndUpdate(
    { id: orderId },
    {
      $set: set,
      ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}),
      $push: {
        statusHistory: {
          status: current.orderStatus,
          at: now,
          by: input.by,
          note: `Shipment updated: ${note}`,
        },
      },
    },
    { returnDocument: 'after' }
  );

  return stripId(result);
}

export async function recordRefund(
  orderId: string,
  refundId: string,
  amountMinor: number
): Promise<Order | null> {
  const orders = await ordersCollection();
  const result = await orders.findOneAndUpdate(
    { id: orderId },
    {
      $set: {
        paymentStatus: PaymentStatus.REFUNDED,
        razorpayRefundId: refundId,
        refundedAmountMinor: amountMinor,
        updatedAt: new Date().toISOString(),
      },
    },
    { returnDocument: 'after' }
  );
  return stripId(result);
}

export async function setInvoiceNumber(orderId: string, invoiceNumber: string): Promise<void> {
  const orders = await ordersCollection();
  await orders.updateOne({ id: orderId, invoiceNumber: { $exists: false } }, { $set: { invoiceNumber } });
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenueMinor: number;
  pendingFulfilment: number;
  deliveredOrders: number;
  lowStockVariants: number;
  recentOrders: Order[];
}

/** Aggregated in Mongo — the old version pulled every order into Node to count them. */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [orders, variants] = await Promise.all([ordersCollection(), variantsCollection()]);

  const [totals, recent, lowStockVariants] = await Promise.all([
    orders
      .aggregate<{
        _id: null;
        totalOrders: number;
        totalRevenueMinor: number;
        pendingFulfilment: number;
        deliveredOrders: number;
      }>([
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenueMinor: {
              $sum: {
                $cond: [
                  { $in: ['$paymentStatus', [PaymentStatus.PAID, PaymentStatus.COD]] },
                  '$totalMinor',
                  0,
                ],
              },
            },
            pendingFulfilment: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      '$orderStatus',
                      [
                        OrderStatus.PLACED,
                        OrderStatus.CONFIRMED,
                        OrderStatus.PACKED,
                        OrderStatus.SHIPPED,
                        OrderStatus.OUT_FOR_DELIVERY,
                      ],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            deliveredOrders: {
              $sum: { $cond: [{ $eq: ['$orderStatus', OrderStatus.DELIVERED] }, 1, 0] },
            },
          },
        },
      ])
      .toArray(),
    orders.find({}).sort({ createdAt: -1 }).limit(5).toArray(),
    variants.countDocuments({ stockQty: { $lte: 5 }, allowBackorder: false, isActive: true }),
  ]);

  const agg = totals[0];
  return {
    totalOrders: agg?.totalOrders ?? 0,
    totalRevenueMinor: agg?.totalRevenueMinor ?? 0,
    pendingFulfilment: agg?.pendingFulfilment ?? 0,
    deliveredOrders: agg?.deliveredOrders ?? 0,
    lowStockVariants,
    recentOrders: stripIds(recent),
  };
}
