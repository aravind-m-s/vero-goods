'use client';

import React, { useState } from 'react';
import { Home, MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useToast } from '@/shared/ui/toast';
import { AddressSchema } from '@/features/auth/schemas';
import type { Address } from '@/features/auth/types';

const EMPTY = {
  label: 'Home',
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  pinCode: '',
  country: 'India',
  isDefault: false,
};

type Draft = typeof EMPTY;

/**
 * Address book. Validated with the same schema the API uses, so the customer
 * sees the problem next to the field instead of a generic 400.
 */
export function AddressBook({ initial }: { initial: Address[] }) {
  const { success, error } = useToast();
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<Address | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Address | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setDraft({ ...EMPTY, isDefault: addresses.length === 0 });
    setFieldErrors({});
    setIsFormOpen(true);
  };

  const openEdit = (address: Address) => {
    setEditing(address);
    setDraft({
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? '',
      city: address.city,
      state: address.state,
      pinCode: address.pinCode,
      country: address.country,
      isDefault: address.isDefault,
    });
    setFieldErrors({});
    setIsFormOpen(true);
  };

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

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
      const response = await fetch(
        editing ? `/api/account/addresses/${editing.id}` : '/api/account/addresses',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        }
      );
      const data = (await response.json()) as { error?: string; address?: Address };
      if (!response.ok || !data.address) {
        error(data.error ?? 'Could not save the address');
        return;
      }

      const saved = data.address;
      setAddresses((prev) => {
        const others = prev
          .filter((item) => item.id !== saved.id)
          // Only one default can be live at a time; the server already enforced it.
          .map((item) => (saved.isDefault ? { ...item, isDefault: false } : item));
        return sortAddresses([...others, saved]);
      });
      success(editing ? 'Address updated' : 'Address saved');
      setIsFormOpen(false);
    } catch {
      error('Could not reach the server');
    } finally {
      setIsSaving(false);
    }
  };

  const makeDefault = async (address: Address) => {
    try {
      const response = await fetch(`/api/account/addresses/${address.id}`, { method: 'PUT' });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        error(data.error ?? 'Could not set the default address');
        return;
      }
      setAddresses((prev) =>
        sortAddresses(prev.map((item) => ({ ...item, isDefault: item.id === address.id })))
      );
      success(`${address.label} is now your default delivery address`);
    } catch {
      error('Could not reach the server');
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/account/addresses/${toDelete.id}`, { method: 'DELETE' });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        error(data.error ?? 'Could not delete the address');
        return;
      }
      const remaining = addresses.filter((item) => item.id !== toDelete.id);
      // The server promotes the next address when the default is removed.
      if (toDelete.isDefault && remaining[0]) remaining[0] = { ...remaining[0], isDefault: true };
      setAddresses(sortAddresses(remaining));
      success('Address deleted');
      setToDelete(null);
    } catch {
      error('Could not reach the server');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" /> Delivery addresses
          </CardTitle>
          <Button size="sm" className="shrink-0 gap-1.5" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Add address
          </Button>
        </CardHeader>
        <CardContent>
          {addresses.length === 0 ? (
            <div className="rounded-control border border-dashed border-line p-8 text-center">
              <Home className="mx-auto h-6 w-6 text-ink-subtle" />
              <p className="mt-2 text-xs text-ink-subtle">
                No saved addresses yet. Add one and it becomes your default for checkout.
              </p>
            </div>
          ) : (
            // items-stretch + flex-col cards: every card in a row is the same
            // height and every action bar sits on the same line.
            <ul className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
              {addresses.map((address) => (
                <li
                  key={address.id}
                  className={`flex h-full flex-col rounded-card border p-4 ${
                    address.isDefault ? 'border-accent' : 'border-line'
                  }`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-bold text-ink">{address.label}</p>
                    {address.isDefault && (
                      <Badge variant="success" className="shrink-0">
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-ink-muted">
                    {address.fullName}
                  </p>

                  <address className="mt-2 text-xs not-italic leading-relaxed text-ink-muted">
                    {address.line1}
                    {address.line2 && <>, {address.line2}</>}
                    <br />
                    {address.city}, {address.state} {address.pinCode}
                    <br />
                    {address.country}
                    <br />
                    <span className="text-ink-subtle">{address.phone}</span>
                  </address>

                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-3">
                    {!address.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 px-2"
                        onClick={() => makeDefault(address)}
                      >
                        <Star className="h-3.5 w-3.5" /> Set default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 px-2"
                      onClick={() => openEdit(address)}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 px-2 text-danger"
                      onClick={() => setToDelete(address)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onClose={() => setIsFormOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit address' : 'Add a delivery address'}</DialogTitle>
            <DialogDescription>
              We deliver across India. The phone number is used by the courier on the day of
              delivery.
            </DialogDescription>
          </DialogHeader>

          <form id="address-form" onSubmit={save} className="space-y-3 pb-2">
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
                placeholder="98765 43210"
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

            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-ink-muted">
              <input
                type="checkbox"
                checked={draft.isDefault}
                onChange={(event) => set({ isDefault: event.target.checked })}
                className="h-4 w-4 rounded border-line-strong accent-accent"
              />
              Use as my default delivery address
            </label>
          </form>

          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="address-form" isLoading={isSaving}>
              {editing ? 'Save changes' : 'Save address'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={toDelete !== null} onClose={() => setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {toDelete?.label}?</DialogTitle>
            <DialogDescription>
              This removes the address from your address book. Orders already placed keep the
              address they were shipped to.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} isLoading={isDeleting}>
              Delete address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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

/** Default first, then newest — matches the order the API returns. */
function sortAddresses(addresses: Address[]): Address[] {
  return [...addresses].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}
