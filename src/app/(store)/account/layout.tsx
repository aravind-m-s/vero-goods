import React from 'react';
import { redirect } from 'next/navigation';
import { getSessionCustomer } from '@/features/auth/server/auth';
import { AccountNav, AccountSignOut } from '@/features/auth/components/AccountNav';

export const dynamic = 'force-dynamic';

/**
 * Every page under /account is behind the session check here, so no individual
 * page can forget it. The API routes re-check on their own — this is the
 * navigation guard, not the security boundary.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const customer = await getSessionCustomer();
  if (!customer) redirect('/login?next=/account');

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-4 sm:mb-6">
        <h1 className="text-xl font-black tracking-tight text-ink sm:text-2xl">My account</h1>
        <p className="mt-1 truncate text-xs text-ink-subtle">
          Signed in as{' '}
          <span className="font-semibold text-ink-muted">
            {customer.email ?? (customer.phone ? `+${customer.phone}` : customer.name)}
          </span>
        </p>
      </header>

      {/* One column on phones with the nav rail on top; sidebar from lg up. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-6">
        <aside className="lg:col-span-3">
          <AccountNav />
        </aside>
        <section className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-9">{children}</section>
      </div>

      <div className="mt-6 lg:hidden">
        <AccountSignOut />
      </div>
    </div>
  );
}
