'use client';

import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import confetti from 'canvas-confetti';
import { CheckCircle2, ChevronRight, Mail, ShoppingBag, Truck } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';

function SuccessContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const orderNumber = searchParams.get('orderNumber');

  useEffect(() => {
    // Skip the celebration for anyone who has asked the OS to reduce motion.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const end = Date.now() + 2000;
    const colors = ['#ea580c', '#fb923c', '#18181b'];

    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, []);

  return (
    <div className="mx-auto my-12 w-full max-w-md space-y-6 px-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckCircle2 className="h-9 w-9" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Order confirmed</h1>
        {orderNumber && (
          <p className="font-mono text-sm font-semibold text-accent">#{orderNumber}</p>
        )}
        <p className="mx-auto max-w-xs text-xs leading-relaxed text-ink-subtle">
          Thanks for shopping with Vero Goods. We&apos;ve emailed your confirmation and tracking
          link, and we&apos;ll keep you posted at every step.
        </p>
      </div>

      <Card className="text-left">
        <CardContent className="space-y-4 p-5">
          <NextStep
            icon={Mail}
            title="Check your inbox"
            body="Your confirmation email contains the invoice summary and tracking link."
          />
          <NextStep
            icon={Truck}
            title="Track anytime"
            body="The tracking page is read-only and shareable — no login needed."
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {token && (
          <Link href={`/order/track/${token}`} className="w-full">
            <Button variant="accent" size="lg" className="w-full">
              Track your order <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
        <Link href="/" className="w-full">
          <Button variant="outline" className="w-full">
            <ShoppingBag className="h-4 w-4" /> Continue shopping
          </Button>
        </Link>
      </div>
    </div>
  );
}

function NextStep({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
      <div>
        <p className="text-xs font-semibold text-ink">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-subtle">{body}</p>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={<div className="my-20 text-center text-sm text-ink-subtle">Loading…</div>}
    >
      <SuccessContent />
    </Suspense>
  );
}
