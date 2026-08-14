'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, LogOut, MapPin, Package, UserRound } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

const LINKS = [
  { href: '/account', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/account/profile', label: 'Profile', icon: UserRound },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/orders', label: 'Orders', icon: Package },
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch('/api/auth/otp', { method: 'DELETE' });
    // refresh() re-runs the server components that read the session cookie, so
    // the header and this nav both reflect the sign-out immediately.
    router.push('/');
    router.refresh();
  };

  return (
    <nav aria-label="Account" className="rounded-card border border-line bg-surface-raised p-2">
      <ul className="space-y-0.5">
        {LINKS.map((link) => {
          const isActive = link.exact ? pathname === link.href : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-surface-sunken font-bold text-ink'
                    : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
                )}
              >
                <link.icon className="h-4 w-4 shrink-0" />
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-1 border-t border-line pt-1">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-control px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-danger"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </nav>
  );
}
