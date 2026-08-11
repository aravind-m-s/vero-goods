'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProductFormSchema } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { SpecificationBuilder, SpecSection } from '@/components/admin/SpecificationBuilder';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { z } from 'zod';

type ProductFormValues = z.infer<typeof ProductFormSchema>;

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default function EditProductPage({ params }: EditProductPageProps) {
  const router = useRouter();
  const { success, error } = useToast();
  
  // Resolve params using React.use()
  const { id } = use(params);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Specifications builder state
  const [specifications, setSpecifications] = useState<SpecSection[]>([]);
  const [imagesText, setImagesText] = useState('');

  // React Hook Form
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(ProductFormSchema) as any,
    defaultValues: {
      isActive: true,
      imageUrls: [],
      title: '',
      slug: '',
      description: '',
      price: 0,
      compareAtPrice: null,
      specifications: [],
    },
  });

  const watchTitle = watch('title');
  const watchSlug = watch('slug');

  // Fetch product data on mount
  useEffect(() => {
    async function loadProduct() {
      try {
        const res = await fetch(`/api/admin/products/${id}`);
        if (res.ok) {
          const data = await res.json();
          const { product } = data;

          setValue('title', product.title);
          setValue('slug', product.slug);
          setValue('description', product.description);
          setValue('price', product.price);
          setValue('compareAtPrice', product.compareAtPrice || null);
          setValue('isActive', product.isActive);

          setImagesText(product.imageUrls.join('\n'));
          setSpecifications(product.specifications || []);
        } else {
          error('Failed to load product details');
          router.push('/admin/products');
        }
      } catch (e) {
        error('Network error loading product data');
      } finally {
        setIsLoading(false);
      }
    }
    loadProduct();
  }, [id, setValue, error, router]);

  const onFormSubmit = async (values: ProductFormValues) => {
    // Process image URLs
    const urls = imagesText
      .split('\n')
      .map((url) => url.trim())
      .filter((url) => url.length > 0);

    if (urls.length === 0) {
      error('At least one product image URL is required');
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        ...values,
        imageUrls: urls,
        specifications,
      };

      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        success('Product updated successfully');
        router.push('/admin/products');
        router.refresh();
      } else {
        const data = await res.json();
        error(data.error || 'Failed to update product');
      }
    } catch (e) {
      error('Error saving changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center text-sm text-zinc-500 animate-pulse">
        Loading product information...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/products">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Edit Product
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Modify product details, thumbnails, and specifications.
          </p>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit(onFormSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Basic Information */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Product Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" {...register('title')} error={errors.title?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="slug" className="flex items-center gap-1">
                    Slug <Sparkles className="h-3 w-3 text-zinc-400" />
                  </Label>
                  <Input id="slug" {...register('slug')} error={errors.slug?.message} />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={6}
                  {...register('description')}
                  error={errors.description?.message}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="price">Selling Price (INR)</Label>
                  <Input id="price" type="number" {...register('price')} error={errors.price?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="compareAtPrice">Compare-At Price (INR, Optional)</Label>
                  <Input id="compareAtPrice" type="number" {...register('compareAtPrice')} error={errors.compareAtPrice?.message} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Specifications Builder Form Component */}
          <SpecificationBuilder value={specifications} onChange={setSpecifications} />
        </div>

        {/* Sidebar settings */}
        <div className="lg:col-span-4 space-y-6">
          {/* Images */}
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Product Media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="images-list">Product Image URLs (One URL per line)</Label>
                <Textarea
                  id="images-list"
                  rows={5}
                  value={imagesText}
                  onChange={(e) => setImagesText(e.target.value)}
                  className="font-mono text-xs leading-normal"
                />
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-normal mt-1">
                  Modify the raw image paths. Commits automatically update the carousel.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Product Status */}
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Catalog Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  {...register('isActive')}
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950 dark:border-zinc-800 cursor-pointer"
                />
                <Label htmlFor="isActive" className="text-sm font-bold">
                  Active (Visible on Storefront)
                </Label>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-900">
                <Button type="submit" className="w-full gap-1.5 cursor-pointer font-bold" isLoading={isSaving}>
                  <Save className="h-4 w-4" /> Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
