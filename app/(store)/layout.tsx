'use client';

import React from 'react';
import { CartProvider } from '../../components/store/CartContext';
import { ToastProvider } from '../../components/ui/toast';
import { Header } from '../../components/store/Header';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <CartProvider>
        <div className="flex flex-col min-h-screen bg-zinc-50 dark:bg-black font-sans">
          <Header />
          <main className="flex-1 flex flex-col">{children}</main>
          
          {/* Footer */}
          <footer className="border-t border-zinc-100 bg-white py-8 dark:border-zinc-900 dark:bg-zinc-950 mt-auto">
            <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                &copy; {new Date().getFullYear()} Vero Goods. Built with Next.js & Tailwind CSS. India delivery only.
              </p>
            </div>
          </footer>
        </div>
      </CartProvider>
    </ToastProvider>
  );
}
