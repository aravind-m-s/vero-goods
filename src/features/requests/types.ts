// Product interest ("Get it for me") domain types. Pure — safe on both sides.

/**
 * What the seller does with an interest request. NEW is the inbox; SOURCING
 * means someone is chasing the supplier; RESTOCKED closes the loop once the
 * customer has been told the product is back.
 */
export enum ProductRequestStatus {
  NEW = 'NEW',
  SOURCING = 'SOURCING',
  RESTOCKED = 'RESTOCKED',
  DECLINED = 'DECLINED',
}

export interface ProductRequest {
  id: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  /** Absent when the product has no sellable variant at all. */
  variantId?: string;
  variantName?: string;
  sku?: string;
  /** Set when the requester was signed in. Guests may request too. */
  userId?: string;
  customerName: string;
  email?: string;
  phone: string;
  quantity: number;
  note?: string;
  status: ProductRequestStatus;
  /** Internal follow-up note, admin-only. */
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}
