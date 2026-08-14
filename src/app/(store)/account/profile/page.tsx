import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionCustomer } from '@/features/auth/server/auth';
import { publicUser } from '@/features/auth/server/public-user';
import { ProfileView } from '@/features/auth/components/ProfileView';

export const metadata: Metadata = {
  title: 'Profile',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const customer = await getSessionCustomer();
  if (!customer) redirect('/login?next=/account/profile');

  return <ProfileView initial={publicUser(customer)} />;
}
