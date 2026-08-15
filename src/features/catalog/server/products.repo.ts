import 'server-only';

import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache';
import {
  orderItemsCollection,
  priceHistoryCollection,
  productImagesCollection,
  productVideosCollection,
  productsCollection,
  specificationRowsCollection,
  specificationsCollection,
  stripIds,
  variantsCollection,
} from '@/shared/db/collections';
import { ensureSeeded } from '@/shared/db/seed';
import type { PriceChange } from '@/features/analytics/types';
import type { Product, ProductImage, ProductSpecification, ProductSpecificationRow, ProductVariant, ProductVideo } from '@/features/catalog/types';

export const PRODUCTS_TAG = 'products';

/** Call after any catalogue mutation so cached storefront reads refresh. */
export function revalidateCatalogue(): void {
  // 'max' keeps serving the previous page while the fresh one is generated.
  revalidateTag(PRODUCTS_TAG, 'max');

  // `revalidateTag` only marks the *data* caches stale. The storefront routes
  // are prerendered, and their route cache entries survive it — which is how a
  // saved product could sit in the database while the page kept serving the
  // HTML from before the edit. The two are complementary, not alternatives.
  // See node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md
  revalidatePath('/');
  revalidatePath('/products/[slug]', 'page');
}

export interface ProductWithDetail {
  product: Product;
  variants: ProductVariant[];
  images: ProductImage[];
  videos: ProductVideo[];
  specifications: Array<ProductSpecification & { rows: ProductSpecificationRow[] }>;
}

export interface ProductCard {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string;
  imageAlt?: string;
  /** Lowest active variant price, in paise. */
  fromPriceMinor: number;
  compareAtPriceMinor?: number;
  inStock: boolean;
  variantCount: number;
  updatedAt: string;
}

async function loadActiveProductCards(): Promise<ProductCard[]> {
  await ensureSeeded();
  const [products, variants, images] = await Promise.all([
    productsCollection(),
    variantsCollection(),
    productImagesCollection(),
  ]);

  const activeProducts = stripIds(
    await products.find({ isActive: true }).sort({ createdAt: -1 }).toArray()
  );
  if (activeProducts.length === 0) return [];

  const ids = activeProducts.map((p) => p.id);
  const [allVariants, allImages] = await Promise.all([
    variants.find({ productId: { $in: ids }, isActive: true }).sort({ sortOrder: 1 }).toArray(),
    images.find({ productId: { $in: ids } }).sort({ sortOrder: 1 }).toArray(),
  ]);

  return activeProducts.map((product) => {
    const productVariants = allVariants.filter((v) => v.productId === product.id);
    const image = allImages.find((img) => img.productId === product.id);
    const cheapest = productVariants.reduce<ProductVariant | undefined>(
      (min, v) => (!min || v.priceMinor < min.priceMinor ? v : min),
      undefined
    );

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      imageUrl: image?.url,
      imageAlt: image?.alt ?? product.title,
      fromPriceMinor: cheapest?.priceMinor ?? 0,
      compareAtPriceMinor: cheapest?.compareAtPriceMinor,
      inStock: productVariants.some((v) => v.stockQty > 0 || v.allowBackorder),
      variantCount: productVariants.length,
      updatedAt: product.updatedAt,
    };
  });
}

/**
 * Storefront catalogue. Cached and tag-invalidated on admin writes, so the
 * listing no longer hits Mongo once per visitor.
 */
export const getActiveProductCards = unstable_cache(loadActiveProductCards, ['product-cards'], {
  tags: [PRODUCTS_TAG],
  revalidate: 3600,
});

async function loadProductDetail(
  by: { slug: string } | { id: string }
): Promise<ProductWithDetail | null> {
  await ensureSeeded();
  const products = await productsCollection();
  const product = stripIds(await products.find(by).limit(1).toArray())[0];
  if (!product) return null;

  const [variantsCol, imagesCol, videosCol, specsCol, rowsCol] = await Promise.all([
    variantsCollection(),
    productImagesCollection(),
    productVideosCollection(),
    specificationsCollection(),
    specificationRowsCollection(),
  ]);

  const [variants, images, videos, specifications] = await Promise.all([
    variantsCol.find({ productId: product.id }).sort({ sortOrder: 1 }).toArray(),
    imagesCol.find({ productId: product.id }).sort({ sortOrder: 1 }).toArray(),
    videosCol.find({ productId: product.id }).sort({ sortOrder: 1 }).toArray(),
    specsCol.find({ productId: product.id }).sort({ sortOrder: 1 }).toArray(),
  ]);

  const specIds = specifications.map((s) => s.id);
  const rows = specIds.length
    ? await rowsCol.find({ specificationId: { $in: specIds } }).sort({ sortOrder: 1 }).toArray()
    : [];

  return {
    product,
    variants: stripIds(variants),
    images: stripIds(images),
    videos: stripIds(videos),
    specifications: stripIds(specifications).map((spec) => ({
      ...spec,
      rows: stripIds(rows.filter((r) => r.specificationId === spec.id)),
    })),
  };
}

