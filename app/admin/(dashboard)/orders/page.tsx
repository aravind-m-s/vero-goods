'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Eye,
  FileDown,
  Calendar,
  X,
  CreditCard,
  Truck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils';
import { Order, OrderStatus, PaymentStatus } from '@/lib/db/types';

export default function AdminOrdersPage() {
  const { success, error } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/orders');
      if (res.ok) {
        const data = await res.json();
        // Sort orders by newest first
        const sorted = (data.orders || []).sort(
          (a: Order, b: Order) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setOrders(sorted);
      } else {
        error('Failed to load orders list');
      }
    } catch (e) {
      error('Error connecting to backend');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Filter Logic
  const filteredOrders = orders.filter((o) => {
    // 1. Search Query (matches order ID/number or customer email/name)
    const lowerQuery = searchQuery.toLowerCase();
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(lowerQuery) ||
      o.email.toLowerCase().includes(lowerQuery) ||
      o.customerName.toLowerCase().includes(lowerQuery);

    // 2. Status Filter
    const matchesStatus = statusFilter === 'ALL' || o.orderStatus === statusFilter;

    // 3. Payment Filter
    const matchesPayment = paymentFilter === 'ALL' || o.paymentMethod === paymentFilter;

    // 4. Date Range Filter
    let matchesDate = true;
    const orderTime = new Date(o.createdAt).getTime();

    if (dateFrom) {
      const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
      matchesDate = matchesDate && orderTime >= fromTime;
    }
    if (dateTo) {
      const toTime = new Date(`${dateTo}T23:59:59`).getTime();
      matchesDate = matchesDate && orderTime <= toTime;
    }

    return matchesSearch && matchesStatus && matchesPayment && matchesDate;
  });

  // Reset Filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
  };

  // Pagination Logic
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // CSV Export Trigger
  const handleExportCSV = () => {
    // Construct query parameters
    const params = new URLSearchParams();
    if (statusFilter !== 'ALL') params.append('status', statusFilter);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);

    const downloadUrl = `/api/admin/export?${params.toString()}`;
    
    // Trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `vero-goods-orders-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    success('CSV Export initiated');
  };

  // Badges styling
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
    [OrderStatus.PLACED]: 'Placed',
    [OrderStatus.CONFIRMED]: 'Confirmed',
    [OrderStatus.PACKED]: 'Packed',
    [OrderStatus.SHIPPED]: 'Shipped',
    [OrderStatus.OUT_FOR_DELIVERY]: 'Out for Delivery',
    [OrderStatus.DELIVERED]: 'Delivered',
    [OrderStatus.CANCELLED]: 'Cancelled',
  };

  const paymentStatusBadges = (status: PaymentStatus) => {
    if (status === PaymentStatus.PAID || status === PaymentStatus.COD) return 'success';
    if (status === PaymentStatus.PENDING) return 'warning';
    return 'danger';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Order Registry
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage customer shipments, update delivery states, and export transactional reports.
          </p>
        </div>
        <Button
          onClick={handleExportCSV}
          className="gap-1.5 cursor-pointer font-bold size-sm sm:size-md"
        >
          <FileDown className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white dark:bg-zinc-950 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Input */}
          <div className="relative md:col-span-4 w-full">
            <Input
              type="text"
              placeholder="Search by order ID, email, name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-9 text-xs"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2.5 w-full">
            <Select
              value={statusFilter}
              onChange={(e: any) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value={OrderStatus.PLACED}>Placed</option>
              <option value={OrderStatus.CONFIRMED}>Confirmed</option>
              <option value={OrderStatus.PACKED}>Packed</option>
              <option value={OrderStatus.SHIPPED}>Shipped</option>
              <option value={OrderStatus.OUT_FOR_DELIVERY}>Out for Delivery</option>
              <option value={OrderStatus.DELIVERED}>Delivered</option>
              <option value={OrderStatus.CANCELLED}>Cancelled</option>
            </Select>
          </div>

          {/* Payment Method Filter */}
          <div className="md:col-span-2.5 w-full">
            <Select
              value={paymentFilter}
              onChange={(e: any) => {
                setPaymentFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 text-xs"
            >
              <option value="ALL">All Payments</option>
              <option value="COD">Cash on Delivery (COD)</option>
              <option value="RAZORPAY">Razorpay Online</option>
            </Select>
          </div>

          {/* Clear Button */}
          <div className="md:col-span-3 flex justify-end w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="h-9 text-xs cursor-pointer w-full md:w-auto"
            >
              <X className="mr-1 h-3.5 w-3.5" /> Clear Filters
            </Button>
          </div>
        </div>

        {/* Date Filters Row */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-900 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-zinc-400" />
            <span>Date From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-950 px-2 py-1 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>Date To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setCurrentPage(1);
              }}
              className="border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-950 px-2 py-1 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Orders List Table */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="py-20 text-center text-sm text-zinc-500 animate-pulse">
            Loading order records...
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="py-20 text-center text-sm text-zinc-500">
            No matching orders found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-center">Method</TableHead>
                <TableHead className="text-center">Pay Status</TableHead>
                <TableHead className="text-center">Order Status</TableHead>
                <TableHead className="hidden lg:table-cell">Date</TableHead>
                <TableHead className="text-right pr-6">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOrders.map((o) => (
                <TableRow key={o.id} className="hover:bg-zinc-50/40">
                  <TableCell className="font-mono font-bold text-xs">
                    #{o.orderNumber}
                  </TableCell>
                  
                  <TableCell>
                    <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-50">{o.customerName}</div>
                    <div className="text-[10px] text-zinc-400 truncate max-w-[150px]">{o.email}</div>
                  </TableCell>
                  
                  <TableCell className="text-right font-semibold text-xs">
                    {formatCurrency(o.totalAmount)}
                  </TableCell>

                  <TableCell className="text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-zinc-500 bg-zinc-50 dark:bg-zinc-900 px-2 py-0.5 rounded border border-zinc-150 dark:border-zinc-800">
                      {o.paymentMethod === 'COD' ? (
                        <>
                          <Truck className="h-3 w-3" /> COD
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-3 w-3" /> ONLINE
                        </>
                      )}
                    </span>
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge variant={paymentStatusBadges(o.paymentStatus)}>
                      {o.paymentStatus}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge variant={orderStatusBadges[o.orderStatus]}>
                      {statusLabels[o.orderStatus]}
                    </Badge>
                  </TableCell>

                  <TableCell className="hidden lg:table-cell text-[11px] text-zinc-500 font-medium">
                    {new Date(o.createdAt).toLocaleDateString('en-IN', {
                      dateStyle: 'medium',
                    })}
                  </TableCell>

                  <TableCell className="text-right pr-4">
                    <Link href={`/admin/orders/${o.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="View Details"
                        className="h-8 w-8 p-0 cursor-pointer"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-zinc-400">
            Page <b>{currentPage}</b> of <b>{totalPages}</b> (Showing {paginatedOrders.length} of {filteredOrders.length} orders)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="h-8 text-xs cursor-pointer font-bold"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="h-8 text-xs cursor-pointer font-bold"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
