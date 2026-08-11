import React from 'react';
import { getDb } from '../../lib/db/db';
import { ProductCard } from '../../components/store/ProductCard';
import { Sparkles, Printer, ShieldCheck } from 'lucide-react';

export const revalidate = 0; // Disable caching to fetch live updates

export default async function StoreHomePage() {
  const db = await getDb();
  // Filter active products
  const activeProducts = db.products.filter((p) => p.isActive);

  return (
    <div className="flex flex-col flex-1 pb-16">
      {/* Hero Section */}
      <section className="bg-white border-b border-zinc-100 dark:bg-zinc-950 dark:border-zinc-900 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8 space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            <Sparkles className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
            Curated 3D Hardware & Filaments
          </div>
          
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Clean Hardware. Premium Prints.
          </h1>
          
          <p className="mx-auto max-w-xl text-base text-zinc-500 dark:text-zinc-400 leading-relaxed sm:text-lg">
            High-performance 3D printers, precision filaments, and accessories curated for professional engineering and high-fidelity making in India.
          </p>

          <div className="flex items-center justify-center gap-8 pt-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <Printer className="h-4 w-4" /> Professional Grade
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-4 w-4" /> Secure COD & Razorpay
            </span>
          </div>
        </div>
      </section>

      {/* Catalog Listing */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 flex-1 w-full">
        <div className="flex flex-col gap-2 mb-8">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-2xl">
            Product Catalog
          </h2>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Browse through our active collection. All orders processed with server-side validation.
          </p>
        </div>

        {activeProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">No products found</h3>
            <p className="text-xs text-zinc-400 mt-1">Check back later or view our admin interface to add new ones.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
            {activeProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
