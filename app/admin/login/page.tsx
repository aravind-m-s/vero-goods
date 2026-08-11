'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { useToast } from '../../../components/ui/toast';
import { ShieldCheck, Lock, AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
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
        success('Admin logged in successfully!');
        router.push('/admin');
        router.refresh();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Invalid password credentials');
        showErrorToast('Admin login failed');
      }
    } catch (e) {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-300">
      <div className="w-full max-w-sm">
        <Card className="border-zinc-800 bg-zinc-900 text-zinc-100 shadow-2xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-white">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </div>
            <CardTitle className="text-white">Admin Portal Access</CardTitle>
            <CardDescription className="text-zinc-500 text-xs">
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
                    className="pl-10 bg-zinc-950 border-zinc-850 focus-visible:ring-zinc-700 text-white"
                    required
                  />
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-650" />
                </div>
              </div>

              {errorMsg && (
                <div className="text-xs text-rose-400 font-medium flex items-center gap-1.5 bg-rose-950/20 p-2.5 rounded border border-rose-900/30">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-white hover:bg-zinc-200 text-zinc-950 font-bold"
                isLoading={isLoading}
              >
                Enter Dashboard
              </Button>
            </form>
            
            <p className="text-[10px] text-zinc-500 text-center mt-6">
              Default local password: <code className="bg-zinc-950 px-1 py-0.5 rounded text-zinc-300 font-mono">admin123</code>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
