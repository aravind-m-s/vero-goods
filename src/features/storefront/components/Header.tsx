'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { LogOut, Menu, ShoppingBag, User, X } from 'lucide-react';
import { CartDrawer } from '@/features/cart/components/CartDrawer';
import { useCart } from '@/features/cart/components/CartContext';
import { Button } from '@/shared/ui/button';
import { ThemeToggle } from '@/shared/ui/theme-toggle';
import { cn } from '@/shared/lib/utils';

const NAV = [
  { href: '/', label: 'Shop all' },
  { href: '/account/orders', label: 'Orders' },
];

export function Header() {
  const { cartCount, isHydrated } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [customer, setCustomer] = useState<{ name: string } | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/otp');
      if (!response.ok) return;
      const data = await response.json();
      setCustomer(data.user ? { name: data.user.name } : null);
    } catch {
      // Treat an unreachable session endpoint as signed out.
    }
  }, []);

  useEffect(() => {
    // The session lives in an httpOnly cookie, so the client can only learn
    // about it by asking the server.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSession();
    window.addEventListener('focus', fetchSession);
    return () => window.removeEventListener('focus', fetchSession);
  }, [fetchSession]);

  const handleLogout = async () => {
    await fetch('/api/auth/otp', { method: 'DELETE' });
    setCustomer(null);
    window.location.reload();
  };

  return (
    <>
      {/* Value-proposition strip. On a storefront reached from an ad, this is
          the first thing that answers "can I trust this shop?". */}
      <div className="bg-band text-band-ink">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-center gap-6 px-4 text-2xs font-medium sm:px-6 lg:px-8">
          <span>Cash on delivery available</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span>Ships across India</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-line bg-surface-raised/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
            className="-ml-2 cursor-pointer rounded-control p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink md:hidden"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-control bg-accent text-xs font-black text-on-accent">
              V
            </span>
            <span className="text-base font-black tracking-tight text-ink">
              VERO<span className="font-light text-ink-subtle">GOODS</span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-control px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />

            {customer ? (
              <div className="flex items-center gap-1">
                <Link
                  href="/account"
                  className="flex max-w-40 items-center gap-1.5 truncate rounded-control px-2 py-1.5 text-xs text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                >
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden truncate lg:inline">{customer.name}</span>
                  <span className="lg:hidden">Account</span>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign in</span>
                </Button>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={`Open cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
              className="relative cursor-pointer rounded-control p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
            >
              <ShoppingBag className="h-5 w-5" />
              {/* Rendered only after hydration so the server and client markup agree. */}
              {isHydrated && cartCount > 0 && (
                <span className="animate-scale-in absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-3xs font-bold text-on-accent">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <nav
          aria-label="Mobile"
          className={cn(
            'overflow-hidden border-t border-line transition-[max-height] duration-200 md:hidden',
            isMenuOpen ? 'max-h-80' : 'max-h-0 border-t-0'
          )}
        >
          <div className="flex flex-col p-2">
            {[...NAV, { href: customer ? '/account' : '/login', label: customer ? 'My account' : 'Sign in' }].map(
              (item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-control px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                >
                  {item.label}
                </Link>
              )
            )}

            {/* Spelled out on mobile: the labelled control is clearer than an
                icon when there is room for it. */}
            <div className="mt-1 flex items-center justify-between border-t border-line px-3 pt-3">
              <span className="text-sm font-medium text-ink-muted">Theme</span>
              <ThemeToggle variant="segmented" />
            </div>
          </div>
        </nav>
      </header>

      <CartDrawer open={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </>
  );
}
