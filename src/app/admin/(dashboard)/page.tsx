import React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { getDashboardStats } from '@/features/orders/server/orders.repo';
import { formatMinor } from '@/shared/lib/money';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  // One aggregation pipeline instead of pulling every order into memory.
  const stats = await getDashboardStats();

  const cards = [
    {
      label: 'Revenue (paid + COD)',
      value: formatMinor(stats.totalRevenueMinor),
      icon: TrendingUp,
      color: 'text-success bg-success-soft',
    },
    {
      label: 'Total orders',
      value: stats.totalOrders,
      icon: ShoppingBag,
      color: 'text-accent bg-accent-soft',
    },
    {
      label: 'Awaiting fulfilment',
      value: stats.pendingFulfilment,
      icon: Clock,
      color: 'text-warning bg-warning-soft',
    },
    {
      label: 'Delivered',
      value: stats.deliveredOrders,
      icon: CheckCircle,
      color: 'text-success bg-success-soft',
    },
    {
      label: 'Low-stock variants',
      value: stats.lowStockVariants,
      icon: AlertTriangle,
      color: 'text-danger bg-danger-soft',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink">
          <ShieldCheck className="h-5 w-5 text-success" /> Admin dashboard
        </h1>
        <p className="mt-1 text-xs text-ink-subtle">
          Live summary of catalogue and sales for the Vero Goods storefront.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className="border-line shadow-card transition-shadow hover:shadow-sm dark:border-line"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                  {card.label}
                </span>
                <div className={`shrink-0 rounded-full p-2 ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black tracking-tight text-ink">
                  {card.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-line">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold">Recent orders</CardTitle>
          <Link href="/admin/orders" className="text-xs text-ink-subtle underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {stats.recentOrders.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-subtle">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {stats.recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-mono text-xs font-bold hover:underline"
                    >
                      #{order.orderNumber}
                    </Link>
                    <p className="truncate text-xs text-ink-subtle">
                      {order.customerName} · {order.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant="secondary">{order.orderStatus}</Badge>
                    <span className="text-xs font-bold tabular-nums">
                      {formatMinor(order.totalMinor)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
