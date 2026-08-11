import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/db';
import { isAdminAuthenticated } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const db = await getDb();
  return NextResponse.json({ orders: db.orders });
}
