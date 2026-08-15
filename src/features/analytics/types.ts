/**
 * One recorded product-page view.
 *
 * Deliberately one document per view rather than a counter on the product.
 * A counter can only ever answer "how many times was this loaded"; keeping the
 * visitor on each row means "how many people looked at it" stays answerable
 * too, and the choice between the two is made when the report is read instead
 * of being baked in at write time — where it could never be undone.
 */
export interface ProductView {
  productId: string;
  /** Random per-browser id from localStorage. Not a person, not an account. */
  visitorId: string;
  at: Date;
}

export interface ProductViewStats {
  views: number;
  uniqueViewers: number;
}

/**
 * Cart intent — the middle of the funnel.
 *
 * "Buy now" counts too: skipping the cart is a stronger decision, not a
 * different one, and treating it as a separate funnel would make every product
 * bought that way look like it converts from nothing.
 */
export interface CartAdd {
  productId: string;
  variantId: string;
  visitorId: string;
  at: Date;
}

/**
 * One recorded price change, written on save when a variant's price moves.
 *
 * Without it, comparing this month against last month silently compares two
 * different prices, and "did raising it cost me sales?" has no answer. Never
 * expires — a year-old price change is exactly what you want when reading a
 * year of sales.
 */
export interface PriceChange {
  productId: string;
  variantId: string;
  sku: string;
  fromMinor: number;
  toMinor: number;
  at: Date;
}
