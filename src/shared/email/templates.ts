import 'server-only';

import { STORE_NAME, SUPPORT_EMAIL, appUrl, trackingUrl } from '@/shared/lib/config';
import { formatMinor } from '@/shared/lib/money';
import { OrderStatus, type Order, type OrderItem } from '@/features/orders/types';
import type { ProductRequest } from '@/features/requests/types';
import type { EmailMessage } from '@/shared/email/send';

/** Escapes interpolated values — order data is customer-supplied text. */
function esc(value: string | number | undefined | null): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(heading: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#71717a;margin:0 0 24px">${esc(STORE_NAME)}</p>
    <h1 style="font-size:20px;margin:0 0 16px">${esc(heading)}</h1>
    ${body}
    <p style="font-size:12px;color:#a1a1aa;margin-top:32px;border-top:1px solid #e4e4e7;padding-top:16px">
      Questions? Reply to this email or write to ${esc(SUPPORT_EMAIL)}.
    </p>
  </div></body></html>`;
}

export function otpEmail(to: string, code: string, ttlMinutes: number): EmailMessage {
  return {
    to,
    subject: `${code} is your ${STORE_NAME} verification code`,
    text: `Your ${STORE_NAME} verification code is ${code}. It expires in ${ttlMinutes} minutes. If you did not request it, ignore this email.`,
    html: layout(
      'Your verification code',
      `<p style="font-size:14px;color:#52525b;margin:0 0 20px">Use this code to sign in and complete your order.</p>
       <p style="font-size:34px;font-weight:700;letter-spacing:.18em;margin:0 0 20px">${esc(code)}</p>
       <p style="font-size:13px;color:#71717a;margin:0">Expires in ${ttlMinutes} minutes. If you did not request this, you can ignore this email.</p>`
    ),
  };
}

function itemRows(items: OrderItem[]): string {
  return items
    .map(
      (item) => `<tr>
        <td style="padding:8px 0;font-size:13px">${esc(item.productTitle)}${
          item.variantName && item.variantName !== 'Default'
            ? ` <span style="color:#71717a">(${esc(item.variantName)})</span>`
            : ''
        }<br><span style="color:#a1a1aa;font-size:11px">${esc(item.sku)} × ${item.quantity}</span></td>
        <td style="padding:8px 0;font-size:13px;text-align:right;white-space:nowrap">${esc(formatMinor(item.totalMinor))}</td>
      </tr>`
    )
    .join('');
}

function totalsRows(order: Order): string {
  const line = (label: string, value: string, bold = false) =>
    `<tr>
      <td style="padding:4px 0;font-size:13px;color:${bold ? '#18181b' : '#71717a'};font-weight:${bold ? 700 : 400}">${esc(label)}</td>
      <td style="padding:4px 0;font-size:13px;text-align:right;font-weight:${bold ? 700 : 400}">${esc(value)}</td>
    </tr>`;

  return [
    line('Subtotal', formatMinor(order.subtotalMinor)),
    line('Shipping', order.shippingMinor === 0 ? 'Free' : formatMinor(order.shippingMinor)),
    order.codFeeMinor > 0 ? line('COD handling fee', formatMinor(order.codFeeMinor)) : '',
    line('Total paid', formatMinor(order.totalMinor), true),
  ].join('');
}

/**
 * Receipt sent as soon as an order is placed (and again on payment capture).
 * It deliberately does not say "confirmed": confirmation is a separate step an
 * admin performs, and its own email goes out on that transition.
 */
export function orderReceivedEmail(order: Order, items: OrderItem[]): EmailMessage {
  const url = trackingUrl(order.trackingToken);
  const paymentLine =
    order.paymentMethod === 'COD'
      ? `Pay ${formatMinor(order.totalMinor)} in cash when your order is delivered.`
      : `We have received your payment of ${formatMinor(order.totalMinor)}.`;

  return {
    to: order.email,
    subject: `We have received order ${order.orderNumber}`,
    text: `Thanks ${order.customerName}! We have received order ${order.orderNumber}. ${paymentLine} Our team will confirm it shortly and you will get an update. Track it here: ${url}`,
    html: layout(
      `Order ${order.orderNumber} received`,
      `<p style="font-size:14px;color:#52525b;margin:0 0 8px">Thanks ${esc(order.customerName)} — we have your order and our team is reviewing it. You will get another email the moment it is confirmed.</p>
       <p style="font-size:14px;color:#52525b;margin:0 0 20px">${esc(paymentLine)}</p>
       <table style="width:100%;border-collapse:collapse;border-top:1px solid #e4e4e7;margin-bottom:8px">${itemRows(items)}</table>
       <table style="width:100%;border-collapse:collapse;border-top:1px solid #e4e4e7;padding-top:8px">${totalsRows(order)}</table>
       <p style="margin:24px 0">
         <a href="${esc(url)}" style="background:#18181b;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:11px 18px;border-radius:6px;display:inline-block">Track your order</a>
       </p>
       <p style="font-size:12px;color:#71717a;margin:0">Shipping to: ${esc(order.shippingAddress.line1)}, ${esc(order.shippingAddress.city)}, ${esc(order.shippingAddress.state)} ${esc(order.shippingAddress.pinCode)}</p>`
    ),
  };
}

const STATUS_COPY: Partial<Record<OrderStatus, { subject: string; body: string }>> = {
  [OrderStatus.CONFIRMED]: {
    subject: 'is confirmed',
    body: 'We have confirmed your order and passed it to our fulfilment partner.',
  },
  [OrderStatus.PACKED]: {
    subject: 'is packed',
    body: 'Your order is packed and waiting for courier pickup.',
  },
  [OrderStatus.SHIPPED]: {
    subject: 'has shipped',
    body: 'Your order is on its way.',
  },
  [OrderStatus.OUT_FOR_DELIVERY]: {
    subject: 'is out for delivery',
    body: 'Your order is with the delivery agent and arrives today.',
  },
  [OrderStatus.DELIVERED]: {
    subject: 'has been delivered',
    body: 'Your order has been delivered. We hope you like it.',
  },
  [OrderStatus.CANCELLED]: {
    subject: 'has been cancelled',
    body: 'Your order has been cancelled. Any payment already made will be refunded to the original payment method.',
  },
  [OrderStatus.RETURN_REQUESTED]: {
    subject: 'return has been requested',
    body: 'We have logged your return request and will be in touch with pickup details.',
  },
  [OrderStatus.RETURNED]: {
    subject: 'has been returned',
    body: 'We have received your return. Your refund is being processed.',
  },
};

export function statusUpdateEmail(order: Order): EmailMessage | null {
  const copy = STATUS_COPY[order.orderStatus];
  if (!copy) return null;

  const url = trackingUrl(order.trackingToken);
  const tracking =
    order.trackingNumber && order.courier
      ? `<p style="font-size:13px;color:#52525b;margin:0 0 20px">${esc(order.courier)} tracking number: <strong>${esc(order.trackingNumber)}</strong></p>`
      : '';

  return {
    to: order.email,
    subject: `Order ${order.orderNumber} ${copy.subject}`,
    text: `${copy.body} Track order ${order.orderNumber}: ${url}`,
    html: layout(
      `Order ${order.orderNumber} ${copy.subject}`,
      `<p style="font-size:14px;color:#52525b;margin:0 0 16px">${esc(copy.body)}</p>
       ${tracking}
       <p style="margin:8px 0 0">
         <a href="${esc(url)}" style="background:#18181b;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:11px 18px;border-radius:6px;display:inline-block">View order status</a>
       </p>`
    ),
  };
}

/**
 * "Get it for me" acknowledgement. Deliberately promises a reply, not stock —
 * the seller has not committed to sourcing anything at this point.
 */
export function productRequestCustomerEmail(request: ProductRequest): EmailMessage {
  const url = `${appUrl()}/products/${request.productSlug}`;
  const variant =
    request.variantName && request.variantName !== 'Default' ? ` (${request.variantName})` : '';

  return {
    to: request.email ?? '',
    subject: `We got your request for ${request.productTitle}`,
    text: `Thanks ${request.customerName} — we have your request for ${request.quantity} × ${request.productTitle}${variant}. Our team will check with our suppliers and get back to you on ${request.phone}. Product page: ${url}`,
    html: layout(
      'Request received',
      `<p style="font-size:14px;color:#52525b;margin:0 0 12px">Thanks ${esc(request.customerName)} — this product is out of stock right now, and we have logged your interest.</p>
       <p style="font-size:14px;color:#52525b;margin:0 0 20px"><strong>${esc(request.quantity)} × ${esc(request.productTitle)}${esc(variant)}</strong></p>
       <p style="font-size:13px;color:#71717a;margin:0 0 20px">Our team checks with suppliers and replies on ${esc(request.phone)}, usually within two working days. Reference ${esc(request.id)}.</p>
       <p style="margin:8px 0 0">
         <a href="${esc(url)}" style="background:#18181b;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:11px 18px;border-radius:6px;display:inline-block">View the product</a>
       </p>`
    ),
  };
}

/** Internal alert so a demand signal is not sitting unseen in the admin panel. */
export function productRequestAdminEmail(request: ProductRequest): EmailMessage {
  const variant =
    request.variantName && request.variantName !== 'Default' ? ` (${request.variantName})` : '';

  return {
    to: SUPPORT_EMAIL,
    subject: `Sourcing request: ${request.quantity} × ${request.productTitle}`,
    text: `${request.customerName} (${request.phone}${request.email ? `, ${request.email}` : ''}) wants ${request.quantity} × ${request.productTitle}${variant}${request.sku ? ` [${request.sku}]` : ''}. Note: ${request.note ?? '—'}`,
    html: layout(
      'New sourcing request',
      `<p style="font-size:14px;color:#52525b;margin:0 0 12px"><strong>${esc(request.quantity)} × ${esc(request.productTitle)}${esc(variant)}</strong>${request.sku ? ` <span style="color:#a1a1aa">${esc(request.sku)}</span>` : ''}</p>
       <p style="font-size:13px;color:#52525b;margin:0 0 8px">${esc(request.customerName)} · ${esc(request.phone)}${request.email ? ` · ${esc(request.email)}` : ''}</p>
       ${request.note ? `<p style="font-size:13px;color:#71717a;margin:0 0 20px">“${esc(request.note)}”</p>` : ''}
       <p style="margin:8px 0 0">
         <a href="${esc(`${appUrl()}/admin/requests`)}" style="background:#18181b;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:11px 18px;border-radius:6px;display:inline-block">Open sourcing requests</a>
       </p>`
    ),
  };
}
