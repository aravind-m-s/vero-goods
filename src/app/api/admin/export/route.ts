import { type NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import { iterateOrders } from '@/features/orders/server/orders.repo';
import { OrderStatus } from '@/features/orders/types';
import { minorToRupees } from '@/shared/lib/money';

export const dynamic = 'force-dynamic';

function escapeCSV(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // A leading =, +, - or @ makes Excel treat the cell as a formula. Prefixing
  // with a single quote neutralises CSV injection from customer-typed fields.
  const guarded = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

const HEADERS = [
  'Order ID',
  'Order Number',
  'Invoice Number',
  'Created At',
  'Customer Name',
  'Customer Email',
  'Phone',
  'Shipping Address',
  'City',
  'State',
  'PIN Code',
  'Subtotal (INR)',
  'Shipping (INR)',
  'COD Fee (INR)',
  'Tax Included (INR)',
  'Total (INR)',
  'Payment Method',
  'Payment Status',
  'Order Status',
  'Courier',
  'Tracking Number',
  'Razorpay Order ID',
  'Razorpay Payment ID',
];

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const statusParam = params.get('status');
  const status: OrderStatus | 'ALL' =
    statusParam && statusParam !== 'ALL' && statusParam in OrderStatus
      ? (statusParam as OrderStatus)
      : 'ALL';

  const filters = {
    status,
    dateFrom: params.get('dateFrom') ?? undefined,
    dateTo: params.get('dateTo') ?? undefined,
    supplier: params.get('supplier') ?? undefined,
  };

  // Streamed row by row from a Mongo cursor, so exporting 100k orders does not
  // build a 100k-element array (and its CSV string) in memory first.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`${HEADERS.join(',')}\n`));
      try {
        for await (const order of iterateOrders(filters)) {
          const row = [
            order.id,
            order.orderNumber,
            order.invoiceNumber,
            new Date(order.createdAt).toLocaleString('en-IN'),
            order.customerName,
            order.email,
            order.phone,
            `${order.shippingAddress.line1}${order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''
            }`,
            order.shippingAddress.city,
            order.shippingAddress.state,
            order.shippingAddress.pinCode,
            minorToRupees(order.subtotalMinor).toFixed(2),
            minorToRupees(order.shippingMinor).toFixed(2),
            minorToRupees(order.codFeeMinor).toFixed(2),
            minorToRupees(order.taxMinor).toFixed(2),
            minorToRupees(order.totalMinor).toFixed(2),
            order.paymentMethod,
            order.paymentStatus,
            order.orderStatus,
            order.courier,
            order.trackingNumber,
            order.razorpayOrderId,
            order.razorpayPaymentId,
          ];
          controller.enqueue(encoder.encode(`${row.map(escapeCSV).join(',')}\n`));
        }
        controller.close();
      } catch (error) {
        console.error('[admin] export failed', error);
        controller.error(error);
      }
    },
  });

  const filename = `vero-goods-orders-${new Date().toISOString().split('T')[0]}.csv`;
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
