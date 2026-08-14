'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useToast } from '@/shared/ui/toast';
import { AddressSchema } from '@/features/auth/schemas';
import type { Address } from '@/features/auth/types';

/**
 * The one place checkout still asks for address fields: a customer with no
 * saved address, or one adding another. Saving writes to the address book, so
 * the address is there for the next order too.
 *
 * Validated with the same schema the API uses, so the problem shows next to the
 * field instead of arriving as a generic 400.
 */
export function CheckoutAddressForm({
  defaultName,
  defaultPhone,
  makeDefault,
  onSaved,
  onCancel,
}: {
  defaultName?: string;
  defaultPhone?: string;
  /** True for the customer's first address — it becomes their default. */
  makeDefault: boolean;
  onSaved: (address: Address) => void;
  onCancel?: () => void;
}) {
  const { success, error } = useToast();
  const [draft, setDraft] = useState({
    label: 'Home',
    fullName: defaultName ?? '',
    phone: defaultPhone ?? '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    pinCode: '',
    country: 'India',
    isDefault: makeDefault,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const set = (patch: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...patch }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldErrors({});

    const parsed = AddressSchema.safeParse({ ...draft, line2: draft.line2 || undefined });
    if (!parsed.success) {
      const messages: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join('.');
        if (!messages[key]) messages[key] = issue.message;
      }
      setFieldErrors(messages);
      error(Object.values(messages)[0] ?? 'Check the address details');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/account/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data = (await response.json()) as { error?: string; address?: Address };
      if (!response.ok || !data.address) {
        error(data.error ?? 'Could not save the address');
        return;
      }
      success('Address saved');
      onSaved(data.address);
    } catch {
      error('Could not reach the server');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Label" error={fieldErrors.label}>
          <Input
            value={draft.label}
            onChange={(event) => set({ label: event.target.value })}
            placeholder="Home"
            error={fieldErrors.label}
          />
        </Field>
        <Field label="Full name" error={fieldErrors.fullName}>
          <Input
            value={draft.fullName}
            onChange={(event) => set({ fullName: event.target.value })}
            autoComplete="name"
            error={fieldErrors.fullName}
          />
        </Field>
      </div>

      <Field label="Mobile number" error={fieldErrors.phone}>
        <Input
          value={draft.phone}
          onChange={(event) => set({ phone: event.target.value })}
          inputMode="numeric"
          autoComplete="tel"
          placeholder="9876543210"
          error={fieldErrors.phone}
        />
      </Field>

      <Field label="Flat / house no. and street" error={fieldErrors.line1}>
        <Input
          value={draft.line1}
          onChange={(event) => set({ line1: event.target.value })}
          autoComplete="address-line1"
          error={fieldErrors.line1}
        />
      </Field>

      <Field label="Area, landmark (optional)" error={fieldErrors.line2}>
        <Input
          value={draft.line2}
          onChange={(event) => set({ line2: event.target.value })}
          autoComplete="address-line2"
          error={fieldErrors.line2}
        />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="City" error={fieldErrors.city}>
          <Input
            value={draft.city}
            onChange={(event) => set({ city: event.target.value })}
            autoComplete="address-level2"
            error={fieldErrors.city}
          />
        </Field>
        <Field label="State" error={fieldErrors.state}>
          <Input
            value={draft.state}
            onChange={(event) => set({ state: event.target.value })}
            autoComplete="address-level1"
            error={fieldErrors.state}
          />
        </Field>
        <Field label="PIN code" error={fieldErrors.pinCode}>
          <Input
            value={draft.pinCode}
            onChange={(event) => set({ pinCode: event.target.value.replace(/\D/g, '') })}
            inputMode="numeric"
            autoComplete="postal-code"
            error={fieldErrors.pinCode}
          />
        </Field>
      </div>

      {!makeDefault && (
        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-muted">
          <input
            type="checkbox"
            checked={draft.isDefault}
            onChange={(event) => set({ isDefault: event.target.checked })}
            className="h-4 w-4 rounded border-line-strong accent-accent"
          />
          Use as my default delivery address
        </label>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" isLoading={isSaving}>
          Save and use this address
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className={error ? 'text-danger' : undefined}>{label}</Label>
      {children}
    </div>
  );
}
