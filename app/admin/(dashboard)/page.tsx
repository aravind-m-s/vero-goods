import React from 'react';
import { getDb, OrderStatus } from '@/lib/db/db';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { formatCurrency } from '../../../lib/utils';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  CheckCircle,
  XCircle,
  ShieldCheck
} from 'lucide-react';

export const revalidate = 0; // live updates

export default async function AdminDashboardPage() {
  const db = await getDb();
  const orders = db.orders;

  // Calculations
  const totalOrders = orders.length;

  const pendingOrders = orders.filter(
    (o) => o.orderStatus !== OrderStatus.DELIVERED && o.orderStatus !== OrderStatus.CANCELLED
  ).length;

  const deliveredOrders = orders.filter((o) => o.orderStatus === OrderStatus.DELIVERED).length;
  
  const cancelledOrders = orders.filter((o) => o.orderStatus === OrderStatus.CANCELLED).length;

  // Sum total revenue for successful orders (exclude cancelled)
  const totalRevenue = orders
    .filter((o) => o.orderStatus !== OrderStatus.CANCELLED)
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const stats = [
    {
      label: 'Total Revenue',
      value: formatCurrency(totalRevenue),
      icon: TrendingUp,
      color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20',
    },
    {
      label: 'Total Orders',
      value: totalOrders,
      icon: ShoppingBag,
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20',
    },
    {
      label: 'Pending Orders',
      value: pendingOrders,
      icon: Clock,
      color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20',
    },
    {
      label: 'Delivered Orders',
      value: deliveredOrders,
      icon: CheckCircle,
      color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20',
    },
    {
      label: 'Cancelled Orders',
      value: cancelledOrders,
      icon: XCircle,
      color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/20',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" /> Admin Dashboard
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Real-time summary metrics for Vero Goods India storefront catalog & sales.
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <Card key={idx} className="border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-sm transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {stat.label}
                </span>
                <div className={`p-2 rounded-full ${stat.color} shrink-0`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-zinc-950 dark:text-zinc-50 tracking-tight">
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Catalog & Shop Info Alert */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            Catalog Management & Order Exports
          </h4>
          <p className="text-xs text-zinc-400 max-w-xl">
            You can create, edit, deactivate products, build dynamic technical details tables, and configure order shipments. Use the sidebar to navigate to catalog listing or orders export panels.
          </p>
        </div>
      </div>
    </div>
  );
}
