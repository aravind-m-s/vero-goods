import type { ProductInsights } from '@/features/analytics/server/insights.repo';

export type VerdictTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface Verdict {
  tone: VerdictTone;
  headline: string;
  reason: string;
  action: string;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Turns the funnel into one plain-English recommendation.
 *
 * Rules, not intelligence — every branch below is readable and arguable, which
 * is the point: you should be able to disagree with the panel and know exactly
 * which number it disagreed with you about.
 *
 * Order matters. The checks run from "this is not a pricing question at all"
 * down to the pricing questions, because the most common mistake is to reach
 * for the price when the real problem is that nobody found the product or that
 * the ones who bought it sent it back.
 */
export function productVerdict(insights: ProductInsights): Verdict {
  const { current, previous } = insights;
  const cartRate = pct(current.cartVisitors, current.uniqueViewers);
  const closeRate = pct(current.orders, current.cartVisitors);
  const marginMinor = current.revenueMinor - current.costMinor;

  // 1. Nothing to judge. Said first so no other rule can fire on noise.
  if (!insights.hasEnoughData) {
    return {
      tone: 'neutral',
      headline: 'Not enough data yet',
      reason: `${current.uniqueViewers} unique viewer${current.uniqueViewers === 1 ? '' : 's'} in ${insights.windowDays} days. Percentages on this few people are noise.`,
      action: 'Leave the price alone and get traffic to the page first.',
    };
  }

  // 2. Quality problem. Never a pricing question — a cheaper faulty product is
  //    still a faulty product, and discounting one buys more returns.
  const returnRate = pct(insights.returnedOrders, current.orders + insights.returnedOrders);
  if (insights.returnedOrders > 0 && returnRate >= 15) {
    return {
      tone: 'bad',
      headline: 'Returns are the problem, not the price',
      reason: `${insights.returnedOrders} of the last ${current.orders + insights.returnedOrders} orders came back (${returnRate}%).`,
      action: 'Check quality and whether the listing promises something the product does not deliver.',
    };
  }

  // 3. Selling at a loss. Volume makes this worse, not better.
  if (current.orders > 0 && marginMinor <= 0) {
    return {
      tone: 'bad',
      headline: 'Selling below cost',
      reason: 'Revenue over the window does not cover supplier cost.',
      action: 'Raise the price or drop the product. More sales at this price lose more money.',
    };
  }

  // 4. Genuinely dead: people see it, nobody even reaches for it.
  if (cartRate < 3 && insights.openRequests === 0) {
    return {
      tone: 'bad',
      headline: 'Seen but not wanted',
      reason: `${current.uniqueViewers} people looked, ${current.cartVisitors} reached for it (${cartRate}%). No out-of-stock requests either.`,
      action: 'Try better photos and a sharper title once. If that does not move it, drop the product.',
    };
  }

  // 5. Interest, then abandonment. The listing sold it; something after it did
  //    not — usually shipping or the COD fee landing on a cheap basket.
  if (current.cartVisitors >= 5 && closeRate < 25) {
    return {
      tone: 'warn',
      headline: 'They add it, then leave',
      reason: `${current.cartVisitors} added to cart, ${current.orders} ordered (${closeRate}%). The listing works; checkout is where they go.`,
      action: 'Check shipping and COD fees against this price point before touching the price itself.',
    };
  }

  // 6. Suppressed demand. Requests are people who wanted it when it was gone.
  if (insights.openRequests >= 3) {
    return {
      tone: 'good',
      headline: 'Demand you are not serving',
      reason: `${insights.openRequests} open "get it for me" request${insights.openRequests === 1 ? '' : 's'} on top of ${current.orders} order${current.orders === 1 ? '' : 's'}.`,
      action: 'Restock deeper. Interest at this level usually survives a price rise.',
    };
  }

  // 7. Underpriced: converts well and is running out.
  if (
    closeRate >= 40 &&
    insights.daysOfStock !== null &&
    insights.daysOfStock < 21 &&
    marginMinor > 0
  ) {
    return {
      tone: 'good',
      headline: 'Converting fast, stock is short',
      reason: `${closeRate}% of the people who added it bought it, and stock covers about ${insights.daysOfStock} more days.`,
      action: 'Test a price rise. Selling out early is money left on the table.',
    };
  }

  // 8. Direction. Only reached when nothing above is wrong.
  const viewerChange = pct(current.uniqueViewers - previous.uniqueViewers, previous.uniqueViewers || 1);
  if (previous.orders > 0 && current.orders < previous.orders && viewerChange > -10) {
    return {
      tone: 'warn',
      headline: 'Sales falling on steady traffic',
      reason: `${current.orders} orders this window against ${previous.orders} last, with viewers roughly flat.`,
      action: 'Something changed in the offer, not in the audience — check recent price changes below.',
    };
  }

  return {
    tone: 'good',
    headline: 'Healthy',
    reason: `${cartRate}% of viewers add it, ${closeRate}% of those buy.`,
    action: 'Nothing to fix. Leave it alone.',
  };
}
