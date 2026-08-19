import 'server-only';

import { usersCollection } from '@/shared/db/collections';
import { type User } from '@/features/auth/types';

const globalForSeed = globalThis as typeof globalThis & { veroSeedPromise?: Promise<void> };

/**
 * Seeds initial demo data the first time the app talks to an empty database.
 * Runs at most once per process and is a no-op once seeding completes.
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
  const users = await usersCollection();

  // Skip seeding if the admin user already exists
  const existingAdmin = await users.findOne({ id: 'u-admin' });
  if (existingAdmin) return;

  const now = new Date().toISOString();

  const seedUsers: User[] = [
    {
      id: 'u-admin',
      email: 'admin@verogoods.in',
      name: 'Vero Admin',
      phone: '919999999999',
      emailVerified: true,
      phoneVerified: false,
      role: 'admin',
      createdAt: now,
    },
  ];

  await users.insertMany(seedUsers).catch(() => {
    // Users may already exist from a previous partial seed; not fatal.
  });
}