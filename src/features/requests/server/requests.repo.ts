import 'server-only';

import { productRequestsCollection, stripId, stripIds } from '@/shared/db/collections';
import { ProductRequestStatus, type ProductRequest } from '@/features/requests/types';

export interface CreateProductRequestInput {
  productId: string;
  productSlug: string;
  productTitle: string;
  variantId?: string;
  variantName?: string;
  sku?: string;
  userId?: string;
  customerName: string;
  email?: string;
  phone: string;
  quantity: number;
  note?: string;
}

export async function createProductRequest(
  input: CreateProductRequestInput
): Promise<ProductRequest> {
  const requests = await productRequestsCollection();
  const now = new Date().toISOString();

  const request: ProductRequest = {
    id: `req-${crypto.randomUUID().slice(0, 12)}`,
    ...input,
    status: ProductRequestStatus.NEW,
    createdAt: now,
    updatedAt: now,
  };

  await requests.insertOne({ ...request });
  return request;
}

/**
 * A customer who asks twice for the same thing in a day is not two leads. The
 * repeat is swallowed so the admin inbox stays a list of real demand signals.
 */
export async function findRecentDuplicate(
  productId: string,
  phone: string,
  withinHours = 24
): Promise<ProductRequest | null> {
  const requests = await productRequestsCollection();
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
  return stripId(
    await requests.findOne({ productId, phone, createdAt: { $gte: since } })
  );
}

export interface ProductRequestPage {
  requests: ProductRequest[];
  total: number;
  /** Open requests across every page — what the sidebar badge counts. */
  newCount: number;
}

export async function listProductRequests(opts: {
  status?: ProductRequestStatus | 'ALL';
  page?: number;
  pageSize?: number;
} = {}): Promise<ProductRequestPage> {
  const requests = await productRequestsCollection();
  const filter = opts.status && opts.status !== 'ALL' ? { status: opts.status } : {};
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 25));

  const [docs, total, newCount] = await Promise.all([
    requests
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
    requests.countDocuments(filter),
    requests.countDocuments({ status: ProductRequestStatus.NEW }),
  ]);

  return { requests: stripIds(docs), total, newCount };
}

export async function updateProductRequest(
  id: string,
  patch: { status?: ProductRequestStatus; adminNote?: string }
): Promise<ProductRequest | null> {
  const requests = await productRequestsCollection();
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.status) set.status = patch.status;
  if (patch.adminNote !== undefined) set.adminNote = patch.adminNote;

  const result = await requests.findOneAndUpdate({ id }, { $set: set }, { returnDocument: 'after' });
  return stripId(result);
}

export async function countOpenRequests(): Promise<number> {
  const requests = await productRequestsCollection();
  return requests.countDocuments({ status: ProductRequestStatus.NEW });
}
