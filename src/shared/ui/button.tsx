import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** `accent` is the money button — add to cart, pay, place order. Use it once per view. */
  variant?: 'accent' | 'default' | 'outline' | 'secondary' | 'ghost' | 'danger' | 'link';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  accent:
    'bg-accent text-on-accent hover:bg-accent-hover shadow-card active:translate-y-px',
  default:
    'bg-surface-inverse text-ink-inverse hover:opacity-90 shadow-card active:translate-y-px',
  outline:
    'border border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken hover:border-ink-subtle',
  secondary: 'bg-surface-sunken text-ink hover:bg-line',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-danger text-white hover:opacity-90 shadow-card active:translate-y-px',
  link: 'text-accent underline underline-offset-4 hover:text-accent-hover',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
  lg: 'h-12 gap-2 px-6 text-sm',
  icon: 'h-9 w-9',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'default', size = 'md', isLoading, children, disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      // aria-busy tells assistive tech the control is working, which the
      // spinner alone does not.
      aria-busy={isLoading || undefined}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center rounded-control font-semibold',
        'transition-[background-color,border-color,color,opacity,transform] duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {isLoading && (
        <svg
          className="h-4 w-4 animate-spin text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
});
