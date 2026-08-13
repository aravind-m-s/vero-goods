import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI is not set. Run with node --env-file=.env scripts/reseed.mjs');
  process.exit(1);
}

const client = new MongoClient(uri, { family: 4 });

try {
  await client.connect();
  const db = client.db();

  console.log('Clearing old product catalog collections...');
  const collectionsToClear = [
    'products',
    'productVariants',
    'productImages',
    'productSpecifications',
    'productSpecificationRows',
  ];

  for (const name of collectionsToClear) {
    try {
      await db.collection(name).drop();
      console.log(`Dropped collection: ${name}`);
    } catch (err) {
      if (err.codeName !== 'NamespaceNotFound') {
        console.warn(`Could not drop ${name}:`, err.message);
      }
    }
  }

  console.log('Database cleared! Run the app or trigger seed to insert the new e-commerce catalog.');
} catch (error) {
  console.error('Error reseeding database:', error);
  process.exit(1);
} finally {
  await client.close();
}
