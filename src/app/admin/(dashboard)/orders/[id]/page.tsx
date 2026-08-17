'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, IndianRupee, Package, Truck, User } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select } from '@/shared/ui/select';
import { Separator } from '@/shared/ui/separator';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { useToast } from '@/shared/ui/toast';
import { ALLOWED_STATUS_TRANSITIONS, OrderStatus, PaymentStatus, type Order, type OrderItem } from '@/features/orders/types';
import { formatMinor } from '@/shared/lib/money';

interface OrderResponse {
  order: Order;
  items: OrderItem[];
  margin: { costMinor: number; grossMarginMinor: number };
}

export default function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { success, error } = useToast();

  const [data, setData] = useState<OrderResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nextStatus, setNextStatus] = useState<string>('');
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [note, setNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  // The shipment editor is its own form: it is used after the order has already
  // moved, when there is no status change to attach the AWB to.
  const [shipmentCourier, setShipmentCourier] = useState('');
  const [shipmentTracking, setShipmentTracking] = useState('');
  const [isSavingShipment, setIsSavingShipment] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/orders/${id}`);
      if (!response.ok) {
        error('Could not load the order');
        return;
      }
      const payload = (await response.json()) as OrderResponse;
      setData(payload);
      setCourier(payload.order.courier ?? '');
      setTrackingNumber(payload.order.trackingNumber ?? '');
      setShipmentCourier(payload.order.courier ?? '');
      setShipmentTracking(payload.order.trackingNumber ?? '');
      setNextStatus('');
    } catch {
      error('Network error loading the order');
    } finally {
      setIsLoading(false);
    }
  }, [id, error]);

  useEffect(() => {
    // The page re-reads the order after every status change, so the fetch has
    // to live in an effect rather than in the server render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleUpdate = async () => {
    if (!nextStatus) return;
    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          note: note || undefined,
          courier: courier || undefined,
          trackingNumber: trackingNumber || undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        error(payload.error ?? 'Could not update the order');
        return;
      }
      success('Order updated and the customer has been emailed');
      setNote('');
      await load();
    } catch {
      error('Network error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleShipmentSave = async () => {
    setIsSavingShipment(true);
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        // Both fields are always sent, so clearing a mistyped AWB works.
        body: JSON.stringify({ courier: shipmentCourier, trackingNumber: shipmentTracking }),
      });
      const payload = (await response.json()) as { error?: string; emailed?: boolean };
      if (!response.ok) {
        error(payload.error ?? 'Could not save the tracking details');
        return;
      }
      success(
        payload.emailed
          ? 'Tracking saved and the customer has been emailed'
          : 'Tracking saved'
      );
      await load();
    } catch {
      error('Network error');
    } finally {
      setIsSavingShipment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">Order not found.</p>
        <Link href="/admin/orders">
          <Button variant="outline">Back to orders</Button>
        </Link>
      </div>
    );
  }

  const { order, items, margin } = data;
  // The API enforces this too — the dropdown just avoids offering a move that
  // will be rejected.
  const allowedNext = ALLOWED_STATUS_TRANSITIONS[order.orderStatus];
  // Offered on the way out, never demanded: the courier issues the AWB after
  // the handover, so it is filled in from the shipment panel below instead.
  const isShipping = nextStatus === OrderStatus.SHIPPED;
  const isDispatched =
    order.orderStatus === OrderStatus.SHIPPED ||
    order.orderStatus === OrderStatus.OUT_FOR_DELIVERY ||
    order.orderStatus === OrderStatus.DELIVERED;
  const shipmentDirty =
    shipmentCourier !== (order.courier ?? '') || shipmentTracking !== (order.trackingNumber ?? '');
  // Prepaid orders cannot be confirmed before the money is captured.
  const paymentBlocksConfirm =
    order.paymentMethod !== 'COD' && order.paymentStatus !== PaymentStatus.PAID;
  const confirmBlocked = nextStatus === OrderStatus.CONFIRMED && paymentBlocksConfirm;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/orders">
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            Order #{order.orderNumber}
          </h1>
          <p className="mt-1 text-xs text-ink-subtle">
            {new Date(order.createdAt).toLocaleString('en-IN')}
            {order.invoiceNumber && ` · Invoice ${order.invoiceNumber}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Card className="border-line">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Package className="h-4 w-4 text-ink-subtle" /> Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="text-xs font-semibold">{item.productTitle}</p>
                        {item.variantName !== 'Default' && (
                          <p className="text-2xs text-ink-muted">{item.variantName}</p>
                        )}
                        <p className="font-mono text-3xs text-ink-subtle">{item.sku}</p>
                      </TableCell>
                      <TableCell className="text-xs text-ink-muted">
                        {item.supplierName}
                        <span className="block font-mono text-3xs text-ink-subtle">
                          {item.supplierSku}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-xs font-bold">{item.quantity}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-ink-muted">
                        {formatMinor(item.costPriceMinor * item.quantity)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-bold tabular-nums">
                        {formatMinor(item.totalMinor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <dl className="space-y-1.5 border-t border-line px-4 py-4 text-xs dark:border-line sm:px-0">
                <Row label="Subtotal" value={formatMinor(order.subtotalMinor)} />
                <Row
                  label="Shipping"
                  value={order.shippingMinor === 0 ? 'Free' : formatMinor(order.shippingMinor)}
                />
                {order.codFeeMinor > 0 && (
                  <Row label="COD handling fee" value={formatMinor(order.codFeeMinor)} />
                )}
                <div className="flex justify-between border-t border-line pt-2 text-base font-bold dark:border-line">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatMinor(order.totalMinor)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="border-line">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <IndianRupee className="h-4 w-4 text-ink-subtle" /> Margin
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4 text-xs">
              <Stat label="Revenue" value={formatMinor(order.subtotalMinor)} />
              <Stat label="Supplier cost" value={formatMinor(margin.costMinor)} />
              <Stat
                label="Gross margin"
                value={formatMinor(margin.grossMarginMinor)}
                tone={margin.grossMarginMinor > 0 ? 'positive' : 'negative'}
              />
            </CardContent>
          </Card>

          <Card className="border-line">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">History</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-xs">
                {historyRows(order.statusHistory).map((row, index) => (
                  <li key={`${row.event.at}-${index}`} className="flex justify-between gap-3">
                    <span>
                      <span className="font-semibold">{row.title}</span>
                      {row.detail && <span className="text-ink-subtle"> — {row.detail}</span>}
                    </span>
                    <span className="shrink-0 text-ink-subtle">
                      {new Date(row.event.at).toLocaleString('en-IN')} · {row.event.by}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-4">
          <Card className="border-line">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Truck className="h-4 w-4 text-ink-subtle" /> Fulfilment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">Current status</span>
                <Badge variant="info">{order.orderStatus.replace(/_/g, ' ')}</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-muted">Payment</span>
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

              <Separator className="bg-line" />

              {allowedNext.length === 0 ? (
                <p className="text-xs text-ink-subtle">
                  This order has reached a final state and cannot be moved further.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Move to</Label>
                    <Select
                      value={nextStatus}
                      onChange={(event) => setNextStatus(event.target.value)}
                    >
                      <option value="">Select a status…</option>
                      {allowedNext.map((status) => (
                        <option
                          key={status}
                          value={status}
                          disabled={status === OrderStatus.CONFIRMED && paymentBlocksConfirm}
                        >
                          {status.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </Select>
                    {order.orderStatus === OrderStatus.PLACED && (
                      <p className="text-2xs text-ink-subtle">
                        {paymentBlocksConfirm
                          ? 'Payment is not captured yet, so this order cannot be confirmed.'
                          : 'This order is waiting for you to confirm it.'}
                      </p>
                    )}
                  </div>

                  {isShipping && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Courier (optional)</Label>
                        <Input
                          value={courier}
                          onChange={(event) => setCourier(event.target.value)}
                          placeholder="Delhivery"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tracking number (AWB, optional)</Label>
                        <Input
                          value={trackingNumber}
                          onChange={(event) => setTrackingNumber(event.target.value)}
                          className="font-mono text-xs"
                          placeholder="Add it now or later"
                        />
                        <p className="text-2xs text-ink-subtle">
                          Leave blank if the courier has not issued it yet — you can add it from
                          this page once the order is shipped.
                        </p>
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Note (optional, shown in history)</Label>
                    <Input value={note} onChange={(event) => setNote(event.target.value)} />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleUpdate}
                    disabled={!nextStatus || confirmBlocked}
                    isLoading={isUpdating}
                  >
                    Update status
                  </Button>
                  <p className="text-2xs text-ink-subtle">
                    Cancelling or returning a paid online order automatically requests a Razorpay
                    refund and returns stock to the shelf.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {isDispatched && (
            <Card className="border-line">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                  <Truck className="h-4 w-4 text-ink-subtle" /> Shipment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Courier</Label>
                  <Input
                    value={shipmentCourier}
                    onChange={(event) => setShipmentCourier(event.target.value)}
                    placeholder="Delhivery"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tracking number (AWB)</Label>
                  <Input
                    value={shipmentTracking}
                    onChange={(event) => setShipmentTracking(event.target.value)}
                    className="font-mono text-xs"
                    placeholder="Not issued yet"
                  />
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={handleShipmentSave}
                  disabled={!shipmentDirty}
                  isLoading={isSavingShipment}
                >
                  Save tracking details
                </Button>
                <p className="text-2xs text-ink-subtle">
                  Saving a new tracking number on a dispatched order emails it to the customer.
                  Editing the courier alone does not.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="border-line">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <User className="h-4 w-4 text-ink-subtle" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <p className="font-bold">{order.customerName}</p>
              <p className="text-ink-muted">{order.email}</p>
              <p className="text-ink-muted">{order.phone}</p>
              <Separator className="bg-line" />
              <p className="text-ink-muted">
                {/* Snapshot from the moment the order was placed. */}
                {order.shippingAddress.fullName ?? order.customerName}
                <br />
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 && `, ${order.shippingAddress.line2}`}
                <br />
                {order.shippingAddress.city}, {order.shippingAddress.state} -{' '}
                {order.shippingAddress.pinCode}
                <br />
                {order.shippingAddress.country}
              </p>
              <Separator className="bg-line" />
              <Link
                href={`/order/track/${order.trackingToken}`}
                target="_blank"
                className="text-ink-subtle underline"
              >
                Open customer tracking page
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/**
 * Turns the raw history into rows, newest first.
 *
 * Not every entry is a fulfilment step. A payment is recorded against the
 * status the order is already in — deliberately, so settling money never reads
 * as the store having moved the order along — and the same is true of a failed
 * payment. Printing `event.status` as the headline made those entries repeat
 * the status above them, so a prepaid order showed "PLACED" twice and looked
 * like it had been recorded two times.
 *
 * An entry that does not change the status is therefore titled by its note:
 * "Payment pay_x verified" is what happened, PLACED is merely where the order
 * still was when it happened.
 */
function historyRows(history: Order['statusHistory']) {
  return history
    .map((event, index) => {
      const isStatusChange = index === 0 || event.status !== history[index - 1].status;
      return isStatusChange
        ? { event, title: event.status.replace(/_/g, ' '), detail: event.note }
        : { event, title: event.note ?? 'Updated', detail: undefined };
    })
    .reverse();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-muted">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
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
  tone?: 'positive' | 'negative';
}) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-ink-subtle">{label}</p>
      <p
        className={`text-sm font-bold tabular-nums ${tone === 'positive'
          ? 'text-success'
          : tone === 'negative'
            ? 'text-danger'
            : 'text-ink'
          }`}
      >
        {value}
      </p>
    </div>
  );
}
