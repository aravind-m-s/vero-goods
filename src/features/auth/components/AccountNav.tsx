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
 * Two layouts, one source of links. On phones it is a horizontally scrollable
 * rail of labelled pills — icon *and* word, because an icon-only tab bar makes
 * people guess what "Addresses" versus "Orders" means. On large screens the
 * same links become the sidebar. Sign out is not in the rail: a destructive
 * action does not belong one mis-swipe away from a navigation tap.
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
      {/* Mobile: edge-to-edge scroll rail, sticky under the site header. */}
      <nav
        aria-label="Account"
        className="sticky top-16 z-20 -mx-4 border-b border-line bg-surface-sunken/95 px-4 py-2 backdrop-blur-sm lg:hidden"
      >
        <ul className="scrollbar-none flex snap-x gap-2 overflow-x-auto pb-0.5">
          {LINKS.map((link) => {
            const active = isCurrent(link);
            return (
              <li key={link.href} className="snap-start">
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors',
                    active
                      ? 'border-ink bg-surface-inverse text-ink-inverse'
                      : 'border-line bg-surface-raised text-ink-muted'
                  )}
                >
                  <link.icon className="h-3.5 w-3.5 shrink-0" />
                  {link.label}
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
