'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Copy,
  ExternalLink,
  Eye,
  CheckCircle2,
  XCircle,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { Product } from '@/lib/db/types';

export default function AdminProductsPage() {
  const { success, error } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Deletion Dialog State
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      } else {
        error('Failed to load products');
      }
    } catch (e) {
      error('Network error loading products');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Copy Product URL
  const handleCopyUrl = (slug: string) => {
    const url = `${window.location.origin}/products/${slug}`;
    navigator.clipboard.writeText(url)
      .then(() => {
        success('Product URL copied');
      })
      .catch(() => {
        error('Failed to copy product URL');
      });
  };

  // Toggle Active/Inactive
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !currentStatus }),
      });

      if (res.ok) {
        success(`Product ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, isActive: !currentStatus } : p))
        );
      } else {
        error('Failed to update product status');
      }
    } catch (e) {
      error('Error updating status');
    }
  };

  // Confirm Delete
  const triggerDeleteConfirm = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/products?id=${productToDelete.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        success(`Product deleted successfully`);
        setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
        setDeleteDialogOpen(false);
      } else {
        error('Failed to delete product');
      }
    } catch (e) {
      error('Error deleting product');
    } finally {
      setIsDeleting(false);
      setProductToDelete(null);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.slug.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && p.isActive) ||
      (statusFilter === 'INACTIVE' && !p.isActive);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Store Catalog
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Create, edit, delete, and copy public storefront product URLs.
          </p>
        </div>
        <Link href="/admin/products/new">
          <Button className="gap-1.5 cursor-pointer font-bold size-sm sm:size-md">
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </Link>
      </div>

      {/* Filter Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-center bg-white dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs">
        <div className="relative w-full sm:flex-1">
          <Input
            type="text"
            placeholder="Search products by title or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="h-9 text-xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </Select>
        </div>
      </div>

      {/* Product List Table */}
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="py-20 text-center text-sm text-zinc-500 animate-pulse">
            Loading catalog products...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center text-sm text-zinc-500">
            No products match the selected filters.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Info</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Created Date</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((p) => (
                <TableRow key={p.id} className="hover:bg-zinc-50/40">
                  <TableCell className="font-medium flex items-center gap-3">
                    <div className="h-10 w-10 rounded border border-zinc-150 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-900 overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        src={p.id === 'p-1' ? 'https://images.unsplash.com/photo-1615840287214-7fe58a8e668f?w=100&auto=format&fit=crop&q=80' : 
                             p.id === 'p-2' ? 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=100&auto=format&fit=crop&q=80' : 
                             p.id === 'p-3' ? 'https://images.unsplash.com/photo-1608156639585-b3a032ef9689?w=100&auto=format&fit=crop&q=80' : 
                             p.id === 'p-4' ? 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=100&auto=format&fit=crop&q=80' : 
                             p.id === 'p-5' ? 'https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?w=100&auto=format&fit=crop&q=80' : 
                             'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=100&auto=format&fit=crop&q=80'}
                        alt={p.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-zinc-50 text-xs line-clamp-1">{p.title}</div>
                      <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{p.slug}</div>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(p.price)}
                    {p.compareAtPrice && p.compareAtPrice > p.price && (
                      <div className="text-[10px] text-zinc-400 line-through font-normal">
                        {formatCurrency(p.compareAtPrice)}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    <button
                      onClick={() => handleToggleActive(p.id, p.isActive)}
                      title={`Click to ${p.isActive ? 'Deactivate' : 'Activate'}`}
                      className="cursor-pointer"
                    >
                      <Badge variant={p.isActive ? 'success' : 'secondary'}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </button>
                  </TableCell>

                  <TableCell className="hidden lg:table-cell text-xs text-zinc-500 font-medium">
                    {new Date(p.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5 pr-2">
                      {/* Copy URL */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyUrl(p.slug)}
                        title="Copy Store URL"
                        className="h-8 w-8 p-0 cursor-pointer"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>

                      {/* View Storefront */}
                      <Link href={`/products/${p.slug}`} target="_blank">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View on Storefront"
                          className="h-8 w-8 p-0 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </Link>

                      {/* Edit */}
                      <Link href={`/admin/products/${p.id}/edit`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Edit Details"
                          className="h-8 w-8 p-0 cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </Link>

                      {/* Delete */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => triggerDeleteConfirm(p)}
                        title="Delete Product"
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/20 mb-2">
            <Trash2 className="h-6 w-6 text-rose-600" />
          </div>
          <DialogTitle className="text-center">Confirm Deletion</DialogTitle>
          <DialogDescription className="text-center text-xs">
            Are you sure you want to delete this product?
          </DialogDescription>
        </DialogHeader>

        <DialogContent className="py-2 text-center text-xs">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
            "{productToDelete?.title}"
          </p>
          <p className="text-zinc-400 mt-2 leading-relaxed">
            This action is permanent and will delete the product, its thumbnails, and its technical details tables from the database. Existing customer orders containing this product will remain unaffected.
          </p>
        </DialogContent>

        <DialogFooter>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              variant="outline"
              className="flex-1 cursor-pointer"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteProduct}
              variant="danger"
              className="flex-1 cursor-pointer"
              isLoading={isDeleting}
            >
              Confirm Delete
            </Button>
          </div>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
