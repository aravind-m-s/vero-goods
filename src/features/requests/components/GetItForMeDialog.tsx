'use client';

import React, { useEffect, useState } from 'react';
import { HandHeart } from 'lucide-react';
import { Button } from '@/shared/ui/button';
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
import { Textarea } from '@/shared/ui/textarea';
import { useToast } from '@/shared/ui/toast';
import { ProductRequestSchema } from '@/features/requests/schemas';

/**
 * "Get it for me" — the out-of-stock counterpart to Add to cart.
 *
 * It records interest; it does not promise stock. The seller reviews these in
 * the admin panel and decides whether to source the product.
 */
export function GetItForMeDialog({
  open,
  onClose,
  productId,
  productTitle,
  variantId,
  variantName,
  quantity,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  productTitle: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
}) {
  const { success, error } = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    // Prefill from the session when there is one; guests fill it in themselves.
    (async () => {
      try {
        const response = await fetch('/api/auth/otp');
        if (!response.ok) return;
        const data = (await response.json()) as {
          user: { name: string; email?: string; phone?: string } | null;
        };
        if (!data.user) return;
        setName((current) => current || data.user!.name);
        setEmail((current) => current || data.user!.email || '');
        setPhone((current) => current || (data.user!.phone ?? '').replace(/\D/g, '').slice(-10));
      } catch {
        // Signed out — nothing to prefill.
      }
    })();
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldErrors({});

    const payload = {
      productId,
      variantId,
      customerName: name,
      email: email || undefined,
      phone,
      quantity,
      note: note || undefined,
    };

    const parsed = ProductRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const messages: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join('.');
        if (!messages[key]) messages[key] = issue.message;
      }
      setFieldErrors(messages);
      error(Object.values(messages)[0] ?? 'Check the details and try again');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/product-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        error(data.error ?? 'Could not send your request');
        return;
      }
      success(data.message ?? 'Request received. Our team will get back to you.');
      setNote('');
      onClose();
    } catch {
      error('Could not reach the server');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandHeart className="h-4 w-4 text-accent" /> Get it for me
          </DialogTitle>
          <DialogDescription>
            {productTitle}
            {variantName && variantName !== 'Default' ? ` · ${variantName}` : ''} is out of stock.
            Tell us how to reach you and our team will try to source it — no payment now, and no
            obligation.
          </DialogDescription>
        </DialogHeader>

        <form id="get-it-for-me" onSubmit={submit} className="space-y-3 pb-2">
          <div className="space-y-1">
            <Label htmlFor="request-name">Your name</Label>
            <Input
              id="request-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              error={fieldErrors.customerName}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="request-phone">Mobile number</Label>
              <Input
                id="request-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="98765 43210"
                error={fieldErrors.phone}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="request-email">Email (optional)</Label>
              <Input
                id="request-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                error={fieldErrors.email}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="request-note">Anything we should know? (optional)</Label>
            <Textarea
              id="request-note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Needed before the 20th, happy with a similar model, bulk order…"
              error={fieldErrors.note}
            />
          </div>

          <p className="text-3xs leading-relaxed text-ink-subtle">
            Quantity requested: <strong className="text-ink-muted">{quantity}</strong>. We use your
            number only to reply about this product.
          </p>
        </form>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="get-it-for-me" variant="accent" isLoading={isSending}>
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
