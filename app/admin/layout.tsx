'use client';

import React from 'react';
import { ToastProvider } from '../../components/ui/toast';

// This layout wraps the login page (outside the dashboard group)
// The dashboard group has its own layout with the sidebar
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
}
