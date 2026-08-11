import { splitInclusiveTax } from '@/shared/lib/money';
import type { TaxLine } from '@/features/orders/types';

/**
 * Commercial rules. These are business decisions, not technical ones — they are
 * env-overridable so they can be changed without a deploy.
 *
 * Defaults chosen: ₹99 flat shipping, free over ₹2,000, ₹49 COD handling fee.
 * Retail prices are GST-INCLUSIVE (Indian retail convention), so tax is
 * back-computed for the invoice and never added on top of the displayed price.
 */
function envMinor(name: string, fallbackMinor: number): number {
  const raw = process.env[name];
  if (!raw) return fallbackMinor;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallbackMinor;
}

export const SHIPPING_FLAT_MINOR = () => envMinor('SHIPPING_FLAT_MINOR', 9900);
export const FREE_SHIPPING_THRESHOLD_MINOR = () =>
  envMinor('FREE_SHIPPING_THRESHOLD_MINOR', 200000);
export const COD_FEE_MINOR = () => envMinor('COD_FEE_MINOR', 4900);
/** COD is refused above this value — unrecoverable loss if the customer refuses delivery. */
export const COD_MAX_ORDER_MINOR = () => envMinor('COD_MAX_ORDER_MINOR', 2000000);

export interface PricedLine {
  unitPriceMinor: number;
  quantity: number;
  totalMinor: number;
  gstRatePercent: number;
}

export interface OrderTotals {
  subtotalMinor: number;
  shippingMinor: number;
  codFeeMinor: number;
  taxMinor: number;
  taxLines: TaxLine[];
  totalMinor: number;
}

export function calculateTotals(
  lines: PricedLine[],
  paymentMethod: 'COD' | 'RAZORPAY'
): OrderTotals {
  const subtotalMinor = lines.reduce((sum, line) => sum + line.totalMinor, 0);

  const shippingMinor =
    subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR() || subtotalMinor === 0
      ? 0
      : SHIPPING_FLAT_MINOR();

  const codFeeMinor = paymentMethod === 'COD' ? COD_FEE_MINOR() : 0;

  // Group the GST contained in each line by rate. Shipping is taxed at the
  // highest rate present in the basket, which is the standard mixed-supply rule.
  const byRate = new Map<number, number>();
  for (const line of lines) {
    byRate.set(line.gstRatePercent, (byRate.get(line.gstRatePercent) ?? 0) + line.totalMinor);
  }

  if (shippingMinor > 0 && byRate.size > 0) {
    const highestRate = Math.max(...byRate.keys());
    byRate.set(highestRate, (byRate.get(highestRate) ?? 0) + shippingMinor);
  }

  const taxLines: TaxLine[] = [...byRate.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ratePercent, inclusiveMinor]) => {
      const { taxableMinor, taxMinor } = splitInclusiveTax(inclusiveMinor, ratePercent);
      return { ratePercent, taxableMinor, taxMinor };
    });

  return {
    subtotalMinor,
    shippingMinor,
    codFeeMinor,
    taxMinor: taxLines.reduce((sum, line) => sum + line.taxMinor, 0),
    taxLines,
    totalMinor: subtotalMinor + shippingMinor + codFeeMinor,
  };
}

/** Business-day-ish estimate from the slowest supplier lead time in the basket. */
export function estimateDeliveryDate(maxLeadTimeDays: number, from = new Date()): string {
  const shippingTransitDays = 3;
  const eta = new Date(from);
  eta.setDate(eta.getDate() + maxLeadTimeDays + shippingTransitDays);
  return eta.toISOString();
}
