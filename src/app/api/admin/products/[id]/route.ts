import { NextResponse, type NextRequest } from 'next/server';
import { isAdminAuthenticated } from '@/features/auth/server/auth';
import { toProductWriteInput } from '@/features/admin/server/product-input';
import {
  archiveProduct,
  deleteProduct,
  getProductById,
  skuExists,
  slugExists,
  updateProduct,
} from '@/features/catalog/server/products.repo';
import { minorToRupees } from '@/shared/lib/money';
import { ProductFormSchema, issuesToFieldErrors } from '@/features/catalog/schemas';

export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<NextResponse | null> {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }
  return null;
}

/** Returns the product shaped for the admin form (rupees, flattened children). */
export async function GET(_request: NextRequest, ctx: RouteContext<'/api/admin/products/[id]'>) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const detail = await getProductById(id);
  if (!detail) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({
    product: {
      ...detail.product,
      imageUrls: detail.images.map((image) => image.url),
      imageAlts: Object.fromEntries(
        detail.images
          .filter((image) => image.alt && image.alt !== detail.product.title)
          .map((image) => [image.url, image.alt as string])
      ),
      videoUrls: detail.videos.map((video) => video.url),
      variants: detail.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        price: minorToRupees(variant.priceMinor),
        compareAtPrice: variant.compareAtPriceMinor
          ? minorToRupees(variant.compareAtPriceMinor)
          : undefined,
        stockQty: variant.stockQty,
        allowBackorder: variant.allowBackorder,
        weightGrams: variant.weightGrams,
        isActive: variant.isActive,
        supplier: {
          name: variant.supplier.name,
          sku: variant.supplier.sku,
          url: variant.supplier.url ?? '',
          costPrice: minorToRupees(variant.supplier.costPriceMinor),
          leadTimeDays: variant.supplier.leadTimeDays,
        },
      })),
      specifications: detail.specifications.map((spec) => ({
        id: spec.id,
        heading: spec.heading,
        rows: spec.rows.map((row) => ({ id: row.id, label: row.label, value: row.value })),
      })),
    },
  });
}

export async function PUT(request: NextRequest, ctx: RouteContext<'/api/admin/products/[id]'>) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;

  try {
    const parsed = ProductFormSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: issuesToFieldErrors(parsed.error) },
        { status: 400 }
      );
    }

    if (await slugExists(parsed.data.slug, id)) {
      return NextResponse.json(
        { error: 'Product slug is already in use by another product' },
        { status: 409 }
      );
    }

    const ownVariantIds = parsed.data.variants.map((v) => v.id).filter(Boolean) as string[];
    for (const variant of parsed.data.variants) {
      if (await skuExists(variant.sku, ownVariantIds)) {
        return NextResponse.json(
          { error: `SKU "${variant.sku}" is already used by another product` },
          { status: 409 }
        );
      }
    }

    const product = await updateProduct(id, toProductWriteInput(parsed.data));
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error('[admin] product update failed', error);
    return NextResponse.json({ error: 'Could not update the product' }, { status: 500 });
  }
}

/** `?mode=delete` hard-deletes; anything else archives. Mirrors the collection route. */
export async function DELETE(request: NextRequest, ctx: RouteContext<'/api/admin/products/[id]'>) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;

  if (new URL(request.url).searchParams.get('mode') === 'delete') {
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
    return NextResponse.json({ success: true, message: `${result.product.title} deleted` });
  }

  const product = await archiveProduct(id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: `${product.title} archived` });
}
