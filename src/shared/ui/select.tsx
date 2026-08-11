import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, error, id, children, ...props },
  ref
) {
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="relative flex items-center">
        <select
          id={id}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={cn(
            'h-10 w-full cursor-pointer appearance-none rounded-control border bg-surface-raised',
            'px-3 pr-9 text-sm text-ink transition-colors duration-150',
            'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-danger' : 'border-line-strong hover:border-ink-subtle',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-ink-subtle" />
      </div>
      {error && (
        <span id={errorId} className="text-xs font-medium text-danger">
          {error}
        </span>
      )}
    </div>
  );
});
