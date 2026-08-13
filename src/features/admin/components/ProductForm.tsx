'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Sparkles } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';
import { useToast } from '@/shared/ui/toast';
import { SpecificationBuilder, type SpecSection } from '@/features/admin/components/SpecificationBuilder';
import { VariantBuilder, type VariantDraft } from '@/features/admin/components/VariantBuilder';
import { ProductFormSchema } from '@/features/catalog/schemas';

/**
 * Shared create/edit form. Both admin pages used to carry near-identical
 * copies; keeping one component means new fields land in both places at once.
 */
export interface ProductFormInitialValues {
  id?: string;
  title: string;
  slug: string;
  description: string;
  isActive: boolean;
  gstRatePercent: number;
  hsnCode?: string;
  imageUrls: string[];
  variants: VariantDraft[];
  specifications: SpecSection[];
}

export function ProductForm({
  initial,
  mode,
}: {
  initial: ProductFormInitialValues;
  mode: 'create' | 'edit';
}) {
  const router = useRouter();
  const { success, error } = useToast();

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(mode === 'edit');
  const [description, setDescription] = useState(initial.description);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [gstRatePercent, setGstRatePercent] = useState(String(initial.gstRatePercent));
  const [hsnCode, setHsnCode] = useState(initial.hsnCode ?? '');
  const [imagesText, setImagesText] = useState(initial.imageUrls.join('\n'));
  const [variants, setVariants] = useState<VariantDraft[]>(initial.variants);
  const [specifications, setSpecifications] = useState<SpecSection[]>(initial.specifications);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) {
      setSlug(
        value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)+/g, '')
      );
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldErrors({});

    const payload = {
      title,
      slug,
      description,
      isActive,
      gstRatePercent: Number(gstRatePercent),
      hsnCode: hsnCode || undefined,
      imageUrls: imagesText
        .split('\n')
        .map((url) => url.trim())
        .filter(Boolean),
      variants: variants.map((variant) => ({
        ...variant,
        price: Number(variant.price),
        compareAtPrice:
          variant.compareAtPrice === '' || variant.compareAtPrice === null
            ? undefined
            : Number(variant.compareAtPrice),
        stockQty: Number(variant.stockQty),
        weightGrams: Number(variant.weightGrams),
        supplier: {
          ...variant.supplier,
          costPrice: Number(variant.supplier.costPrice),
          leadTimeDays: Number(variant.supplier.leadTimeDays),
        },
      })),
      specifications: specifications.map((spec) => ({
        id: spec.id,
        heading: spec.heading,
        rows: spec.rows.map((row) => ({ id: row.id, label: row.label, value: row.value })),
      })),
    };

    // Validate with the same schema the API uses, so problems surface in the
    // form instead of as a generic 400.
    const parsed = ProductFormSchema.safeParse(payload);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const messages: Record<string, string> = {};
      for (const [field, errors] of Object.entries(flat.fieldErrors)) {
        if (errors?.[0]) messages[field] = errors[0];
      }
      setFieldErrors(messages);
      error(flat.formErrors[0] ?? 'Please fix the highlighted fields');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        mode === 'create' ? '/api/admin/products' : `/api/admin/products/${initial.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        error(data.error ?? 'Could not save the product');
        return;
      }

      success(mode === 'create' ? 'Product created' : 'Product updated');
      router.push('/admin/products');
      router.refresh();
    } catch {
      error('Could not reach the server');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/products">
          <Button variant="ghost" size="l" className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            {mode === 'create' ? 'Create product' : 'Edit product'}
          </h1>
          <p className="mt-1 text-xs text-ink-subtle">
            {mode === 'create'
              ? 'Publish a new product to the catalog.'
              : 'Changes go live as soon as you save.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <Card className="border-line shadow-card dark:border-line">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Product information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(event) => handleTitleChange(event.target.value)}
                    placeholder="Multi-Angle Precision Ratchet Screwdriver"
                    error={fieldErrors.title}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="slug" className="flex items-center gap-1">
                    Slug <Sparkles className="h-3 w-3 text-ink-subtle" />
                  </Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlug(event.target.value);
                    }}
                    placeholder="precision-ratchet-screwdriver"
                    error={fieldErrors.slug}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={6}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Features, benefits, what is in the box…"
                  error={fieldErrors.description}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="gst">Tax rate (%)</Label>
                  <Input
                    id="gst"
                    type="number"
                    min={0}
                    max={28}
                    value={gstRatePercent}
                    onChange={(event) => setGstRatePercent(event.target.value)}
                    error={fieldErrors.gstRatePercent}
                  />
                  <p className="text-3xs text-ink-subtle">
                    Tax percentage included in product pricing.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hsn">HSN code</Label>
                  <Input
                    id="hsn"
                    value={hsnCode}
                    onChange={(event) => setHsnCode(event.target.value)}
                    placeholder="8477"
                    error={fieldErrors.hsnCode}
                  />
                  <p className="text-3xs text-ink-subtle">Required for tax compliance.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <VariantBuilder value={variants} onChange={setVariants} />
          {fieldErrors.variants && (
            <p className="text-xs font-medium text-danger">{fieldErrors.variants}</p>
          )}

          <SpecificationBuilder value={specifications} onChange={setSpecifications} />
        </div>

        <div className="space-y-6 lg:col-span-4">
          <Card className="border-line shadow-card dark:border-line">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Product media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="images-list">Image URLs (one per line)</Label>
                <Textarea
                  id="images-list"
                  rows={5}
                  value={imagesText}
                  onChange={(event) => setImagesText(event.target.value)}
                  placeholder={'https://example.com/image1.jpg\nhttps://example.com/image2.jpg'}
                  className="font-mono text-xs leading-normal"
                  error={fieldErrors.imageUrls}
                />
                <p className="mt-1 text-3xs leading-normal text-ink-subtle">
                  The host must be listed in `next.config.ts` under `images.remotePatterns`.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-line shadow-card dark:border-line">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Catalog status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label htmlFor="isActive" className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="h-4 w-4 rounded border-line-strong accent-accent"
                />
                <span className="text-sm font-bold">Visible on the storefront</span>
              </label>

              <div className="border-t border-line pt-4">
                <Button type="submit" className="w-full gap-1.5 font-bold" isLoading={isSaving}>
                  <Save className="h-4 w-4" /> Save product
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
