import React from 'react';
import { cn } from '@/shared/lib/utils';

/** Wide tables scroll inside their own container rather than the page body. */
export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  function Table({ className, ...props }, ref) {
    return (
      <div className="w-full overflow-x-auto">
        <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
      </div>
    );
  }
);

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableHeader({ className, ...props }, ref) {
  return <thead ref={ref} className={cn('[&_tr]:border-b [&_tr]:border-line', className)} {...props} />;
});

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
});

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn('border-t border-line bg-surface-sunken font-semibold', className)}
      {...props}
    />
  );
});

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn('border-b border-line transition-colors hover:bg-surface-sunken', className)}
      {...props}
    />
  );
});

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(function TableHead({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      scope="col"
      className={cn(
        'h-10 px-4 text-left align-middle text-2xs font-semibold uppercase tracking-wide text-ink-subtle',
        className
      )}
      {...props}
    />
  );
});

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(function TableCell({ className, ...props }, ref) {
  return <td ref={ref} className={cn('px-4 py-3 align-middle', className)} {...props} />;
});

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(function TableCaption({ className, ...props }, ref) {
  return <caption ref={ref} className={cn('mt-3 text-xs text-ink-subtle', className)} {...props} />;
});
