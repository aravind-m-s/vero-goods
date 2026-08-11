import React from 'react';
import { ProductForm } from '@/features/admin/components/ProductForm';
import { emptyProductForm } from '@/features/admin/product-form-defaults';

export default function NewProductPage() {
  return <ProductForm mode="create" initial={emptyProductForm()} />;
}
