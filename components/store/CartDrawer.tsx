'use client';

import React, { useEffect } from 'react';
import { X, ShoppingBag, Plus, Minus, Trash2 } from 'lucide-react';
import { useCart } from './CartContext';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../ui/button';
import Link from 'next/link';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, updateQuantity, removeFromCart, cartSubtotal, cartCount } = useCart();

  // Prevent background scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/35 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full z-10 animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Shopping Cart ({cartCount})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="h-12 w-12 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center mb-3">
                <ShoppingBag className="h-6 w-6 text-zinc-400" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Your cart is empty</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[200px]">
                Add some quality items to get started with your project.
              </p>
              <Button size="sm" variant="outline" className="mt-4" onClick={onClose}>
                Continue Shopping
              </Button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.product.id}
                className="flex gap-4 py-3 border-b border-zinc-100 dark:border-zinc-800/40 last:border-0"
              >
                {/* Product Thumbnail */}
                <div className="h-16 w-16 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-850 overflow-hidden shrink-0 flex items-center justify-center">
                  <img
                    src={item.product.id === 'p-1' ? 'https://images.unsplash.com/photo-1615840287214-7fe58a8e668f?w=100&auto=format&fit=crop&q=80' : 
                         item.product.id === 'p-2' ? 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=100&auto=format&fit=crop&q=80' : 
                         item.product.id === 'p-3' ? 'https://images.unsplash.com/photo-1608156639585-b3a032ef9689?w=100&auto=format&fit=crop&q=80' : 
                         item.product.id === 'p-4' ? 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=100&auto=format&fit=crop&q=80' : 
                         item.product.id === 'p-5' ? 'https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?w=100&auto=format&fit=crop&q=80' : 
                         'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=100&auto=format&fit=crop&q=80'}
                    alt={item.product.title}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-1">
                      {item.product.title}
                    </h4>
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {formatCurrency(item.product.price)}
                    </p>
                  </div>

                  {/* Quantity Actions */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-zinc-200 dark:border-zinc-800 rounded bg-zinc-50/50 dark:bg-zinc-900">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-zinc-400 hover:text-rose-500 transition-colors p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Summary */}
        {items.length > 0 && (
          <div className="border-t border-zinc-100 dark:border-zinc-800/80 p-5 bg-zinc-50/30 dark:bg-zinc-950/20 space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">Subtotal</span>
              <span className="text-zinc-900 dark:text-zinc-50 font-bold text-lg">
                {formatCurrency(cartSubtotal)}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-normal">
              Shipping & taxes calculated at checkout. Deliveries restricted to India only.
            </p>
            <div className="grid grid-cols-1 gap-2 pt-2">
              <Link href="/checkout" className="w-full" onClick={onClose}>
                <Button className="w-full">
                  Proceed to Checkout
                </Button>
              </Link>
              <Button variant="outline" className="w-full" onClick={onClose}>
                Continue Shopping
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
