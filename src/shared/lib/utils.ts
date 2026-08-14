import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Class-name joiner that resolves Tailwind conflicts.
 *
 * Plain string concatenation is not enough: a component's default padding and a
 * caller's override both end up in `class`, and the winner is decided by the
 * order the utilities happen to sit in the generated stylesheet, not by the
 * order they were written. That is how `<CardContent className="p-5">` ended up
 * with no top padding at all — the component's own `pt-0` outranked it.
 *
 * `twMerge` keeps the last value written for each property group, which is what
 * anyone passing a className expects.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Money formatting lives in `lib/money.ts` — everything monetary is an integer
// number of paise, so `formatMinor` is the only correct formatter.
