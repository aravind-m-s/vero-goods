import 'server-only';

import {
  cartAddsCollection,
  ordersCollection,
  productViewsCollection,
} from '@/shared/db/collections';
import type { ProductViewStats } from '@/features/analytics/types';

/** Default reporting window. Long enough to be stable, short enough to be current. */
export const DEFAULT_WINDOW_DAYS = 30;

function windowStart(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function recordProductView(productId: string, visitorId: string): Promise<void> {
  const views = await productViewsCollection();
  await views.insertOne({ productId, visitorId, at: new Date() });
}

export async function recordCartAdd(
  productId: string,
  variantId: string,
  visitorId: string
): Promise<void> {
  const cartAdds = await cartAddsCollection();
  await cartAdds.insertOne({ productId, variantId, visitorId, at: new Date() });
}

/**
 * Views and distinct viewers per product over the window.
 *
 * `$addToSet` holds every visitor id for a product in memory while the stage
 * runs, which is fine at this catalogue's traffic and would need replacing with
 * a pre-aggregated daily rollup long before it became a problem.
 */
export async function getProductViewStats(
  days = DEFAULT_WINDOW_DAYS
): Promise<Map<string, ProductViewStats>> {
  const views = await productViewsCollection();

  const rows = await views
    .aggregate<{ _id: string; views: number; uniqueViewers: number }>([
      { $match: { at: { $gte: windowStart(days) } } },
      {
        $group: {
          _id: '$productId',
          views: { $sum: 1 },
          visitors: { $addToSet: '$visitorId' },
        },
      },
      { $project: { views: 1, uniqueViewers: { $size: '$visitors' } } },
    ])
    .toArray();

  return new Map(rows.map((row) => [row._id, { views: row.views, uniqueViewers: row.uniqueViewers }]));
}

/**
 * Orders containing each product over the same window.
 *
 * Counts orders, not units: two of the same item in one basket is one person
 * deciding to buy, and conversion is about the decision. `orderItems` carries
 * no date of its own, so the window comes from the parent order.
 */
export async function getProductOrderCounts(
  days = DEFAULT_WINDOW_DAYS
): Promise<Map<string, number>> {
  const orders = await ordersCollection();

  const rows = await orders
    .aggregate<{ _id: string; orders: number }>([
      { $match: { createdAt: { $gte: windowStart(days).toISOString() } } },
      {
        $lookup: {
          from: 'orderItems',
          localField: 'id',
          foreignField: 'orderId',
          as: 'items',
        },
      },
      { $unwind: '$items' },
      // Group twice: the first collapses duplicate lines of one product within
      // a single order, the second counts the orders that remain.
      { $group: { _id: { productId: '$items.productId', orderId: '$id' } } },
      { $group: { _id: '$_id.productId', orders: { $sum: 1 } } },
    ])
    .toArray();

  return new Map(rows.map((row) => [row._id, row.orders]));
}
