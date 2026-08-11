'use client';

import React from 'react';
import { AlertTriangle, Boxes, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { emptyVariant } from '@/features/admin/product-form-defaults';

/**
 * Variant + supplier editor.
 *
 * Stock, cost price and supplier lead time live per variant because that is
 * where they actually differ — the same product can be sourced from two
 * suppliers at two costs. Margin is shown inline so the person setting the
 * price can see what they are making on it.
 */
export interface VariantDraft {
  id?: string;
  name: string;
  sku: string;
  price: number | string;
  compareAtPrice?: number | string | null;
  stockQty: number | string;
  allowBackorder: boolean;
  weightGrams: number | string;
  isActive: boolean;
  supplier: {
    name: string;
    sku: string;
    url?: string;
    costPrice: number | string;
    leadTimeDays: number | string;
  };
}

interface VariantBuilderProps {
  value: VariantDraft[];
  onChange: (value: VariantDraft[]) => void;
}

export function VariantBuilder({ value, onChange }: VariantBuilderProps) {
  const update = (index: number, patch: Partial<VariantDraft>) => {
    onChange(value.map((variant, i) => (i === index ? { ...variant, ...patch } : variant)));
  };

  const updateSupplier = (index: number, patch: Partial<VariantDraft['supplier']>) => {
    onChange(
      value.map((variant, i) =>
        i === index ? { ...variant, supplier: { ...variant.supplier, ...patch } } : variant
      )
    );
  };

  return (
    <Card className="border-line shadow-card dark:border-line">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <Boxes className="h-4 w-4 text-ink-subtle" /> Variants, stock &amp; supplier
        </CardTitle>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...value, emptyVariant(value.length)])}
          className="gap-1"
        >
          <Plus className="h-3.5 w-3.5" /> Add variant
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        {value.length === 0 && (
          <p className="rounded-control border border-dashed border-line p-4 text-xs text-ink-subtle dark:border-line">
            Every product needs at least one variant. Single-SKU products use one variant named
            &ldquo;Default&rdquo;.
          </p>
        )}

        {value.map((variant, index) => {
          const price = Number(variant.price) || 0;
          const cost = Number(variant.supplier.costPrice) || 0;
          const marginPercent = price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
          const negativeMargin = price > 0 && cost > 0 && cost >= price;

          return (
            <div
              key={variant.id ?? index}
              className="space-y-4 rounded-card border border-line p-4 dark:border-line"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                  Variant {index + 1}
                </span>
                {value.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((_, i) => i !== index))}
                    className="p-1 text-ink-subtle hover:text-danger"
                    aria-label={`Remove variant ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FieldBlock label="Variant name">
                  <Input
                    value={variant.name}
                    onChange={(event) => update(index, { name: event.target.value })}
                    placeholder="Coal Black"
                  />
                </FieldBlock>
                <FieldBlock label="SKU">
                  <Input
                    value={variant.sku}
                    onChange={(event) => update(index, { sku: event.target.value })}
                    placeholder="VERO-PLA-BLK-1KG"
                    className="font-mono text-xs"
                  />
                </FieldBlock>
                <FieldBlock label="Selling price (₹, incl. GST)">
                  <Input
                    type="number"
                    min={1}
                    value={variant.price}
                    onChange={(event) => update(index, { price: event.target.value })}
                  />
                </FieldBlock>
                <FieldBlock label="Compare-at price (₹, optional)">
                  <Input
                    type="number"
                    min={0}
                    value={variant.compareAtPrice ?? ''}
                    onChange={(event) => update(index, { compareAtPrice: event.target.value })}
                  />
                </FieldBlock>
                <FieldBlock label="Stock on hand">
                  <Input
                    type="number"
                    min={0}
                    value={variant.stockQty}
                    onChange={(event) => update(index, { stockQty: event.target.value })}
                  />
                </FieldBlock>
                <FieldBlock label="Shipping weight (grams)">
                  <Input
                    type="number"
                    min={0}
                    value={variant.weightGrams}
                    onChange={(event) => update(index, { weightGrams: event.target.value })}
                  />
                </FieldBlock>
              </div>

              <div className="flex flex-wrap gap-5">
                <Checkbox
                  id={`backorder-${index}`}
                  label="Allow backorder (sell past zero stock)"
                  checked={variant.allowBackorder}
                  onChange={(checked) => update(index, { allowBackorder: checked })}
                />
                <Checkbox
                  id={`variant-active-${index}`}
                  label="Available for sale"
                  checked={variant.isActive}
                  onChange={(checked) => update(index, { isActive: checked })}
                />
              </div>

              <div className="space-y-3 rounded-control bg-surface-sunken p-3 ">
                <p className="text-2xs font-bold uppercase tracking-wider text-ink-subtle">
                  Supplier (internal only)
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FieldBlock label="Supplier name">
                    <Input
                      value={variant.supplier.name}
                      onChange={(event) => updateSupplier(index, { name: event.target.value })}
                      placeholder="Anycubic Official Store"
                    />
                  </FieldBlock>
                  <FieldBlock label="Supplier SKU">
                    <Input
                      value={variant.supplier.sku}
                      onChange={(event) => updateSupplier(index, { sku: event.target.value })}
                      className="font-mono text-xs"
                    />
                  </FieldBlock>
                  <FieldBlock label="Cost price (₹)">
                    <Input
                      type="number"
                      min={0}
                      value={variant.supplier.costPrice}
                      onChange={(event) => updateSupplier(index, { costPrice: event.target.value })}
                    />
                  </FieldBlock>
                  <FieldBlock label="Lead time (days)">
                    <Input
                      type="number"
                      min={0}
                      value={variant.supplier.leadTimeDays}
                      onChange={(event) =>
                        updateSupplier(index, { leadTimeDays: event.target.value })
                      }
                    />
                  </FieldBlock>
                  <div className="sm:col-span-2">
                    <FieldBlock label="Supplier product URL (optional)">
                      <Input
                        value={variant.supplier.url ?? ''}
                        onChange={(event) => updateSupplier(index, { url: event.target.value })}
                        placeholder="https://supplier.example.com/product"
                        className="font-mono text-xs"
                      />
                    </FieldBlock>
                  </div>
                </div>

                {price > 0 && cost > 0 && (
                  <p
                    className={`flex items-center gap-1.5 text-xs font-semibold ${
                      negativeMargin ? 'text-danger' : 'text-success'
                    }`}
                  >
                    {negativeMargin && <AlertTriangle className="h-3.5 w-3.5" />}
                    Gross margin: ₹{(price - cost).toLocaleString('en-IN')} ({marginPercent}%)
                    {negativeMargin && ' — you are selling at a loss'}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Checkbox({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-xs font-medium">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-line-strong accent-accent"
      />
      {label}
    </label>
  );
}