export const getProductBySlug = unstable_cache(
  (slug: string) => loadProductDetail({ slug }),
  ['product-detail-slug'],
  { tags: [PRODUCTS_TAG], revalidate: 3600 }
);

/** Admin reads are uncached — editors must see their own writes immediately. */
export function getProductById(id: string): Promise<ProductWithDetail | null> {
  return loadProductDetail({ id });
}

export const getActiveProductSlugs = unstable_cache(
  async (): Promise<Array<{ slug: string; updatedAt: string }>> => {
    await ensureSeeded();
    const products = await productsCollection();
    const docs = await products
      .find({ isActive: true }, { projection: { slug: 1, updatedAt: 1, _id: 0 } })
      .toArray();
    return docs.map((d) => ({ slug: d.slug as string, updatedAt: d.updatedAt as string }));
  },
  ['product-slugs'],
  { tags: [PRODUCTS_TAG], revalidate: 3600 }
);

export interface AdminProductRow extends Product {
  variantCount: number;
  totalStock: number;
  fromPriceMinor: number;
  costPriceMinor: number;
  imageUrl?: string;
}

export async function listAdminProducts(): Promise<AdminProductRow[]> {
  await ensureSeeded();
  const [products, variantsCol, imagesCol] = await Promise.all([
    productsCollection(),
    variantsCollection(),
    productImagesCollection(),
  ]);

  const all = stripIds(await products.find({}).sort({ createdAt: -1 }).toArray());
  if (all.length === 0) return [];

  const ids = all.map((p) => p.id);
  const [variants, images] = await Promise.all([
    variantsCol.find({ productId: { $in: ids } }).sort({ sortOrder: 1 }).toArray(),
    imagesCol.find({ productId: { $in: ids }, sortOrder: 0 }).toArray(),
  ]);

  return all.map((product) => {
    const pv = variants.filter((v) => v.productId === product.id);
    const cheapest = pv.reduce<ProductVariant | undefined>(
      (min, v) => (!min || v.priceMinor < min.priceMinor ? v : min),
      undefined
    );
    return {
      ...product,
      variantCount: pv.length,
      totalStock: pv.reduce((sum, v) => sum + v.stockQty, 0),
      fromPriceMinor: cheapest?.priceMinor ?? 0,
      costPriceMinor: cheapest?.supplier.costPriceMinor ?? 0,
      imageUrl: images.find((img) => img.productId === product.id)?.url,
    };
  });
}

export async function getVariantsByIds(variantIds: string[]): Promise<ProductVariant[]> {
  if (variantIds.length === 0) return [];
  const variants = await variantsCollection();
  return stripIds(await variants.find({ id: { $in: variantIds } }).toArray());
}

export async function slugExists(slug: string, exceptProductId?: string): Promise<boolean> {
  const products = await productsCollection();
  const found = await products.findOne({
    slug,
    ...(exceptProductId ? { id: { $ne: exceptProductId } } : {}),
  });
  return found !== null;
}

export async function skuExists(sku: string, exceptVariantIds: string[] = []): Promise<boolean> {
  const variants = await variantsCollection();
  const found = await variants.findOne({
    sku,
    ...(exceptVariantIds.length ? { id: { $nin: exceptVariantIds } } : {}),
  });
  return found !== null;
}

export interface ProductWriteInput {
  title: string;
  slug: string;
  description: string;
  isActive: boolean;
  gstRatePercent: number;
  hsnCode?: string;
  imageUrls: string[];
  videoUrls: string[];
  variants: Array<{
    id?: string;
    name: string;
    sku: string;
    priceMinor: number;
    compareAtPriceMinor?: number;
    stockQty: number;
    allowBackorder: boolean;
    weightGrams: number;
    isActive: boolean;
    supplier: {
      name: string;
      sku: string;
      url?: string;
      costPriceMinor: number;
      leadTimeDays: number;
    };
  }>;
  specifications: Array<{
    id?: string;
    heading: string;
    rows: Array<{ id?: string; label: string; value: string }>;
  }>;
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
}

