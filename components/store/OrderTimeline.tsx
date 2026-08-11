import React from 'react';
import { Check, Truck, Package, ShoppingBag, ClipboardCheck, Navigation, Gift, XCircle } from 'lucide-react';
import { OrderStatus } from '../../lib/db/types';
import { cn } from '../../lib/utils';

interface OrderTimelineProps {
  status: OrderStatus;
}

interface Step {
  key: OrderStatus;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function OrderTimeline({ status }: OrderTimelineProps) {
  const steps: Step[] = [
    {
      key: OrderStatus.PLACED,
      label: 'Order Placed',
      description: 'Your order has been registered in our system.',
      icon: ShoppingBag,
    },
    {
      key: OrderStatus.CONFIRMED,
      label: 'Confirmed',
      description: 'The store has accepted and confirmed your order.',
      icon: ClipboardCheck,
    },
    {
      key: OrderStatus.PACKED,
      label: 'Packed',
      description: 'Your items have been safely packed and labelled.',
      icon: Package,
    },
    {
      key: OrderStatus.SHIPPED,
      label: 'Shipped',
      description: 'The package has been handed over to the courier.',
      icon: Truck,
    },
    {
      key: OrderStatus.OUT_FOR_DELIVERY,
      label: 'Out for Delivery',
      description: 'A delivery executive is bringing the package to your address.',
      icon: Navigation,
    },
    {
      key: OrderStatus.DELIVERED,
      label: 'Delivered',
      description: 'Order successfully delivered to your doorstep.',
      icon: Gift,
    },
  ];

  // If order is cancelled, we handle the timeline differently
  const isCancelled = status === OrderStatus.CANCELLED;

  // Determine current step index
  const currentStepIndex = steps.findIndex((step) => step.key === status);

  return (
    <div className="py-6">
      {isCancelled ? (
        <div className="flex gap-4 p-4 rounded-lg bg-rose-50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30">
          <XCircle className="h-6 w-6 text-rose-600 dark:text-rose-400 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-rose-800 dark:text-rose-400">Order Cancelled</h4>
            <p className="text-xs text-rose-600 dark:text-rose-400/80 mt-0.5 leading-normal">
              This order has been cancelled and will not be processed further. If you were charged, a refund will be initiated.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative pl-8 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-100 dark:before:bg-zinc-800">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const StepIcon = step.icon;

            return (
              <div key={step.key} className="relative group">
                {/* Step Circle Indicator */}
                <div
                  className={cn(
                    'absolute -left-8 top-0.5 h-6 w-6 rounded-full border flex items-center justify-center transition-all duration-300 z-10',
                    isCompleted && 'bg-zinc-950 border-zinc-950 text-white dark:bg-zinc-50 dark:border-zinc-50 dark:text-zinc-950',
                    isCurrent && 'bg-white border-zinc-950 text-zinc-950 dark:bg-zinc-900 dark:border-zinc-50 dark:text-zinc-50 scale-110 shadow-sm',
                    !isCompleted && !isCurrent && 'bg-white border-zinc-200 text-zinc-400 dark:bg-zinc-950 dark:border-zinc-800'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  ) : (
                    <StepIcon className="h-3.5 w-3.5" />
                  )}
                </div>

                {/* Content */}
                <div>
                  <h4
                    className={cn(
                      'text-sm font-semibold transition-colors duration-300',
                      isCompleted && 'text-zinc-500 dark:text-zinc-400',
                      isCurrent && 'text-zinc-950 dark:text-zinc-50',
                      !isCompleted && !isCurrent && 'text-zinc-400 dark:text-zinc-600'
                    )}
                  >
                    {step.label}
                  </h4>
                  <p
                    className={cn(
                      'text-xs mt-1 leading-normal transition-colors duration-300',
                      isCompleted && 'text-zinc-400 dark:text-zinc-500',
                      isCurrent && 'text-zinc-600 dark:text-zinc-300',
                      !isCompleted && !isCurrent && 'text-zinc-300 dark:text-zinc-700'
                    )}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
