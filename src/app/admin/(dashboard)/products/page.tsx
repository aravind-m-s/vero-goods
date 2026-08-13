'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Archive, Copy, Edit2, ExternalLink, Eye, EyeOff, Plus, Search } from 'lucide-react';
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
}

export default function AdminProductsPage() {
  const { success, error } = useToast();
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [toArchive, setToArchive] = useState<AdminProductRow | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/admin/products');
        if (!response.ok) {
          if (!cancelled) error('Could not load products');
          return;
        }
        const data = (await response.json()) as { products: AdminProductRow[] };
        if (!cancelled) setProducts(data.products);
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
      if (statusFilter === 'ACTIVE' && !product.isActive) return false;
      if (statusFilter === 'INACTIVE' && product.isActive) return false;
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
        prev.map((item) => (item.id === toArchive.id ? { ...item, isActive: false } : item))
      );
      success(`${toArchive.title} archived`);
      setToArchive(null);
    } catch {
      error('Network error');
    } finally {
      setIsArchiving(false);
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
            {products.length} product{products.length === 1 ? '' : 's'} · stock and margin shown per
            product
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
            onChange={(event) =>
              setStatusFilter(event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')
            }
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Hidden</option>
          </Select>
        </div>
      </div>

      <div className="rounded-card border border-line">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Variants</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-xs text-ink-subtle">
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

                return (
                  <TableRow key={product.id}>
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
                    <TableCell>
                      <Badge variant={product.isActive ? 'success' : 'secondary'}>
                        {product.isActive ? 'Active' : 'Hidden'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          size="icon"
                          label={product.isActive ? 'Hide from storefront' : 'Publish'}
                          onClick={() => handleToggleActive(product)}
                        >
                          {product.isActive ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </IconButton>

                        <IconButton
                          size="icon"
                          label="Copy URL"
                          onClick={() => copyUrl(product.slug)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </IconButton>

                        <Link href={`/products/${product.slug}`} target="_blank">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-0"
                            title="View on storefront"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>

                        <Link href={`/admin/products/${product.id}/edit`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 p-0"
                            title="Edit"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        </Link>

                        <IconButton
                          size="icon"
                          label="Archive"
                          onClick={() => setToArchive(product)}
                        >
                          <Archive className="h-3.5 w-3.5 text-danger" />
                        </IconButton>
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
              The product is hidden from the storefront and all its variants stop selling. It is not
              deleted — past orders, invoices and returns still reference it.
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
    </div>
  );
}

function IconButton({
  label,
  size = 'l',
  onClick,
  children,
}: {
  label: string;
  size?: 'sm' | 'md' | 'l' | 'lg';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size={size}
      className="h-8 w-8 p-0"
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </Button>
  );
}