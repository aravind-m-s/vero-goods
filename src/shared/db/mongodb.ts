import 'server-only';

import { MongoClient, type Db } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI is not defined');
}

const options = {
  family: 4,
  // Bound the pool so a traffic spike cannot exhaust Atlas connections.
  maxPoolSize: 20,
  minPoolSize: 1,
  retryWrites: true,
  serverSelectionTimeoutMS: 10_000,
};

// The client (and the index-creation promise) are cached on globalThis so HMR in
// dev does not open a new pool on every module reload.
const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
  mongoIndexPromise?: Promise<void>;
};

if (!globalForMongo.mongoClientPromise) {
  globalForMongo.mongoClientPromise = new MongoClient(uri, options).connect();
}

const clientPromise = globalForMongo.mongoClientPromise;

export default clientPromise;

export async function getMongoDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db();
}

/** Idempotent: a missing index (or a missing collection) is not an error. */
async function dropIndexIfExists(db: Db, collection: string, indexName: string): Promise<void> {
  try {
    await db.collection(collection).dropIndex(indexName);
  } catch {
    // IndexNotFound / NamespaceNotFound — nothing to migrate.
  }
}

/**
 * Builds a unique index, degrading to a non-unique one when existing rows
 * already violate it.
 *
 * Historic accounts can share a phone number: checkout used to copy whatever
 * the shopper typed onto their user record, unverified. Refusing to start (or
 * quietly deleting somebody's data) are both worse than running with a plain
 * index and a loud warning until an operator runs the dedupe script.
 */
async function createUniqueIndexOrWarn(
  db: Db,
  collection: string,
  key: Record<string, 1 | -1>,
  partialFilterExpression: Record<string, unknown>,
  remedy: string
): Promise<void> {
  try {
    await db.collection(collection).createIndex(key, { unique: true, partialFilterExpression });
  } catch (error) {
    const code = (error as { code?: number }).code;
    // 11000 duplicate key, 85/86 an existing index with different options.
    if (code !== 11000 && code !== 85 && code !== 86) throw error;

    console.warn(
      `[db] could not build a unique index on ${collection}.${Object.keys(key).join(',')} — ` +
        `existing documents violate it. Falling back to a non-unique index. Fix with: ${remedy}`
    );
    await db.collection(collection).createIndex(key, { partialFilterExpression });
  }
}

/**
 * Indexes for every access path the app actually uses. Runs once per process.
 * `createIndex` is idempotent, so this is safe to call on every request path.
 */
