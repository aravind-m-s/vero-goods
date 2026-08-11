import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
}

const VARIANTS: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-surface-inverse text-ink-inverse',
  secondary: 'bg-surface-sunken text-ink-muted border border-line',
  outline: 'border border-line-strong text-ink-muted',
  accent: 'bg-accent text-on-accent',
  success: 'bg-success-soft text-success border border-success-border',
  warning: 'bg-warning-soft text-warning border border-warning-border',
  danger: 'bg-danger-soft text-danger border border-danger-border',
  info: 'bg-accent-soft text-accent-ink border border-accent-border',
};

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex select-none items-center gap-1 rounded-full px-2.5 py-0.5',
        'text-2xs font-semibold uppercase tracking-wide',
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
