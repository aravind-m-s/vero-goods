'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { AlertCircle, ArrowLeft, Banknote, Landmark, Lock, MapPin, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useCart } from '@/features/cart/components/CartContext';
import { AuthView } from '@/features/auth/components/AuthView';
import type { PublicUser } from '@/features/auth/server/public-user';
import type { Address } from '@/features/auth/types';
import { CheckoutFormSchema } from '@/features/checkout/schemas';
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
  // Checkout buys whatever the cart context says is being bought — the cart, or
  // a single "buy now" item that never entered it.
  const {
    checkoutLines: lines,
    checkoutTotals: totals,
    checkoutCount: cartCount,
    isCheckoutPricing: isPricing,
    isDirectBuy,
    clearPurchased,
    refreshQuote,
    isHydrated,
  } = useCart();
  const { success: showSuccess, error: showError } = useToast();

  const [customer, setCustomer] = useState<PublicUser | null>(null);
  const [authStep, setAuthStep] = useState<'signin' | 'verified'>('signin');
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
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
    defaultValues: { country: 'India', paymentMethod: 'RAZORPAY' },
  });

  const paymentMethod = watch('paymentMethod');

  // COD carries a handling fee, so the server quote is refreshed whenever the
  // payment method changes.
  useEffect(() => {
    if (paymentMethod) void refreshQuote(paymentMethod);
  }, [paymentMethod, refreshQuote]);

  /** Stored numbers carry the country code; the form wants the 10 local digits. */
  const toLocalPhone = (phone?: string) => (phone ? phone.replace(/\D/g, '').slice(-10) : '');

  const applyAddress = useCallback(
    (address: Address) => {
      setSelectedAddressId(address.id);
      setValue('name', address.fullName);
      setValue('phone', toLocalPhone(address.phone));
      setValue('line1', address.line1);
      setValue('line2', address.line2 ?? '');
      setValue('city', address.city);
      setValue('state', address.state);
      setValue('pinCode', address.pinCode);
      setValue('country', 'India');
    },
    [setValue]
  );

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/otp');
      if (!response.ok) return;
      const data = (await response.json()) as { user: PublicUser | null };
      if (!data.user) return;

      setCustomer(data.user);
      setAuthStep('verified');
      setValue('email', data.user.email ?? '');
      setValue('name', data.user.name);
      if (data.user.phone) setValue('phone', toLocalPhone(data.user.phone));

      // Saved addresses turn checkout into two clicks for a returning customer.
      const addressResponse = await fetch('/api/account/addresses');
      if (!addressResponse.ok) return;
      const addressData = (await addressResponse.json()) as { addresses: Address[] };
      setSavedAddresses(addressData.addresses);

      const preferred = addressData.addresses.find((item) => item.isDefault);
      if (preferred) applyAddress(preferred);
    } catch {
      // Not signed in — the auth panel handles it.
    }
  }, [setValue, applyAddress]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const goToSuccess = (trackingToken: string, orderNumber: string) => {
    clearPurchased();
    router.push(`/order/success?token=${trackingToken}&orderNumber=${orderNumber}`);
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
      prefill: { email: customer?.email, contact: watch('phone') },
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
    setIsPlacingOrder(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          phone: values.phone,
          // Where the receipt goes. A customer who signed in by mobile types it
          // here; for everyone else it is their account address.
          email: values.email,
          shippingAddress: {
            line1: values.line1,
            line2: values.line2,
            city: values.city,
            state: values.state,
            pinCode: values.pinCode,
            country: values.country,
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
          <Step index={1} label="Verify" active={authStep !== 'verified'} done={authStep === 'verified'} />
          <span aria-hidden="true" className="h-px w-4 bg-line-strong sm:w-6" />
          <Step index={2} label="Address" active={authStep === 'verified'} done={false} />
          <span aria-hidden="true" className="h-px w-4 bg-line-strong sm:w-6" />
          <Step index={3} label="Pay" active={false} done={false} />
        </ol>
      </header>

      {authStep !== 'verified' ? (
        <AuthView next="/checkout" compact />
      ) : (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12"
        >
          <div className="space-y-6 lg:col-span-7">
            {savedAddresses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-ink-subtle" /> Saved addresses
                  </CardTitle>
                  <p className="text-xs text-ink-subtle">
                    Pick one to fill the form, or edit the fields below for a one-off delivery.
                  </p>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {savedAddresses.map((address) => (
                    <button
                      key={address.id}
                      type="button"
                      onClick={() => applyAddress(address)}
                      className={cn(
                        'cursor-pointer rounded-control border p-3 text-left transition-colors',
                        selectedAddressId === address.id
                          ? 'border-accent bg-accent-soft/30'
                          : 'border-line hover:border-ink-subtle'
                      )}
                    >
                      <span className="flex items-center gap-2 text-xs font-bold text-ink">
                        {address.label}
                        {address.isDefault && <Badge variant="secondary">Default</Badge>}
                      </span>
                      <span className="mt-1 block text-2xs leading-relaxed text-ink-muted">
                        {address.line1}, {address.city}, {address.state} {address.pinCode}
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Delivery address</CardTitle>
                <p className="text-xs text-ink-subtle">
                  Signed in as {customer?.email ?? (customer?.phone ? `+${customer.phone}` : customer?.name)}
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {!customer?.email && (
                  <div className="sm:col-span-2">
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
                  </div>
                )}
                <Field id="name" label="Full name" error={errors.name?.message}>
                  <Input id="name" autoComplete="name" error={errors.name?.message} {...register('name')} />
                </Field>
                <Field id="phone" label="Mobile number" error={errors.phone?.message}>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="9876543210"
                    error={errors.phone?.message}
                    {...register('phone')}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field id="line1" label="Address line 1" error={errors.line1?.message}>
                    <Input
                      id="line1"
                      autoComplete="address-line1"
                      error={errors.line1?.message}
                      {...register('line1')}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field id="line2" label="Address line 2 (optional)" error={errors.line2?.message}>
                    <Input id="line2" autoComplete="address-line2" {...register('line2')} />
                  </Field>
                </div>
                <Field id="city" label="City" error={errors.city?.message}>
                  <Input
                    id="city"
                    autoComplete="address-level2"
                    error={errors.city?.message}
                    {...register('city')}
                  />
                </Field>
                <Field id="state" label="State" error={errors.state?.message}>
                  <Input
                    id="state"
                    autoComplete="address-level1"
                    error={errors.state?.message}
                    {...register('state')}
                  />
                </Field>
                <Field id="pinCode" label="PIN code" error={errors.pinCode?.message}>
                  <Input
                    id="pinCode"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    error={errors.pinCode?.message}
                    {...register('pinCode')}
                  />
                </Field>
                <Field id="country" label="Country" error={errors.country?.message}>
                  <Input id="country" readOnly className="bg-surface-sunken" {...register('country')} />
                </Field>
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
                  subtitle={`${formatMinor(totals.codFeeMinor || 18)} handling fee applies`}
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
                  <SummaryRow label="Subtotal" value={formatMinor(totals.subtotalMinor)} />
                  <SummaryRow
                    label="Shipping"
                    value={totals.shippingMinor === 0 ? 'Free' : formatMinor(totals.shippingMinor)}
                  />
                  {totals.codFeeMinor > 0 && (
                    <SummaryRow label="COD handling fee" value={formatMinor(totals.codFeeMinor)} />
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-lg font-bold text-ink">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatMinor(totals.totalMinor)}</dd>
                  </div>
                </dl>

                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  className="w-full"
                  isLoading={isPlacingOrder || isPricing}
                  disabled={lines.length === 0}
                >
                  {paymentMethod === 'COD'
                    ? `Place order · ${formatMinor(totals.totalMinor)}`
                    : `Pay ${formatMinor(totals.totalMinor)}`}
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-2xs text-ink-subtle">
                  <Lock className="h-3 w-3" />
                  Prices are re-confirmed on the server before payment
                </p>
              </CardContent>
            </Card>
          </div>
        </form>
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
