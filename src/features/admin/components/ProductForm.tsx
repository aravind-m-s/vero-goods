'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, Save, Sparkles } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { useToast } from '@/shared/ui/toast';
import { MediaGallery } from '@/features/admin/components/MediaGallery';
import {
  MediaUploader,
  deleteCloudinaryAsset,
  type UploadKind,
} from '@/features/admin/components/MediaUploader';
import { SpecificationBuilder, type SpecSection } from '@/features/admin/components/SpecificationBuilder';
import { VariantBuilder, type VariantDraft } from '@/features/admin/components/VariantBuilder';
import { FORM_ERROR_KEY, ProductFormSchema, issuesToFieldErrors } from '@/features/catalog/schemas';
import type { PaymentSupport } from '@/features/catalog/types';

/**
 * Turns a dotted schema path into something an admin recognises, e.g.
 * `variants.0.supplier.costPrice` -> "Variant 1 · Supplier · Cost price".
 */
function humanisePath(path: string): string {
  if (path === FORM_ERROR_KEY) return 'Form';

  const segments = path.split('.');
  const parts: string[] = [];

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const next = segments[i + 1];
    const isIndexed = next !== undefined && /^\d+$/.test(next);
    const label = segment
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (char) => char.toUpperCase())
      .trim();

    if (isIndexed) {
      const singular = label.replace(/s$/, '');
      parts.push(`${singular} ${Number(next) + 1}`);
      i += 1;
    } else if (!/^\d+$/.test(segment)) {
      parts.push(label);
    }
  }

  return parts.join(' · ');
}

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
  paymentSupport: PaymentSupport;
  /** Delivery charge in rupees. */
  shippingPrice: number;
  imageUrls: string[];
  videoUrls: string[];
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
  const [paymentSupport, setPaymentSupport] = useState<PaymentSupport>(initial.paymentSupport);
  const [shippingPrice, setShippingPrice] = useState(String(initial.shippingPrice));
  const [imageUrls, setImageUrls] = useState<string[]>(initial.imageUrls);
  const [videoUrls, setVideoUrls] = useState<string[]>(initial.videoUrls);
  /**
   * Media that belonged to the saved product and has been removed here.
   *
   * Held back rather than destroyed on the spot: until the form saves, the
   * product in the database still points at these files, and deleting one and
   * then navigating away would leave a live listing with a broken image.
   */
  const [pendingDeletions, setPendingDeletions] = useState<
    Array<{ url: string; kind: UploadKind }>
  >([]);
  const [variants, setVariants] = useState<VariantDraft[]>(initial.variants);
  const [specifications, setSpecifications] = useState<SpecSection[]>(initial.specifications);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const errorEntries = Object.entries(fieldErrors);

  /** First message on `prefix` itself or any path beneath it. */
  const firstErrorFor = (prefix: string) =>
    errorEntries.find(([path]) => path === prefix || path.startsWith(`${prefix}.`))?.[1];

  /** What the product already pointed at when this form opened. */
  const savedMedia = useMemo(
    () => new Set([...initial.imageUrls, ...initial.videoUrls]),
    [initial.imageUrls, initial.videoUrls]
  );

  const addMedia = (kind: UploadKind) => (url: string) =>
    (kind === 'image' ? setImageUrls : setVideoUrls)((current) =>
      current.includes(url) ? current : [...current, url]
    );

  /**
   * Detaches media from the product and takes it out of Cloudinary too, so an
   * abandoned upload does not sit in the account being paid for.
   *
   * Something uploaded in this session goes immediately — nothing references it
   * yet. Something the saved product still points at only goes once the save
   * succeeds; see `pendingDeletions`.
   */
  const removeMedia = (kind: UploadKind) => (url: string) => {
    (kind === 'image' ? setImageUrls : setVideoUrls)((current) =>
      current.filter((item) => item !== url)
    );

    if (savedMedia.has(url)) {
      setPendingDeletions((current) =>
        current.some((item) => item.url === url) ? current : [...current, { url, kind }]
      );
      return;
    }
    void deleteCloudinaryAsset(url, kind);
  };

  /**
   * Nested fields (variants, suppliers, specification rows) fail far below the
   * fold, so the summary is what makes a rejected save actionable.
   */
  const showErrors = (messages: Record<string, string>, fallback: string) => {
    setFieldErrors(messages);
    error(messages[FORM_ERROR_KEY] ?? Object.values(messages)[0] ?? fallback);
    requestAnimationFrame(() => {
      errorSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

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

    // Pruned in state, not only in the payload, so error paths like
    // `specifications.0.rows.1.label` still point at the row on screen.
    const cleanedSpecifications = specifications
      .map((spec) => ({
        ...spec,
        heading: spec.heading.trim(),
        rows: spec.rows
          .filter((row) => row.label.trim() !== '' || row.value.trim() !== '')
          .map((row, index) => ({
            ...row,
            label: row.label.trim(),
            value: row.value.trim(),
            sortOrder: index,
          })),
      }))
      .filter((spec) => spec.heading !== '' || spec.rows.length > 0)
      .map((spec, index) => ({ ...spec, sortOrder: index }));
    setSpecifications(cleanedSpecifications);

    const payload = {
      title,
      slug,
      description,
      isActive,
      gstRatePercent: Number(gstRatePercent),
      hsnCode: hsnCode || undefined,
      paymentSupport,
      // An emptied field is free delivery, not a broken number.
      shippingPrice: shippingPrice === '' ? 0 : Number(shippingPrice),
      imageUrls,
      videoUrls,
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
      // Rows the user added but never filled are noise, not errors — they were
      // dropped above. Half-filled rows stay so validation names the gap.
      specifications: cleanedSpecifications.map((spec) => ({
        id: spec.id,
        heading: spec.heading,
        rows: spec.rows.map((row) => ({ id: row.id, label: row.label, value: row.value })),
      })),
    };

    // Validate with the same schema the API uses, so problems surface in the
    // form instead of as a generic 400.
    const parsed = ProductFormSchema.safeParse(payload);
    if (!parsed.success) {
      showErrors(issuesToFieldErrors(parsed.error), 'Please fix the highlighted fields');
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

      const data = (await response.json()) as {
        error?: string;
        fieldErrors?: Record<string, string>;
      };
      if (!response.ok) {
        // The API re-validates; surface its field errors the same way, so a
        // server-only failure (duplicate slug, duplicate SKU) is visible too.
        if (data.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
          showErrors(data.fieldErrors, data.error ?? 'Please fix the highlighted fields');
          return;
        }
        showErrors(
          { [FORM_ERROR_KEY]: data.error ?? 'Could not save the product' },
          'Could not save the product'
        );
        return;
      }

      // The product no longer points at these, so the files can go now. Failures
      // are deliberately ignored: the save is the part that mattered, and an
      // orphaned file is a storage cost, not a broken product.
      await Promise.all(
        pendingDeletions.map((item) => deleteCloudinaryAsset(item.url, item.kind))
      );
      setPendingDeletions([]);

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
          <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
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

      {errorEntries.length > 0 && (
        <div
          ref={errorSummaryRef}
          role="alert"
          aria-live="assertive"
          className="rounded-card border border-danger/40 bg-danger/5 p-4"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-danger">
            <AlertCircle className="h-4 w-4" />
            {errorEntries.length} problem{errorEntries.length === 1 ? '' : 's'} stopped this product
            from saving
          </p>
          <ul className="mt-2 space-y-1">
            {errorEntries.map(([path, message]) => (
              <li key={path} className="text-xs text-ink-muted">
                {path !== FORM_ERROR_KEY && (
                  <span className="font-semibold text-ink">{humanisePath(path)}: </span>
                )}
                {message}
              </li>
            ))}
          </ul>
        </div>
      )}

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
                <div className="space-y-1">
                  <Label htmlFor="shipping">Shipping charge (₹)</Label>
                  <Input
                    id="shipping"
                    type="number"
                    min={0}
                    step="1"
                    value={shippingPrice}
                    onChange={(event) => setShippingPrice(event.target.value)}
                    placeholder="0"
                    error={fieldErrors.shippingPrice}
                  />
                  <p className="text-3xs text-ink-subtle">
                    0 means free delivery, and the product page says so. A basket is charged the
                    highest shipping of the products in it.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <VariantBuilder value={variants} onChange={setVariants} errors={fieldErrors} />
          {fieldErrors.variants && (
            <p className="text-xs font-medium text-danger">{fieldErrors.variants}</p>
          )}

          <SpecificationBuilder
            value={specifications}
            onChange={setSpecifications}
            errors={fieldErrors}
          />
        </div>

        <div className="space-y-6 lg:col-span-4">
          <Card className="border-line shadow-card dark:border-line">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Product media</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Images ({imageUrls.length}/10)</Label>
                <MediaGallery kind="image" urls={imageUrls} onRemove={removeMedia('image')} />
                {firstErrorFor('imageUrls') && (
                  <p className="text-xs font-medium text-danger">{firstErrorFor('imageUrls')}</p>
                )}
                <p className="text-3xs leading-normal text-ink-subtle">
                  The first image is what the catalogue card and search results show.
                </p>
                <MediaUploader kind="image" onUploaded={addMedia('image')} />
              </div>

              <div className="space-y-2 border-t border-line pt-3">
                <Label>Videos ({videoUrls.length}/6)</Label>
                <MediaGallery kind="video" urls={videoUrls} onRemove={removeMedia('video')} />
                {firstErrorFor('videoUrls') && (
                  <p className="text-xs font-medium text-danger">{firstErrorFor('videoUrls')}</p>
                )}
                <p className="text-3xs leading-normal text-ink-subtle">
                  Videos appear after the images in the product gallery.
                </p>
                <MediaUploader kind="video" onUploaded={addMedia('video')} />
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

              <div className="space-y-1 border-t border-line pt-4">
                <Label htmlFor="paymentSupport">Payment methods</Label>
                <Select
                  id="paymentSupport"
                  value={paymentSupport}
                  onChange={(event) => setPaymentSupport(event.target.value as PaymentSupport)}
                  error={fieldErrors.paymentSupport}
                >
                  <option value="BOTH">Online payment and cash on delivery</option>
                  <option value="ONLINE">Online payment only</option>
                  <option value="COD">Cash on delivery only</option>
                </Select>
                <p className="text-3xs leading-normal text-ink-subtle">
                  Checkout offers a method only when every product in the basket accepts it.
                </p>
              </div>

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
