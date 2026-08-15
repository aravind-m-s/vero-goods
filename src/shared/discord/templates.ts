import 'server-only';

import { appUrl } from '@/shared/lib/config';
import { formatMinor } from '@/shared/lib/money';
import type { Order, OrderItem } from '@/features/orders/types';
import type { DiscordMessage } from '@/shared/discord/send';

/**
 * The order alert posted to the admin channel.
 *
 * Carries the full contact and delivery details deliberately: the point is to
 * be able to act on an order — call the customer, check the address, start
 * sourcing — from the phone, without opening the admin portal. The portal link
 * is the last line for when you do need it.
 *
 * Everything in here lands on Discord's servers and is readable by everyone in
 * the channel, so the channel must be private to the people who already have
 * admin access.
 */

/** Embed field values cap at 1024 characters; long baskets get a tail summary. */
const MAX_ITEM_LINES = 15;
const FIELD_VALUE_LIMIT = 1024;

const COLOR_COD = 0xf59e0b;
const COLOR_PREPAID = 0x22c55e;

function truncateField(value: string): string {
  return value.length <= FIELD_VALUE_LIMIT
    ? value
    : `${value.slice(0, FIELD_VALUE_LIMIT - 3)}...`;
}

function itemLines(items: OrderItem[]): string {
  const shown = items.slice(0, MAX_ITEM_LINES).map((item) => {
    const variant = item.variantName === 'Default' ? '' : ` (${item.variantName})`;
    return `**${item.quantity} ×** ${item.productTitle}${variant} — ${formatMinor(item.totalMinor)}\n\`${item.sku}\``;
  });

  const hidden = items.length - shown.length;
  if (hidden > 0) shown.push(`_+ ${hidden} more item${hidden === 1 ? '' : 's'}_`);

  return truncateField(shown.join('\n') || '_No items_');
}

function addressBlock(order: Order): string {
  const address = order.shippingAddress;
  const lines = [
    address.fullName ?? order.customerName,
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.pinCode}`,
    address.country,
  ].filter(Boolean);

  return truncateField(lines.join('\n'));
}

function totalsBlock(order: Order): string {
  const rows = [`Subtotal — ${formatMinor(order.subtotalMinor)}`];
  rows.push(
    `Shipping — ${order.shippingMinor === 0 ? 'Free' : formatMinor(order.shippingMinor)}`
  );
  if (order.codFeeMinor > 0) rows.push(`COD fee — ${formatMinor(order.codFeeMinor)}`);
  rows.push(`**Total — ${formatMinor(order.totalMinor)}**`);
  return truncateField(rows.join('\n'));
}

export function orderPlacedDiscord(order: Order, items: OrderItem[]): DiscordMessage {
  const isCod = order.paymentMethod === 'COD';
  const adminUrl = `${appUrl()}/admin/orders/${order.id}`;

  return {
    embeds: [
      {
        title: `${isCod ? 'New COD order' : 'New paid order'} · ${order.orderNumber}`,
        description: isCod
          ? 'Cash on delivery — collect at handover.'
          : `Payment captured${order.razorpayPaymentId ? ` · \`${order.razorpayPaymentId}\`` : ''}`,
        color: isCod ? COLOR_COD : COLOR_PREPAID,
        fields: [
          { name: 'Customer', value: truncateField(order.customerName), inline: true },
          // Printed exactly as stored. `CreateOrderSchema` keeps the bare
          // 10-digit number the customer typed — it is not the `91`-prefixed
          // form the users collection normalises to, so adding a `+` here would
          // produce a number that does not dial.
          { name: 'Phone', value: order.phone || '—', inline: true },
          { name: 'Email', value: truncateField(order.email || '—'), inline: true },
          { name: 'Delivery address', value: addressBlock(order) },
          { name: `Items (${items.length})`, value: itemLines(items) },
          { name: 'Totals', value: totalsBlock(order), inline: true },
          {
            name: 'Payment',
            value: `${isCod ? 'Cash on delivery' : 'Razorpay'}\n${order.paymentStatus}`,
            inline: true,
          },
        ],
        footer: {
          text: order.estimatedDeliveryDate
            ? `Est. delivery ${new Date(order.estimatedDeliveryDate).toLocaleDateString('en-IN', {
              dateStyle: 'medium',
            })}`
            : 'Vero Goods',
        },
        timestamp: order.createdAt,
      },
    ],
    // Last line, outside the embed, so it is a plain tappable URL on mobile
    // rather than something to copy out of a formatted block.
    content: adminUrl,
  };
}
