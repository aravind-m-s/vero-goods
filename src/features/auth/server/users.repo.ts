import 'server-only';

import { stripId, stripIds, usersCollection } from '@/shared/db/collections';
import type { OtpChannel, User } from '@/features/auth/types';

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Digits only, with the Indian country code implied for bare 10-digit numbers.
 * Storing one canonical form is what makes "log in with my phone" match the
 * number the customer typed at checkout six months ago.
 */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

export function normaliseIdentifier(identifier: string, channel: OtpChannel): string {
  return channel === 'email' ? normaliseEmail(identifier) : normalisePhone(identifier);
}

export async function getUserById(id: string): Promise<User | null> {
  const users = await usersCollection();
  return stripId(await users.findOne({ id }));
}

export async function getCustomerById(id: string): Promise<User | null> {
  const users = await usersCollection();
  return stripId(await users.findOne({ id, role: 'customer' }));
}

export async function findByEmail(email: string): Promise<User | null> {
  const users = await usersCollection();
  return stripId(await users.findOne({ email: normaliseEmail(email) }));
}

export async function findByPhone(phone: string): Promise<User | null> {
  const users = await usersCollection();
  return stripId(await users.findOne({ phone: normalisePhone(phone) }));
}

export async function findByIdentifier(
  identifier: string,
  channel: OtpChannel
): Promise<User | null> {
  return channel === 'email' ? findByEmail(identifier) : findByPhone(identifier);
}

export async function findByGoogleId(googleId: string): Promise<User | null> {
  const users = await usersCollection();
  return stripId(await users.findOne({ googleId }));
}

function newUserId(): string {
  return `u-${crypto.randomUUID()}`;
}

/**
 * Upsert-on-login, keyed by whichever identifier was just proven.
 *
 * `role` is only ever set on insert, so an existing admin account can never be
 * silently downgraded by someone logging in with that address. The matching
 * `*Verified` flag is set because reaching this function means an OTP for that
 * identifier was just consumed.
 */
export async function findOrCreateCustomer(input: {
  identifier: string;
  channel: OtpChannel;
  name?: string;
}): Promise<{ user: User; created: boolean }> {
  const users = await usersCollection();
  const value = normaliseIdentifier(input.identifier, input.channel);
  const now = new Date().toISOString();
  const filter = input.channel === 'email' ? { email: value } : { phone: value };

  // Read before the upsert so the caller can say "welcome back" rather than
  // "account created" — the difference the customer actually notices.
  const existing = await users.findOne(filter);

  const fallbackName =
    input.channel === 'email' ? value.split('@')[0] : `Customer ${value.slice(-4)}`;

  const result = await users.findOneAndUpdate(
    filter,
    {
      $set: {
        [input.channel === 'email' ? 'emailVerified' : 'phoneVerified']: true,
        updatedAt: now,
      },
      $setOnInsert: {
        id: newUserId(),
        ...filter,
        name: input.name?.trim() || fallbackName,
        [input.channel === 'email' ? 'phoneVerified' : 'emailVerified']: false,
        role: 'customer' as const,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: 'after' }
  );

  const user = stripId(result) as User;

  // A returning customer who registered without a name (or with the derived
  // fallback) gets it filled in the first time they supply a real one.
  const supplied = input.name?.trim();
  if (supplied && (user.name === fallbackName || !user.name)) {
    return {
      user: (await updateProfile(user.id, { name: supplied })) ?? user,
      created: !existing,
    };
  }
  return { user, created: !existing };
}

/** Links (or creates) an account for a verified Google identity. */
export async function findOrCreateGoogleCustomer(profile: {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}): Promise<User> {
  const users = await usersCollection();
  const email = normaliseEmail(profile.email);
  const now = new Date().toISOString();

  const existing =
    (await findByGoogleId(profile.googleId)) ?? (await findByEmail(email));

  if (existing) {
    // Google has already verified the address, so linking also verifies it here.
    const result = await users.findOneAndUpdate(
      { id: existing.id },
      {
        $set: {
          googleId: profile.googleId,
          email,
          emailVerified: true,
          avatarUrl: profile.avatarUrl ?? existing.avatarUrl,
          name: existing.name?.trim() || profile.name,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' }
    );
    return stripId(result) as User;
  }

  const user: User = {
    id: newUserId(),
    email,
    name: profile.name.trim() || email.split('@')[0],
    emailVerified: true,
    phoneVerified: false,
    googleId: profile.googleId,
    avatarUrl: profile.avatarUrl,
    role: 'customer',
    createdAt: now,
    updatedAt: now,
  };
  await users.insertOne({ ...user });
  return user;
}

export interface ProfilePatch {
  name?: string;
  /** Only set after an OTP for the new address has been verified. */
  email?: string;
  phone?: string;
}

export class IdentifierTakenError extends Error {
  constructor(public readonly field: 'email' | 'phone') {
    super(`That ${field} is already used by another account`);
    this.name = 'IdentifierTakenError';
  }
}

export async function updateProfile(id: string, patch: ProfilePatch): Promise<User | null> {
  const users = await usersCollection();
  const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (patch.name !== undefined) set.name = patch.name.trim();

  if (patch.email !== undefined) {
    const email = normaliseEmail(patch.email);
    const clash = await findByEmail(email);
    if (clash && clash.id !== id) throw new IdentifierTakenError('email');
    set.email = email;
    set.emailVerified = true;
  }

  if (patch.phone !== undefined) {
    const phone = normalisePhone(patch.phone);
    const clash = await findByPhone(phone);
    if (clash && clash.id !== id) throw new IdentifierTakenError('phone');
    set.phone = phone;
    set.phoneVerified = true;
  }

  const result = await users.findOneAndUpdate({ id }, { $set: set }, { returnDocument: 'after' });
  return stripId(result);
}

/**
 * Keeps the customer record in step with what they typed at checkout.
 * Unverified — checkout is not proof of ownership, so it never flips a
 * `*Verified` flag and never overwrites an already-verified phone.
 */
export async function updateCustomerContact(
  id: string,
  patch: { name?: string; phone?: string }
): Promise<void> {
  const users = await usersCollection();
  const current = await getUserById(id);
  if (!current) return;

  const set: Record<string, unknown> = {};
  if (patch.name) set.name = patch.name;
  if (patch.phone && !current.phoneVerified) {
    const phone = normalisePhone(patch.phone);
    const clash = await findByPhone(phone);
    if (!clash || clash.id === id) set.phone = phone;
  }
  if (Object.keys(set).length === 0) return;

  set.updatedAt = new Date().toISOString();
  await users.updateOne({ id }, { $set: set });
}

/** Admin/debug helper — customers, newest first. */
export async function listCustomers(limit = 100): Promise<User[]> {
  const users = await usersCollection();
  return stripIds(
    await users.find({ role: 'customer' }).sort({ createdAt: -1 }).limit(limit).toArray()
  );
}
