export function cn(...inputs: (string | undefined | null | boolean | number)[]) {
  return inputs.filter(Boolean).join(' ');
}

// Money formatting lives in `lib/money.ts` — everything monetary is an integer
// number of paise, so `formatMinor` is the only correct formatter.
