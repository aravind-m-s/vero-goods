'use client';

import React, { useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ChevronRight, ShoppingBag, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const orderNumber = searchParams.get('orderNumber');

  useEffect(() => {
    // Fire confetti celebration on mount!
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#000000', '#777777', '#bbbbbb']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#000000', '#777777', '#bbbbbb']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  }, []);

  return (
    <div className="max-w-md mx-auto w-full my-12 px-4 text-center space-y-6">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-10 w-10 animate-bounce" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          Order confirmed!
        </h1>
        {orderNumber && (
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Order #{orderNumber}
          </p>
        )}
        <p className="text-xs text-zinc-400 leading-normal max-w-xs mx-auto">
          Thank you for shopping with Vero Goods. Your order is pending verification and will be processed shortly. We've sent a confirmation email to your address.
        </p>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 bg-white dark:bg-zinc-950/40 text-left space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">What's Next?</h3>
        
        <div className="flex gap-3 text-xs leading-normal">
          <Truck className="h-5 w-5 text-zinc-400 shrink-0" />
          <div>
            <p className="font-semibold text-zinc-850 dark:text-zinc-300">Track Order Progress</p>
            <p className="text-zinc-400 mt-0.5">Use your secure token URL to inspect delivery fulfillment status at any time.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2">
        {token && (
          <Link href={`/order/track/${token}`} className="w-full">
            <Button className="w-full gap-1 cursor-pointer">
              Track Order <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
        <Link href="/" className="w-full">
          <Button variant="outline" className="w-full gap-1.5 cursor-pointer">
            <ShoppingBag className="h-4 w-4" /> Continue Shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto w-full my-20 text-center text-sm text-zinc-500">
        Loading confirmation...
      </div>
    }>
      <SuccessPageContent />
    </Suspense>
  );
}
