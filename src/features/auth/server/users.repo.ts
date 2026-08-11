import 'server-only';

import { stripId, usersCollection } from '@/shared/db/collections';
import type { User } from '@/features/auth/types';

export async function getUserById(id: string): Promise<User | null> {
  const users = await usersCollection();
  return stripId(await users.findOne({ id }));
}

export async function getCustomerById(id: string): Promise<User | null> {
  const users = await usersCollection();
  return stripId(await users.findOne({ id, role: 'customer' }));
}

/**
 * Upsert-on-login. `role` is only set on insert, so an existing admin account
 * can never be silently downgraded by someone logging in with that address.
 */
export async function findOrCreateCustomer(email: string): Promise<User> {
  const users = await usersCollection();
  const normalised = email.trim().toLowerCase();
  const now = new Date().toISOString();

  const result = await users.findOneAndUpdate(
    { email: normalised },
    {
      $setOnInsert: {
        id: `u-${crypto.randomUUID()}`,
        email: normalised,
        name: normalised.split('@')[0],
        phone: '',
        role: 'customer' as const,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  return stripId(result) as User;
}

/** Keeps the customer record in step with what they typed at checkout. */
export async function updateCustomerContact(
  id: string,
  patch: { name?: string; phone?: string }
): Promise<void> {
  const set: Record<string, string> = {};
  if (patch.name) set.name = patch.name;
  if (patch.phone) set.phone = patch.phone;
  if (Object.keys(set).length === 0) return;

  const users = await usersCollection();
  await users.updateOne({ id }, { $set: set });
}
