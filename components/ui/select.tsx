import React from 'react';
import { cn } from '../../lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
  label?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, label, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1 w-full relative">
        {label && <label className="text-sm font-medium text-zinc-900 dark:text-zinc-50 mb-1">{label}</label>}
        <div className="relative flex items-center">
          <select
            className={cn(
              'flex h-10 w-full appearance-none rounded-md border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:focus-visible:ring-zinc-300 duration-150 cursor-pointer',
              error && 'border-rose-500 focus-visible:ring-rose-500 dark:border-rose-500 dark:focus-visible:ring-rose-500',
              className
            )}
            ref={ref}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="absolute right-3 h-4 w-4 text-zinc-400 pointer-events-none" />
        </div>
        {error && <span className="text-xs text-rose-500 font-medium">{error}</span>}
      </div>
    );
  }
);

Select.displayName = 'Select';
