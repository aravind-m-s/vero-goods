import 'server-only';

import type { Collection, Document } from 'mongodb';
import { ensureIndexes, getMongoDb } from '@/shared/db/mongodb';
import type { Address, OtpRecord, User } from '@/features/auth/types';
import type { Product, ProductImage, ProductSpecification, ProductSpecificationRow, ProductVariant, ProductVideo } from '@/features/catalog/types';
import type { Order, OrderItem } from '@/features/orders/types';
import type { ProductRequest } from '@/features/requests/types';
import type { Counter } from '@/shared/db/types';

/**
 * Every document in this app carries its own string `id`. Mongo's `_id` is an
 * implementation detail and is stripped on the way out — see `stripId`.
 */
export type WithMongoId<T> = T & { _id?: unknown };

async function collection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getMongoDb();
  // Idempotent and cached per process; guarantees indexes exist before first query.
  await ensureIndexes();
  return db.collection<T>(name);
}

export const usersCollection = () => collection<WithMongoId<User>>('users');
export const addressesCollection = () => collection<WithMongoId<Address>>('addresses');
export const productsCollection = () => collection<WithMongoId<Product>>('products');
export const variantsCollection = () => collection<WithMongoId<ProductVariant>>('productVariants');
export const productImagesCollection = () => collection<WithMongoId<ProductImage>>('productImages');
export const productVideosCollection = () => collection<WithMongoId<ProductVideo>>('productVideos');
export const productRequestsCollection = () =>
  collection<WithMongoId<ProductRequest>>('productRequests');
export const specificationsCollection = () =>
  collection<WithMongoId<ProductSpecification>>('productSpecifications');
export const specificationRowsCollection = () =>
  collection<WithMongoId<ProductSpecificationRow>>('productSpecificationRows');
export const ordersCollection = () => collection<WithMongoId<Order>>('orders');
export const orderItemsCollection = () => collection<WithMongoId<OrderItem>>('orderItems');
export const otpsCollection = () => collection<WithMongoId<OtpRecord>>('otps');
export const countersCollection = () => collection<WithMongoId<Counter>>('counters');
export const rateLimitsCollection = () =>
  collection<{ key: string; count: number; expiresAt: Date }>('rateLimits');
export const webhookEventsCollection = () =>
  collection<{ eventId: string; receivedAt: Date }>('webhookEvents');

/** Drops Mongo's `_id` so documents can cross the server/client boundary. */
export function stripId<T>(doc: WithMongoId<T> | null): T | null {
  if (!doc) return null;
  const { _id, ...rest } = doc as Record<string, unknown>;
  void _id;
  return rest as T;
}

export function stripIds<T>(docs: WithMongoId<T>[]): T[] {
  return docs.map((doc) => stripId(doc) as T);
}

/**
 * Atomically increments a named sequence and returns the new value.
 * This is what makes order numbers collision-free under concurrency — the old
 * `orders.length + 1` approach handed the same number to simultaneous checkouts.
 */
export async function nextSequence(name: string, startAt = 1000): Promise<number> {
  const counters = await countersCollection();
  const result = await counters.findOneAndUpdate(
    { id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = result?.seq ?? 1;
  return startAt + seq;
}
