'use client';

import React from 'react';
import { AdminSidebar } from '../../../components/admin/AdminSidebar';
import { ToastProvider } from '../../../components/ui/toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans text-zinc-900 dark:text-zinc-50">
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
