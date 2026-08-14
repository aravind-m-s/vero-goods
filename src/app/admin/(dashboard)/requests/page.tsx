'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, HandHeart, Mail, Phone } from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Select } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { useToast } from '@/shared/ui/toast';
import { ProductRequestStatus, type ProductRequest } from '@/features/requests/types';

const STATUS_VARIANT: Record<ProductRequestStatus, 'warning' | 'info' | 'success' | 'secondary'> = {
  [ProductRequestStatus.NEW]: 'warning',
  [ProductRequestStatus.SOURCING]: 'info',
  [ProductRequestStatus.RESTOCKED]: 'success',
  [ProductRequestStatus.DECLINED]: 'secondary',
};

const STATUS_LABEL: Record<ProductRequestStatus, string> = {
  [ProductRequestStatus.NEW]: 'New',
  [ProductRequestStatus.SOURCING]: 'Sourcing',
  [ProductRequestStatus.RESTOCKED]: 'Restocked',
  [ProductRequestStatus.DECLINED]: 'Declined',
};

/**
 * Demand inbox: every "Get it for me" a customer sent from an out-of-stock
 * product page. Sorted newest first, because the freshest signal is the one
 * worth acting on.
 */
export default function AdminRequestsPage() {
  const { success, error } = useToast();
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/product-requests?status=${statusFilter}`);
      if (!response.ok) {
        error('Could not load sourcing requests');
        return;
      }
      const data = (await response.json()) as {
        requests: ProductRequest[];
        total: number;
        newCount: number;
      };
      setRequests(data.requests);
      setTotal(data.total);
      setNewCount(data.newCount);
    } catch {
      error('Network error loading requests');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, error]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const setStatus = async (request: ProductRequest, status: ProductRequestStatus) => {
    setUpdatingId(request.id);
    try {
      const response = await fetch(`/api/admin/product-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as { error?: string; request?: ProductRequest };
      if (!response.ok || !data.request) {
        error(data.error ?? 'Could not update the request');
        return;
      }
      const updated = data.request;
      setRequests((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setNewCount((count) =>
        request.status === ProductRequestStatus.NEW && status !== ProductRequestStatus.NEW
          ? Math.max(0, count - 1)
          : count
      );
      success(`Marked as ${STATUS_LABEL[status].toLowerCase()}`);
    } catch {
      error('Network error');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink">
            <HandHeart className="h-5 w-5 text-ink-subtle" /> Sourcing requests
          </h1>
          <p className="mt-1 text-xs text-ink-subtle">
            {total} request{total === 1 ? '' : 's'} · {newCount} awaiting review
          </p>
        </div>
        <div className="sm:w-52">
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="ALL">All statuses</option>
            {Object.values(ProductRequestStatus).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <HandHeart className="mx-auto h-6 w-6 text-ink-subtle" />
            <p className="mt-2 text-sm font-bold text-ink">No requests yet</p>
            <p className="mt-1 text-xs text-ink-subtle">
              When a customer taps &ldquo;Get it for me&rdquo; on an out-of-stock product, it
              appears here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Card>
                <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_VARIANT[request.status]}>
                        {STATUS_LABEL[request.status]}
                      </Badge>
                      <span className="text-sm font-bold text-ink">
                        {request.quantity} × {request.productTitle}
                      </span>
                      {request.variantName && request.variantName !== 'Default' && (
                        <span className="text-xs text-ink-muted">{request.variantName}</span>
                      )}
                      <Link
                        href={`/products/${request.productSlug}`}
                        target="_blank"
                        className="flex items-center gap-1 text-2xs text-ink-subtle hover:text-accent"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>

                    <p className="text-xs font-semibold text-ink-muted">{request.customerName}</p>
                    <p className="flex flex-wrap items-center gap-3 text-2xs text-ink-subtle">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" /> +{request.phone}
                      </span>
                      {request.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {request.email}
                        </span>
                      )}
                      {request.sku && <span className="font-mono">{request.sku}</span>}
                      <span>
                        {new Date(request.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </p>

                    {request.note && (
                      <p className="mt-1 rounded-control bg-surface-sunken p-2 text-xs italic text-ink-muted">
                        “{request.note}”
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {request.status !== ProductRequestStatus.SOURCING && (
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={updatingId === request.id}
                        onClick={() => setStatus(request, ProductRequestStatus.SOURCING)}
                      >
                        Sourcing
                      </Button>
                    )}
                    {request.status !== ProductRequestStatus.RESTOCKED && (
                      <Button
                        size="sm"
                        variant="outline"
                        isLoading={updatingId === request.id}
                        onClick={() => setStatus(request, ProductRequestStatus.RESTOCKED)}
                      >
                        Restocked
                      </Button>
                    )}
                    {request.status !== ProductRequestStatus.DECLINED && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger"
                        isLoading={updatingId === request.id}
                        onClick={() => setStatus(request, ProductRequestStatus.DECLINED)}
                      >
                        Decline
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
