import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import { listSupplierNames } from '@/features/catalog/server/products.repo';

export const dynamic = 'force-dynamic';

/**
 * The supplier names already in use, for the admin's supplier picker and the
 * product/order filters. There is no supplier table — the names are read back
 * off the variants and order lines that carry them, so the list can never
 * disagree with the data it describes.
 */
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  return NextResponse.json({ suppliers: await listSupplierNames() });
}
