/**
 * All money in this app is an integer count of paise (minor units).
 * Floats are never used for money — 0.1 + 0.2 problems on an invoice are not acceptable.
 */

export const MINOR_PER_MAJOR = 100;

export function rupeesToMinor(rupees: number): number {
  return Math.round(rupees * MINOR_PER_MAJOR);
}

export function minorToRupees(minor: number): number {
  return minor / MINOR_PER_MAJOR;
}

/** Formats paise as "₹19,999" / "₹1,499.50". */
export function formatMinor(minor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: minor % MINOR_PER_MAJOR === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minorToRupees(minor));
}

/**
 * Splits a GST-INCLUSIVE amount into its taxable value and tax component.
 * Indian retail convention: the shelf price is what the customer pays, and the
 * invoice shows the tax already contained within it.
 */
export function splitInclusiveTax(
  inclusiveMinor: number,
  ratePercent: number
): { taxableMinor: number; taxMinor: number } {
  if (ratePercent <= 0) return { taxableMinor: inclusiveMinor, taxMinor: 0 };
  const taxableMinor = Math.round((inclusiveMinor * 100) / (100 + ratePercent));
  return { taxableMinor, taxMinor: inclusiveMinor - taxableMinor };
}
