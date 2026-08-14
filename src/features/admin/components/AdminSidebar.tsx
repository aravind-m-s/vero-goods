'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HandHeart, LayoutDashboard, LogOut, Receipt, ShoppingBag, Store } from 'lucide-react';
import { ThemeToggle } from '@/shared/ui/theme-toggle';
import { cn } from '@/shared/lib/utils';

/**
 * The admin shell has its own `--sidebar-*` tokens rather than the storefront's
 * surfaces, so it stays visually distinct from the shop while still following
 * the colour scheme the user picked.
 */
const MENU = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin', exact: true },
  { label: 'Products', icon: ShoppingBag, href: '/admin/products', exact: false },
  { label: 'Orders', icon: Receipt, href: '/admin/orders', exact: false },
  { label: 'Sourcing requests', icon: HandHeart, href: '/admin/requests', exact: false },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/otp?role=admin', { method: 'DELETE' });
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 shrink-0 flex-col border-r border-sidebar-line bg-sidebar text-sidebar-ink">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-line px-6">
        <span className="flex h-6 w-6 items-center justify-center rounded-control bg-accent text-xs font-black text-on-accent">
          V
        </span>
        <span className="text-sm font-black tracking-widest text-sidebar-ink-strong">
          VERO<span className="font-light text-sidebar-ink-faint">ADMIN</span>
        </span>
      </div>

      <nav aria-label="Admin" className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {MENU.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-control px-3 py-2.5 text-xs font-semibold tracking-wide transition-colors duration-150',
                active
                  ? 'bg-sidebar-active text-sidebar-ink-strong'
                  : 'hover:bg-sidebar-hover hover:text-sidebar-ink-strong'
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
              )}
              <Icon className={cn('h-4 w-4', active ? 'text-accent' : 'text-sidebar-ink-faint')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-sidebar-line p-3">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="text-xs font-semibold tracking-wide">Theme</span>
          <ThemeToggle variant="segmented" />
        </div>

        <Link
          href="/"
          className="flex items-center gap-3 rounded-control px-3 py-2 text-xs font-semibold transition-colors hover:bg-sidebar-hover hover:text-sidebar-ink-strong"
        >
          <Store className="h-4 w-4 text-sidebar-ink-faint" />
          <span>View storefront</span>
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-left text-xs font-semibold text-danger transition-colors hover:bg-danger/10"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
