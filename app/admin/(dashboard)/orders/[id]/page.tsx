'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Landmark, Truck, FileCheck, CheckCircle2, XCircle, AlertCircle, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import { Order, OrderItem, OrderStatus, PaymentStatus } from '@/lib/db/types';
import Link from 'next/link';

interface OrderDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default function AdminOrderDetailsPage({ params }: OrderDetailsPageProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const { id } = use(params);

  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const loadOrderDetails = async () => {
    try {
      const res = await fetch(`/api/admin/orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setItems(data.items || []);
      } else {
        error('Failed to load order information');
        router.push('/admin/orders');
      }
    } catch (e) {
      error('Network connection failure');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrderDetails();
  }, [id]);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = e.target.value as OrderStatus;
    if (!order) return;

    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        success(`Order status updated to ${nextStatus}`);
        router.refresh();
      } else {
        const data = await res.json();
        error(data.error || 'Failed to update order status');
      }
    } catch (e) {
      error('Error updating status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Status timeline markers
  const statusLabels: Record<OrderStatus, string> = {
    [OrderStatus.PLACED]: 'Order Placed',
    [OrderStatus.CONFIRMED]: 'Confirmed',
    [OrderStatus.PACKED]: 'Packed',
    [OrderStatus.SHIPPED]: 'Shipped',
    [OrderStatus.OUT_FOR_DELIVERY]: 'Out for Delivery',
    [OrderStatus.DELIVERED]: 'Delivered',
    [OrderStatus.CANCELLED]: 'Cancelled',
  };

  const statusHierarchy = [
    OrderStatus.PLACED,
    OrderStatus.CONFIRMED,
    OrderStatus.PACKED,
    OrderStatus.SHIPPED,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
  ];

  if (isLoading) {
    return (
      <div className="py-20 text-center text-sm text-zinc-500 animate-pulse">
        Loading order details...
      </div>
    );
  }

  if (!order) return null;

  const currentStatusIdx = statusHierarchy.indexOf(order.orderStatus);
  const isCancelled = order.orderStatus === OrderStatus.CANCELLED;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/orders">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Order Details <span className="font-mono text-zinc-500 font-medium">#{order.orderNumber}</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Registered on {new Date(order.createdAt).toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left main info */}
        <div className="lg:col-span-8 space-y-6">
          {/* Order Items Table */}
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-900">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-zinc-500" /> Purchased Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Product</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right pr-6">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-6 font-semibold text-xs text-zinc-900 dark:text-zinc-50">
                        {item.productTitle}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {formatCurrency(item.unitPrice)}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs text-zinc-500">
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right pr-6 font-bold text-xs text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(item.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Totals Summary */}
                  <TableRow className="bg-zinc-50/20 hover:bg-zinc-50/20 font-bold border-t border-zinc-200 dark:border-zinc-800 text-xs">
                    <TableCell colSpan={3} className="text-right text-zinc-400 pl-6">
                      Subtotal
                    </TableCell>
                    <TableCell className="text-right pr-6 text-zinc-850 dark:text-zinc-200 font-semibold">
                      {formatCurrency(order.totalAmount)}
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-zinc-50/20 hover:bg-zinc-50/20 font-bold text-xs border-b-0">
                    <TableCell colSpan={3} className="text-right text-zinc-400 pl-6">
                      Shipping Charge
                    </TableCell>
                    <TableCell className="text-right pr-6 text-emerald-600 font-bold uppercase">
                      Free
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-zinc-50/40 hover:bg-zinc-50/40 font-bold border-t border-zinc-200 dark:border-zinc-800 text-xs">
                    <TableCell colSpan={3} className="text-right text-zinc-500 pl-6 py-4">
                      Grand Total
                    </TableCell>
                    <TableCell className="text-right pr-6 text-base text-zinc-950 dark:text-zinc-50 font-black py-4">
                      {formatCurrency(order.totalAmount)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Customer Address Details */}
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <CardHeader className="border-b border-zinc-100 dark:border-zinc-900 pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Truck className="h-4 w-4 text-zinc-500" /> Customer & Shipping Info
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs leading-normal">
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-400 uppercase tracking-wider">Contact Profile</h4>
                <div>
                  <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{order.customerName}</p>
                  <p className="text-zinc-500 mt-0.5">{order.email}</p>
                  <p className="text-zinc-500">{order.phone}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-bold text-zinc-400 uppercase tracking-wider">Shipping Destination</h4>
                <p className="text-zinc-500">
                  {order.shippingAddress.line1}
                  {order.shippingAddress.line2 && `, ${order.shippingAddress.line2}`}
                  <br />
                  {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pinCode}
                  <br />
                  <b>{order.shippingAddress.country}</b>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right status management */}
        <div className="lg:col-span-4 space-y-6">
          {/* Order Status Control */}
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Manage Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Update Current Status</label>
                <Select
                  value={order.orderStatus}
                  onChange={handleStatusChange}
                  disabled={isUpdatingStatus || order.orderStatus === OrderStatus.DELIVERED || order.orderStatus === OrderStatus.CANCELLED}
                  className="font-bold text-xs"
                >
                  <option value={OrderStatus.PLACED} disabled={currentStatusIdx > 0}>Placed</option>
                  <option value={OrderStatus.CONFIRMED} disabled={currentStatusIdx > 1}>Confirmed</option>
                  <option value={OrderStatus.PACKED} disabled={currentStatusIdx > 2}>Packed</option>
                  <option value={OrderStatus.SHIPPED} disabled={currentStatusIdx > 3}>Shipped</option>
                  <option value={OrderStatus.OUT_FOR_DELIVERY} disabled={currentStatusIdx > 4}>Out for Delivery</option>
                  <option value={OrderStatus.DELIVERED} disabled={currentStatusIdx > 5}>Delivered</option>
                  <option value={OrderStatus.CANCELLED}>Cancelled</option>
                </Select>
              </div>

              {(order.orderStatus === OrderStatus.DELIVERED || order.orderStatus === OrderStatus.CANCELLED) && (
                <div className="text-[11px] text-zinc-400 bg-zinc-50 dark:bg-zinc-900 p-3 rounded leading-normal flex items-start gap-2 border border-zinc-150 dark:border-zinc-850">
                  <AlertCircle className="h-4 w-4 text-zinc-500 shrink-0" />
                  <span>Order state is closed. Further status modifications are deactivated.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Details */}
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-900">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Payment Audit
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3 text-xs leading-normal">
              <div className="flex justify-between">
                <span className="text-zinc-400">Payment Gateway:</span>
                <span className="font-semibold">{order.paymentMethod === 'COD' ? 'COD (Cash)' : 'Razorpay Online'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Payment Status:</span>
                <Badge variant={order.paymentStatus === 'PAID' || order.paymentStatus === 'COD' ? 'success' : 'warning'}>
                  {order.paymentStatus}
                </Badge>
              </div>
              {order.razorpayOrderId && (
                <div className="flex justify-between font-mono text-[10px] text-zinc-500 border-t border-dashed border-zinc-100 dark:border-zinc-900 pt-2">
                  <span>Rzp Order:</span>
                  <span>{order.razorpayOrderId}</span>
                </div>
              )}
              {order.razorpayPaymentId && (
                <div className="flex justify-between font-mono text-[10px] text-zinc-500">
                  <span>Rzp Payment:</span>
                  <span>{order.razorpayPaymentId}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status timeline visualizer */}
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-900">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Fulfillment Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {isCancelled ? (
                <div className="flex items-center gap-2 text-rose-500 font-bold text-xs bg-rose-50/50 dark:bg-rose-950/20 p-2.5 rounded border border-rose-100 dark:border-rose-900/30">
                  <XCircle className="h-4 w-4" /> Order Cancelled
                </div>
              ) : (
                <div className="space-y-4 text-xs font-medium pl-6 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-100 dark:before:bg-zinc-900">
                  {statusHierarchy.map((stepStatus, idx) => {
                    const isCompleted = idx <= currentStatusIdx;
                    return (
                      <div key={stepStatus} className="relative flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`absolute -left-6 h-3.5 w-3.5 rounded-full border flex items-center justify-center ${
                              isCompleted
                                ? 'bg-zinc-950 border-zinc-950 text-white dark:bg-zinc-50 dark:border-zinc-50'
                                : 'bg-white border-zinc-200 dark:bg-zinc-950 dark:border-zinc-850'
                            }`}
                          >
                            {isCompleted && <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-zinc-950" />}
                          </span>
                          <span className={isCompleted ? 'text-zinc-900 dark:text-zinc-50 font-bold' : 'text-zinc-400 dark:text-zinc-650'}>
                            {statusLabels[stepStatus]}
                          </span>
                        </div>
                        {isCompleted && (
                          <Badge variant="success" className="h-4 px-1 text-[9px]">
                            Done
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
