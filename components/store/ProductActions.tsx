'use client';

import React, { useState } from 'react';
import { ShoppingCart, Bolt } from 'lucide-react';
import { Product } from '../../lib/db/types';
import { useCart } from './CartContext';
import { useToast } from '../ui/toast';
import { Button } from '../ui/button';
import { useRouter } from 'next/navigation';

interface ProductActionsProps {
  product: Product;
  imageUrls: string[];
}

export function ProductActions({ product, imageUrls }: ProductActionsProps) {
  const [selectedImage, setSelectedImage] = useState(imageUrls[0] || 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=600&auto=format&fit=crop&q=80');
  const [quantity, setQuantity] = useState(1);
  const { addToCart } = useCart();
  const { success } = useToast();
  const router = useRouter();

  const handleAddToCart = () => {
    addToCart(product, quantity);
    success(`${quantity} x ${product.title} added to cart`);
  };

  const handleBuyNow = () => {
    addToCart(product, quantity);
    router.push('/checkout');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
      {/* Product Gallery */}
      <div className="space-y-4">
        {/* Main Image */}
        <div className="aspect-square bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden relative shadow-sm">
          <img
            src={selectedImage}
            alt={product.title}
            className="w-full h-full object-cover transition-all duration-300"
          />
        </div>

        {/* Thumbnail Selector */}
        {imageUrls.length > 1 && (
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {imageUrls.map((url, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedImage(url)}
                className={`h-16 w-16 rounded border shrink-0 overflow-hidden transition-all duration-200 cursor-pointer ${
                  selectedImage === url
                    ? 'border-zinc-950 ring-1 ring-zinc-950 dark:border-zinc-50 dark:ring-zinc-50'
                    : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-850'
                }`}
              >
                <img src={url} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Details & Purchase Controls */}
      <div className="flex flex-col justify-between h-full py-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            {product.title}
          </h1>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(product.price)}
            </span>
            {product.compareAtPrice && product.compareAtPrice > product.price && (
              <>
                <span className="text-base text-zinc-400 line-through">
                  {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(product.compareAtPrice)}
                </span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)}% OFF
                </span>
              </>
            )}
          </div>

          <div className="mt-6 border-t border-zinc-100 dark:border-zinc-900 pt-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Description
            </h3>
            <p className="mt-2 text-sm text-zinc-655 dark:text-zinc-400 leading-relaxed">
              {product.description}
            </p>
          </div>
        </div>

        {/* Quantity and CTA Buttons */}
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Quantity:
            </span>
            <div className="flex items-center border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-950">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                -
              </button>
              <span className="px-3 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="px-3 py-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              onClick={handleAddToCart}
              variant="outline"
              className="flex-1 gap-2 cursor-pointer"
            >
              <ShoppingCart className="h-4 w-4" /> Add to Cart
            </Button>
            <Button
              onClick={handleBuyNow}
              className="flex-1 gap-2 cursor-pointer"
            >
              <Bolt className="h-4 w-4" /> Buy Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
