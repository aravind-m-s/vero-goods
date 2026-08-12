'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { useToast } from '@/shared/ui/toast';
import { ThemeToggle } from '@/shared/ui/theme-toggle';
import { ShieldCheck, Lock, AlertCircle } from 'lucide-react';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { success, error: showErrorToast } = useToast();
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/otp?role=admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        success('Signed in');
        // Return to whatever admin page triggered the redirect, but only if it
        // is a local path — never bounce to an attacker-supplied absolute URL.
        const next = searchParams.get('next');
        router.push(next && next.startsWith('/admin') ? next : '/admin');
        router.refresh();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Invalid password credentials');
        showErrorToast('Admin login failed');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-surface-sunken px-4">
      {/* This page sits outside both shells, so it carries its own picker. */}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <Card className="border-line bg-surface-raised text-ink shadow-overlay">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-accent-border bg-accent-soft">
              <ShieldCheck className="h-6 w-6 text-accent" />
            </div>
            <CardTitle className="text-base text-ink">Admin Portal Access</CardTitle>
            <CardDescription className="text-xs text-ink-subtle">
              Vero Goods administrator control center. Please enter password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-password">Portal Password</Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter admin password..."
                    className="pl-10"
                    required
                  />
                  <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-subtle" />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-center gap-1.5 rounded-control border border-danger/30 bg-danger/10 p-2.5 text-xs font-medium text-danger">
                  <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="accent" className="w-full"
                isLoading={isLoading}
              >
                Enter Dashboard
              </Button>
            </form>

            <p className="mt-6 text-center text-3xs text-ink-subtle">
              Set by <code className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-ink-muted">ADMIN_PASSWORD_HASH</code>.
              Five failed attempts locks this IP out for 15 minutes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}
