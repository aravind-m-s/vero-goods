import type { MetadataRoute } from 'next';
import { appUrl, isIndexable } from '@/shared/lib/config';
import { getSitemapProducts } from '@/features/catalog/server/products.repo';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only production publishes a sitemap. The dev server would otherwise hand a
  // crawler a full list of its own product URLs to index.
  if (!isIndexable()) return [];

  const base = appUrl();
  const products = await getSitemapProducts();

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
    ...products.map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified: new Date(product.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      // Every gallery image, not just the primary one. Without these entries a
      // product's other photographs are only discoverable by rendering the page,
      // which is why image search knew about one picture per SKU.
      images: product.imageUrls,
    })),
  ];
}
