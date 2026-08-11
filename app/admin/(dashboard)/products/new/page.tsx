'use client';

import React, { useState, useEffect } from 'react';
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

export default function NewProductPage() {
  const router = useRouter();
  const { success, error } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Specifications state
  const [specifications, setSpecifications] = useState<SpecSection[]>([]);

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

  // Auto-generate slug from title
  useEffect(() => {
    if (watchTitle) {
      const generated = watchTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      
      // Only set slug if user hasn't heavily customized it already
      if (!watchSlug || watchSlug.startsWith(generated.slice(0, 3))) {
        setValue('slug', generated);
      }
    }
  }, [watchTitle, setValue]);

  // Image URLs textarea helper state
  const [imagesText, setImagesText] = useState('');

  const onFormSubmit = async (values: ProductFormValues) => {
    // 1. Process image URLs
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

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        success('Product created successfully');
        router.push('/admin/products');
        router.refresh();
      } else {
        const data = await res.json();
        error(data.error || 'Failed to create product');
      }
    } catch (e) {
      error('Error connecting to backend');
    } finally {
      setIsSaving(false);
    }
  };

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
            Create Product
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Publish a new product to the catalog store.
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
                  <Input id="title" placeholder="Creality Ender 3 V3 SE" {...register('title')} error={errors.title?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="slug" className="flex items-center gap-1">
                    Slug <Sparkles className="h-3 w-3 text-zinc-400" />
                  </Label>
                  <Input id="slug" placeholder="creality-ender-3-v3-se" {...register('slug')} error={errors.slug?.message} />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Provide a detailed description of the product features, benefits, and components..."
                  rows={6}
                  {...register('description')}
                  error={errors.description?.message}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="price">Selling Price (INR)</Label>
                  <Input id="price" type="number" placeholder="18499" {...register('price')} error={errors.price?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="compareAtPrice">Compare-At Price (INR, Optional)</Label>
                  <Input id="compareAtPrice" type="number" placeholder="21999" {...register('compareAtPrice')} error={errors.compareAtPrice?.message} />
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
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                  rows={5}
                  value={imagesText}
                  onChange={(e) => setImagesText(e.target.value)}
                  className="font-mono text-xs leading-normal"
                />
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-normal mt-1">
                  Paste raw image links. Unsplash images work great for catalog styling.
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
                  <Save className="h-4 w-4" /> Save Product
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
