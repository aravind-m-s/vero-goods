import 'server-only';

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('MONGODB_URI is not defined');
}

const options = {
  family: 4,
};

const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

if (!globalForMongo.mongoClientPromise) {
  const client = new MongoClient(uri, options);
  console.log(
    'MONGODB_URI:',
    process.env.MONGODB_URI?.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'),
  );

  globalForMongo.mongoClientPromise = client.connect();
}

export default globalForMongo.mongoClientPromise;