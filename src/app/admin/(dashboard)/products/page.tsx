'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { SafeImage as Image } from '@/shared/ui/safe-image';
import Link from 'next/link';
import {
  Archive,
  ArchiveRestore,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLink,
  DropdownMenuSeparator,
} from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { useToast } from '@/shared/ui/toast';
import { useRowNavigation } from '@/shared/ui/use-row-navigation';
import { formatMinor } from '@/shared/lib/money';

interface AdminProductRow {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  variantCount: number;
  totalStock: number;
  fromPriceMinor: number;
  costPriceMinor: number;
  imageUrl?: string;
  updatedAt: string;
  /** Present only on retired products. Absent means never archived. */
  archivedAt?: string;
  /** Reporting window is the API's `windowDays`. */
  views: number;
  uniqueViewers: number;
  orderCount: number;
}

/**
 * `LIVE` is everything not archived — active and hidden together. It is the
 * default because it is the working catalogue; `ALL` exists for when you know
 * you are looking for something retired.
 */
type StatusFilter = 'LIVE' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | 'ALL';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'LIVE', label: 'Not archived' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Hidden' },
  { value: 'ARCHIVED', label: 'Archived' },
  { value: 'ALL', label: 'All including archived' },
];

function matchesStatus(product: AdminProductRow, filter: StatusFilter): boolean {
  const archived = Boolean(product.archivedAt);
  switch (filter) {
    case 'LIVE':
      return !archived;
    case 'ACTIVE':
      return product.isActive && !archived;
    case 'INACTIVE':
      return !product.isActive && !archived;
    case 'ARCHIVED':
      return archived;
    case 'ALL':
      return true;
  }
}

/**
 * Orders per unique viewer, as a percentage.
 *
 * Deliberately per *viewer* and not per view: three reloads by one shopper is
 * one person deciding, and dividing by raw views would make every product that
 * people revisit look like it converts badly.
 */
function conversionPercent(product: AdminProductRow): number | null {
  if (product.uniqueViewers === 0) return null;
  return Math.round((product.orderCount / product.uniqueViewers) * 100);
}

