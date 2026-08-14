import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionCustomer } from '@/features/auth/server/auth';
import { AuthView } from '@/features/auth/components/AuthView';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only same-site paths are honoured — an open redirect here would turn the
  // login page into a phishing hop.
  const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/account';

  const customer = await getSessionCustomer();
  if (customer) redirect(destination);

  return <AuthView next={destination} />;
}
