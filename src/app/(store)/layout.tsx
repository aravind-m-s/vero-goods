import React from 'react';
import { CartProvider } from '@/features/cart/components/CartContext';
import { Footer } from '@/features/storefront/components/Footer';
import { Header } from '@/features/storefront/components/Header';
import { ToastProvider } from '@/shared/ui/toast';

/**
 * A server component that mounts the client providers, so the storefront shell
 * itself is not shipped to the browser — only the interactive parts are.
 */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <CartProvider>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div className="flex min-h-screen flex-col bg-surface-sunken font-sans">
          <Header />
          <main id="main" className="flex flex-1 flex-col">
            {children}
          </main>
          <Footer />
        </div>
      </CartProvider>
    </ToastProvider>
  );
}
