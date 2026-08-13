import 'server-only';

import {
  productImagesCollection,
  productsCollection,
  specificationRowsCollection,
  specificationsCollection,
  usersCollection,
  variantsCollection,
} from '@/shared/db/collections';
import { type User } from '@/features/auth/types';
import { CURRENCY, type Product, type ProductVariant } from '@/features/catalog/types';
import { rupeesToMinor } from '@/shared/lib/money';

const globalForSeed = globalThis as typeof globalThis & { veroSeedPromise?: Promise<void> };

/**
 * Seeds demo catalogue data the first time the app talks to an empty database.
 * Runs at most once per process and is a no-op as soon as any product exists.
 */
export async function ensureSeeded(): Promise<void> {
  if (!globalForSeed.veroSeedPromise) {
    globalForSeed.veroSeedPromise = seed().catch((err) => {
      globalForSeed.veroSeedPromise = undefined;
      throw err;
    });
  }
  return globalForSeed.veroSeedPromise;
}

async function seed(): Promise<void> {
  const products = await productsCollection();
  if ((await products.estimatedDocumentCount()) > 0) return;

  const now = new Date().toISOString();

  const defs: Array<{
    product: Omit<Product, 'currency' | 'createdAt' | 'updatedAt'>;
    imageUrl: string;
    variants: Array<Omit<ProductVariant, 'productId' | 'isActive'>>;
    specs: Array<{ heading: string; rows: Array<[string, string]> }>;
  }> = [];

  const [variants, images, specs, specRows, users] = await Promise.all([
    variantsCollection(),
    productImagesCollection(),
    specificationsCollection(),
    specificationRowsCollection(),
    usersCollection(),
  ]);

  await products.insertMany(
    defs.map((d) => ({ ...d.product, currency: CURRENCY, createdAt: now, updatedAt: now }))
  );

  await variants.insertMany(
    defs.flatMap((d) =>
      d.variants.map((v) => ({ ...v, productId: d.product.id, isActive: true }))
    )
  );

  await images.insertMany(
    defs.map((d, i) => ({
      id: `img-${i + 1}`,
      productId: d.product.id,
      url: d.imageUrl,
      alt: d.product.title,
      width: 1200,
      height: 800,
      sortOrder: 0,
    }))
  );

  const specDocs = defs.flatMap((d) =>
    d.specs.map((s, i) => ({
      id: `spec-${d.product.id}-${i}`,
      productId: d.product.id,
      heading: s.heading,
      sortOrder: i,
      rows: s.rows,
    }))
  );

  if (specDocs.length > 0) {
    await specs.insertMany(
      specDocs.map(({ rows, ...spec }) => {
        void rows;
        return spec;
      })
    );
    await specRows.insertMany(
      specDocs.flatMap((spec) =>
        spec.rows.map(([label, value], i) => ({
          id: `row-${spec.id}-${i}`,
          specificationId: spec.id,
          label,
          value,
          sortOrder: i,
        }))
      )
    );
  }

  const seedUsers: User[] = [
    {
      id: 'u-admin',
      email: 'admin@verogoods.in',
      name: 'Vero Admin',
      phone: '9999999999',
      role: 'admin',
      createdAt: now,
    },
  ];
  await users.insertMany(seedUsers).catch(() => {
    // Users may already exist from a previous partial seed; not fatal.
  });
}
