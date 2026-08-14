import 'server-only';

import { addressesCollection, stripId, stripIds } from '@/shared/db/collections';
import type { Address } from '@/features/auth/types';

export interface AddressInput {
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pinCode: string;
  country?: string;
  isDefault?: boolean;
}

/** Default first, then most recently touched — the order the customer expects. */
export async function listAddresses(userId: string): Promise<Address[]> {
  const addresses = await addressesCollection();
  return stripIds(
    await addresses.find({ userId }).sort({ isDefault: -1, updatedAt: -1 }).toArray()
  );
}

export async function getAddress(userId: string, id: string): Promise<Address | null> {
  const addresses = await addressesCollection();
  // Scoped by userId on every read: an address id from another account must
  // never resolve, no matter which handler asks for it.
  return stripId(await addresses.findOne({ id, userId }));
}

export async function getDefaultAddress(userId: string): Promise<Address | null> {
  const addresses = await addressesCollection();
  const preferred = stripId(await addresses.findOne({ userId, isDefault: true }));
  if (preferred) return preferred;
  return stripId(await addresses.findOne({ userId }, { sort: { updatedAt: -1 } }));
}

export async function createAddress(userId: string, input: AddressInput): Promise<Address> {
  const addresses = await addressesCollection();
  const now = new Date().toISOString();
  const existingCount = await addresses.countDocuments({ userId });

  const address: Address = {
    id: `addr-${crypto.randomUUID()}`,
    userId,
    label: input.label.trim(),
    fullName: input.fullName.trim(),
    phone: input.phone.trim(),
    line1: input.line1.trim(),
    line2: input.line2?.trim() || undefined,
    city: input.city.trim(),
    state: input.state.trim(),
    pinCode: input.pinCode.trim(),
    country: input.country?.trim() || 'India',
    // The first address saved is the default whether or not they ticked the box.
    isDefault: input.isDefault === true || existingCount === 0,
    createdAt: now,
    updatedAt: now,
  };

  if (address.isDefault) await clearDefault(userId);
  await addresses.insertOne({ ...address });
  return address;
}

export async function updateAddress(
  userId: string,
  id: string,
  input: Partial<AddressInput>
): Promise<Address | null> {
  const addresses = await addressesCollection();
  const current = await getAddress(userId, id);
  if (!current) return null;

  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const key of [
    'label',
    'fullName',
    'phone',
    'line1',
    'city',
    'state',
    'pinCode',
    'country',
  ] as const) {
    const value = input[key];
    if (value !== undefined) set[key] = value.trim();
  }
  if (input.line2 !== undefined) set.line2 = input.line2.trim() || undefined;

  if (input.isDefault === true) {
    await clearDefault(userId);
    set.isDefault = true;
  }

  const result = await addresses.findOneAndUpdate(
    { id, userId },
    { $set: set },
    { returnDocument: 'after' }
  );
  return stripId(result);
}

/**
 * Deleting the default promotes the next most recent address, so a customer
 * never ends up with addresses but no default.
 */
export async function deleteAddress(userId: string, id: string): Promise<boolean> {
  const addresses = await addressesCollection();
  const target = await getAddress(userId, id);
  if (!target) return false;

  await addresses.deleteOne({ id, userId });

  if (target.isDefault) {
    const next = await addresses.findOne({ userId }, { sort: { updatedAt: -1 } });
    if (next) await addresses.updateOne({ id: next.id }, { $set: { isDefault: true } });
  }
  return true;
}

export async function setDefaultAddress(userId: string, id: string): Promise<Address | null> {
  const addresses = await addressesCollection();
  const target = await getAddress(userId, id);
  if (!target) return null;

  await clearDefault(userId);
  const result = await addresses.findOneAndUpdate(
    { id, userId },
    { $set: { isDefault: true, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );
  return stripId(result);
}

async function clearDefault(userId: string): Promise<void> {
  const addresses = await addressesCollection();
  await addresses.updateMany({ userId, isDefault: true }, { $set: { isDefault: false } });
}
