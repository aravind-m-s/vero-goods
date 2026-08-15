'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, AtSign, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useToast } from '@/shared/ui/toast';
import { GoogleSignInButton } from '@/features/auth/components/GoogleSignInButton';
import { identifyChannel } from '@/features/auth/schemas';
import { cn } from '@/shared/lib/utils';

type Mode = 'login' | 'signup';

const RESEND_SECONDS = 30;

/**
 * Sign in and registration on one screen.
 *
 * There is a single "Email or mobile number" box: the channel is derived from
 * what was typed, so nobody has to pick a tab before they can start. Login is
 * the default because most visitors already have an account, and an existing
 * customer who taps Create account is simply signed in rather than being sent
 * around the loop again.
 *
 * Whether an identifier already has an account is only ever disclosed *after* a
 * code is verified — an unauthenticated caller cannot use this screen to find
 * out who shops here.
 */
export function AuthView({
  next = '/account',
  /** Embedded in a page that already has its own heading, e.g. checkout. */
  compact = false,
}: {
  next?: string;
  compact?: boolean;
}) {
  const { success, error } = useToast();

  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<'identify' | 'code'>('identify');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const channel = identifyChannel(identifier);
  const isSignup = mode === 'signup';

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (step === 'code') codeInputRef.current?.focus();
  }, [step]);

  const finish = () => {
    // A full navigation, not a client push: the header, cart and every server
    // component need to re-read the new session cookie.
    window.location.assign(next);
  };

  const requestCode = async (isResend = false) => {
    if (!channel) {
      error('Enter a valid email address or 10-digit mobile number');
      return;
    }
    if (isSignup && name.trim().length < 2) {
      error('Enter your full name');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          name: isSignup ? name.trim() : undefined,
          intent: mode,
        }),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        error(data.error ?? 'Could not send the verification code');
        return;
      }
      success(data.message ?? 'Verification code sent');
      setStep('code');
      setSecondsLeft(RESEND_SECONDS);
      if (isResend) setCode('');
    } catch {
      error('Could not reach the server');
    } finally {
      setIsSending(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) {
      error('Enter the 6-digit code');
      return;
    }
    setIsVerifying(true);
    try {
      const response = await fetch('/api/auth/otp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          name: name.trim() || undefined,
          code,
        }),
      });
      const data = (await response.json()) as { error?: string; isNewAccount?: boolean };
      if (!response.ok) {
        error(data.error ?? 'Invalid or expired verification code');
        return;
      }
      // The account did the deciding, not the tab the visitor happened to pick.
      success(data.isNewAccount ? 'Account created' : 'Welcome back');
      finish();
    } catch {
      error('Could not reach the server');
    } finally {
      setIsVerifying(false);
    }
  };

  const sentTo = channel === 'phone' ? `+${identifier.replace(/\D/g, '').slice(-10)}` : identifier;

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-md',
        compact ? 'px-0 py-0' : 'px-4 py-8 sm:py-12'
      )}
    >
      <div className={cn('text-center', compact ? 'mb-3' : 'mb-5 sm:mb-6')}>
        <h1
          className={cn(
            'font-black tracking-tight text-ink',
            compact ? 'text-lg' : 'text-xl sm:text-2xl'
          )}
        >
          {step === 'code' ? 'Enter your code' : isSignup ? 'Create your account' : 'Sign in'}
        </h1>
        <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-ink-subtle">
          {step === 'code'
            ? `We sent a 6-digit code to ${sentTo}. It expires in 10 minutes.`
            : 'No passwords. We send a one-time code to your email or mobile number.'}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5 sm:space-y-5 sm:p-6">
          {step === 'identify' ? (
            <>
              <div
                role="tablist"
                aria-label="Login or create an account"
                className="grid grid-cols-2 gap-1 rounded-control bg-surface-sunken p-1"
              >
                {(
                  [
                    { key: 'login' as const, label: 'Login' },
                    { key: 'signup' as const, label: 'Create account' },
                  ]
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={mode === tab.key}
                    onClick={() => setMode(tab.key)}
                    className={cn(
                      'cursor-pointer rounded-control px-3 py-2 text-xs font-bold transition-colors',
                      mode === tab.key
                        ? 'bg-surface-raised text-ink shadow-card'
                        : 'text-ink-muted hover:text-ink'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void requestCode();
                }}
              >
                {isSignup && (
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-name">Full name</Label>
                    <Input
                      id="auth-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Aravind Menon"
                      autoComplete="name"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="auth-identifier">Email or mobile number</Label>
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-subtle" />
                    <Input
                      id="auth-identifier"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      placeholder="you@example.com or 98765 43210"
                      autoComplete="username"
                      className="pl-10"
                    />
                  </div>
                  <p className="min-h-4 text-3xs leading-none text-ink-subtle">
                    {channel === 'email'
                      ? 'We will email your code.'
                      : channel === 'phone'
                        ? 'We will text your code.'
                        : 'Type either one — we work out which it is.'}
                  </p>
                </div>

                <Button type="submit" className="w-full font-bold" isLoading={isSending}>
                  {isSignup ? 'Create account' : 'Login'}
                </Button>
              </form>

              <p className="text-center text-xs text-ink-muted">
                {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => setMode(isSignup ? 'login' : 'signup')}
                  className="cursor-pointer font-bold text-accent hover:underline"
                >
                  {isSignup ? 'Login' : 'Sign up'}
                </button>
              </p>

              <GoogleSignInButton onSignedIn={finish} onError={error} />

              <p className="flex items-start gap-2 text-3xs leading-relaxed text-ink-subtle">
                <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />
                Codes are single-use and expire in 10 minutes. We never store your code, and we
                never ask for it over the phone.
              </p>
            </>
          ) : (
            <form className="space-y-4" onSubmit={verifyCode}>
              <div className="space-y-1.5">
                <Label htmlFor="auth-code">6-digit code</Label>
                <Input
                  id="auth-code"
                  ref={codeInputRef}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="text-center font-mono text-lg tracking-[0.4em]"
                />
              </div>

              <Button
                type="submit"
                className="w-full font-bold"
                isLoading={isVerifying}
                disabled={code.length !== 6}
              >
                Verify and continue
              </Button>

              <div className="flex items-center justify-between gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setStep('identify');
                    setCode('');
                  }}
                  className="flex cursor-pointer items-center gap-1 text-ink-muted hover:text-ink"
                >
                  <ArrowLeft className="h-3 w-3" /> Change {channel === 'phone' ? 'number' : 'email'}
                </button>

                <button
                  type="button"
                  disabled={secondsLeft > 0 || isSending}
                  onClick={() => void requestCode(true)}
                  className="flex cursor-pointer items-center gap-1 font-semibold text-accent disabled:cursor-not-allowed disabled:text-ink-subtle"
                >
                  {isSending && <Loader2 className="h-3 w-3 animate-spin" />}
                  {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Outside the card so it covers every way off this screen — the code
          form and the Google button as much as the email one. */}
      <p className="mt-4 text-center text-3xs leading-relaxed text-ink-subtle">
        By signing in you accept our{' '}
        <Link href="/terms" className="font-semibold text-ink-muted underline hover:text-accent">
          Terms &amp; conditions
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="font-semibold text-ink-muted underline hover:text-accent">
          Privacy policy
        </Link>
        .
      </p>
    </div>
  );
}
