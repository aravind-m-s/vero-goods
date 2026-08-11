import React from 'react';
import { notFound } from 'next/navigation';
import { getDb, OrderStatus } from '@/lib/db/db';
import { OrderTimeline } from '@/components/store/OrderTimeline';
import { CopyTrackingUrl } from '@/components/store/CopyTrackingUrl';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { Info, Truck, ShieldAlert } from 'lucide-react';
import { Metadata } from 'next';

export const revalidate = 0;

export function generateMetadata(): Metadata {
  return {
    title: 'Track Order | Vero Goods',
    description: 'Track your Vero Goods shipment status in real-time.',
    robots: 'noindex, nofollow',
  };
}

export default async function OrderTrackingPage(
  props: PageProps<"/order/track/[token]">
) {
  const { token } = await props.params;
  const db = await getDb();

  const order = db.orders.find((o) => o.trackingToken === token);
  if (!order) {
    notFound();
  }

  const items = db.orderItems.filter((item) => item.orderId === order.id);

  const orderStatusBadges: Record<OrderStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
    [OrderStatus.PLACED]: 'warning',
    [OrderStatus.CONFIRMED]: 'info',
    [OrderStatus.PACKED]: 'info',
    [OrderStatus.SHIPPED]: 'info',
    [OrderStatus.OUT_FOR_DELIVERY]: 'info',
    [OrderStatus.DELIVERED]: 'success',
    [OrderStatus.CANCELLED]: 'danger',
  };

  const statusLabels: Record<OrderStatus, string> = {
    [OrderStatus.PLACED]: 'Order Placed',
    [OrderStatus.CONFIRMED]: 'Confirmed',
    [OrderStatus.PACKED]: 'Packed',
    [OrderStatus.SHIPPED]: 'Shipped',
    [OrderStatus.OUT_FOR_DELIVERY]: 'Out for Delivery',
    [OrderStatus.DELIVERED]: 'Delivered',
    [OrderStatus.CANCELLED]: 'Cancelled',
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full flex-1 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
            Order tracking: <span className="font-mono text-zinc-500">#{order.orderNumber}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Created on {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
          </p>
        </div>
        <CopyTrackingUrl token={token} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <div className="md:col-span-7">
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="flex flex-row justify-between items-center border-b border-zinc-100 dark:border-zinc-800/60 pb-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Truck className="h-4 w-4 text-zinc-500" /> Fulfillment Status
              </CardTitle>
              <Badge variant={orderStatusBadges[order.orderStatus]}>
                {statusLabels[order.orderStatus]}
              </Badge>
            </CardHeader>
            <CardContent className="pt-6">
              <OrderTimeline status={order.orderStatus} />
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-5 space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Delivery Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-normal">
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-50">{order.customerName}</p>
                <p className="text-zinc-500 dark:text-zinc-400">{order.email}</p>
                <p className="text-zinc-500 dark:text-zinc-400">{order.phone}</p>
              </div>
              <Separator className="bg-zinc-100 dark:bg-zinc-850" />
              <div>
                <p className="font-bold text-zinc-900 dark:text-zinc-50">Shipping Address</p>
                <p className="text-zinc-500 mt-1 dark:text-zinc-400">
                  {order.shippingAddress.line1}
                  {order.shippingAddress.line2 && `, ${order.shippingAddress.line2}`}
                  <br />
                  {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pinCode}
                  <br />
                  {order.shippingAddress.country}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Payment Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-normal">
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Payment Method:</span>
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  {order.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : 'Razorpay Online'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Payment Status:</span>
                <Badge variant={order.paymentStatus === 'PAID' ? 'success' : order.paymentStatus === 'COD' ? 'success' : 'warning'}>
                  {order.paymentStatus}
                </Badge>
              </div>
              {order.razorpayPaymentId && (
                <div className="flex justify-between pt-1 font-mono text-[10px] text-zinc-400">
                  <span>Txn ID:</span>
                  <span>{order.razorpayPaymentId}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Info className="h-4 w-4 text-zinc-500" /> Ordered Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.productTitle}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-center font-bold text-zinc-500">{item.quantity}</TableCell>
                  <TableCell className="text-right font-bold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(item.total)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-zinc-50/50 hover:bg-zinc-50/50 dark:bg-zinc-950/20 font-bold border-t-2 border-zinc-200 dark:border-zinc-800">
                <TableCell colSpan={3} className="text-right text-zinc-500">
                  Grand Total
                </TableCell>
                <TableCell className="text-right text-lg text-zinc-950 dark:text-zinc-50">
                  {formatCurrency(order.totalAmount)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