export default function AdminProductsPage() {
  const { success, error } = useToast();
  const rowNavigation = useRowNavigation();
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [windowDays, setWindowDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  // Archived products are excluded by default — that is what archiving them
  // meant. They stay one filter away rather than being deleted, because
  // invoices and past orders still resolve through them.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('LIVE');
  const [toArchive, setToArchive] = useState<AdminProductRow | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [toDelete, setToDelete] = useState<AdminProductRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/admin/products');
        if (!response.ok) {
          if (!cancelled) error('Could not load products');
          return;
        }
        const data = (await response.json()) as {
          products: AdminProductRow[];
          windowDays?: number;
        };
        if (!cancelled) {
          setProducts(data.products);
          if (data.windowDays) setWindowDays(data.windowDays);
        }
      } catch {
        if (!cancelled) error('Network error loading products');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [error]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (!matchesStatus(product, statusFilter)) return false;
      if (!term) return true;
      return (
        product.title.toLowerCase().includes(term) || product.slug.toLowerCase().includes(term)
      );
    });
  }, [products, search, statusFilter]);

  const handleToggleActive = async (product: AdminProductRow) => {
    try {
      const response = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, isActive: !product.isActive }),
      });
      if (!response.ok) {
        error('Could not update the product');
        return;
      }
      setProducts((prev) =>
        prev.map((item) => (item.id === product.id ? { ...item, isActive: !item.isActive } : item))
      );
      success(product.isActive ? 'Hidden from storefront' : 'Published to storefront');
    } catch {
      error('Network error');
    }
  };

  const handleArchive = async () => {
    if (!toArchive) return;
    setIsArchiving(true);
    try {
      const response = await fetch(`/api/admin/products?id=${toArchive.id}`, { method: 'DELETE' });
      if (!response.ok) {
        error('Could not archive the product');
        return;
      }
      setProducts((prev) =>
        prev.map((item) =>
          item.id === toArchive.id
            ? { ...item, isActive: false, archivedAt: new Date().toISOString() }
            : item
        )
      );
      success(`${toArchive.title} archived`);
      setToArchive(null);
    } catch {
      error('Network error');
    } finally {
      setIsArchiving(false);
    }
  };

  /**
   * Comes back hidden, not live. Putting something retired months ago straight
   * onto the storefront — at whatever price it carried then — is a decision the
   * admin should make on purpose, in a second step.
   */
  const handleUnarchive = async (product: AdminProductRow) => {
    try {
      const response = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id, archived: false }),
      });
      if (!response.ok) {
        error('Could not restore the product');
        return;
      }
      setProducts((prev) =>
        prev.map((item) =>
          item.id === product.id ? { ...item, archivedAt: undefined, isActive: false } : item
        )
      );
      success(`${product.title} restored — still hidden, publish it when you are ready`);
    } catch {
      error('Network error');
    }
  };

  const closeDeleteDialog = () => {
    setToDelete(null);
    setDeleteConfirmText('');
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/products?id=${toDelete.id}&mode=delete`, {
        method: 'DELETE',
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        // 409 means order items still reference it — archiving is the way out.
        error(data.error ?? 'Could not delete the product');
        return;
      }
      setProducts((prev) => prev.filter((item) => item.id !== toDelete.id));
      success(`${toDelete.title} deleted permanently`);
      closeDeleteDialog();
    } catch {
      error('Network error');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyUrl = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/products/${slug}`);
      success('Product URL copied');
    } catch {
      error('Could not copy the URL');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            Products
          </h1>
          <p className="mt-1 text-xs text-ink-subtle">
            {products.length} product{products.length === 1 ? '' : 's'} · stock and margin per
            product, views and conversion over the last {windowDays} days
          </p>
        </div>
        <Link href="/admin/products/new">
          <Button className="gap-1.5">
            <Plus className="h-4 w-4" /> New product
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-ink-subtle" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by title or slug"
            className="pl-10"
          />
        </div>
        <div className="sm:w-48">
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* The dashboard shell is `bg-surface-sunken`, so a table with no surface
          of its own sat directly on the page tint. `bg-surface-raised` is the
          same token Card uses — white in light, #1a1a1f in dark — which is what
          makes the row hover (`bg-surface-sunken`) read as a change at all.
          `overflow-hidden` keeps the first and last rows inside the rounding. */}
      <div className="overflow-hidden rounded-card border border-line bg-surface-raised">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="text-right" title={`Last ${windowDays} days`}>
                Views
              </TableHead>
              <TableHead className="text-right" title={`Orders per unique viewer, last ${windowDays} days`}>
                Conv.
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-xs text-ink-subtle">
                  No products match your filters.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((product) => {
                const marginMinor = product.fromPriceMinor - product.costPriceMinor;
                const marginPercent =
                  product.fromPriceMinor > 0
                    ? Math.round((marginMinor / product.fromPriceMinor) * 100)
                    : 0;
                const conversion = conversionPercent(product);

                return (
                  <TableRow
                    key={product.id}
                    className="cursor-pointer"
                    {...rowNavigation(`/admin/products/${product.id}/edit`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.imageUrl && (
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-surface-sunken">
                            <Image
                              src={product.imageUrl}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{product.title}</p>
                          <p className="truncate font-mono text-3xs text-ink-subtle">
                            /{product.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-ink-muted">{product.variantCount}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`text-xs font-bold tabular-nums ${product.totalStock === 0
                          ? 'text-danger'
                          : product.totalStock <= 5
                            ? 'text-warning'
                            : 'text-ink-muted'
                          }`}
                      >
                        {product.totalStock}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold tabular-nums">
                      {formatMinor(product.fromPriceMinor)}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      <span className={marginMinor <= 0 ? 'text-danger' : 'text-success'}>
                        {formatMinor(marginMinor)}
                        <span className="ml-1 text-ink-subtle">({marginPercent}%)</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      <span className="font-semibold text-ink-muted">{product.views}</span>
                      <span className="ml-1 text-ink-subtle">
                        ({product.uniqueViewers} unique)
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold tabular-nums">
                      {conversion === null ? (
                        <span className="text-ink-subtle">—</span>
                      ) : (
                        <span
                          className={
                            conversion === 0
                              ? 'text-danger'
                              : conversion >= 5
                                ? 'text-success'
                                : 'text-ink-muted'
                          }
                          title={`${product.orderCount} order${product.orderCount === 1 ? '' : 's'} from ${product.uniqueViewers} viewer${product.uniqueViewers === 1 ? '' : 's'}`}
                        >
                          {conversion}%
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.archivedAt ? (
                        <Badge
                          variant="secondary"
                          title={`Archived ${new Date(product.archivedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}`}
                        >
                          Archived
                        </Badge>
                      ) : (
                        <Badge variant={product.isActive ? 'success' : 'secondary'}>
                          {product.isActive ? 'Active' : 'Hidden'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {/* Edit stays in reach because it is why you came to this
                          row. Everything rarer moves behind the menu, which is
                          what keeps Delete from sitting one stray click away
                          from it. */}
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/products/${product.id}/edit`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Edit2 className="h-3.5 w-3.5" /> Edit
                          </Button>
                        </Link>

                        <DropdownMenu label={`More actions for ${product.title}`}>
                          {/* Publishing an archived product straight to the
                              storefront would skip the decision to un-retire
                              it, so it is not offered until it leaves the
                              archive. */}
                          {!product.archivedAt && (
                            <DropdownMenuItem onSelect={() => handleToggleActive(product)}>
                              {product.isActive ? (
                                <>
                                  <EyeOff className="h-3.5 w-3.5 shrink-0" /> Hide from storefront
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3.5 w-3.5 shrink-0" /> Publish to storefront
                                </>
                              )}
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem onSelect={() => copyUrl(product.slug)}>
                            <Copy className="h-3.5 w-3.5 shrink-0" /> Copy product URL
                          </DropdownMenuItem>

                          <DropdownMenuLink href={`/products/${product.slug}`} external>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" /> View on storefront
                          </DropdownMenuLink>

                          <DropdownMenuSeparator />

                          {product.archivedAt ? (
                            <DropdownMenuItem onSelect={() => handleUnarchive(product)}>
                              <ArchiveRestore className="h-3.5 w-3.5 shrink-0 text-success" />{' '}
                              Restore from archive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => setToArchive(product)}>
                              <Archive className="h-3.5 w-3.5 shrink-0 text-warning" /> Archive
                            </DropdownMenuItem>
                          )}

                          <DropdownMenuItem
                            destructive
                            onSelect={() => {
                              setDeleteConfirmText('');
                              setToDelete(product);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 shrink-0" /> Delete permanently
                          </DropdownMenuItem>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={toArchive !== null} onClose={() => setToArchive(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {toArchive?.title}?</DialogTitle>
            <DialogDescription>
              The product comes off the storefront and out of this list. Nothing is deleted — past
              orders, invoices and returns still resolve through it, your variant settings are kept
              exactly as they are, and you can restore it from the Archived filter at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToArchive(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleArchive} isLoading={isArchiving}>
              Archive product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={toDelete !== null} onClose={closeDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {toDelete?.title} permanently?</DialogTitle>
            <DialogDescription>
              This removes the product, its {toDelete?.variantCount} variant
              {toDelete?.variantCount === 1 ? '' : 's'}, images and specifications from the
              database. It cannot be undone. Products that appear on any past order cannot be
              deleted — archive those instead.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pb-2">
            <p className="text-xs text-ink-muted">
              Type <span className="font-mono font-bold text-ink">{toDelete?.slug}</span> to
              confirm.
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              placeholder={toDelete?.slug}
              className="font-mono text-xs"
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDeleteDialog}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              isLoading={isDeleting}
              disabled={deleteConfirmText.trim() !== toDelete?.slug}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
