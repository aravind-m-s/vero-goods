'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, LayoutDashboard, User as UserIcon, LogOut } from 'lucide-react';
import { useCart } from './CartContext';
import { CartDrawer } from './CartDrawer';
import { Button } from '../ui/button';

export function Header() {
  const { cartCount } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customer, setCustomer] = useState<{ name: string; email: string } | null>(null);

  // Fetch session user on mount/focus
  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/otp');
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setCustomer({ name: data.user.name, email: data.user.email });
        } else {
          setCustomer(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSession();
    // Refresh session when page becomes visible (e.g., after login redirect)
    window.addEventListener('focus', fetchSession);
    return () => window.removeEventListener('focus', fetchSession);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/otp', { method: 'DELETE' });
      setCustomer(null);
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-100 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                VERO<span className="font-light text-zinc-500">GOODS</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/"
                className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Browse Catalog
              </Link>
            </nav>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-4">
            {/* Admin Dashboard link */}
            <Link href="/admin">
              <Button size="sm" variant="ghost" className="text-xs font-semibold gap-1">
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Admin Panel</span>
              </Button>
            </Link>

            {/* Customer session display */}
            {customer ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden lg:inline max-w-[120px] truncate">
                  Hi, {customer.name}
                </span>
                <button
                  onClick={handleLogout}
                  title="Sign Out"
                  className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-rose-500 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {/* Shopping Cart button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
              aria-label="Open cart"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-zinc-50 animate-scale-in dark:bg-zinc-50 dark:text-zinc-900">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Cart Sidebar drawer */}
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
