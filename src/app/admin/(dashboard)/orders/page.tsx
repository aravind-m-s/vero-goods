'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, FileDown, Search, X } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
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
import { OrderStatus, PaymentStatus, type Order } from '@/features/orders/types';
import { formatMinor } from '@/shared/lib/money';

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<OrderStatus, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
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

function paymentVariant(status: PaymentStatus): 'success' | 'warning' | 'danger' | 'secondary' {
  if (status === PaymentStatus.PAID || status === PaymentStatus.COD) return 'success';
  if (status === PaymentStatus.FAILED) return 'danger';
  if (status === PaymentStatus.REFUNDED) return 'secondary';
  return 'warning';
}

export default function AdminOrdersPage() {
  const { error } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const buildQuery = useCallback(
    (targetPage: number) => {
      const params = new URLSearchParams({
        page: String(targetPage),
        pageSize: String(PAGE_SIZE),
      });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      return params;
    },
    [statusFilter, search, dateFrom, dateTo]
  );

  useEffect(() => {
    let cancelled = false;
    // Admin list data is fetched client-side so filters stay instant; the
    // loading flag is the visible part of that fetch lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    // Debounced so typing in the search box does not fire a query per keystroke.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/orders?${buildQuery(page).toString()}`);
        if (!response.ok) {
          if (!cancelled) error('Could not load orders');
          return;
        }
        const data = (await response.json()) as { orders: Order[]; total: number };
        if (cancelled) return;
        setOrders(data.orders);
        setTotal(data.total);
      } catch {
        if (!cancelled) error('Network error loading orders');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [buildQuery, page, error]);

  // Any filter change resets to the first page.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [statusFilter, search, dateFrom, dateTo]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
  };

  const exportUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return `/api/admin/export?${params.toString()}`;
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            Orders
          </h1>
          <p className="mt-1 text-xs text-ink-subtle">
            {total} order{total === 1 ? '' : 's'} matching the current filters
          </p>
        </div>
        <a href={exportUrl()} download>
          <Button variant="outline" className="gap-1.5">
            <FileDown className="h-4 w-4" /> Export CSV
          </Button>
        </a>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-3 h-4 w-4 text-ink-subtle" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Order number, email, name or phone"
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="ALL">All statuses</option>
          {Object.values(OrderStatus).map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
      </div>

      {(search || statusFilter !== 'ALL' || dateFrom || dateTo) && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1 text-xs text-ink-subtle underline"
        >
          <X className="h-3 w-3" /> Clear filters
        </button>
      )}

      <div className="rounded-card border border-line">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-xs text-ink-subtle">
                  No orders match your filters.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs font-bold">#{order.orderNumber}</TableCell>
                  <TableCell>
                    <p className="text-xs font-semibold">{order.customerName}</p>
                    <p className="text-2xs text-ink-subtle">{order.email}</p>
                  </TableCell>
                  <TableCell className="text-xs text-ink-muted">
                    {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </TableCell>
                  <TableCell className="text-right text-xs font-bold tabular-nums">
                    {formatMinor(order.totalMinor)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={paymentVariant(order.paymentStatus)}>
                      {order.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[order.orderStatus]}>
                      {order.orderStatus.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/orders/${order.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 p-0" aria-label="View order">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink-subtle">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
