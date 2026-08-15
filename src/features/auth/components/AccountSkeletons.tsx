import React from 'react';
import { Card, CardContent, CardHeader } from '@/shared/ui/card';
import { Separator } from '@/shared/ui/separator';
import { Skeleton } from '@/shared/ui/skeleton';

/**
 * Placeholders for the account pages, one per route, used by their `loading.tsx`.
 *
 * Every page under /account is `force-dynamic`, so a click used to sit on a
 * server round trip — session cookie, then the page's own queries — before
 * anything on screen moved. These give the router something to commit to
 * immediately, which also makes the nav highlight react on the click rather
 * than when the data lands.
 *
 * They mirror the real layout closely enough that the content does not jump
 * when it replaces them: same card count, same rows, same fixed columns. Each
 * one returns a fragment, so the spacing comes from the account layout's
 * content column exactly as it does for the real pages.
 */

/** One summary tile. Also the Suspense fallback for the overview's data cards. */
export function SummaryCardSkeleton() {
  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-1.5 p-5">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-auto h-2.5 w-24" />
      </CardContent>
    </Card>
  );
}

/** Rows only — the card and its header render before the orders query lands. */
export function RecentOrderRowsSkeleton() {
  return (
    <ul className="divide-y divide-line">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AccountOverviewSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SummaryCardSkeleton key={i} />
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Separator className="bg-line" />
          <RecentOrderRowsSkeleton />
        </CardContent>
      </Card>
    </>
  );
}

export function ProfileSkeleton() {
  return (
    <>
      <Card>
        <CardHeader>
          <Skeleton className="h-3.5 w-32" />
        </CardHeader>
        <CardContent className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-24 shrink-0" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-3.5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-2.5 w-24" />
                <Skeleton className="h-3.5 w-44 max-w-full" />
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

export function AddressesSkeleton() {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-8 w-28 shrink-0" />
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <li key={i} className="flex h-full flex-col rounded-card border border-line p-4">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="mt-3 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="mt-4 flex gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function OrderHistorySkeleton() {
  return (
    <>
      <Skeleton className="h-3 w-36" />
      <ul className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <li key={i}>
            <Card>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-2.5 w-48 max-w-full" />
                  <Skeleton className="h-2.5 w-40 max-w-full" />
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
