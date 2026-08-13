import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Info, Package, Truck } from 'lucide-react';
import { CopyTrackingUrl } from '@/features/orders/components/CopyTrackingUrl';
import { OrderTimeline } from '@/features/orders/components/OrderTimeline';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Separator } from '@/shared/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { getOrderByTrackingToken, getOrderItems } from '@/features/orders/server/orders.repo';
import { OrderStatus } from '@/features/orders/types';
import { formatMinor } from '@/shared/lib/money';

// Order state changes at any moment and the page is per-customer, so it is
// always rendered fresh — but never cached or indexed.
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  return {
    title: 'Track order',
    description: 'Track your Vero Goods shipment status.',
    robots: { index: false, follow: false },
  };
}

const STATUS_BADGES: Record<OrderStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  [OrderStatus.PLACED]: 'warning',
  [OrderStatus.CONFIRMED]: 'info',
  [OrderStatus.PACKED]: 'info',
  [OrderStatus.SHIPPED]: 'info',
  [OrderStatus.OUT_FOR_DELIVERY]: 'info',
  [OrderStatus.DELIVERED]: 'success',
  [OrderStatus.CANCELLED]: 'danger',
  [OrderStatus.RETURN_REQUESTED]: 'warning',
  [OrderStatus.RETURNED]: 'danger',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PLACED]: 'Order placed',
  [OrderStatus.CONFIRMED]: 'Confirmed',
  [OrderStatus.PACKED]: 'Packed',
  [OrderStatus.SHIPPED]: 'Shipped',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Out for delivery',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
  [OrderStatus.RETURN_REQUESTED]: 'Return requested',
  [OrderStatus.RETURNED]: 'Returned',
};

export default async function OrderTrackingPage(props: PageProps<'/order/track/[token]'>) {
  const { token } = await props.params;
  const order = await getOrderByTrackingToken(token);
  if (!order) notFound();

  const items = await getOrderItems(order.id);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-ink">
            Order tracking: <span className="font-mono text-ink-muted">#{order.orderNumber}</span>
          </h1>
          <p className="mt-1 text-xs text-ink-subtle">
            Placed on{' '}
            {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
            {order.invoiceNumber && ` · Invoice ${order.invoiceNumber}`}
          </p>
        </div>
        <CopyTrackingUrl token={token} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12">
        <div className="md:col-span-7">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b border-line pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Truck className="h-4 w-4 text-ink-muted" /> Fulfillment status
              </CardTitle>
              <Badge variant={STATUS_BADGES[order.orderStatus]}>
                {STATUS_LABELS[order.orderStatus]}
              </Badge>
            </CardHeader>
            <CardContent className="pt-6">
              {order.estimatedDeliveryDate && order.orderStatus !== OrderStatus.DELIVERED && (
                <p className="mb-4 rounded-control bg-surface-sunken px-3 py-2 text-xs text-ink-muted">
                  Estimated delivery by{' '}
                  <strong>
                    {new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', {
                      dateStyle: 'medium',
                    })}
                  </strong>
                </p>
              )}
              <OrderTimeline status={order.orderStatus} history={order.statusHistory} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 md:col-span-5">
          {order.trackingNumber && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-subtle">
                  <Package className="h-3.5 w-3.5" /> Courier
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <p className="font-bold text-ink">{order.courier}</p>
                <p className="font-mono text-ink-muted">{order.trackingNumber}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                Delivery details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-normal">
              <div>
                <p className="font-bold text-ink">{order.customerName}</p>
                <p className="text-ink-muted">{order.email}</p>
                <p className="text-ink-muted">{order.phone}</p>
              </div>
              <Separator className="bg-line" />
              <div>
                <p className="font-bold text-ink">Shipping address</p>
                <p className="mt-1 text-ink-muted">
                  {order.shippingAddress.line1}
                  {order.shippingAddress.line2 && `, ${order.shippingAddress.line2}`}
                  <br />
                  {order.shippingAddress.city}, {order.shippingAddress.state} -{' '}
                  {order.shippingAddress.pinCode}
                  <br />
                  {order.shippingAddress.country}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-normal">
              <div className="flex justify-between">
                <span className="text-ink-muted">Method</span>
                <span className="font-bold text-ink">
                  {order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Razorpay'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Status</span>
                <Badge
                  variant={
                    order.paymentStatus === 'PAID' || order.paymentStatus === 'COD'
                      ? 'success'
                      : order.paymentStatus === 'FAILED'
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {order.paymentStatus}
                </Badge>
              </div>
              {order.razorpayPaymentId && (
                <div className="flex justify-between pt-1 font-mono text-3xs text-ink-subtle">
                  <span>Txn ID</span>
                  <span>{order.razorpayPaymentId}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <Info className="h-4 w-4 text-ink-muted" /> Items
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
                  <TableCell className="font-medium">
                    {item.productTitle}
                    {item.variantName !== 'Default' && (
                      <span className="text-ink-muted"> · {item.variantName}</span>
                    )}
                    <span className="block font-mono text-3xs text-ink-subtle">{item.sku}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMinor(item.unitPriceMinor)}
                  </TableCell>
                  <TableCell className="text-center font-bold text-ink-muted">
                    {item.quantity}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {formatMinor(item.totalMinor)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <dl className="space-y-1.5 border-t border-line px-4 py-4 text-xs sm:px-0">
            <SummaryRow label="Subtotal" value={formatMinor(order.subtotalMinor)} />
            <SummaryRow
              label="Shipping"
              value={order.shippingMinor === 0 ? 'Free' : formatMinor(order.shippingMinor)}
            />
            {order.codFeeMinor > 0 && (
              <SummaryRow label="COD handling fee" value={formatMinor(order.codFeeMinor)} />
            )}
            <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink">
              <dt>Grand total</dt>
              <dd className="tabular-nums">{formatMinor(order.totalMinor)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-muted">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
