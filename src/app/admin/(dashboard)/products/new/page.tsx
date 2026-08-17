import React from 'react';
import { ProductForm } from '@/features/admin/components/ProductForm';
import { emptyProductForm } from '@/features/admin/product-form-defaults';
import { listSupplierNames } from '@/features/catalog/server/products.repo';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  // Read here rather than fetched by the form: the page is already on the
  // server, so the picker arrives filled in instead of after a round trip.
  const supplierNames = await listSupplierNames();

  return (
    <ProductForm mode="create" initial={emptyProductForm()} supplierNames={supplierNames} />
  );
}
