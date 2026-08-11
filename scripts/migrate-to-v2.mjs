#!/usr/bin/env node
/**
 * One-time migration from the original schema to the current one.
 *
 *   node --env-file=.env scripts/migrate-to-v2.mjs          # dry run
 *   node --env-file=.env scripts/migrate-to-v2.mjs --apply  # write changes
 *
 * What changes:
 *   products     price/compareAtPrice (rupees, float) are removed; a "Default"
 *                variant carrying priceMinor/stock/supplier is created for each
 *                product. gstRatePercent defaults to 18.
 *   orders       totalAmount (rupees) becomes subtotal/shipping/tax/totalMinor
 *                (paise). statusHistory and taxLines are backfilled.
 *   orderItems   unitPrice/total become *Minor; variant and supplier snapshot
 *                fields are backfilled from the product.
 *   otps         dropped — the old records stored plaintext codes.
 *
 * Existing orders keep the totals they were actually charged: shipping and the
 * COD fee are recorded as zero rather than invented retrospectively.
 */
import { MongoClient } from 'mongodb';
import crypto from 'node:crypto';

const apply = process.argv.includes('--apply');
const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI is not set. Run with: node --env-file=.env scripts/migrate-to-v2.mjs');
  process.exit(1);
}

const toMinor = (rupees) => Math.round(Number(rupees ?? 0) * 100);
const newId = (prefix) => `${prefix}-${crypto.randomUUID().slice(0, 12)}`;

/** Splits a GST-inclusive amount into taxable value and tax. */
function splitInclusiveTax(inclusiveMinor, ratePercent) {
  if (ratePercent <= 0) return { taxableMinor: inclusiveMinor, taxMinor: 0 };
  const taxableMinor = Math.round((inclusiveMinor * 100) / (100 + ratePercent));
  return { taxableMinor, taxMinor: inclusiveMinor - taxableMinor };
}

const client = new MongoClient(uri, { family: 4 });

try {
  await client.connect();
  const db = client.db();
  const plan = [];

  // ---------------------------------------------------------------- products
  const legacyProducts = await db
    .collection('products')
    .find({ gstRatePercent: { $exists: false } })
    .toArray();

  for (const product of legacyProducts) {
    const priceMinor = toMinor(product.price);
    const variant = {
      id: newId('v'),
      productId: product.id,
      name: 'Default',
      // Derive a SKU from the slug; it only has to be unique and stable.
      sku: String(product.slug ?? product.id).toUpperCase().slice(0, 40),
      priceMinor,
      compareAtPriceMinor: product.compareAtPrice ? toMinor(product.compareAtPrice) : undefined,
      // Unknown before this migration — start at zero with backorder allowed so
      // nothing silently goes out of stock on deploy.
      stockQty: 0,
      allowBackorder: true,
      weightGrams: 0,
      supplier: {
        name: 'Unknown supplier',
        sku: String(product.slug ?? product.id),
        costPriceMinor: 0,
        leadTimeDays: 5,
      },
      sortOrder: 0,
      isActive: product.isActive !== false,
    };

    plan.push({
      description: `product ${product.slug}: add gstRatePercent, create Default variant @ ${priceMinor} paise`,
      run: async () => {
        const existing = await db.collection('productVariants').findOne({ productId: product.id });
        if (!existing) await db.collection('productVariants').insertOne(variant);
        await db.collection('products').updateOne(
          { id: product.id },
          {
            $set: { gstRatePercent: 18, currency: 'INR' },
            $unset: { price: '', compareAtPrice: '' },
          }
        );
      },
    });
  }

  // ------------------------------------------------------------------ orders
  const legacyOrders = await db
    .collection('orders')
    .find({ totalMinor: { $exists: false } })
    .toArray();

  for (const order of legacyOrders) {
    const totalMinor = toMinor(order.totalAmount);
    const { taxableMinor, taxMinor } = splitInclusiveTax(totalMinor, 18);

    plan.push({
      description: `order ${order.orderNumber}: ${order.totalAmount} INR -> ${totalMinor} paise`,
      run: async () => {
        await db.collection('orders').updateOne(
          { id: order.id },
          {
            $set: {
              subtotalMinor: totalMinor,
              shippingMinor: 0,
              codFeeMinor: 0,
              taxMinor,
              taxLines: [{ ratePercent: 18, taxableMinor, taxMinor }],
              totalMinor,
              currency: 'INR',
              statusHistory: [
                {
                  status: order.orderStatus ?? 'PLACED',
                  at: order.createdAt ?? new Date().toISOString(),
                  by: 'system',
                  note: 'Backfilled during schema migration',
                },
              ],
            },
            $unset: { totalAmount: '' },
          }
        );
      },
    });
  }

  // -------------------------------------------------------------- orderItems
  const legacyItems = await db
    .collection('orderItems')
    .find({ totalMinor: { $exists: false } })
    .toArray();

  for (const item of legacyItems) {
    plan.push({
      description: `order item ${item.id}: ${item.unitPrice} INR -> ${toMinor(item.unitPrice)} paise`,
      run: async () => {
        const variant = await db.collection('productVariants').findOne({ productId: item.productId });
        await db.collection('orderItems').updateOne(
          { id: item.id },
          {
            $set: {
              variantId: variant?.id ?? 'legacy-unknown',
              variantName: 'Default',
              sku: variant?.sku ?? 'LEGACY',
              unitPriceMinor: toMinor(item.unitPrice),
              totalMinor: toMinor(item.total),
              gstRatePercent: 18,
              costPriceMinor: 0,
              supplierName: 'Unknown supplier',
              supplierSku: '',
            },
            $unset: { unitPrice: '', total: '' },
          }
        );
      },
    });
  }

  // -------------------------------------------------------------------- otps
  const staleOtps = await db.collection('otps').countDocuments({ codeHash: { $exists: false } });
  if (staleOtps > 0) {
    plan.push({
      description: `drop ${staleOtps} legacy OTP record(s) storing plaintext codes`,
      run: () => db.collection('otps').deleteMany({ codeHash: { $exists: false } }),
    });
  }

  // ----------------------------------------------------------------- execute
  if (plan.length === 0) {
    console.log('Nothing to migrate — the database is already on the current schema.');
  } else {
    console.log(`${plan.length} change(s)${apply ? '' : ' (dry run)'}:\n`);
    for (const step of plan) console.log(`  - ${step.description}`);

    if (apply) {
      console.log('\nApplying…');
      for (const step of plan) await step.run();
      console.log(`Done. ${plan.length} change(s) applied.`);
    } else {
      console.log('\nRe-run with --apply to write these changes.');
    }
  }
} finally {
  await client.close();
}
