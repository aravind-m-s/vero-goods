'use client';

import React from 'react';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { Product } from '../../lib/db/types';
import { formatCurrency } from '../../lib/utils';
import { useCart } from './CartContext';
import { useToast } from '../ui/toast';
import { Button } from '../ui/button';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const { success } = useToast();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to product page when clicking add to cart
    addToCart(product);
    success(`${product.title} added to cart`);
  };

  // Select photo based on product ID
  const imageUrl = product.id === 'p-1' ? 'https://images.unsplash.com/photo-1615840287214-7fe58a8e668f?w=600&auto=format&fit=crop&q=80' : 
                   product.id === 'p-2' ? 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80' : 
                   product.id === 'p-3' ? 'https://images.unsplash.com/photo-1608156639585-b3a032ef9689?w=600&auto=format&fit=crop&q=80' : 
                   product.id === 'p-4' ? 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=600&auto=format&fit=crop&q=80' : 
                   product.id === 'p-5' ? 'https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?w=600&auto=format&fit=crop&q=80' : 
                   'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=600&auto=format&fit=crop&q=80';

  const discount = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : 0;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 hover:shadow-md transition-all duration-300"
    >
      {/* Product Image */}
      <div className="aspect-square bg-zinc-50 dark:bg-zinc-900 overflow-hidden relative border-b border-zinc-100 dark:border-zinc-900">
        <img
          src={imageUrl}
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Discount Badge */}
        {discount > 0 && (
          <span className="absolute top-2.5 left-2.5 bg-rose-600 text-[10px] font-bold text-white px-2 py-0.5 rounded-full select-none shadow-sm">
            -{discount}% OFF
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col p-4 justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1 group-hover:text-zinc-900 group-hover:underline dark:group-hover:text-white decoration-zinc-400">
            {product.title}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>

        {/* Pricing & Cart Action */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-zinc-950 dark:text-zinc-50">
              {formatCurrency(product.price)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <span className="text-xs text-zinc-400 line-through">
                {formatCurrency(product.compareAtPrice)}
              </span>
            )}
          </div>

          <Button
            size="sm"
            onClick={handleAddToCart}
            className="h-8 w-8 p-0 rounded-full cursor-pointer opacity-90 group-hover:opacity-100 shadow-sm"
            title="Add to Cart"
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Link>
  );
}
