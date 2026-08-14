import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, MapPin, Package, UserRound } from 'lucide-react';
import { Card, CardContent } from '@/shared/ui/card';
import { Separator } from '@/shared/ui/separator';
import { OrderStatusBadge } from '@/features/orders/components/OrderStatusBadge';
import { getSessionCustomer } from '@/features/auth/server/auth';
import { getDefaultAddress, listAddresses } from '@/features/auth/server/addresses.repo';
import { listCustomerOrders } from '@/features/orders/server/orders.repo';
import { formatMinor } from '@/shared/lib/money';

export const metadata: Metadata = {
  title: 'My account',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AccountOverviewPage() {
  const customer = await getSessionCustomer();
  if (!customer) redirect('/login?next=/account');

  const [addresses, defaultAddress, { orders, total }] = await Promise.all([
    listAddresses(customer.id),
    getDefaultAddress(customer.id),
    listCustomerOrders(customer.id, { pageSize: 3 }),
  ]);

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          href="/account/profile"
          icon={UserRound}
          label="Profile"
          value={customer.name}
          hint={
            customer.emailVerified && customer.phoneVerified
              ? 'Email and mobile verified'
              : customer.emailVerified
                ? 'Email verified'
                : 'Mobile verified'
          }
        />
        <SummaryCard
          href="/account/addresses"
          icon={MapPin}
          label="Addresses"
          value={`${addresses.length} saved`}
          hint={defaultAddress ? `Default: ${defaultAddress.label}` : 'No default set'}
        />
        <SummaryCard
          href="/account/orders"
          icon={Package}
          label="Orders"
          value={`${total} order${total === 1 ? '' : 's'}`}
          hint={orders[0] ? `Latest ${orders[0].orderNumber}` : 'Nothing ordered yet'}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5">
            <h2 className="text-sm font-bold text-ink">Recent orders</h2>
            <Link
              href="/account/orders"
              className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Separator className="bg-line" />

          {orders.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-xs text-ink-subtle">
                You have not placed an order yet.{' '}
                <Link href="/" className="font-semibold text-accent hover:underline">
                  Start shopping
                </Link>
                .
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 p-5 transition-colors hover:bg-surface-sunken"
                  >
                    <div>
                      <p className="font-mono text-xs font-bold text-ink">{order.orderNumber}</p>
                      <p className="mt-0.5 text-2xs text-ink-subtle">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          dateStyle: 'medium',
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <OrderStatusBadge status={order.orderStatus} />
                      <span className="w-24 text-right text-sm font-bold tabular-nums text-ink">
                        {formatMinor(order.totalMinor)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function SummaryCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    // block + h-full: without them the anchor shrink-wraps and the three cards
    // in the row end up different heights.
    <Link href={href} className="group block h-full">
      <Card className="flex h-full flex-col transition-colors group-hover:border-ink-subtle">
        <CardContent className="flex flex-1 flex-col gap-1.5 p-5">
          <p className="flex items-center gap-1.5 text-2xs font-bold uppercase leading-none tracking-wider text-ink-subtle">
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </p>
          <p className="truncate text-base font-bold leading-snug text-ink">{value}</p>
          <p className="mt-auto truncate text-2xs leading-none text-ink-subtle">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