async function writeChildren(productId: string, input: ProductWriteInput): Promise<void> {
  const [variantsCol, imagesCol, videosCol, specsCol, rowsCol] = await Promise.all([
    variantsCollection(),
    productImagesCollection(),
    productVideosCollection(),
    specificationsCollection(),
    specificationRowsCollection(),
  ]);

  // Variants are reconciled rather than wiped: deleting and re-inserting would
  // orphan the variantId that historical order items point at.
  const keptVariantIds = input.variants.filter((v) => v.id).map((v) => v.id as string);
  await variantsCol.deleteMany({ productId, id: { $nin: keptVariantIds } });

  // Read the prices before they are overwritten. Without this record, a report
  // comparing this month against last month silently compares two different
  // prices, and "did raising it cost me sales?" has no answer at all.
  const previousPrices = new Map(
    (
      await variantsCol
        .find({ productId }, { projection: { id: 1, priceMinor: 1 } })
        .toArray()
    ).map((variant) => [variant.id as string, variant.priceMinor as number])
  );
  const priceChanges: PriceChange[] = [];

  for (const [index, variant] of input.variants.entries()) {
    const id = variant.id ?? newId('v');
    const previous = previousPrices.get(id);
    if (previous !== undefined && previous !== variant.priceMinor) {
      priceChanges.push({
        productId,
        variantId: id,
        sku: variant.sku,
        fromMinor: previous,
        toMinor: variant.priceMinor,
        at: new Date(),
      });
    }
    await variantsCol.updateOne(
      { id },
      {
        $set: {
          id,
          productId,
          name: variant.name,
          sku: variant.sku,
          priceMinor: variant.priceMinor,
          compareAtPriceMinor: variant.compareAtPriceMinor,
          stockQty: variant.stockQty,
          allowBackorder: variant.allowBackorder,
          weightGrams: variant.weightGrams,
          supplier: variant.supplier,
          sortOrder: index,
          isActive: variant.isActive,
        },
      },
      { upsert: true }
    );
  }

  if (priceChanges.length > 0) {
    await (await priceHistoryCollection()).insertMany(priceChanges);
  }

  await imagesCol.deleteMany({ productId });
  if (input.imageUrls.length > 0) {
    await imagesCol.insertMany(
      input.imageUrls.map((url, index) => ({
        id: newId('img'),
        productId,
        url,
        alt: input.title,
        sortOrder: index,
      }))
    );
  }

  // Videos carry no references of their own, so replace-in-place is safe.
  await videosCol.deleteMany({ productId });
  if (input.videoUrls.length > 0) {
    await videosCol.insertMany(
      input.videoUrls.map((url, index) => ({
        id: newId('vid'),
        productId,
        url,
        title: input.title,
        sortOrder: index,
      }))
    );
  }

  const existingSpecs = await specsCol.find({ productId }, { projection: { id: 1 } }).toArray();
  await rowsCol.deleteMany({ specificationId: { $in: existingSpecs.map((s) => s.id as string) } });
  await specsCol.deleteMany({ productId });

  if (input.specifications.length > 0) {
    const specDocs = input.specifications.map((spec, index) => ({
      id: spec.id ?? newId('spec'),
      productId,
      heading: spec.heading,
      sortOrder: index,
      rows: spec.rows,
    }));
    await specsCol.insertMany(specDocs.map(({ rows, ...rest }) => (void rows, rest)));
    const rowDocs = specDocs.flatMap((spec) =>
      spec.rows.map((row, index) => ({
        id: row.id ?? newId('row'),
        specificationId: spec.id,
        label: row.label,
        value: row.value,
        sortOrder: index,
      }))
    );
    if (rowDocs.length > 0) await rowsCol.insertMany(rowDocs);
  }
}

export async function createProduct(input: ProductWriteInput): Promise<Product> {
  const products = await productsCollection();
  const now = new Date().toISOString();
  const product: Product = {
    id: newId('p'),
    title: input.title,
    slug: input.slug,
    description: input.description,
    currency: 'INR',
    isActive: input.isActive,
    gstRatePercent: input.gstRatePercent,
    hsnCode: input.hsnCode,
    createdAt: now,
    updatedAt: now,
  };

  await products.insertOne({ ...product });
  await writeChildren(product.id, input);
  revalidateCatalogue();
  return product;
}

