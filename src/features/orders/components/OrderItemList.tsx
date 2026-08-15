import React from 'react';
import { SafeImage as Image } from '@/shared/ui/safe-image';
import type { Order, OrderItem } from '@/features/orders/types';
import { formatMinor } from '@/shared/lib/money';

/**
 * The lines of an order, as rows rather than a table.
 *
 * A four-column table of product, price, quantity and total needs about 500px
 * before the product name stops being crushed, so on a phone it either scrolled
 * sideways or wrapped into something unreadable — and the phone is where most
 * people open a receipt. Stacking the detail under the title and keeping only
 * the money in its own column reads at 320px and still lines up on a desktop.
 *
 * Shared by the account order page and the public tracking page so the two
 * cannot drift into looking like different shops.
 */
export function OrderItemList({ items }: { items: OrderItem[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 py-4 first:pt-0 last:pb-0">
          {item.imageUrl ? (
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-control bg-surface-sunken">
              <Image src={item.imageUrl} alt="" fill sizes="64px" className="object-cover" />
            </div>
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-control bg-surface-sunken" />
          )}

          {/* min-w-0 is what lets a long product name wrap instead of pushing
              the money column off the side of a narrow screen. */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-ink">{item.productTitle}</p>
            {item.variantName !== 'Default' && (
              <p className="mt-0.5 text-2xs text-ink-muted">{item.variantName}</p>
            )}
            <p className="mt-0.5 font-mono text-3xs text-ink-subtle">{item.sku}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {item.quantity} × {formatMinor(item.unitPriceMinor)}
            </p>
          </div>

          <p className="w-20 shrink-0 text-right text-sm font-bold tabular-nums text-ink sm:w-24">
            {formatMinor(item.totalMinor)}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * The money summary under the items.
 *
 * Tax, where it is shown, is shown as included rather than added: retail prices
 * here are GST-inclusive, so listing it as another line would read as a second
 * charge on top of the total.
 *
 * `showTax` is off on the public tracking page, which anyone holding the link
 * can open — it is a delivery status view, not the receipt. The account order
 * page keeps it, because that is where the customer goes for the invoice.
 */
export function OrderTotals({ order, showTax = true }: { order: Order; showTax?: boolean }) {
  return (
    <dl className="space-y-1.5 border-t border-line pt-4 text-xs">
      <SummaryRow label="Subtotal" value={formatMinor(order.subtotalMinor)} />
      <SummaryRow
        label="Shipping"
        value={order.shippingMinor === 0 ? 'Free' : formatMinor(order.shippingMinor)}
      />
      {order.codFeeMinor > 0 && (
        <SummaryRow label="COD handling fee" value={formatMinor(order.codFeeMinor)} />
      )}

      <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatMinor(order.totalMinor)}</dd>
      </div>
    </dl>
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
