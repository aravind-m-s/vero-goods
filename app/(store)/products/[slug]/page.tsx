import React from 'react';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db/db';
import { ProductActions } from '@/components/store/ProductActions';
import { Metadata } from 'next';

export const revalidate = 0;

export async function generateMetadata(
  props: PageProps<"/products/[slug]">
): Promise<Metadata> {
  const { slug } = await props.params;
  const db = await getDb();
  const product = db.products.find((p) => p.slug === slug && p.isActive);

  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }

  return {
    title: `${product.title} | Vero Goods`,
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.title,
      description: product.description.slice(0, 160),
      type: 'website',
    },
  };
}

export default async function ProductDetailsPage(
  props: PageProps<"/products/[slug]">
) {
  const { slug } = await props.params;
  const db = await getDb();

  // Find product
  const product = db.products.find((p) => p.slug === slug);
  if (!product || !product.isActive) {
    notFound();
  }

  // Get images for the product
  const images = db.productImages
    .filter((img) => img.productId === product.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((img) => img.url);

  // Fallback to a single default image if none specified
  const imageUrls = images.length > 0 ? images : ['https://images.unsplash.com/photo-1573164713988-8665fc963095?w=600&auto=format&fit=crop&q=80'];

  // Load Specifications and rows
  const specs = db.productSpecifications
    .filter((s) => s.productId === product.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => {
      const rows = db.productSpecificationRows
        .filter((r) => r.specificationId === s.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      return {
        ...s,
        rows,
      };
    });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 w-full">
      {/* Product Information Grid */}
      <ProductActions product={product} imageUrls={imageUrls} />

      {/* Specifications Sections */}
      {specs.length > 0 && (
        <div className="mt-16 max-w-3xl border-t border-zinc-200 dark:border-zinc-800 pt-10">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mb-6">
            Technical Specifications
          </h2>
          
          <div className="space-y-10">
            {specs.map((spec) => (
              <div key={spec.id} className="space-y-4">
                {/* Heading above the table */}
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {spec.heading}
                </h3>
                
                {/* Responsive spec list */}
                <div className="border-t border-zinc-100 dark:border-zinc-800/80">
                  {spec.rows.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-1 sm:grid-cols-3 py-3.5 border-b border-zinc-100 dark:border-zinc-800/40 text-sm gap-1 sm:gap-4 hover:bg-zinc-50/30 dark:hover:bg-zinc-900/10 px-1 transition-colors duration-150"
                    >
                      {/* Label column (1/3 width on desktop) */}
                      <span className="font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
                        {row.label}
                      </span>
                      
                      {/* Value column (2/3 width on desktop) */}
                      <span className="text-zinc-800 dark:text-zinc-200 sm:col-span-2 break-words leading-relaxed">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
