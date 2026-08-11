'use client';

import React from 'react';
import { AdminSidebar } from '@/features/admin/components/AdminSidebar';
import { ToastProvider } from '@/shared/ui/toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface-sunken font-sans text-ink">
        {/* Admin Sidebar Navigation */}
        <AdminSidebar />

        {/* Main Content Area */}
        <div className="pl-64 flex flex-col min-h-screen">
          <main className="flex-1 p-8 sm:p-10 w-full max-w-7xl mx-auto">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
