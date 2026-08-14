import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import { toProductWriteInput } from '@/features/admin/server/product-input';
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  listAdminProducts,
  setProductActive,
  skuExists,
  slugExists,
} from '@/features/catalog/server/products.repo';
import { ProductFormSchema, issuesToFieldErrors } from '@/features/catalog/schemas';

export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  return NextResponse.json({ products: await listAdminProducts() });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const parsed = ProductFormSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: issuesToFieldErrors(parsed.error) },
        { status: 400 }
      );
    }

    if (await slugExists(parsed.data.slug)) {
      return NextResponse.json({ error: 'Product slug must be unique' }, { status: 409 });
    }

    for (const variant of parsed.data.variants) {
      if (await skuExists(variant.sku)) {
        return NextResponse.json(
          { error: `SKU "${variant.sku}" is already used by another product` },
          { status: 409 }
        );
      }
    }

    const product = await createProduct(toProductWriteInput(parsed.data));
    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error) {
    console.error('[admin] product creation failed', error);
    return NextResponse.json({ error: 'Could not create the product' }, { status: 500 });
  }
}

/**
 * `?mode=archive` (default) soft-deletes: the product stays in the database so
 * invoices, returns and reporting keep resolving. `?mode=delete` hard-deletes,
 * and is refused with 409 once any order item references the product.
 */
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  const mode = params.get('mode') === 'delete' ? 'delete' : 'archive';
  if (!id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

  if (mode === 'delete') {
    const result = await deleteProduct(id);
    if (result.status === 'not-found') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    if (result.status === 'referenced') {
      return NextResponse.json(
        {
          error: `${result.product.title} appears on ${result.orderItemCount} order item${
            result.orderItemCount === 1 ? '' : 's'
          } and cannot be deleted. Archive it instead.`,
          orderItemCount: result.orderItemCount,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({
      success: true,
      message: `${result.product.title} deleted permanently`,
    });
  }

  const product = await archiveProduct(id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: `${product.title} archived and hidden from the storefront`,
  });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = (await request.json()) as { id?: string; isActive?: boolean };
  if (!body.id || typeof body.isActive !== 'boolean') {
    return NextResponse.json({ error: 'Product ID and isActive are required' }, { status: 400 });
  }

  const product = await setProductActive(body.id, body.isActive);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, product });
}
