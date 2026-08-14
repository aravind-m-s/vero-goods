import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCustomer } from '@/features/auth/server/auth';
import {
  deleteAddress,
  getAddress,
  setDefaultAddress,
  updateAddress,
} from '@/features/auth/server/addresses.repo';
import { AddressUpdateSchema } from '@/features/auth/schemas';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<'/api/account/addresses/[id]'>
) {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

  const { id } = await ctx.params;
  const address = await getAddress(customer.id, id);
  if (!address) return NextResponse.json({ error: 'Address not found' }, { status: 404 });

  return NextResponse.json({ address });
}

export async function PATCH(request: NextRequest, ctx: RouteContext<'/api/account/addresses/[id]'>) {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = AddressUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Check the address details' },
      { status: 400 }
    );
  }

  const address = await updateAddress(customer.id, id, parsed.data);
  if (!address) return NextResponse.json({ error: 'Address not found' }, { status: 404 });

  return NextResponse.json({ success: true, address });
}

/** PUT — make this the default delivery address. */
export async function PUT(_request: NextRequest, ctx: RouteContext<'/api/account/addresses/[id]'>) {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

  const { id } = await ctx.params;
  const address = await setDefaultAddress(customer.id, id);
  if (!address) return NextResponse.json({ error: 'Address not found' }, { status: 404 });

  return NextResponse.json({ success: true, address });
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<'/api/account/addresses/[id]'>
) {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });

  const { id } = await ctx.params;
  const deleted = await deleteAddress(customer.id, id);
  if (!deleted) return NextResponse.json({ error: 'Address not found' }, { status: 404 });

  return NextResponse.json({ success: true });
}
