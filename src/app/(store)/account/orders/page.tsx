import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, Package } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge';
import { getSessionCustomer } from '@/features/auth/server/auth';
import { listCustomerOrders } from '@/features/orders/server/orders.repo';
import { formatMinor } from '@/shared/lib/money';

export const metadata: Metadata = {
  title: 'Order history',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const customer = await getSessionCustomer();
  if (!customer) redirect('/login?next=/account/orders');

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { orders, total } = await listCustomerOrders(customer.id, { page, pageSize: PAGE_SIZE });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center">
          <Package className="mx-auto h-7 w-7 text-ink-subtle" />
          <p className="mt-3 text-sm font-bold text-ink">No orders yet</p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-ink-subtle">
            When you place an order it appears here with its full status history.
          </p>
          <Link href="/" className="mt-4 inline-block">
            <Button>Start shopping</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <p className="text-xs text-ink-subtle">
        {total} order{total === 1 ? '' : 's'} · newest first
      </p>

      <ul className="space-y-3">
        {orders.map((order) => (
          <li key={order.id}>
            <Link href={`/account/orders/${order.id}`} className="block">
              <Card className="transition-colors hover:border-ink-subtle">
                {/* One column on a phone, one row from `sm` up.
                    `flex-wrap` alone used to drop the status/total/chevron group
                    onto a second line as a right-aligned huddle, leaving the
                    fixed 96px money column stranded mid-row. Below `sm` the
                    total now sits beside the order number where the eye already
                    is, the status badge gets its own line, and the chevron —
                    which pointed at a whole tappable card — is dropped. */}
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3 sm:block">
                      <p className="font-mono text-sm font-bold text-ink">{order.orderNumber}</p>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-ink sm:hidden">
                        {formatMinor(order.totalMinor)}
                      </span>
                    </div>
                    <p className="mt-1 text-2xs text-ink-subtle">
                      Placed{' '}
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        dateStyle: 'medium',
                      })}
                      {order.invoiceNumber && ` · Invoice ${order.invoiceNumber}`}
                    </p>
                    <p className="mt-1 truncate text-2xs text-ink-subtle">
                      Ships to {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                      {order.shippingAddress.pinCode}
                    </p>
                  </div>

                  {/* Fixed-width money column keeps the badges and chevrons in
                      a straight line down the list, from `sm` up. */}
                  <div className="flex shrink-0 items-center gap-4">
                    <OrderStatusBadge status={order.orderStatus} />
                    <span className="hidden w-24 text-right text-sm font-bold tabular-nums text-ink sm:inline">
                      {formatMinor(order.totalMinor)}
                    </span>
                    <ChevronRight className="hidden h-4 w-4 shrink-0 text-ink-subtle sm:block" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-subtle">
            Page {page} of {totalPages}
          </p>
          {/* A disabled Button inside a Link still navigates — the anchor gets
              the click. Out-of-range pages render as a bare disabled button. */}
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={`/account/orders?page=${page - 1}`}>
                <Button variant="outline" size="sm">
                  Previous
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            )}
            {page < totalPages ? (
              <Link href={`/account/orders?page=${page + 1}`}>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
