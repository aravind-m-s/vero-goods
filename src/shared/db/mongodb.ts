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

/**
 * Indexes for every access path the app actually uses. Runs once per process.
 * `createIndex` is idempotent, so this is safe to call on every request path.
 */
export async function ensureIndexes(): Promise<void> {
  if (!globalForMongo.mongoIndexPromise) {
    globalForMongo.mongoIndexPromise = (async () => {
      const db = await getMongoDb();
      await Promise.all([
        db.collection('users').createIndex({ id: 1 }, { unique: true }),
        db.collection('users').createIndex({ email: 1 }, { unique: true }),

        db.collection('products').createIndex({ id: 1 }, { unique: true }),
        db.collection('products').createIndex({ slug: 1 }, { unique: true }),
        db.collection('products').createIndex({ isActive: 1, createdAt: -1 }),

        db.collection('productVariants').createIndex({ id: 1 }, { unique: true }),
        db.collection('productVariants').createIndex({ productId: 1, sortOrder: 1 }),
        db.collection('productVariants').createIndex({ sku: 1 }, { unique: true }),

        db.collection('productImages').createIndex({ productId: 1, sortOrder: 1 }),
        db.collection('productSpecifications').createIndex({ productId: 1, sortOrder: 1 }),
        db.collection('productSpecificationRows').createIndex({ specificationId: 1, sortOrder: 1 }),

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

        db.collection('otps').createIndex({ email: 1 }, { unique: true }),
        // Mongo evicts expired OTPs for us; no cleanup job needed.
        db.collection('otps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

        db.collection('counters').createIndex({ id: 1 }, { unique: true }),

        db.collection('rateLimits').createIndex({ key: 1 }, { unique: true }),
        db.collection('rateLimits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),

        db.collection('webhookEvents').createIndex({ eventId: 1 }, { unique: true }),
        db.collection('webhookEvents').createIndex({ receivedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }),
      ]);
    })().catch((err) => {
      // Let the next call retry rather than caching a rejected promise forever.
      globalForMongo.mongoIndexPromise = undefined;
      throw err;
    });
  }
  return globalForMongo.mongoIndexPromise;
}
