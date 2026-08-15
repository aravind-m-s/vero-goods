'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Check,
  Landmark,
  Lock,
  MapPin,
  Plus,
  ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import {
  clearPurchased,
  refreshQuote,
  useCheckoutCount,
  useCheckoutLines,
  useCheckoutTotals,
  useIsCartHydrated,
  useIsDirectBuy,
} from '@/features/cart/store/cart.store';
import { AuthView } from '@/features/auth/components/AuthView';
import type { PublicUser } from '@/features/auth/server/public-user';
import type { Address } from '@/features/auth/types';
import { CheckoutFormSchema } from '@/features/checkout/schemas';
import { CheckoutAddressForm } from '@/features/checkout/components/CheckoutAddressForm';
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
import { Separator } from '@/shared/ui/separator';
import { useToast } from '@/shared/ui/toast';
import { formatMinor } from '@/shared/lib/money';
import { cn } from '@/shared/lib/utils';

type CheckoutFormValues = z.input<typeof CheckoutFormSchema>;

interface RazorpaySession {
  razorpayOrderId: string;
  amountMinor: number;
  keyId: string;
  isSandbox: boolean;
  orderId: string;
  orderNumber: string;
  trackingToken: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function CheckoutView() {
  const router = useRouter();
  // Checkout buys whatever the cart store says is being bought — the cart, or a
  // single "buy now" item that never entered it.
  const lines = useCheckoutLines();
  const totals = useCheckoutTotals();
  const cartCount = useCheckoutCount();
  const isDirectBuy = useIsDirectBuy();
  const isHydrated = useIsCartHydrated();
  const { success: showSuccess, error: showError } = useToast();

  const [customer, setCustomer] = useState<PublicUser | null>(null);
  /**
   * `restoring` until the session cookie has been checked *and*, for a signed-in
   * customer, their addresses have arrived. Starting at `signin` flashed the
   * login panel at every returning customer on every refresh, then replaced it
   * with an empty address list, then with the default address — three layouts
   * for what is one already-decided state.
   */
  const [sessionState, setSessionState] = useState<'restoring' | 'guest' | 'verified'>('restoring');
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  /** Opens the address fields on top of an existing list. */
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [simulation, setSimulation] = useState<RazorpaySession | null>(null);

  /**
   * Stable per-attempt key. The order API answers a repeat of the same key with
   * the original order, so a double-click cannot produce two orders or two charges.
   */
  const idempotencyKey = useRef<string>(crypto.randomUUID());

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(CheckoutFormSchema),
    defaultValues: { paymentMethod: 'RAZORPAY' },
  });

  const paymentMethod = watch('paymentMethod');
  const selectedAddress = savedAddresses.find((item) => item.id === selectedAddressId) ?? null;
  const addressCardRef = useRef<HTMLDivElement>(null);

  /**
   * The pay button stays live without an address.
   *
   * A disabled button explains nothing: a first-time visitor with an empty
   * cart-to-order path saw a dead control and no reason for it. Pressing it now
   * says what is missing, opens the address form when there is nothing to pick,
   * and scrolls to it — which on a phone is the difference between the problem
   * being on screen and being three scrolls above it.
   */
  const requireAddress = (): boolean => {
    if (selectedAddress) return true;

    if (savedAddresses.length === 0) setIsAddingAddress(true);
    showError(
      savedAddresses.length === 0
        ? 'Add a delivery address to place your order'
        : 'Choose a delivery address to place your order'
    );
    addressCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  };

  const handlePayClick = () => {
    if (!requireAddress()) return;
    void handleSubmit(onSubmit)();
  };

  // COD carries a handling fee, so the server quote is refreshed whenever the
  // payment method changes — and only then. `refreshQuote` is a module-level
  // function, so this no longer re-fires every time the basket changes.
  useEffect(() => {
    if (paymentMethod) void refreshQuote(paymentMethod);
  }, [paymentMethod]);

  /**
   * Totals to show while that refresh is still in the air.
   *
   * Switching to COD changes exactly one number, and the last quote already
   * carries it: `codFeeIfSelectedMinor` exists so the COD option can be labelled
   * before anyone picks it. Applying it here means the summary and the button
   * move the instant the radio does, instead of sitting on a spinner for a
   * round-trip that will return this same figure. The server quote remains
   * authoritative — it lands a moment later and overwrites this — and the order
   * API re-prices from the database regardless of what was on screen.
   */
  const displayTotals = useMemo(() => {
    const codFeeMinor = paymentMethod === 'COD' ? totals.codFeeIfSelectedMinor : 0;
    if (codFeeMinor === totals.codFeeMinor) return totals;
    return {
      ...totals,
      codFeeMinor,
      // Mirrors `calculateTotals`: the COD fee is added to the total and, unlike
      // shipping, is not part of the inclusive-GST split.
      totalMinor: totals.subtotalMinor + totals.shippingMinor + codFeeMinor,
    };
  }, [totals, paymentMethod]);

  /** Stored numbers carry the country code; the order API wants the 10 local digits. */
  const toLocalPhone = (phone?: string) => (phone ? phone.replace(/\D/g, '').slice(-10) : '');

  /** A newly saved address joins the list and becomes the one being shipped to. */
  const acceptNewAddress = useCallback((address: Address) => {
    setSavedAddresses((current) => [
      address,
      // The server allows exactly one default; mirror that here.
      ...current.map((item) => (address.isDefault ? { ...item, isDefault: false } : item)),
    ]);
    setSelectedAddressId(address.id);
    setIsAddingAddress(false);
  }, []);

  /**
   * Restores the whole checkout in one pass: session, then addresses, then the
   * choices made before the refresh. Nothing is rendered until it settles, so a
   * returning customer sees the skeleton and then the finished page — never the
   * login panel they already got past.
   */
  const restoreCheckout = useCallback(async () => {
    const prefs = readCheckoutPrefs();
    if (prefs.paymentMethod) setValue('paymentMethod', prefs.paymentMethod);

    try {
      const response = await fetch('/api/auth/otp');
      const data = response.ok ? ((await response.json()) as { user: PublicUser | null }) : null;

      // No session, or one the server has since expired: sign-in is genuinely
      // needed, and only now is it shown.
      if (!data?.user) {
        setSessionState('guest');
        return;
      }

      setCustomer(data.user);
      setValue('email', data.user.email ?? '');

      // Saved addresses turn checkout into two clicks for a returning customer:
      // pick a card, pay. No address fields are shown at all.
      const addressResponse = await fetch('/api/account/addresses');
      const addresses = addressResponse.ok
        ? ((await addressResponse.json()) as { addresses: Address[] }).addresses
        : [];
      setSavedAddresses(addresses);

      // The address chosen before the refresh wins, but only while it still
      // exists — it may have been deleted from the address book meanwhile.
      const remembered = addresses.find((item) => item.id === prefs.addressId);
      const preferred = remembered ?? addresses.find((item) => item.isDefault) ?? addresses[0];
      setSelectedAddressId(preferred?.id ?? '');
    } catch {
      // The session could not be checked at all. Treat it as signed out rather
      // than stranding the customer on a spinner.
      setSessionState('guest');
      return;
    }

    setSessionState('verified');
  }, [setValue]);

  useEffect(() => {
    void restoreCheckout();
  }, [restoreCheckout]);

  // Remember the choices so a refresh mid-checkout costs nothing.
  useEffect(() => {
    if (sessionState !== 'verified') return;
    writeCheckoutPrefs({ addressId: selectedAddressId, paymentMethod });
  }, [sessionState, selectedAddressId, paymentMethod]);

  const goToSuccess = (trackingToken: string, orderNumber: string) => {
    clearPurchased();
    router.push(`/order/success?token=${trackingToken}&orderNumber=${orderNumber}`);
    // The order history and the overview's order card are server-rendered and
    // the router may still be holding a copy from before this order existed.
    router.refresh();
  };

  const verifyPayment = async (session: RazorpaySession, response: Record<string, string>) => {
    try {
      const verification = await fetch('/api/payments/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id ?? session.razorpayOrderId,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          orderId: session.orderId,
        }),
      });
      const data = (await verification.json()) as { error?: string };

      if (verification.status === 202) {
        // Gateway unreachable; the webhook will settle it. Never lose the order.
        showSuccess('Payment received. We will email your receipt shortly.');
        goToSuccess(session.trackingToken, session.orderNumber);
        return;
      }
      if (!verification.ok) {
        showError(data.error ?? 'Payment verification failed');
        setIsPlacingOrder(false);
        return;
      }
      showSuccess('Payment confirmed');
      goToSuccess(session.trackingToken, session.orderNumber);
    } catch {
      showError('Could not confirm the payment. Check your email for the receipt.');
      setIsPlacingOrder(false);
    }
  };

  const startRazorpayCheckout = async (session: RazorpaySession) => {
    if (session.isSandbox) {
      setSimulation(session);
      setIsPlacingOrder(false);
      return;
    }

    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) {
      showError('Could not reach the payment gateway. Please try again.');
      setIsPlacingOrder(false);
      return;
    }

    new window.Razorpay({
      key: session.keyId,
      amount: session.amountMinor,
      currency: 'INR',
      name: 'Vero Goods',
      description: `Order ${session.orderNumber}`,
      order_id: session.razorpayOrderId,
      prefill: { email: customer?.email, contact: toLocalPhone(selectedAddress?.phone) },
      handler: (response: Record<string, string>) => {
        void verifyPayment(session, response);
      },
      modal: {
        ondismiss: () => {
          setIsPlacingOrder(false);
          showError('Payment cancelled. Your order is saved and can be paid from the tracking page.');
        },
      },
    }).open();
  };

  const onSubmit = async (values: CheckoutFormValues) => {
    if (lines.length === 0) {
      showError('Your cart is empty');
      return;
    }
    // Also checked on the click, before validation; this covers the paths that
    // reach the submit handler another way.
    if (!requireAddress() || !selectedAddress) return;
    setIsPlacingOrder(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedAddress.fullName,
          phone: toLocalPhone(selectedAddress.phone),
          // Where the receipt goes. A customer who signed in by mobile types it
          // here; for everyone else it is their account address.
          email: values.email,
          // Copied field by field, not sent as an id: the order keeps this
          // address even if the saved one is edited or deleted later.
          shippingAddress: {
            line1: selectedAddress.line1,
            line2: selectedAddress.line2 ?? undefined,
            city: selectedAddress.city,
            state: selectedAddress.state,
            pinCode: selectedAddress.pinCode,
            country: selectedAddress.country,
            fullName: selectedAddress.fullName,
            phone: toLocalPhone(selectedAddress.phone),
            label: selectedAddress.label,
            sourceAddressId: selectedAddress.id,
          },
          paymentMethod: values.paymentMethod,
          items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
          idempotencyKey: idempotencyKey.current,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        orderId?: string;
        orderNumber?: string;
        trackingToken?: string;
      };

      if (!response.ok || !data.orderId) {
        showError(data.error ?? 'Could not place your order');
        // Stock changed under us — re-price so the cart reflects reality.
        if (response.status === 409) await refreshQuote();
        setIsPlacingOrder(false);
        return;
      }

      if (values.paymentMethod === 'COD') {
        showSuccess('Order placed');
        goToSuccess(data.trackingToken as string, data.orderNumber as string);
        return;
      }

      const paymentResponse = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: data.orderId }),
      });
      const payment = (await paymentResponse.json()) as {
        error?: string;
        razorpayOrderId?: string;
        amountMinor?: number;
        keyId?: string;
        isSandbox?: boolean;
      };

      if (!paymentResponse.ok || !payment.razorpayOrderId) {
        showError(payment.error ?? 'Could not start the payment');
        setIsPlacingOrder(false);
        return;
      }

      await startRazorpayCheckout({
        razorpayOrderId: payment.razorpayOrderId,
        amountMinor: payment.amountMinor as number,
        keyId: payment.keyId as string,
        isSandbox: Boolean(payment.isSandbox),
        orderId: data.orderId,
        orderNumber: data.orderNumber as string,
        trackingToken: data.trackingToken as string,
      });
    } catch {
      showError('Checkout failed. Please try again.');
      setIsPlacingOrder(false);
    }
  };

  // The cart lives in localStorage and the session in a cookie; neither is
  // readable during the first render. One skeleton covers both.
  const isRestoring = sessionState === 'restoring' || !isHydrated;

  if (isHydrated && cartCount === 0 && !isPlacingOrder) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-sunken">
          <ShoppingBag className="h-6 w-6 text-ink-subtle" />
        </div>
        <h1 className="text-lg font-bold text-ink">Your cart is empty</h1>
        <p className="text-xs text-ink-subtle">Add something to it before checking out.</p>
        <Link href="/" className="mt-2">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" /> Browse the catalog
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      {/* Tighter on phones: the sign-in card used to start most of a screen
          down, under a full-size title and a wide step rail. */}
      <header className="mb-4 sm:mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-ink-subtle transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3 w-3" /> Continue shopping
        </Link>
        <h1 className="mt-1.5 text-xl font-bold tracking-tight text-ink sm:mt-2 sm:text-3xl">
          Checkout
        </h1>
        <ol className="mt-3 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide sm:mt-4 sm:gap-2">
          <Step
            index={1}
            label="Verify"
            active={sessionState === 'guest'}
            done={sessionState === 'verified'}
          />
          <span aria-hidden="true" className="h-px w-4 bg-line-strong sm:w-6" />
          <Step
            index={2}
            label="Address"
            active={sessionState === 'verified' && !selectedAddress}
            done={Boolean(selectedAddress)}
          />
          <span aria-hidden="true" className="h-px w-4 bg-line-strong sm:w-6" />
          <Step index={3} label="Pay" active={Boolean(selectedAddress)} done={false} />
        </ol>
      </header>

      {isRestoring ? (
        <CheckoutSkeleton />
      ) : sessionState === 'guest' ? (
        <AuthView next="/checkout" compact />
      ) : (
        // Not a <form>: the address panel has its own form for saving a new
        // address, and forms cannot nest.
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-7">
            <Card ref={addressCardRef}>
              <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 shrink-0 text-ink-subtle" /> Delivery address
                  </CardTitle>
                  <p className="mt-1 truncate text-xs text-ink-subtle">
                    Signed in as{' '}
                    {customer?.email ?? (customer?.phone ? `+${customer.phone}` : customer?.name)}
                  </p>
                </div>
                {savedAddresses.length > 0 && !isAddingAddress && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    onClick={() => setIsAddingAddress(true)}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add new
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {!customer?.email && (
                  <Field id="email" label="Email for your receipt" error={errors.email?.message}>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      error={errors.email?.message}
                      {...register('email')}
                    />
                  </Field>
                )}

                {savedAddresses.length > 0 && !isAddingAddress ? (
                  // Nothing to type: the saved addresses are the whole step.
                  <div
                    role="radiogroup"
                    aria-label="Delivery address"
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                  >
                    {savedAddresses.map((address) => {
                      const isSelected = selectedAddressId === address.id;
                      return (
                        <button
                          key={address.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setSelectedAddressId(address.id)}
                          className={cn(
                            'flex h-full cursor-pointer flex-col rounded-control border p-3 text-left transition-colors',
                            isSelected
                              ? 'border-accent bg-accent-soft/30'
                              : 'border-line hover:border-ink-subtle'
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 truncate text-xs font-bold text-ink">
                              {address.label}
                            </span>
                            {address.isDefault && <Badge variant="secondary">Default</Badge>}
                            {isSelected && (
                              <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-accent" />
                            )}
                          </span>
                          <span className="mt-1 block text-2xs font-semibold text-ink-muted">
                            {address.fullName}
                          </span>
                          <span className="mt-0.5 block text-2xs leading-relaxed text-ink-muted">
                            {address.line1}
                            {address.line2 ? `, ${address.line2}` : ''}
                            <br />
                            {address.city}, {address.state} {address.pinCode}
                            <br />
                            <span className="text-ink-subtle">{address.phone}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <CheckoutAddressForm
                    defaultName={customer?.name}
                    defaultPhone={toLocalPhone(customer?.phone)}
                    makeDefault={savedAddresses.length === 0}
                    onSaved={acceptNewAddress}
                    onCancel={
                      savedAddresses.length > 0 ? () => setIsAddingAddress(false) : undefined
                    }
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <PaymentOption
                  {...register('paymentMethod')}
                  value="RAZORPAY"
                  checked={paymentMethod === 'RAZORPAY'}
                  icon={<Landmark className="h-4 w-4" />}
                  title="Pay online"
                  subtitle="UPI, cards and netbanking via Razorpay"
                />
                <PaymentOption
                  {...register('paymentMethod')}
                  value="COD"
                  checked={paymentMethod === 'COD'}
                  icon={<Banknote className="h-4 w-4" />}
                  title="Cash on delivery"
                  // Reads the configured fee rather than the one applied to this
                  // basket: the latter is zero until COD is actually selected,
                  // so the label has to describe the option, not the current total.
                  // Falls back to a statement with no number in it, because the
                  // placeholder totals are zero until the first quote returns
                  // and "no handling fee" would be a claim rather than a blank.
                  subtitle={
                    totals.codFeeIfSelectedMinor > 0
                      ? `${formatMinor(totals.codFeeIfSelectedMinor)} handling fee applies`
                      : 'Pay in cash when it arrives'
                  }
                />
                {errors.paymentMethod && <AuthError message={errors.paymentMethod.message ?? ''} />}
              </CardContent>
            </Card>
          </div>

          <div className="lg:sticky lg:top-28 lg:col-span-5">
            <Card>
              <CardHeader>
                <CardTitle>Order summary</CardTitle>
                {isDirectBuy && (
                  <p className="mt-1 text-2xs text-ink-subtle">
                    Buying this item directly — anything in your cart is left untouched.
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {lines.map((line) => (
                    <li key={line.variantId} className="flex justify-between gap-3 text-xs">
                      <span className="min-w-0">
                        <span className="font-medium text-ink">{line.productTitle}</span>
                        {line.variantName !== 'Default' && (
                          <span className="text-ink-muted"> · {line.variantName}</span>
                        )}
                        <span className="block text-ink-subtle">Qty {line.quantity}</span>
                      </span>
                      <span className="whitespace-nowrap font-semibold text-ink tabular-nums">
                        {formatMinor(line.totalMinor)}
                      </span>
                    </li>
                  ))}
                </ul>

                <Separator />

                <dl className="space-y-1.5 text-xs">
                  <SummaryRow label="Subtotal" value={formatMinor(displayTotals.subtotalMinor)} />
                  <SummaryRow
                    label="Shipping"
                    value={
                      displayTotals.shippingMinor === 0
                        ? 'Free'
                        : formatMinor(displayTotals.shippingMinor)
                    }
                  />
                  {displayTotals.codFeeMinor > 0 && (
                    <SummaryRow
                      label="COD handling fee"
                      value={formatMinor(displayTotals.codFeeMinor)}
                    />
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-lg font-bold text-ink">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatMinor(displayTotals.totalMinor)}</dd>
                  </div>
                </dl>

                <Button
                  type="button"
                  variant="accent"
                  size="lg"
                  className="w-full"
                  onClick={handlePayClick}
                  isLoading={isPlacingOrder}
                  disabled={lines.length === 0}
                >
                  {paymentMethod === 'COD'
                    ? `Place order · ${formatMinor(displayTotals.totalMinor)}`
                    : `Pay ${formatMinor(displayTotals.totalMinor)}`}
                </Button>
                {!selectedAddress && (
                  <p className="text-center text-2xs text-ink-subtle">
                    Add a delivery address to continue
                  </p>
                )}
                <p className="flex items-center justify-center gap-1.5 text-2xs text-ink-subtle">
                  <Lock className="h-3 w-3" />
                  Prices are re-confirmed on the server before payment
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={simulation !== null} onClose={() => setSimulation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simulated payment</DialogTitle>
            <DialogDescription>
              Razorpay keys are not configured, so this is a local simulation. It is disabled
              entirely in production.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between rounded-control border border-line p-3 text-sm">
            <span className="text-ink-muted">Amount</span>
            <Badge variant="info">{formatMinor(simulation?.amountMinor ?? 0)}</Badge>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSimulation(null);
                setIsPlacingOrder(false);
                showError('Payment cancelled');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={async () => {
                if (!simulation) return;
                await verifyPayment(simulation, {
                  razorpay_order_id: simulation.razorpayOrderId,
                  razorpay_payment_id: `pay_sim_${Date.now()}`,
                  razorpay_signature: 'simulated_valid_signature_token',
                });
                setSimulation(null);
              }}
            >
              Simulate success
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Address and payment choices survive a refresh. Session storage, not local:
 * they belong to this checkout in this tab, and a stale pick should not follow
 * the customer into next week's order.
 */
const PREFS_KEY = 'vero.checkout.prefs.v1';

interface CheckoutPrefs {
  addressId?: string;
  paymentMethod?: 'COD' | 'RAZORPAY';
}

function readCheckoutPrefs(): CheckoutPrefs {
  try {
    const raw = sessionStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CheckoutPrefs;
    return {
      addressId: typeof parsed.addressId === 'string' ? parsed.addressId : undefined,
      paymentMethod:
        parsed.paymentMethod === 'COD' || parsed.paymentMethod === 'RAZORPAY'
          ? parsed.paymentMethod
          : undefined,
    };
  } catch {
    return {};
  }
}

function writeCheckoutPrefs(prefs: CheckoutPrefs): void {
  try {
    sessionStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Private browsing or a full quota. Losing the preference is not an error
    // worth interrupting a checkout for.
  }
}

/**
 * Shown while the session and addresses are being restored. It mirrors the real
 * layout, so the page does not jump when the content lands.
 */
function CheckoutSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12"
    >
      <span className="sr-only">Loading your checkout details</span>
      <div className="space-y-6 lg:col-span-7">
        <Card>
          <CardHeader>
            <Bar className="h-4 w-40" />
            <Bar className="mt-2 h-3 w-56" />
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Bar className="h-24 w-full" />
            <Bar className="h-24 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Bar className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Bar className="h-14 w-full" />
            <Bar className="h-14 w-full" />
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-5">
        <Card>
          <CardHeader>
            <Bar className="h-4 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Bar className="h-3 w-full" />
            <Bar className="h-3 w-4/5" />
            <Bar className="h-3 w-2/3" />
            <Separator />
            <Bar className="h-6 w-full" />
            <Bar className="h-11 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Bar({ className }: { className?: string }) {
  return <span className={cn('block animate-pulse rounded bg-surface-sunken', className)} />;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function Step({
  index,
  label,
  active,
  done,
}: {
  index: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full text-3xs',
          done
            ? 'bg-success text-on-success'
            : active
              ? 'bg-accent text-on-accent'
              : 'bg-surface-sunken text-ink-subtle'
        )}
      >
        {index}
      </span>
      <span className={active || done ? 'text-ink' : 'text-ink-subtle'}>{label}</span>
    </li>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {/* Input renders its own message when `error` is set; this keeps the
          label/field pairing intact for fields without one. */}
      {!error && null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-ink-muted">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 rounded-control bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {message}
    </p>
  );
}

const PaymentOption = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
  }
>(function PaymentOption({ icon, title, subtitle, checked, className, ...props }, ref) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-control border p-3.5 transition-colors',
        checked
          ? 'border-accent bg-accent-soft'
          : 'border-line-strong hover:border-ink-subtle',
        className
      )}
    >
      <input type="radio" ref={ref} className="accent-accent" checked={checked} {...props} />
      <span className={checked ? 'text-accent' : 'text-ink-subtle'}>{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-xs text-ink-subtle">{subtitle}</span>
      </span>
    </label>
  );
});
