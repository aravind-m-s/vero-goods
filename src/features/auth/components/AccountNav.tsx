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

/**
 * Account navigation.
 *
 * Two layouts, one source of links. On phones all four links share one
 * full-width row — no horizontal scrolling, because a scroll rail hides
 * destinations behind a gesture nobody knows is there. Labels stay next to the
 * icons: an icon-only bar makes people guess what "Addresses" versus "Orders"
 * means. On large screens the same links become the sidebar. Sign out is not in
 * the bar: a destructive action does not belong beside a navigation tap.
 */
export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();

  const isCurrent = (link: (typeof LINKS)[number]) =>
    link.exact ? pathname === link.href : pathname.startsWith(link.href);

  const handleSignOut = async () => {
    await fetch('/api/auth/otp', { method: 'DELETE' });
    // refresh() re-runs the server components that read the session cookie, so
    // the header and this nav both reflect the sign-out immediately.
    router.push('/');
    router.refresh();
  };

  return (
    <>
      {/* Mobile: one full-width row, every destination visible at once. */}
      <nav
        aria-label="Account"
        className="sticky top-16 z-20 -mx-4 border-b border-line bg-surface-sunken/95 px-4 py-2 backdrop-blur-sm lg:hidden"
      >
        {/* grid-cols-4 with min-w-0 cells: the row divides the screen instead of
            overflowing it, so nothing sits off-screen on a 320px phone. */}
        <ul className="grid grid-cols-4 gap-1.5">
          {LINKS.map((link) => {
            const active = isCurrent(link);
            return (
              <li key={link.href} className="min-w-0">
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-full flex-col items-center justify-center gap-1 rounded-control border px-1 py-1.5 text-3xs font-semibold transition-colors',
                    active
                      ? 'border-ink bg-surface-inverse text-ink-inverse'
                      : 'border-line bg-surface-raised text-ink-muted'
                  )}
                >
                  <link.icon className="h-4 w-4 shrink-0" />
                  <span className="w-full truncate text-center">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: sidebar. */}
      <nav
        aria-label="Account"
        className="hidden rounded-card border border-line bg-surface-raised p-2 lg:block"
      >
        <ul className="space-y-0.5">
          {LINKS.map((link) => {
            const active = isCurrent(link);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-control px-3 py-2.5 text-sm font-medium transition-colors',
                    active
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
          <SignOutButton onSignOut={handleSignOut} />
        </div>
      </nav>
    </>
  );
}

/** Full-width sign-out for the bottom of the account page on mobile. */
export function AccountSignOut() {
  const router = useRouter();

  const handleSignOut = async () => {
    await fetch('/api/auth/otp', { method: 'DELETE' });
    router.push('/');
    router.refresh();
  };

  return (
    <div className="rounded-card border border-line bg-surface-raised p-2 lg:hidden">
      <SignOutButton onSignOut={handleSignOut} />
    </div>
  );
}

function SignOutButton({ onSignOut }: { onSignOut: () => void }) {
  return (
    <button
      type="button"
      onClick={onSignOut}
      className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-control px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-danger lg:justify-start"
    >
      <LogOut className="h-4 w-4 shrink-0" />
      Sign out
    </button>
  );
}
