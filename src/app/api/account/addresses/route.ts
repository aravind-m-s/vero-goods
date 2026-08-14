import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCustomer } from '@/features/auth/server/auth';
import { createAddress, listAddresses } from '@/features/auth/server/addresses.repo';
import { AddressSchema } from '@/features/auth/schemas';

export const dynamic = 'force-dynamic';

const MAX_ADDRESSES = 20;

export async function GET() {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

  return NextResponse.json({ addresses: await listAddresses(customer.id) });
}

export async function POST(request: NextRequest) {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = AddressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Check the address details' },
      { status: 400 }
    );
  }

  // A cap keeps one account from filling the collection; nobody ships to 20
  // addresses from one login.
  const existing = await listAddresses(customer.id);
  if (existing.length >= MAX_ADDRESSES) {
    return NextResponse.json(
      { error: `You can save up to ${MAX_ADDRESSES} addresses. Delete one to add another.` },
      { status: 409 }
    );
  }

  const address = await createAddress(customer.id, parsed.data);
  return NextResponse.json({ success: true, address }, { status: 201 });
}
