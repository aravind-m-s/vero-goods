'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Receipt,
  Store,
  LogOut,
  ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      href: '/admin',
      active: pathname === '/admin',
    },
    {
      label: 'Products',
      icon: ShoppingBag,
      href: '/admin/products',
      active: pathname.startsWith('/admin/products'),
    },
    {
      label: 'Orders',
      icon: Receipt,
      href: '/admin/orders',
      active: pathname.startsWith('/admin/orders'),
    },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/otp?role=admin', { method: 'DELETE' });
      router.push('/admin/login');
      router.refresh();
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-900 text-zinc-400 flex flex-col h-screen fixed left-0 top-0 z-30 shrink-0">
      {/* Brand Heading */}
      <div className="h-16 flex items-center px-6 border-b border-zinc-900 gap-2 shrink-0">
        <div className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-sm font-extrabold tracking-widest text-white">
          VERO<span className="text-zinc-400 font-light">ADMIN</span>
        </span>
      </div>

      {/* Main Menu Links */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 rounded-md text-xs font-semibold tracking-wide transition-all duration-150',
                item.active
                  ? 'bg-zinc-900 text-white font-bold border border-zinc-800'
                  : 'hover:bg-zinc-900/60 hover:text-zinc-200'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn('h-4 w-4', item.active ? 'text-white' : 'text-zinc-500')} />
                <span>{item.label}</span>
              </div>
              {item.active && <ChevronRight className="h-3 w-3 text-zinc-500" />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-zinc-900 bg-zinc-950/80 space-y-1.5 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
        >
          <Store className="h-4 w-4 text-zinc-500" />
          <span>View Storefront</span>
        </Link>
        
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-xs font-semibold text-rose-500 hover:bg-rose-950/20 w-full text-left transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