export async function ensureIndexes(): Promise<void> {
  if (!globalForMongo.mongoIndexPromise) {
    globalForMongo.mongoIndexPromise = (async () => {
      const db = await getMongoDb();

      // Phone-first accounts have no email and email-first accounts have no
      // phone, so the old plain-unique indexes (which treat "missing" as a
      // single null value) would reject the second such account. Drop them
      // once, then rebuild as partial uniques below.
      await Promise.all([
        dropIndexIfExists(db, 'users', 'email_1'),
        dropIndexIfExists(db, 'otps', 'email_1'),
      ]);

      // Identifier uniqueness is what makes "log in with this email/phone"
      // resolve to exactly one account, so it is enforced by the database
      // wherever the existing data allows it.
      await Promise.all([
        createUniqueIndexOrWarn(
          db,
          'users',
          { email: 1 },
          { email: { $type: 'string' } },
          'node scripts/dedupe-user-identifiers.mjs --field=email --fix'
        ),
        createUniqueIndexOrWarn(
          db,
          'users',
          { phone: 1 },
          { phone: { $type: 'string' } },
          'node scripts/dedupe-user-identifiers.mjs --field=phone --fix'
        ),
        createUniqueIndexOrWarn(
          db,
          'users',
          { googleId: 1 },
          { googleId: { $type: 'string' } },
          'node scripts/dedupe-user-identifiers.mjs --field=googleId --fix'
        ),
      ]);

      await Promise.all([
        db.collection('users').createIndex({ id: 1 }, { unique: true }),

        db.collection('addresses').createIndex({ id: 1 }, { unique: true }),
        db.collection('addresses').createIndex({ userId: 1, isDefault: -1, updatedAt: -1 }),

        db.collection('products').createIndex({ id: 1 }, { unique: true }),
        db.collection('products').createIndex({ slug: 1 }, { unique: true }),
        db.collection('products').createIndex({ isActive: 1, createdAt: -1 }),

        db.collection('productVariants').createIndex({ id: 1 }, { unique: true }),
        db.collection('productVariants').createIndex({ productId: 1, sortOrder: 1 }),
        db.collection('productVariants').createIndex({ sku: 1 }, { unique: true }),

        db.collection('productImages').createIndex({ productId: 1, sortOrder: 1 }),
        db.collection('productVideos').createIndex({ productId: 1, sortOrder: 1 }),

        db.collection('productRequests').createIndex({ id: 1 }, { unique: true }),
        db.collection('productRequests').createIndex({ status: 1, createdAt: -1 }),
        db.collection('productRequests').createIndex({ productId: 1, createdAt: -1 }),
        db.collection('productSpecifications').createIndex({ productId: 1, sortOrder: 1 }),
        db.collection('productSpecificationRows').createIndex({ specificationId: 1, sortOrder: 1 }),

        // Analytics rows are cheap individually and endless in aggregate, so
        // they expire rather than accumulating forever. Ninety days is long
        // enough to compare a month against the month before it.
        db.collection('productViews').createIndex({ productId: 1, at: -1 }),
        db.collection('productViews').createIndex(
          { at: 1 },
          { expireAfterSeconds: 60 * 60 * 24 * 90 }
        ),
        db.collection('cartAdds').createIndex({ productId: 1, at: -1 }),
        db.collection('cartAdds').createIndex({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }),

        // Deliberately no TTL: a price change from a year ago is exactly what
        // you need when reading a year of sales.
        db.collection('priceHistory').createIndex({ productId: 1, at: -1 }),

        db.collection('orders').createIndex({ id: 1 }, { unique: true }),
        db.collection('orders').createIndex({ orderNumber: 1 }, { unique: true }),
        db.collection('orders').createIndex({ trackingToken: 1 }, { unique: true }),
        db.collection('orders').createIndex({ userId: 1, createdAt: -1 }),
        db.collection('orders').createIndex({ orderStatus: 1, createdAt: -1 }),
        db.collection('orders').createIndex({ razorpayOrderId: 1 }, { sparse: true }),
        // Partial unique index: retrying a checkout with the same key cannot double-charge.
        db.collection('orders').createIndex(
          { userId: 1, idempotencyKey: 1 },
          { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
        ),

        db.collection('orderItems').createIndex({ orderId: 1 }),

        // One live code per identifier+purpose: requesting a new login code
        // must not silently invalidate a pending email-change verification.
        db.collection('otps').createIndex({ identifier: 1, purpose: 1 }, { unique: true }),
        // Mongo evicts expired OTPs for us; no cleanup job needed.
        db.collection('otps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

        db.collection('counters').createIndex({ id: 1 }, { unique: true }),

        db.collection('rateLimits').createIndex({ key: 1 }, { unique: true }),
        db.collection('rateLimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

        db.collection('webhookEvents').createIndex({ eventId: 1 }, { unique: true }),
        db.collection('webhookEvents').createIndex({ receivedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }),

        // Unmatched payments. Deliberately no TTL: money that arrived without a
        // home is not something to quietly expire after thirty days.
        db.collection('paymentAlerts').createIndex({ id: 1 }, { unique: true }),
        db.collection('paymentAlerts').createIndex(
          { razorpayOrderId: 1, kind: 1 },
          { unique: true }
        ),
        db.collection('paymentAlerts').createIndex({ resolvedAt: 1, lastSeenAt: -1 }),
      ]);
    })().catch((err) => {
      // Let the next call retry rather than caching a rejected promise forever.
      globalForMongo.mongoIndexPromise = undefined;
      throw err;
    });
  }
  return globalForMongo.mongoIndexPromise;
}
