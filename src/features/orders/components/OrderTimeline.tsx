import React from 'react';
import { Check, Truck, Package, ShoppingBag, ClipboardCheck, Navigation, Gift, RotateCcw, XCircle } from 'lucide-react';
import { OrderStatus, type OrderStatusEvent } from '@/features/orders/types';
import { cn } from '@/shared/lib/utils';

interface OrderTimelineProps {
  status: OrderStatus;
  /** Timestamps for the steps already reached, newest write wins. */
  history?: OrderStatusEvent[];
}

interface Step {
  key: OrderStatus;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function OrderTimeline({ status, history = [] }: OrderTimelineProps) {
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
  const isReturn = status === OrderStatus.RETURN_REQUESTED || status === OrderStatus.RETURNED;

  // Determine current step index. Return states sit after delivery, so the
  // whole fulfilment timeline stays complete behind the return notice.
  const currentStepIndex = isReturn
    ? steps.length - 1
    : steps.findIndex((step) => step.key === status);

  const reachedAt = (key: OrderStatus): string | undefined => {
    const event = history.find((item) => item.status === key);
    return event
      ? new Date(event.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      : undefined;
  };

  return (
    <div className="py-6">
      {isReturn && (
        <div className="mb-6 flex gap-4 rounded-lg border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-950/20">
          <RotateCcw className="h-6 w-6 shrink-0 text-warning" />
          <div>
            <h4 className="text-sm font-bold text-warning">
              {status === OrderStatus.RETURNED ? 'Order returned' : 'Return requested'}
            </h4>
            <p className="mt-0.5 text-xs leading-normal text-warning">
              {status === OrderStatus.RETURNED
                ? 'We have received the returned items and your refund is being processed.'
                : 'We have logged your return request and will be in touch with pickup details.'}
            </p>
          </div>
        </div>
      )}
      {isCancelled ? (
        <div className="flex gap-4 p-4 rounded-lg bg-danger-soft border border-danger-border">
          <XCircle className="h-6 w-6 text-danger shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-danger">Order Cancelled</h4>
            <p className="text-xs text-danger/80 mt-0.5 leading-normal">
              This order has been cancelled and will not be processed further. If you were charged, a refund will be initiated.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative pl-8 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-line">
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
                    isCompleted && 'bg-accent border-accent text-on-accent',
                    isCurrent && 'bg-surface-raised border-accent text-accent scale-110 shadow-card',
                    !isCompleted && !isCurrent && 'bg-surface-raised border-line text-ink-subtle'
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
                      isCompleted && 'text-ink-muted',
                      isCurrent && 'text-ink',
                      !isCompleted && !isCurrent && 'text-ink-subtle'
                    )}
                  >
                    {step.label}
                    {reachedAt(step.key) && (
                      <span className="ml-2 text-2xs font-normal text-ink-subtle">
                        {reachedAt(step.key)}
                      </span>
                    )}
                  </h4>
                  <p
                    className={cn(
                      'text-xs mt-1 leading-normal transition-colors duration-300',
                      isCompleted && 'text-ink-subtle',
                      isCurrent && 'text-ink-muted',
                      !isCompleted && !isCurrent && 'text-ink-subtle'
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
