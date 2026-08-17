'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Eye, FileDown, Search, X } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
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
import { useRowNavigation } from '@/shared/ui/use-row-navigation';
import {
  ALLOWED_STATUS_TRANSITIONS,
  OrderStatus,
  PaymentStatus,
  type Order,
} from '@/features/orders/types';
import { formatMinor } from '@/shared/lib/money';

const PAGE_SIZE = 20;

const COLUMN_COUNT = 8;

/** Prepaid orders confirm only once the money is captured; COD confirms on judgement. */
function isConfirmable(order: Order): boolean {
  return (
    order.orderStatus === OrderStatus.PLACED &&
    (order.paymentMethod === 'COD' || order.paymentStatus === PaymentStatus.PAID)
  );
}

function readableStatus(status: OrderStatus): string {
  return status.replace(/_/g, ' ');
}

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
  const { success, error } = useToast();
  const rowNavigation = useRowNavigation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [supplierOptions, setSupplierOptions] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState('');
  const [pendingBulk, setPendingBulk] = useState<OrderStatus | null>(null);
  const [isBulkRunning, setIsBulkRunning] = useState(false);

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
      // Resolved server-side against the order lines — an order carries no
      // supplier of its own.
      if (supplierFilter !== 'ALL') params.set('supplier', supplierFilter);
      return params;
    },
    [statusFilter, search, dateFrom, dateTo, supplierFilter]
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
        // Ids from the previous result set are meaningless against these rows,
        // and a selection the admin can no longer see must not stay armed.
        setSelectedIds(new Set());
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
  }, [statusFilter, search, dateFrom, dateTo, supplierFilter]);

  // The supplier list is the same one the product form picks from, so the two
  // screens can never offer different spellings of the same supplier.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/admin/suppliers');
        if (!response.ok) return;
        const data = (await response.json()) as { suppliers: string[] };
        if (!cancelled) setSupplierOptions(data.suppliers);
      } catch {
        // A missing supplier list only costs the filter; the orders still load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Orders land in PLACED and stay there until a human accepts them — payment
   * settling no longer confirms anything — so confirming is the one action
   * worth having without opening the order.
   */
  const handleConfirm = async (order: Order) => {
    setConfirmingId(order.id);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: OrderStatus.CONFIRMED }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        error(payload.error ?? 'Could not confirm the order');
        return;
      }
      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id ? { ...item, orderStatus: OrderStatus.CONFIRMED } : item
        )
      );
      success(`Order #${order.orderNumber} confirmed — customer emailed`);
    } catch {
      error('Network error');
    } finally {
      setConfirmingId(null);
    }
  };

  const toggleOne = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds((current) =>
      current.size === orders.length ? new Set() : new Set(orders.map((order) => order.id))
    );

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedIds.has(order.id)),
    [orders, selectedIds]
  );

  /**
   * Only statuses every selected order can legally reach.
   *
   * Offering a status that half the selection would reject turns a bulk action
   * into a guessing game — the server would refuse those rows anyway, so the
   * mixed-selection case is settled here rather than in an error toast.
   */
  const availableTargets = useMemo(() => {
    if (selectedOrders.length === 0) return [] as OrderStatus[];
    return Object.values(OrderStatus).filter((target) =>
      selectedOrders.every((order) =>
        ALLOWED_STATUS_TRANSITIONS[order.orderStatus].includes(target)
      )
    );
  }, [selectedOrders]);

  const confirmable = useMemo(() => selectedOrders.filter(isConfirmable), [selectedOrders]);

  // The chosen target stops being valid as soon as the selection changes shape.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBulkTarget((current) =>
      current && availableTargets.includes(current as OrderStatus) ? current : ''
    );
  }, [availableTargets]);

  /**
   * Partial success is expected, so the result is reported per order rather
   * than as one pass/fail: the rows that moved are patched from the server's
   * copy (a COD delivery also flips its payment status), and the rest are named
   * with the reason the server gave.
   */
  const runBulk = async (status: OrderStatus, ids: string[]) => {
    setIsBulkRunning(true);
    try {
      const response = await fetch('/api/admin/orders/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: ids, status }),
      });
      const data = (await response.json()) as {
        error?: string;
        updated?: Order[];
        failed?: Array<{ id: string; message: string }>;
        summary?: { requested: number; updated: number; failed: number };
      };
      if (!response.ok || !data.updated || !data.summary) {
        error(data.error ?? 'Could not apply the status change');
        return;
      }

      const byId = new Map(data.updated.map((order) => [order.id, order]));
      setOrders((prev) => prev.map((order) => byId.get(order.id) ?? order));
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of byId.keys()) next.delete(id);
        return next;
      });

      if (data.summary.updated > 0) {
        success(
          `${data.summary.updated} order${data.summary.updated === 1 ? '' : 's'} moved to ` +
            `${readableStatus(status)} — customers emailed`
        );
      }

      const failures = data.failed ?? [];
      if (failures.length > 0) {
        const numbers = failures
          .map((failure) => orders.find((order) => order.id === failure.id)?.orderNumber)
          .filter(Boolean)
          .slice(0, 3)
          .join(', ');
        error(
          `${failures.length} unchanged${numbers ? ` (${numbers}${failures.length > 3 ? '…' : ''})` : ''}: ${failures[0].message}`
        );
      }
    } catch {
      error('Network error applying the status change');
    } finally {
      setIsBulkRunning(false);
      setPendingBulk(null);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setSupplierFilter('ALL');
  };

  const exportUrl = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    // The CSV is the list you are looking at, so it carries the same filters.
    if (supplierFilter !== 'ALL') params.set('supplier', supplierFilter);
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
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
        {supplierOptions.length > 0 && (
          <Select
            value={supplierFilter}
            onChange={(event) => setSupplierFilter(event.target.value)}
            aria-label="Filter by supplier"
          >
            <option value="ALL">All suppliers</option>
            {supplierOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={statusFilter === OrderStatus.PLACED ? 'default' : 'outline'}
          size="sm"
          onClick={() =>
            setStatusFilter((current) =>
              current === OrderStatus.PLACED ? 'ALL' : OrderStatus.PLACED
            )
          }
        >
          Awaiting confirmation
        </Button>
        <span className="text-2xs text-ink-subtle">
          New orders stay in PLACED until you confirm them.
        </span>
      </div>

      {(search || statusFilter !== 'ALL' || dateFrom || dateTo || supplierFilter !== 'ALL') && (
        <button
          type="button"
          onClick={clearFilters}
          className="flex items-center gap-1 text-xs text-ink-subtle underline"
        >
          <X className="h-3 w-3" /> Clear filters
        </button>
      )}

      {selectedIds.size > 0 && (
        // sticky: with twenty rows the selection is made at the bottom of the
        // table and the action would otherwise be scrolled off the top.
        <div className="sticky top-4 z-20 flex flex-wrap items-center gap-3 rounded-card border border-ink bg-surface-raised p-3 shadow-card">
          <p className="text-xs font-bold text-ink">
            {selectedIds.size} selected
            {selectedIds.size === orders.length && orders.length > 0 && ' (whole page)'}
          </p>

          <Button
            size="sm"
            className="gap-1.5"
            disabled={confirmable.length === 0 || isBulkRunning}
            onClick={() => setPendingBulk(OrderStatus.CONFIRMED)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Confirm {confirmable.length > 0 && `(${confirmable.length})`}
          </Button>

          <div className="flex items-center gap-2">
            <Select
              value={bulkTarget}
              onChange={(event) => setBulkTarget(event.target.value)}
              disabled={availableTargets.length === 0 || isBulkRunning}
              className="h-9 text-xs"
              aria-label="Bulk status change"
            >
              <option value="">Change status to…</option>
              {availableTargets.map((status) => (
                <option key={status} value={status}>
                  {readableStatus(status)}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="outline"
              disabled={!bulkTarget || isBulkRunning}
              onClick={() => setPendingBulk(bulkTarget as OrderStatus)}
            >
              Apply
            </Button>
          </div>

          {availableTargets.length === 0 && (
            <p className="text-2xs text-ink-subtle">
              No single status is valid for every selected order.
            </p>
          )}

          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto flex items-center gap-1 text-xs text-ink-subtle underline"
          >
            <X className="h-3 w-3" /> Clear selection
          </button>
        </div>
      )}

      {/* Matches the products table — see the note there. */}
      <div className="overflow-hidden rounded-card border border-line bg-surface-raised">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-line-strong accent-accent"
                  aria-label="Select every order on this page"
                  checked={orders.length > 0 && selectedIds.size === orders.length}
                  ref={(node) => {
                    // Some-but-not-all reads as a third state, not as "off".
                    if (node) {
                      node.indeterminate =
                        selectedIds.size > 0 && selectedIds.size < orders.length;
                    }
                  }}
                  disabled={orders.length === 0}
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Placed</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={COLUMN_COUNT}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="py-10 text-center text-xs text-ink-subtle">
                  No orders match your filters.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow
                  key={order.id}
                  data-selected={selectedIds.has(order.id) || undefined}
                  className="cursor-pointer"
                  {...rowNavigation(`/admin/orders/${order.id}`)}
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-line-strong accent-accent"
                      aria-label={`Select order ${order.orderNumber}`}
                      checked={selectedIds.has(order.id)}
                      onChange={() => toggleOne(order.id)}
                    />
                  </TableCell>
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
                      {readableStatus(order.orderStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {isConfirmable(order) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => handleConfirm(order)}
                          isLoading={confirmingId === order.id}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                        </Button>
                      )}
                      <Link href={`/admin/orders/${order.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 p-0"
                          aria-label="View order"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
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

      <Dialog open={pendingBulk !== null} onClose={() => !isBulkRunning && setPendingBulk(null)}>
        {pendingBulk && (
          <BulkConfirmDialog
            status={pendingBulk}
            orders={pendingBulk === OrderStatus.CONFIRMED ? confirmable : selectedOrders}
            skipped={
              pendingBulk === OrderStatus.CONFIRMED ? selectedOrders.length - confirmable.length : 0
            }
            isRunning={isBulkRunning}
            onCancel={() => setPendingBulk(null)}
            onApply={(ids) => runBulk(pendingBulk, ids)}
          />
        )}
      </Dialog>
    </div>
  );
}

/**
 * The stop before a bulk write.
 *
 * It names the orders rather than only counting them: "18 orders" is not
 * something an admin can check, and the whole point of the pause is that a
 * mis-click on the select-all box is caught here rather than in the customers'
 * inboxes. Cancelling gets an extra warning because it restocks and starts
 * refunds, neither of which the undo button can take back — there is no undo.
 */
function BulkConfirmDialog({
  status,
  orders,
  skipped,
  isRunning,
  onCancel,
  onApply,
}: {
  status: OrderStatus;
  orders: Order[];
  skipped: number;
  isRunning: boolean;
  onCancel: () => void;
  onApply: (ids: string[]) => void;
}) {
  const isCancelling = status === OrderStatus.CANCELLED;
  const shown = orders.slice(0, 8);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          Move {orders.length} order{orders.length === 1 ? '' : 's'} to {readableStatus(status)}?
        </DialogTitle>
        <DialogDescription>
          Each one gets its own status-update email. Orders that cannot make this transition are
          left untouched and reported back.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {shown.map((order) => (
            <span
              key={order.id}
              className="rounded-control bg-surface-sunken px-2 py-1 font-mono text-2xs font-bold text-ink"
            >
              #{order.orderNumber}
            </span>
          ))}
          {orders.length > shown.length && (
            <span className="px-2 py-1 text-2xs text-ink-subtle">
              +{orders.length - shown.length} more
            </span>
          )}
        </div>

        {skipped > 0 && (
          <p className="text-2xs text-ink-subtle">
            {skipped} selected order{skipped === 1 ? '' : 's'} cannot be confirmed yet — already
            past PLACED, or prepaid with the payment not captured. They stay as they are.
          </p>
        )}

        {isCancelling && (
          <p className="rounded-control border border-danger/40 bg-danger/5 p-3 text-2xs font-medium text-danger">
            Cancelling puts every unit back into stock and starts a refund on each paid online
            order. This cannot be undone.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isRunning}>
          Keep as is
        </Button>
        <Button
          variant={isCancelling ? 'danger' : 'default'}
          isLoading={isRunning}
          disabled={orders.length === 0}
          onClick={() => onApply(orders.map((order) => order.id))}
        >
          {isCancelling ? 'Cancel orders' : `Move to ${readableStatus(status)}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
