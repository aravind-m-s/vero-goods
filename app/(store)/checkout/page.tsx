'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCart } from '../../../components/store/CartContext';
import { useToast } from '../../../components/ui/toast';
import { CheckoutFormSchema } from '../../../lib/validations';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Separator } from '../../../components/ui/separator';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../../components/ui/dialog';
import { ShieldCheck, Mail, Lock, CheckCircle, AlertCircle, ShoppingBag, Landmark, Truck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '../../../lib/utils';
import { z } from 'zod';

type CheckoutFormValues = z.infer<typeof CheckoutFormSchema>;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, cartSubtotal, cartCount, clearCart } = useCart();
  const { success: showSuccessToast, error: showErrorToast } = useToast();

  // Auth State
  const [customer, setCustomer] = useState<{ email: string; name: string } | null>(null);
  const [authStep, setAuthStep] = useState<'email' | 'otp' | 'verified'>('email');
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Checkout State
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'RAZORPAY'>('COD');

  // Razorpay Simulation Modal State
  const [showRazorpaySim, setShowRazorpaySim] = useState(false);
  const [simulatedOrderInfo, setSimulatedOrderInfo] = useState<{
    orderId: string;
    orderNumber: string;
    trackingToken: string;
    amount: number;
  } | null>(null);
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);

  // Address Form Hook
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormValues>({
    resolver: zodResolver(CheckoutFormSchema),
    defaultValues: {
      country: 'India',
      paymentMethod: 'COD',
    },
  });

  // Check customer session on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch('/api/auth/otp');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCustomer(data.user);
            setAuthStep('verified');
            setValue('email', data.user.email);
            setValue('name', data.user.name);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    checkSession();
  }, [setValue]);

  // Handle Cart Empty Redirection
  useEffect(() => {
    if (items.length === 0 && authStep === 'verified') {
      router.push('/');
    }
  }, [items, authStep, router]);

  // Send OTP
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) {
      setAuthError('Please enter a valid email address');
      return;
    }

    setIsAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });

      if (res.ok) {
        setAuthStep('otp');
        showSuccessToast('verification code printed to console/terminal!');
      } else {
        const data = await res.json();
        setAuthError(data.error || 'Failed to send verification code');
      }
    } catch (e) {
      setAuthError('Network error. Please try again.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput.length !== 6) {
      setAuthError('Verification code must be 6 digits');
      return;
    }

    setIsAuthLoading(true);
    setAuthError('');

    try {
      const res = await fetch('/api/auth/otp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, code: otpInput }),
      });

      if (res.ok) {
        const data = await res.json();
        setCustomer(data.user);
        setAuthStep('verified');
        setValue('email', data.user.email);
        setValue('name', data.user.name);
        showSuccessToast('Logged in successfully!');
      } else {
        const data = await res.json();
        setAuthError(data.error || 'Invalid or expired code');
      }
    } catch (e) {
      setAuthError('Verification failed. Try again.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Submit Address & Place Order
  const onSubmitAddress = async (values: CheckoutFormValues) => {
    if (items.length === 0) {
      showErrorToast('Your cart is empty');
      return;
    }

    setIsPlacingOrder(true);

    try {
      // 1. Create order on server side
      const cartPayload = items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }));

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingDetails: {
            line1: values.line1,
            line2: values.line2,
            city: values.city,
            state: values.state,
            pinCode: values.pinCode,
            country: values.country,
          },
          paymentMethod: values.paymentMethod,
          items: cartPayload,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        showErrorToast(data.error || 'Failed to place order');
        setIsPlacingOrder(false);
        return;
      }

      const orderData = await res.json();

      if (values.paymentMethod === 'COD') {
        // Cash on delivery completes immediately
        showSuccessToast('Order placed successfully!');
        clearCart();
        router.push(`/order/success?token=${orderData.trackingToken}&orderNumber=${orderData.orderNumber}`);
      } else {
        // Online Payment - Show Razorpay Simulation Screen
        setSimulatedOrderInfo({
          orderId: orderData.orderId,
          orderNumber: orderData.orderNumber,
          trackingToken: orderData.trackingToken,
          amount: orderData.totalAmount,
        });
        setShowRazorpaySim(true);
      }
    } catch (e) {
      showErrorToast('Checkout connection failure');
    } finally {
      if (paymentMethod === 'COD') {
        setIsPlacingOrder(false);
      }
    }
  };

  // Simulate Razorpay Payment Success
  const handleSimulatePaymentSuccess = async () => {
    if (!simulatedOrderInfo) return;
    setIsSimulatingPayment(true);

    try {
      // Call verification endpoint with simulated signature
      const res = await fetch('/api/payments/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: `rzp_order_${simulatedOrderInfo.orderId}`,
          razorpay_payment_id: `pay_${Math.random().toString(36).substr(2, 9)}`,
          razorpay_signature: 'simulated_valid_signature_token',
          orderId: simulatedOrderInfo.orderId,
        }),
      });

      if (res.ok) {
        showSuccessToast('Payment verification succeeded!');
        setShowRazorpaySim(false);
        clearCart();
        router.push(`/order/success?token=${simulatedOrderInfo.trackingToken}&orderNumber=${simulatedOrderInfo.orderNumber}`);
      } else {
        const data = await res.json();
        showErrorToast(data.error || 'Signature verification failed');
      }
    } catch (e) {
      showErrorToast('Verification endpoint error');
    } finally {
      setIsSimulatingPayment(false);
      setIsPlacingOrder(false);
    }
  };

  const handleSimulatePaymentFailure = () => {
    showErrorToast('Payment cancelled/failed');
    setShowRazorpaySim(false);
    setIsPlacingOrder(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 flex flex-col justify-start">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-8 sm:text-3xl">
        Checkout
      </h1>

      {/* Auth Step Panel */}
      {authStep !== 'verified' ? (
        <div className="max-w-md mx-auto w-full my-8">
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-900 mb-2">
                <ShieldCheck className="h-6 w-6 text-zinc-650" />
              </div>
              <CardTitle>Verify Your Email</CardTitle>
              <p className="text-xs text-zinc-400 mt-1.5 leading-normal">
                To keep your orders secure and share read-only tracking URLs, please log in with a passwordless email verification code.
              </p>
            </CardHeader>
            <CardContent>
              {authStep === 'email' ? (
                <form onSubmit={handleSendOTP} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="auth-email">Email Address</Label>
                    <div className="relative">
                      <Input
                        id="auth-email"
                        type="email"
                        placeholder="you@example.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="pl-10"
                        required
                      />
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                    </div>
                  </div>
                  {authError && (
                    <div className="text-xs text-rose-500 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {authError}
                    </div>
                  )}
                  <Button type="submit" className="w-full" isLoading={isAuthLoading}>
                    Send Verification Code
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="auth-code">6-Digit Code</Label>
                      <button
                        type="button"
                        onClick={() => setAuthStep('email')}
                        className="text-xs text-zinc-500 hover:text-zinc-800 underline"
                      >
                        Change Email
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="auth-code"
                        type="text"
                        placeholder="123456"
                        maxLength={6}
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        className="pl-10 text-center tracking-widest font-mono text-lg"
                        required
                      />
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-normal mt-1">
                      Code generated! Check your terminal server logs for the simulated OTP code.
                    </p>
                  </div>
                  {authError && (
                    <div className="text-xs text-rose-500 font-medium flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> {authError}
                    </div>
                  )}
                  <Button type="submit" className="w-full animate-pulse" isLoading={isAuthLoading}>
                    Verify & Continue
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Shipping address form */}
          <div className="lg:col-span-7">
            <Card className="border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-base font-bold">Shipping Address</CardTitle>
                <p className="text-xs text-zinc-400 mt-1">
                  Enter your physical address details. We currently ship to India only.
                </p>
              </CardHeader>
              <CardContent>
                <form id="checkout-form" onSubmit={handleSubmit(onSubmitAddress)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" {...register('name')} error={errors.name?.message} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" {...register('email')} disabled className="opacity-70 cursor-not-allowed bg-zinc-50 dark:bg-zinc-900" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="phone">Phone Number (10 digits)</Label>
                      <Input id="phone" placeholder="9876543210" {...register('phone')} error={errors.phone?.message} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" value="India" disabled className="opacity-70 cursor-not-allowed bg-zinc-50 dark:bg-zinc-900" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="line1">Address Line 1</Label>
                    <Input id="line1" placeholder="Flat, House no., Building, Company, Apartment" {...register('line1')} error={errors.line1?.message} />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="line2">Address Line 2 (Optional)</Label>
                    <Input id="line2" placeholder="Area, Street, Sector, Village" {...register('line2')} error={errors.line2?.message} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" {...register('city')} error={errors.city?.message} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="state">State</Label>
                      <Input id="state" {...register('state')} error={errors.state?.message} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pinCode">PIN Code (6 digits)</Label>
                      <Input id="pinCode" placeholder="400001" maxLength={6} {...register('pinCode')} error={errors.pinCode?.message} />
                    </div>
                  </div>

                  <Separator className="my-6 bg-zinc-100 dark:bg-zinc-800" />

                  {/* Payment Method */}
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Payment Method</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer select-none transition-all duration-200 ${
                          paymentMethod === 'COD'
                            ? 'border-zinc-950 bg-zinc-50/50 dark:border-zinc-50 dark:bg-zinc-900/40'
                            : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/20'
                        }`}
                        onClick={() => {
                          setPaymentMethod('COD');
                          setValue('paymentMethod', 'COD');
                        }}
                      >
                        <input
                          type="radio"
                          name="payMethod"
                          checked={paymentMethod === 'COD'}
                          onChange={() => {}}
                          className="sr-only"
                        />
                        <Truck className="h-5 w-5 text-zinc-500" />
                        <div>
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Cash on Delivery</p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Pay in cash upon physical delivery.</p>
                        </div>
                      </label>

                      <label
                        className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer select-none transition-all duration-200 ${
                          paymentMethod === 'RAZORPAY'
                            ? 'border-zinc-950 bg-zinc-50/50 dark:border-zinc-50 dark:bg-zinc-900/40'
                            : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/20'
                        }`}
                        onClick={() => {
                          setPaymentMethod('RAZORPAY');
                          setValue('paymentMethod', 'RAZORPAY');
                        }}
                      >
                        <input
                          type="radio"
                          name="payMethod"
                          checked={paymentMethod === 'RAZORPAY'}
                          onChange={() => {}}
                          className="sr-only"
                        />
                        <Landmark className="h-5 w-5 text-zinc-500" />
                        <div>
                          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Razorpay Online</p>
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">UPI, Cards, Netbanking.</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Cart summary */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" /> Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* List items */}
                <div className="max-h-60 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900 pr-1">
                  {items.map((item) => (
                    <div key={item.product.id} className="flex justify-between items-center py-2.5">
                      <div className="flex gap-2">
                        <span className="text-xs font-bold text-zinc-400 shrink-0 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded">
                          {item.quantity}x
                        </span>
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 line-clamp-1">
                          {item.product.title}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 pl-3">
                        {formatCurrency(item.product.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <Separator className="bg-zinc-100 dark:bg-zinc-800" />

                {/* Subtotals */}
                <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatCurrency(cartSubtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span className="text-emerald-600 font-semibold uppercase">Free</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Taxes</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">Included</span>
                  </div>
                </div>

                <Separator className="bg-zinc-100 dark:bg-zinc-800" />

                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Total Amount</span>
                  <span className="text-lg font-extrabold text-zinc-950 dark:text-zinc-50">
                    {formatCurrency(cartSubtotal)}
                  </span>
                </div>

                {/* CTA Button */}
                <Button
                  type="submit"
                  form="checkout-form"
                  className="w-full mt-4 cursor-pointer"
                  isLoading={isPlacingOrder}
                >
                  {paymentMethod === 'COD' ? 'Confirm COD Order' : 'Proceed to Razorpay Payment'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Razorpay Simulation Dialog */}
      <Dialog open={showRazorpaySim} onClose={handleSimulatePaymentFailure}>
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/20 mb-2">
            <Landmark className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <DialogTitle className="text-center text-zinc-900 dark:text-zinc-50">
            Razorpay Sandbox Simulator
          </DialogTitle>
          <DialogDescription className="text-center text-xs text-zinc-400">
            Review your order payment. This simulates Razorpay's secure SDK.
          </DialogDescription>
        </DialogHeader>

        <DialogContent className="space-y-4">
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-100 dark:border-zinc-900 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-400">Merchant:</span>
              <span className="font-bold text-zinc-800 dark:text-zinc-200">Vero Goods India</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Order Number:</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {simulatedOrderInfo?.orderNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Razorpay Order:</span>
              <span className="font-mono text-zinc-800 dark:text-zinc-200">
                rzp_order_{simulatedOrderInfo?.orderId}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-zinc-200 dark:border-zinc-850">
              <span className="text-zinc-950 dark:text-zinc-50 font-bold text-sm">Payable:</span>
              <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                {simulatedOrderInfo ? formatCurrency(simulatedOrderInfo.amount) : '₹0'}
              </span>
            </div>
          </div>
          
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-normal text-center bg-blue-50/20 p-2 rounded">
            Clicking <b>Simulate Success</b> fires the server-side callback to verify the signature, records Razorpay transaction IDs, and sets order status to PLACED.
          </p>
        </DialogContent>

        <DialogFooter>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button
              onClick={handleSimulatePaymentFailure}
              variant="outline"
              className="flex-1 cursor-pointer"
              disabled={isSimulatingPayment}
            >
              Cancel Payment
            </Button>
            <Button
              onClick={handleSimulatePaymentSuccess}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
              isLoading={isSimulatingPayment}
            >
              Simulate Success
            </Button>
          </div>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
