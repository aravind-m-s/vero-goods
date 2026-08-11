import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, Product, ProductImage, ProductSpecification, ProductSpecificationRow } from '@/lib/db/db';
import { isAdminAuthenticated } from '@/lib/auth/auth';
import { ProductFormSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

// GET a single product with its specs and images for editing
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const { id } = await props.params;
  const db = await getDb();

  const product = db.products.find((p) => p.id === id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const imageUrls = db.productImages
    .filter((img) => img.productId === id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((img) => img.url);

  // Load specifications and rows
  const specifications = db.productSpecifications
    .filter((s) => s.productId === id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => {
      const rows = db.productSpecificationRows
        .filter((r) => r.specificationId === s.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => ({
          id: r.id,
          label: r.label,
          value: r.value,
          sortOrder: r.sortOrder,
        }));

      return {
        id: s.id,
        heading: s.heading,
        sortOrder: s.sortOrder,
        rows,
      };
    });

  return NextResponse.json({
    product: {
      ...product,
      imageUrls,
      specifications,
    },
  });
}

// PUT (update) a product
export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
  }

  const { id } = await props.params;
  const body = await request.json();
  
  // Validate input schema
  const parsed = ProductFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.format() }, { status: 400 });
  }

  const db = await getDb();
  const productIdx = db.products.findIndex((p) => p.id === id);
  if (productIdx === -1) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const { title, slug, description, price, compareAtPrice, isActive, imageUrls, specifications } = parsed.data;

  // Check if slug is used by another product
  const slugConflict = db.products.find((p) => p.slug === slug && p.id !== id);
  if (slugConflict) {
    return NextResponse.json({ error: 'Product slug is already in use by another product' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // 1. Update basic product fields
  db.products[productIdx] = {
    ...db.products[productIdx],
    title,
    slug,
    description,
    price,
    compareAtPrice: compareAtPrice || undefined,
    isActive,
    updatedAt: now,
  };

  // 2. Refresh images
  db.productImages = db.productImages.filter((img) => img.productId !== id);
  imageUrls.forEach((url, index) => {
    db.productImages.push({
      id: `img-${Math.random().toString(36).substr(2, 9)}`,
      productId: id,
      url,
      sortOrder: index,
    });
  });

  // 3. Clear existing specifications and rows for this product
  const existingSpecIds = db.productSpecifications
    .filter((s) => s.productId === id)
    .map((s) => s.id);

  db.productSpecifications = db.productSpecifications.filter((s) => s.productId !== id);
  db.productSpecificationRows = db.productSpecificationRows.filter(
    (row) => !existingSpecIds.includes(row.specificationId)
  );

  // 4. Insert updated specifications and rows
  specifications.forEach((spec, specIdx) => {
    const specId = spec.id || `spec-${Math.random().toString(36).substr(2, 9)}`;
    
    db.productSpecifications.push({
      id: specId,
      productId: id,
      heading: spec.heading,
      sortOrder: spec.sortOrder ?? specIdx,
    });

    spec.rows.forEach((row, rowIdx) => {
      const rowId = row.id || `row-${Math.random().toString(36).substr(2, 9)}`;
      db.productSpecificationRows.push({
        id: rowId,
        specificationId: specId,
        label: row.label,
        value: row.value,
        sortOrder: row.sortOrder ?? rowIdx,
      });
    });
  });

  await saveDb(db);
  return NextResponse.json({ success: true, product: db.products[productIdx] });
}
