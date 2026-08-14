import React from 'react';
import type { Metadata } from 'next';
import { SafeImage as Image } from '@/shared/ui/safe-image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ExternalLink, MapPin, Receipt } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Separator } from '@/shared/ui/separator';
import { OrderStatusBadge, STATUS_LABELS } from '@/features/orders/components/OrderStatusBadge';
import { OrderTimeline } from '@/features/orders/components/OrderTimeline';
import { getSessionCustomer } from '@/features/auth/server/auth';
import { getCustomerOrder, getOrderItems } from '@/features/orders/server/orders.repo';
import { PaymentStatus } from '@/features/orders/types';
import { formatMinor } from '@/shared/lib/money';

export const metadata: Metadata = {
  title: 'Order details',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const customer = await getSessionCustomer();
  if (!customer) redirect('/login?next=/account/orders');

  const { id } = await params;
  // Scoped to the signed-in customer: another account's order id 404s.
  const order = await getCustomerOrder(customer.id, id);
  if (!order) notFound();

  const items = await getOrderItems(order.id);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/account/orders">
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0" aria-label="Back to orders">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="font-mono text-lg font-black tracking-tight text-ink">
              {order.orderNumber}
            </h2>
            <p className="mt-0.5 text-2xs text-ink-subtle">
              Placed{' '}
              {new Date(order.createdAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
              {order.invoiceNumber && ` · Invoice ${order.invoiceNumber}`}
            </p>
          </div>
        </div>
        <OrderStatusBadge status={order.orderStatus} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">
                {items.length} item{items.length === 1 ? '' : 's'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3">
                  {item.imageUrl ? (
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control bg-surface-sunken">
                      <Image
                        src={item.imageUrl}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded-control bg-surface-sunken" />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{item.productTitle}</p>
                    {item.variantName !== 'Default' && (
                      <p className="text-2xs text-ink-muted">{item.variantName}</p>
                    )}
                    <p className="font-mono text-3xs text-ink-subtle">{item.sku}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {item.quantity} × {formatMinor(item.unitPriceMinor)}
                    </p>
                  </div>

                  <p className="w-24 shrink-0 text-right text-sm font-bold tabular-nums text-ink">
                    {formatMinor(item.totalMinor)}
                  </p>
                </div>
              ))}

              <Separator className="bg-line" />

              <dl className="space-y-1.5 text-xs">
                <SummaryRow label="Subtotal" value={formatMinor(order.subtotalMinor)} />
                <SummaryRow
                  label="Shipping"
                  value={order.shippingMinor === 0 ? 'Free' : formatMinor(order.shippingMinor)}
                />
                {order.codFeeMinor > 0 && (
                  <SummaryRow label="COD handling fee" value={formatMinor(order.codFeeMinor)} />
                )}
                <SummaryRow
                  label="Tax included"
                  value={formatMinor(order.taxMinor)}
                  muted
                />
                <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatMinor(order.totalMinor)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Status history</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline status={order.orderStatus} history={order.statusHistory} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <MapPin className="h-4 w-4 text-ink-subtle" /> Delivery address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-xs text-ink-muted">
              {/* Read straight off the order's own snapshot — never the
                  customer's current address book. */}
              <p className="font-bold text-ink">
                {order.shippingAddress.fullName ?? order.customerName}
              </p>
              <address className="not-italic leading-relaxed">
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 && <>, {order.shippingAddress.line2}</>}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                {order.shippingAddress.pinCode}
                <br />
                {order.shippingAddress.country}
              </address>
              <p>{order.shippingAddress.phone ?? order.phone}</p>
              {order.estimatedDeliveryDate && (
                <p className="pt-1 text-ink-subtle">
                  Estimated delivery{' '}
                  {new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', {
                    dateStyle: 'medium',
                  })}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Receipt className="h-4 w-4 text-ink-subtle" /> Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Method</span>
                <span className="font-semibold text-ink">
                  {order.paymentMethod === 'COD' ? 'Cash on delivery' : 'Paid online'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Status</span>
                <Badge
                  variant={
                    order.paymentStatus === PaymentStatus.PAID ||
                    order.paymentStatus === PaymentStatus.COD
                      ? 'success'
                      : order.paymentStatus === PaymentStatus.FAILED
                        ? 'danger'
                        : 'warning'
                  }
                >
                  {order.paymentStatus}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Order status</span>
                <span className="font-semibold text-ink">{STATUS_LABELS[order.orderStatus]}</span>
              </div>

              {(order.trackingNumber || order.courier) && (
                <>
                  <Separator className="bg-line" />
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Courier</span>
                    <span className="font-semibold text-ink">{order.courier ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Tracking no.</span>
                    <span className="font-mono font-semibold text-ink">
                      {order.trackingNumber ?? '—'}
                    </span>
                  </div>
                </>
              )}

              <Separator className="bg-line" />
              <Link
                href={`/order/track/${order.trackingToken}`}
                className="flex items-center gap-1 font-semibold text-accent hover:underline"
              >
                Open tracking page <ExternalLink className="h-3 w-3" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className={`flex justify-between ${muted ? 'text-ink-subtle' : 'text-ink-muted'}`}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
