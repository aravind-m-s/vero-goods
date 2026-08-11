import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, id, 'aria-describedby': describedBy, ...props },
  ref
) {
  // Wire the message to the field so screen readers announce it, and mark the
  // field invalid rather than relying on colour alone.
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <div className="flex w-full flex-col gap-1">
      <input
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={[describedBy, errorId].filter(Boolean).join(' ') || undefined}
        className={cn(
          'h-10 w-full rounded-control border bg-surface-raised px-3 text-sm text-ink',
          'placeholder:text-ink-subtle',
          'transition-colors duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-danger' : 'border-line-strong hover:border-ink-subtle',
          className
        )}
        {...props}
      />
      {error && (
        <span id={errorId} className="text-xs font-medium text-danger">
          {error}
        </span>
      )}
    </div>
  );
});
