import { cookies } from 'next/headers';
import { getDb, saveDb, User } from '../db/db';

const ADMIN_COOKIE_NAME = 'vero_admin_session';
const CUSTOMER_COOKIE_NAME = 'vero_customer_session';

export interface OTPRecord {
  email: string;
  code: string;
  expiresAt: string;
}

// Admin Auth Helpers
export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return session === 'authenticated_admin_active';
}

export async function setAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, 'authenticated_admin_active', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 1 day
    path: '/',
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

// Customer Auth Helpers
export async function getSessionCustomer(): Promise<User | null> {
  const cookieStore = await cookies();
  const userId = cookieStore.get(CUSTOMER_COOKIE_NAME)?.value;
  if (!userId) return null;

  const db = await getDb();
  const user = db.users.find((u) => u.id === userId && u.role === 'customer');
  return user || null;
}

export async function setCustomerSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_COOKIE_NAME, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

export async function clearCustomerSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_COOKIE_NAME);
}

// OTP Operations
interface DatabaseSchemaWithOTPs extends Awaited<ReturnType<typeof getDb>> {
  otps?: OTPRecord[];
}

export async function sendOTP(email: string): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes from now

  const db = (await getDb()) as DatabaseSchemaWithOTPs;
  if (!db.otps) {
    db.otps = [];
  }

  // Clear previous OTPs for this email
  db.otps = db.otps.filter((o) => o.email !== email);
  db.otps.push({ email, code, expiresAt });
  await saveDb(db);

  // Print to terminal/console for easy development debugging
  console.log(`\n===============================================\n[OTP VERIFICATION] code for ${email}: ${code}\n===============================================\n`);

  return code;
}

export async function verifyOTP(email: string, code: string): Promise<User | null> {
  const db = (await getDb()) as DatabaseSchemaWithOTPs;
  if (!db.otps) return null;

  const recordIdx = db.otps.findIndex(
    (o) => o.email === email && o.code === code && new Date(o.expiresAt) > new Date()
  );

  if (recordIdx === -1) return null;

  // Remove used OTP
  db.otps.splice(recordIdx, 1);

  // Check if customer user exists, else create one
  let user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    user = {
      id: `u-${Math.random().toString(36).substr(2, 9)}`,
      email: email.toLowerCase(),
      name: email.split('@')[0], // default name to email prefix
      phone: '',
      role: 'customer',
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
  }

  await saveDb(db);
  return user;
}