export async function updateProduct(id: string, input: ProductWriteInput): Promise<Product | null> {
  const products = await productsCollection();
  const now = new Date().toISOString();

  const result = await products.findOneAndUpdate(
    { id },
    {
      $set: {
        title: input.title,
        slug: input.slug,
        description: input.description,
        isActive: input.isActive,
        gstRatePercent: input.gstRatePercent,
        hsnCode: input.hsnCode,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' }
  );
  if (!result) return null;

  await writeChildren(id, input);
  revalidateCatalogue();
  return stripIds([result])[0];
}

export async function setProductActive(id: string, isActive: boolean): Promise<Product | null> {
  const products = await productsCollection();
  const result = await products.findOneAndUpdate(
    { id },
    { $set: { isActive, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );
  if (!result) return null;
  revalidateCatalogue();
  return stripIds([result])[0];
}

/**
 * Products are archived, never hard-deleted: order items reference them for
 * invoices, returns, and accounting long after the product leaves the catalogue.
 */
/**
 * Retires a product without deleting it.
 *
 * Deliberately does not touch the variants. The storefront filters on the
 * product's own `isActive` at every entry point, so switching them off changed
 * nothing a shopper could see — but it did overwrite which variants the admin
 * had intentionally disabled, and unarchiving never put them back. A product
 * restored from the archive came back live with nothing sellable on it.
 */
export async function archiveProduct(id: string): Promise<Product | null> {
  return setArchived(id, true);
}

/**
 * Brings a product back, as hidden rather than live.
 *
 * Publishing is left as its own deliberate step: restoring something retired
 * months ago straight onto the storefront, at whatever price it carried then,
 * is not a decision this button should make for you.
 */
export async function unarchiveProduct(id: string): Promise<Product | null> {
  return setArchived(id, false);
}

async function setArchived(id: string, archived: boolean): Promise<Product | null> {
  const products = await productsCollection();
  const now = new Date().toISOString();

  const result = await products.findOneAndUpdate(
    { id },
    archived
      ? { $set: { archivedAt: now, isActive: false, updatedAt: now } }
      : { $set: { isActive: false, updatedAt: now }, $unset: { archivedAt: '' } },
    { returnDocument: 'after' }
  );
  if (!result) return null;

  revalidateCatalogue();
  return stripIds([result])[0];
}

/** How many historical order items still point at this product. */
export async function countProductOrderItems(id: string): Promise<number> {
  const orderItems = await orderItemsCollection();
  return orderItems.countDocuments({ productId: id });
}

export type DeleteProductResult =
  | { status: 'deleted'; product: Product }
  | { status: 'not-found' }
  | { status: 'referenced'; product: Product; orderItemCount: number };

/**
 * Hard delete, for catalogue mistakes only — a product typed in wrong and never
 * sold. If any order item references it the delete is refused and the caller is
 * expected to archive instead: invoices, returns and margin reporting read those
 * rows long after the product leaves the catalogue.
 */
export async function deleteProduct(id: string): Promise<DeleteProductResult> {
  const products = await productsCollection();
  const product = stripIds(await products.find({ id }).limit(1).toArray())[0];
  if (!product) return { status: 'not-found' };

  const orderItemCount = await countProductOrderItems(id);
  if (orderItemCount > 0) return { status: 'referenced', product, orderItemCount };

  const [variantsCol, imagesCol, videosCol, specsCol, rowsCol] = await Promise.all([
    variantsCollection(),
    productImagesCollection(),
    productVideosCollection(),
    specificationsCollection(),
    specificationRowsCollection(),
  ]);

  const specIds = (await specsCol.find({ productId: id }, { projection: { id: 1 } }).toArray()).map(
    (spec) => spec.id as string
  );

  // Children first: a failure halfway leaves orphans rather than a product that
  // renders with missing variants.
  await rowsCol.deleteMany({ specificationId: { $in: specIds } });
  await specsCol.deleteMany({ productId: id });
  await imagesCol.deleteMany({ productId: id });
  await videosCol.deleteMany({ productId: id });
  await variantsCol.deleteMany({ productId: id });
  await products.deleteOne({ id });

  revalidateCatalogue();
  return { status: 'deleted', product };
}
