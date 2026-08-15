import 'server-only';

import {
  cartAddsCollection,
  ordersCollection,
  priceHistoryCollection,
  productRequestsCollection,
  productViewsCollection,
  stripIds,
  variantsCollection,
} from '@/shared/db/collections';
import { OrderStatus } from '@/features/orders/types';
import { ProductRequestStatus } from '@/features/requests/types';
import type { PriceChange } from '@/features/analytics/types';

export const INSIGHT_WINDOW_DAYS = 30;

/**
 * Below this, every percentage on the panel is noise.
 *
 * Three viewers and no orders is not a failing product, it is an unmeasured
 * one — and a panel that says "0% conversion" on three viewers will talk you
 * into dropping something perfectly good.
 */
export const MIN_VIEWERS_FOR_VERDICT = 30;

function windowStart(days: number, offsetWindows = 0): Date {
  return new Date(Date.now() - (days * (offsetWindows + 1)) * 24 * 60 * 60 * 1000);
}

/** One funnel measured over one window. */
export interface FunnelCounts {
  views: number;
  uniqueViewers: number;
  cartVisitors: number;
  orders: number;
  units: number;
  revenueMinor: number;
  costMinor: number;
}

export interface ProductInsights {
  windowDays: number;
  current: FunnelCounts;
  /** The window immediately before `current`, for direction. */
  previous: FunnelCounts;
  /** Units sold per day over the current window, used for stock cover. */
  stockQty: number;
  daysOfStock: number | null;
  cancelledOrders: number;
  returnedOrders: number;
  openRequests: number;
  priceChanges: PriceChange[];
  hasEnoughData: boolean;
}

async function funnelFor(productId: string, from: Date, to: Date): Promise<FunnelCounts> {
  const [views, cartAdds, orders] = await Promise.all([
    productViewsCollection(),
    cartAddsCollection(),
    ordersCollection(),
  ]);

  const [viewRows, cartRows, orderRows] = await Promise.all([
    views
      .aggregate<{ views: number; uniqueViewers: number }>([
        { $match: { productId, at: { $gte: from, $lt: to } } },
        { $group: { _id: null, views: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
        { $project: { views: 1, uniqueViewers: { $size: '$visitors' } } },
      ])
      .toArray(),

    // Counted as people, not events, so it divides cleanly into unique viewers.
    cartAdds
      .aggregate<{ cartVisitors: number }>([
        { $match: { productId, at: { $gte: from, $lt: to } } },
        { $group: { _id: null, visitors: { $addToSet: '$visitorId' } } },
        { $project: { cartVisitors: { $size: '$visitors' } } },
      ])
      .toArray(),

    orders
      .aggregate<{ orders: number; units: number; revenueMinor: number; costMinor: number }>([
        {
          $match: {
            createdAt: { $gte: from.toISOString(), $lt: to.toISOString() },
            // A cancelled order is not a sale; counting it would flatter every
            // conversion rate on the panel.
            orderStatus: { $nin: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
          },
        },
        {
          $lookup: {
            from: 'orderItems',
            localField: 'id',
            foreignField: 'orderId',
            as: 'items',
          },
        },
        { $unwind: '$items' },
        { $match: { 'items.productId': productId } },
        {
          $group: {
            _id: '$id',
            units: { $sum: '$items.quantity' },
            revenueMinor: { $sum: '$items.totalMinor' },
            costMinor: { $sum: { $multiply: ['$items.costPriceMinor', '$items.quantity'] } },
          },
        },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            units: { $sum: '$units' },
            revenueMinor: { $sum: '$revenueMinor' },
            costMinor: { $sum: '$costMinor' },
          },
        },
      ])
      .toArray(),
  ]);

  return {
    views: viewRows[0]?.views ?? 0,
    uniqueViewers: viewRows[0]?.uniqueViewers ?? 0,
    cartVisitors: cartRows[0]?.cartVisitors ?? 0,
    orders: orderRows[0]?.orders ?? 0,
    units: orderRows[0]?.units ?? 0,
    revenueMinor: orderRows[0]?.revenueMinor ?? 0,
    costMinor: orderRows[0]?.costMinor ?? 0,
  };
}

/**
 * Everything the product panel needs to argue for a price move, a promotion, or
 * dropping the product.
 *
 * Two windows rather than one, because direction beats level: 12 orders means
 * nothing until you know last month was 4 or 30.
 */
export async function getProductInsights(
  productId: string,
  days = INSIGHT_WINDOW_DAYS
): Promise<ProductInsights> {
  const now = new Date();
  const currentFrom = windowStart(days);
  const previousFrom = windowStart(days, 1);

  const [current, previous, variantDocs, statusRows, requests, priceRows] = await Promise.all([
    funnelFor(productId, currentFrom, now),
    funnelFor(productId, previousFrom, currentFrom),

    (await variantsCollection())
      .find({ productId }, { projection: { stockQty: 1 } })
      .toArray(),

    // Cancels and returns are read separately: a high return rate is a quality
    // problem, and the fix for that is never "lower the price".
    (await ordersCollection())
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            createdAt: { $gte: currentFrom.toISOString() },
            orderStatus: { $in: [OrderStatus.CANCELLED, OrderStatus.RETURNED] },
          },
        },
        {
          $lookup: {
            from: 'orderItems',
            localField: 'id',
            foreignField: 'orderId',
            as: 'items',
          },
        },
        { $unwind: '$items' },
        { $match: { 'items.productId': productId } },
        { $group: { _id: { status: '$orderStatus', order: '$id' } } },
        { $group: { _id: '$_id.status', count: { $sum: 1 } } },
      ])
      .toArray(),

    (await productRequestsCollection()).countDocuments({
      productId,
      status: { $in: [ProductRequestStatus.NEW, ProductRequestStatus.SOURCING] },
    }),

    (await priceHistoryCollection())
      .find({ productId })
      .sort({ at: -1 })
      .limit(5)
      .toArray(),
  ]);

  const stockQty = variantDocs.reduce((sum, v) => sum + ((v.stockQty as number) ?? 0), 0);
  const perDay = current.units / days;

  return {
    windowDays: days,
    current,
    previous,
    stockQty,
    // Null rather than Infinity when nothing sold: "no sales to run out of" is
    // a different statement from "stock will last forever".
    daysOfStock: perDay > 0 ? Math.round(stockQty / perDay) : null,
    cancelledOrders: statusRows.find((r) => r._id === OrderStatus.CANCELLED)?.count ?? 0,
    returnedOrders: statusRows.find((r) => r._id === OrderStatus.RETURNED)?.count ?? 0,
    openRequests: requests,
    priceChanges: stripIds(priceRows) as unknown as PriceChange[],
    hasEnoughData: current.uniqueViewers >= MIN_VIEWERS_FOR_VERDICT,
  };
}
