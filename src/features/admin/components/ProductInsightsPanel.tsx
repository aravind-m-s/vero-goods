'use client';

import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Minus, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { productVerdict, type VerdictTone } from '@/features/analytics/lib/verdict';
import type { ProductInsights } from '@/features/analytics/server/insights.repo';
import { formatMinor } from '@/shared/lib/money';

const TONE_CLASS: Record<VerdictTone, string> = {
  good: 'border-success/40 bg-success/5 text-success',
  warn: 'border-warning/40 bg-warning/5 text-warning',
  bad: 'border-danger/40 bg-danger/5 text-danger',
  neutral: 'border-line bg-surface-sunken text-ink-muted',
};

const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

/**
 * Decision support for one product, shown where the price is edited.
 *
 * The funnel is the point: viewed, added, ordered. Where people drop tells you
 * which lever to pull, and the same low order count means opposite things
 * depending on whether they reached for the product at all.
 */
export function ProductInsightsPanel({ productId }: { productId: string }) {
  const [insights, setInsights] = useState<ProductInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/admin/products/${productId}/insights`);
        if (!response.ok) {
          if (!cancelled) setFailed(true);
          return;
        }
        const data = (await response.json()) as ProductInsights;
        if (!cancelled) setInsights(data);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productId]);

  if (isLoading) {
    return (
      <Card className="border-line">
        <CardContent className="space-y-3 p-5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  // A failed analytics read must never block editing the product.
  if (failed || !insights) return null;

  const { current, previous, windowDays } = insights;
  const verdict = productVerdict(insights);
  const marginMinor = current.revenueMinor - current.costMinor;

  return (
    <Card className="border-line">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <TrendingUp className="h-4 w-4 text-ink-subtle" />
          Last {windowDays} days
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className={`rounded-control border p-3 ${TONE_CLASS[verdict.tone]}`}>
          <p className="text-xs font-bold">{verdict.headline}</p>
          <p className="mt-1 text-2xs leading-relaxed opacity-90">{verdict.reason}</p>
          <p className="mt-1.5 text-2xs font-semibold leading-relaxed">{verdict.action}</p>
        </div>

        {/* The funnel, with the drop between each step named rather than left
            to be worked out from two numbers. */}
        <div className="grid grid-cols-3 gap-2">
          <FunnelStep
            label="Viewed"
            value={current.uniqueViewers}
            sub={`${current.views} view${current.views === 1 ? '' : 's'}`}
            previous={previous.uniqueViewers}
          />
          <FunnelStep
            label="Added to cart"
            value={current.cartVisitors}
            sub={`${percent(current.cartVisitors, current.uniqueViewers)}% of viewers`}
            previous={previous.cartVisitors}
          />
          <FunnelStep
            label="Ordered"
            value={current.orders}
            sub={`${percent(current.orders, current.cartVisitors)}% of carts`}
            previous={previous.orders}
          />
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-xs sm:grid-cols-4">
          <Stat label="Units" value={String(current.units)} />
          <Stat label="Revenue" value={formatMinor(current.revenueMinor)} />
          <Stat
            label="Gross margin"
            value={formatMinor(marginMinor)}
            tone={marginMinor <= 0 && current.orders > 0 ? 'bad' : undefined}
          />
          <Stat
            label="Stock cover"
            value={
              insights.daysOfStock === null
                ? `${insights.stockQty} in stock`
                : `${insights.daysOfStock} days`
            }
            tone={
              insights.daysOfStock !== null && insights.daysOfStock < 14 ? 'warn' : undefined
            }
          />
        </div>

        {(insights.openRequests > 0 ||
          insights.cancelledOrders > 0 ||
          insights.returnedOrders > 0) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-2xs">
            {insights.openRequests > 0 && (
              <span className="text-ink-muted">
                <span className="font-bold text-ink">{insights.openRequests}</span> open stock
                request{insights.openRequests === 1 ? '' : 's'}
              </span>
            )}
            {insights.cancelledOrders > 0 && (
              <span className="text-ink-muted">
                <span className="font-bold text-ink">{insights.cancelledOrders}</span> cancelled
              </span>
            )}
            {insights.returnedOrders > 0 && (
              <span className="text-danger">
                <span className="font-bold">{insights.returnedOrders}</span> returned
              </span>
            )}
          </div>
        )}

        {insights.priceChanges.length > 0 && (
          <div className="space-y-1 border-t border-line pt-3">
            <p className="text-2xs font-bold uppercase tracking-wider text-ink-subtle">
              Recent price changes
            </p>
            {insights.priceChanges.map((change, index) => (
              <p key={index} className="flex justify-between text-2xs text-ink-muted">
                <span className="font-mono">{change.sku}</span>
                <span>
                  {formatMinor(change.fromMinor)} → {formatMinor(change.toMinor)}
                  <span className="ml-2 text-ink-subtle">
                    {new Date(change.at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </span>
                </span>
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelStep({
  label,
  value,
  sub,
  previous,
}: {
  label: string;
  value: number;
  sub: string;
  previous: number;
}) {
  const change = value - previous;

  return (
    <div className="rounded-control bg-surface-sunken p-3">
      <p className="text-2xs uppercase tracking-wider text-ink-subtle">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1.5 text-lg font-bold tabular-nums text-ink">
        {value}
        {/* Direction against the window before this one. A number on its own
            cannot tell you whether things are getting better or worse. */}
        {previous > 0 && change !== 0 && (
          <span
            className={`flex items-center text-2xs font-semibold ${change > 0 ? 'text-success' : 'text-danger'}`}
            title={`${previous} in the previous window`}
          >
            {change > 0 ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {Math.abs(change)}
          </span>
        )}
        {previous > 0 && change === 0 && (
          <Minus className="h-3 w-3 text-ink-subtle" aria-label="unchanged" />
        )}
      </p>
      <p className="mt-0.5 text-2xs text-ink-subtle">{sub}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warn' | 'bad';
}) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-ink-subtle">{label}</p>
      <p
        className={`font-bold tabular-nums ${tone === 'bad' ? 'text-danger' : tone === 'warn' ? 'text-warning' : 'text-ink'}`}
      >
        {value}
      </p>
    </div>
  );
}
