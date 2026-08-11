import React from 'react';
import { cn } from '@/shared/lib/utils';

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...props },
  ref
) {
  return (
    <label
      ref={ref}
      className={cn(
        'cursor-pointer select-none text-xs font-semibold leading-none text-ink-muted',
        className
      )}
      {...props}
    />
  );
});
