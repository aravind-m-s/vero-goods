// Catalog domain types. Pure — safe in both Client and Server Components.
//
// MONEY: every monetary value is an integer number of paise (1 INR = 100 paise)
// and is suffixed `Minor`. Never store rupees as a float.

export const CURRENCY = 'INR';

/**
 * Which ways a product may be paid for. Set per product by the admin: some
 * items are too costly or too fragile to hand to a courier on COD terms, and
 * some suppliers only ship against a prepaid order.
 */
export type PaymentSupport = 'BOTH' | 'ONLINE' | 'COD';

/** Products stored before this field existed accept either method. */
export const DEFAULT_PAYMENT_SUPPORT: PaymentSupport = 'BOTH';

/**
 * The checkout methods a product allows. `RAZORPAY` is the online rail, and is
 * the only one every product is guaranteed to offer.
 */
export function allowedPaymentMethods(
  support: PaymentSupport | undefined
): Array<'COD' | 'RAZORPAY'> {
  switch (support ?? DEFAULT_PAYMENT_SUPPORT) {
    case 'COD':
      return ['COD'];
    case 'ONLINE':
      return ['RAZORPAY'];
    default:
      return ['COD', 'RAZORPAY'];
  }
}

/**
 * What a whole basket allows: a method has to be accepted by every product in
 * it, since one order carries one payment.
 */
export function basketPaymentMethods(
  supports: Array<PaymentSupport | undefined>
): Array<'COD' | 'RAZORPAY'> {
  return (['COD', 'RAZORPAY'] as const).filter((method) =>
    supports.every((support) => allowedPaymentMethods(support).includes(method))
  );
}

/** Supplier/fulfilment metadata. Dropshipping-specific, admin-only — never sent to the storefront. */
export interface SupplierInfo {
  name: string;
  sku: string;
  url?: string;
  /** Landed cost we pay the supplier, in paise. Used for margin reporting. */
  costPriceMinor: number;
  /** Supplier dispatch lead time, in days. Drives the delivery estimate shown at checkout. */
  leadTimeDays: number;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  currency: string;
  isActive: boolean;
  /** GST rate applied to this product, e.g. 18 for 18%. Prices are GST-inclusive. */
  gstRatePercent: number;
  /** HSN code — required on a compliant Indian GST invoice. */
  hsnCode?: string;
  /**
   * Which payment methods checkout may offer for this product. Absent on
   * products created before it existed, which is read as `BOTH`.
   */
  paymentSupport?: PaymentSupport;
  /**
   * What this product costs to deliver, in paise. Zero means free delivery and
   * is shown as such. Absent on products created before the field existed —
   * those keep falling back to the store-wide flat rate.
   */
  shippingMinor?: number;
  /**
   * Set when the product is retired, cleared when it is brought back.
   *
   * Distinct from `isActive: false`, which is "off the shelf for now".
   * Archived means "done with this", and is what keeps a retired catalogue out
   * of the working list without deleting rows that invoices still point at.
   * Absent on every product that has never been archived, so no migration.
   */
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Every product has at least one variant, even single-SKU products (a "Default"
 * variant is created automatically). Price, stock, weight, and supplier all live
 * here so cart/order/stock logic never needs a product-or-variant branch.
 */
export interface ProductVariant {
  id: string;
  productId: string;
  /** Human label, e.g. "Coal Black / 1kg". "Default" for single-SKU products. */
  name: string;
  sku: string;
  priceMinor: number;
  compareAtPriceMinor?: number;
  /** Units on hand. Decremented atomically at order placement. */
  stockQty: number;
  /** Allow selling below zero stock (supplier-backed products with reliable restock). */
  allowBackorder: boolean;
  weightGrams: number;
  supplier: SupplierInfo;
  sortOrder: number;
  isActive: boolean;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  sortOrder: number;
}

/**
 * Product video. `url` is either a direct file (mp4/webm) or a YouTube/Vimeo
 * watch/share link — the player picks its rendering from the URL, so the admin
 * pastes whatever the supplier gave them.
 */
export interface ProductVideo {
  id: string;
  productId: string;
  url: string;
  title?: string;
  /** Poster frame for direct-file videos. Optional; embeds bring their own. */
  thumbnailUrl?: string;
  sortOrder: number;
}

export interface ProductSpecification {
  id: string;
  productId: string;
  heading: string;
  sortOrder: number;
}

export interface ProductSpecificationRow {
  id: string;
  specificationId: string;
  label: string;
  value: string;
  sortOrder: number;
}
