import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, Product } from '@/lib/db/db';
import { isAdminAuthenticated } from '@/lib/auth/auth';
import { ProductFormSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

// GET all products for admin (authenticated)
export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const db = await getDb();
  return NextResponse.json({ products: db.products });
}

// POST create a new product
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    // Validate schema
    const parsed = ProductFormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.format() }, { status: 400 });
    }

    const { title, slug, description, price, compareAtPrice, isActive, imageUrls, specifications } = parsed.data;
    
    const db = await getDb();
    
    // Check if slug is unique
    const slugConflict = db.products.find((p) => p.slug === slug);
    if (slugConflict) {
      return NextResponse.json({ error: 'Product slug must be unique' }, { status: 400 });
    }

    const productId = `p-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    // 1. Save product
    const newProduct: Product = {
      id: productId,
      title,
      slug,
      description,
      price,
      compareAtPrice: compareAtPrice || undefined,
      currency: 'INR',
      isActive,
      createdAt: now,
      updatedAt: now,
    };
    db.products.push(newProduct);

    // 2. Save images
    imageUrls.forEach((url, idx) => {
      db.productImages.push({
        id: `img-${Math.random().toString(36).substr(2, 9)}`,
        productId,
        url,
        sortOrder: idx,
      });
    });

    // 3. Save specs and rows
    specifications.forEach((spec, specIdx) => {
      const specId = `spec-${Math.random().toString(36).substr(2, 9)}`;
      db.productSpecifications.push({
        id: specId,
        productId,
        heading: spec.heading,
        sortOrder: spec.sortOrder ?? specIdx,
      });

      spec.rows.forEach((row, rowIdx) => {
        db.productSpecificationRows.push({
          id: `row-${Math.random().toString(36).substr(2, 9)}`,
          specificationId: specId,
          label: row.label,
          value: row.value,
          sortOrder: row.sortOrder ?? rowIdx,
        });
      });
    });

    await saveDb(db);
    return NextResponse.json({ success: true, product: newProduct });
  } catch (e) {
    console.error('Error creating product:', e);
    return NextResponse.json({ error: 'Internal server error during product creation' }, { status: 500 });
  }
}

// DELETE or Deactivate product
export async function DELETE(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

  const db = await getDb();
  const productIdx = db.products.findIndex((p) => p.id === id);

  if (productIdx === -1) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const product = db.products[productIdx];

  // Clean up product and its nested specs/images
  db.products.splice(productIdx, 1);
  db.productImages = db.productImages.filter((img) => img.productId !== id);
  
  const specIds = db.productSpecifications
    .filter((s) => s.productId === id)
    .map((s) => s.id);
    
  db.productSpecifications = db.productSpecifications.filter((s) => s.productId !== id);
  db.productSpecificationRows = db.productSpecificationRows.filter(
    (row) => !specIds.includes(row.specificationId)
  );

  await saveDb(db);
  return NextResponse.json({ success: true, message: `Product ${product.title} deleted successfully` });
}

// PATCH toggle active status
export async function PATCH(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const body = await request.json();
  const { id, isActive } = body;

  if (!id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

  const db = await getDb();
  const product = db.products.find((p) => p.id === id);

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  product.isActive = isActive;
  product.updatedAt = new Date().toISOString();
  await saveDb(db);

  return NextResponse.json({ success: true, product });
}
