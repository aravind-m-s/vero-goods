'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, KeyRound, Mail, Save, ShieldCheck, Smartphone } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Separator } from '@/shared/ui/separator';
import { useToast } from '@/shared/ui/toast';
import type { PublicUser } from '@/features/auth/server/public-user';

type Channel = 'email' | 'phone';

/**
 * Profile management.
 *
 * The name is a plain edit. Email and mobile are identifiers — changing one
 * moves the account, so it goes through the same OTP proof as signing in, one
 * channel at a time.
 */
export function ProfileView({ initial }: { initial: PublicUser }) {
  const { success, error } = useToast();
  const router = useRouter();
  const [user, setUser] = useState(initial);

  const [name, setName] = useState(initial.name);
  const [isSavingName, setIsSavingName] = useState(false);

  const [pending, setPending] = useState<Channel | null>(null);
  const [newValue, setNewValue] = useState('');
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingName(true);
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { error?: string; user?: PublicUser };
      if (!response.ok || !data.user) {
        error(data.error ?? 'Could not save your name');
        return;
      }
      setUser(data.user);
      success('Name updated');
      // The name is on the account header and the overview's profile card too,
      // both server-rendered — drop the router's copy of them so they do not
      // come back stale on the next navigation.
      router.refresh();
    } catch {
      error('Could not reach the server');
    } finally {
      setIsSavingName(false);
    }
  };

  const startChange = (channel: Channel) => {
    setPending(channel);
    setNewValue('');
    setCode('');
    setCodeSent(false);
  };

  const sendCode = async () => {
    if (!pending || !newValue.trim()) {
      error(pending === 'email' ? 'Enter the new email address' : 'Enter the new mobile number');
      return;
    }
    setIsSending(true);
    try {
      const response = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: pending, value: newValue.trim() }),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        error(data.error ?? 'Could not send the verification code');
        return;
      }
      setCodeSent(true);
      success(data.message ?? 'Verification code sent');
    } catch {
      error('Could not reach the server');
    } finally {
      setIsSending(false);
    }
  };

  const confirmChange = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pending || code.length !== 6) {
      error('Enter the 6-digit code');
      return;
    }
    setIsConfirming(true);
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [pending]: newValue.trim(), code }),
      });
      const data = (await response.json()) as { error?: string; user?: PublicUser };
      if (!response.ok || !data.user) {
        error(data.error ?? 'Could not verify the code');
        return;
      }
      setUser(data.user);
      setPending(null);
      setCodeSent(false);
      setCode('');
      success(pending === 'email' ? 'Email address updated' : 'Mobile number updated');
      router.refresh();
    } catch {
      error('Could not reach the server');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Personal details</CardTitle>
        </CardHeader>
        <CardContent>
          {/* The label sits above the whole row, so the input and the button
              share one baseline instead of the button hanging off the label. */}
          <form onSubmit={saveName} className="space-y-1.5">
            <Label htmlFor="profile-name">Full name</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
              />
              <Button
                type="submit"
                className="shrink-0 gap-1.5"
                isLoading={isSavingName}
                disabled={name.trim() === user.name || name.trim().length < 2}
              >
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">Sign-in methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <IdentifierRow
            icon={Mail}
            label="Email address"
            value={user.email ?? 'Not added'}
            verified={user.emailVerified}
            onChange={() => startChange('email')}
            isEditing={pending === 'email'}
          />

          {pending === 'email' && (
            <ChangeForm
              channel="email"
              value={newValue}
              onValueChange={setNewValue}
              code={code}
              onCodeChange={setCode}
              codeSent={codeSent}
              isSending={isSending}
              isConfirming={isConfirming}
              onSend={sendCode}
              onConfirm={confirmChange}
              onCancel={() => setPending(null)}
            />
          )}

          <Separator className="bg-line" />

          <IdentifierRow
            icon={Smartphone}
            label="Mobile number"
            value={user.phone ? `+${user.phone}` : 'Not added'}
            verified={user.phoneVerified}
            onChange={() => startChange('phone')}
            isEditing={pending === 'phone'}
          />

          {pending === 'phone' && (
            <ChangeForm
              channel="phone"
              value={newValue}
              onValueChange={setNewValue}
              code={code}
              onCodeChange={setCode}
              codeSent={codeSent}
              isSending={isSending}
              isConfirming={isConfirming}
              onSend={sendCode}
              onConfirm={confirmChange}
              onCancel={() => setPending(null)}
            />
          )}

          {user.googleLinked && (
            <>
              <Separator className="bg-line" />
              <div className="flex items-center gap-2 text-xs text-ink-muted">
                <BadgeCheck className="h-4 w-4 text-success" />
                Google Sign-In is linked to this account.
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck className="h-4 w-4 text-ink-subtle" /> Account security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs leading-relaxed text-ink-muted">
          <p>
            This account has no password. Every sign-in needs a fresh one-time code sent to your
            verified email or mobile, so a leaked password can never be used against it.
          </p>
          <p>
            Codes are single-use, expire after 10 minutes, and lock out after five wrong attempts.
            Changing your email or mobile requires a code sent to the <em>new</em> one.
          </p>
          <p>
            Signed-in sessions last 30 days. Sign out from the menu on any device you no longer
            use.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

function IdentifierRow({
  icon: Icon,
  label,
  value,
  verified,
  onChange,
  isEditing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  verified: boolean;
  onChange: () => void;
  isEditing: boolean;
}) {
  return (
    // Icon column is fixed, the value column takes the slack and truncates, and
    // the actions never wrap under half a badge.
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 shrink-0 text-ink-subtle" />
      <div className="min-w-0 flex-1">
        <p className="text-2xs uppercase tracking-wider text-ink-subtle">{label}</p>
        <p className="truncate text-sm font-semibold text-ink">{value}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {verified ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="secondary">Not verified</Badge>
        )}
        <Button variant="outline" size="sm" onClick={onChange} disabled={isEditing}>
          {value === 'Not added' ? 'Add' : 'Change'}
        </Button>
      </div>
    </div>
  );
}

function ChangeForm({
  channel,
  value,
  onValueChange,
  code,
  onCodeChange,
  codeSent,
  isSending,
  isConfirming,
  onSend,
  onConfirm,
  onCancel,
}: {
  channel: Channel;
  value: string;
  onValueChange: (value: string) => void;
  code: string;
  onCodeChange: (value: string) => void;
  codeSent: boolean;
  isSending: boolean;
  isConfirming: boolean;
  onSend: () => void;
  onConfirm: (event: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onConfirm} className="space-y-3 rounded-control bg-surface-sunken p-4">
      <div className="space-y-1">
        <Label htmlFor={`new-${channel}`}>
          {channel === 'email' ? 'New email address' : 'New mobile number'}
        </Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Input
            id={`new-${channel}`}
            type={channel === 'email' ? 'email' : 'tel'}
            inputMode={channel === 'email' ? 'email' : 'numeric'}
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={channel === 'email' ? 'you@example.com' : '98765 43210'}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            onClick={onSend}
            isLoading={isSending}
          >
            {codeSent ? 'Resend code' : 'Send code'}
          </Button>
        </div>
      </div>

      {codeSent && (
        <div className="space-y-1">
          <Label htmlFor={`code-${channel}`} className="flex items-center gap-1.5">
            <KeyRound className="h-3 w-3" /> Verification code
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Input
              id={`code-${channel}`}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="font-mono tracking-[0.3em]"
            />
            <Button type="submit" className="shrink-0" isLoading={isConfirming} disabled={code.length !== 6}>
              Confirm change
            </Button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="cursor-pointer text-2xs text-ink-subtle underline"
      >
        Cancel
      </button>
    </form>
  );
}
