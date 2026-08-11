import React from 'react';
import { cn } from '@/shared/lib/utils';

/** Shimmering placeholder. Always give it the size of the content it stands in for. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-control bg-line',
        className
      )}
      {...props}
    />
  );
}
