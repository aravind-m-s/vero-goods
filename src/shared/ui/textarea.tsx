import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error, id, ...props },
  ref
) {
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <div className="flex w-full flex-col gap-1">
      <textarea
        id={id}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={cn(
          'w-full rounded-control border bg-surface-raised px-3 py-2 text-sm leading-relaxed text-ink',
          'placeholder:text-ink-subtle transition-colors duration-150',
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
