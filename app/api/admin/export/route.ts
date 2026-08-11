import { NextRequest, NextResponse } from 'next/server';
import { getDb, Order, OrderStatus } from '@/lib/db/db';
import { isAdminAuthenticated } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

function escapeCSV(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  const db = await getDb();
  let orders = [...db.orders];

  // Apply filters server-side
  if (statusFilter && statusFilter !== 'ALL') {
    orders = orders.filter((o) => o.orderStatus === statusFilter);
  }

  if (dateFrom) {
    const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
    orders = orders.filter((o) => new Date(o.createdAt).getTime() >= fromTime);
  }

  if (dateTo) {
    const toTime = new Date(`${dateTo}T23:59:59`).getTime();
    orders = orders.filter((o) => new Date(o.createdAt).getTime() <= toTime);
  }

  // Sort by newest first
  orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Build CSV
  const headers = [
    'Order ID',
    'Order Number',
    'Created At',
    'Customer Name',
    'Customer Email',
    'Phone',
    'Shipping Address',
    'City',
    'State',
    'PIN Code',
    'Total Amount (INR)',
    'Payment Method',
    'Payment Status',
    'Order Status',
    'Razorpay Order ID',
    'Razorpay Payment ID',
  ];

  const rows = orders.map((o) => [
    escapeCSV(o.id),
    escapeCSV(o.orderNumber),
    escapeCSV(new Date(o.createdAt).toLocaleString('en-IN')),
    escapeCSV(o.customerName),
    escapeCSV(o.email),
    escapeCSV(o.phone),
    escapeCSV(`${o.shippingAddress.line1}${o.shippingAddress.line2 ? ', ' + o.shippingAddress.line2 : ''}`),
    escapeCSV(o.shippingAddress.city),
    escapeCSV(o.shippingAddress.state),
    escapeCSV(o.shippingAddress.pinCode),
    escapeCSV(o.totalAmount),
    escapeCSV(o.paymentMethod),
    escapeCSV(o.paymentStatus),
    escapeCSV(o.orderStatus),
    escapeCSV(o.razorpayOrderId || ''),
    escapeCSV(o.razorpayPaymentId || ''),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  const filename = `vero-goods-orders-${new Date().toISOString().split('T')[0]}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
