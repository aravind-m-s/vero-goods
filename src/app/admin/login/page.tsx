'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { useToast } from '@/shared/ui/toast';
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
    <div className="flex min-h-screen items-center justify-center bg-[#0b0b0d] px-4">
      <div className="w-full max-w-sm">
        <Card className="border-white/10 bg-[#141417] text-white shadow-overlay">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <ShieldCheck className="h-6 w-6 text-accent" />
            </div>
            <CardTitle className="text-base text-white">Admin Portal Access</CardTitle>
            <CardDescription className="text-xs text-white/50">
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
                    className="border-white/15 bg-black/40 pl-10 text-white placeholder:text-white/30"
                    required
                  />
                  <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-white/40" />
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

            <p className="mt-6 text-center text-3xs text-white/40">
              Set by <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-white/70">ADMIN_PASSWORD_HASH</code>.
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
