import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionCustomer } from '@/features/auth/server/auth';
import { listAddresses } from '@/features/auth/server/addresses.repo';
import { AddressBook } from '@/features/auth/components/AddressBook';

export const metadata: Metadata = {
  title: 'Addresses',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AddressesPage() {
  const customer = await getSessionCustomer();
  if (!customer) redirect('/login?next=/account/addresses');

  return <AddressBook initial={await listAddresses(customer.id)} />;
}
