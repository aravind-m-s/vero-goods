import 'server-only';

import {
  productImagesCollection,
  productsCollection,
  specificationRowsCollection,
  specificationsCollection,
  usersCollection,
  variantsCollection,
} from '@/shared/db/collections';
import { type User } from '@/features/auth/types';
import { CURRENCY, type Product, type ProductVariant } from '@/features/catalog/types';
import { rupeesToMinor } from '@/shared/lib/money';

const globalForSeed = globalThis as typeof globalThis & { veroSeedPromise?: Promise<void> };

/**
 * Seeds demo catalogue data the first time the app talks to an empty database.
 * Runs at most once per process and is a no-op as soon as any product exists.
 */
export async function ensureSeeded(): Promise<void> {
  if (!globalForSeed.veroSeedPromise) {
    globalForSeed.veroSeedPromise = seed().catch((err) => {
      globalForSeed.veroSeedPromise = undefined;
      throw err;
    });
  }
  return globalForSeed.veroSeedPromise;
}

async function seed(): Promise<void> {
  const products = await productsCollection();
  if ((await products.estimatedDocumentCount()) > 0) return;

  const now = new Date().toISOString();

  const defs: Array<{
    product: Omit<Product, 'currency' | 'createdAt' | 'updatedAt'>;
    imageUrl: string;
    variants: Array<Omit<ProductVariant, 'productId' | 'isActive'>>;
    specs: Array<{ heading: string; rows: Array<[string, string]> }>;
  }> = [
    {
      product: {
        id: 'p-1',
        title: 'Anycubic Kobra 2 Neo 3D Printer',
        slug: 'anycubic-kobra-2-neo',
        description:
          'The Anycubic Kobra 2 Neo is an entry-level high-speed FDM 3D printer featuring a max print speed of 250mm/s, LeviQ 2.0 auto bed leveling, and a direct drive extruder. Ideal for beginners and hobbyists seeking speed and reliability.',
        isActive: true,
        gstRatePercent: 18,
        hsnCode: '8477',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1615840287214-7fe58a8e668f?w=1200&auto=format&fit=crop&q=80',
      variants: [
        {
          id: 'v-1',
          name: 'Default',
          sku: 'ANY-KOBRA2NEO',
          priceMinor: rupeesToMinor(19999),
          compareAtPriceMinor: rupeesToMinor(24999),
          stockQty: 12,
          allowBackorder: false,
          weightGrams: 7300,
          sortOrder: 0,
          supplier: {
            name: 'Anycubic Official Store',
            sku: 'KOBRA2NEO-IN',
            costPriceMinor: rupeesToMinor(15200),
            leadTimeDays: 4,
          },
        },
      ],
      specs: [
        {
          heading: 'Technical Details',
          rows: [
            ['Brand', 'Anycubic'],
            ['Model', 'Kobra 2 Neo'],
            ['Extruder Type', 'Direct Drive'],
            ['Max Print Speed', '250 mm/s'],
            ['Auto Leveling', 'LeviQ 2.0 (25-point)'],
            ['Print Platform', 'PEI Spring Steel'],
          ],
        },
        {
          heading: 'Dimensions',
          rows: [
            ['Build Volume', '220 x 220 x 250 mm'],
            ['Product Dimensions', '48.5 x 44 x 44 cm'],
            ['Item Weight', '7.3 kg'],
          ],
        },
      ],
    },
    {
      product: {
        id: 'p-2',
        title: 'Creality Ender 3 V3 SE 3D Printer',
        slug: 'creality-ender-3-v3-se',
        description:
          'The Creality Ender 3 V3 SE sets a new standard for budget-friendly 3D printing. It comes equipped with a Sprite direct extruder, dual Z-axis rods, Y-axis linear shafts, automatic bed leveling, and a sleek user interface.',
        isActive: true,
        gstRatePercent: 18,
        hsnCode: '8477',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1200&auto=format&fit=crop&q=80',
      variants: [
        {
          id: 'v-2',
          name: 'Default',
          sku: 'CRE-E3V3SE',
          priceMinor: rupeesToMinor(18499),
          compareAtPriceMinor: rupeesToMinor(21999),
          stockQty: 8,
          allowBackorder: false,
          weightGrams: 7120,
          sortOrder: 0,
          supplier: {
            name: 'Creality Distribution India',
            sku: 'E3V3SE-IN',
            costPriceMinor: rupeesToMinor(14100),
            leadTimeDays: 3,
          },
        },
      ],
      specs: [
        {
          heading: 'Technical Details',
          rows: [
            ['Brand', 'Creality'],
            ['Model', 'Ender 3 V3 SE'],
            ['Extruder Type', 'Sprite Direct Extruder'],
            ['Typical Speed', '180 mm/s'],
            ['Max Speed', '250 mm/s'],
          ],
        },
        {
          heading: 'Dimensions',
          rows: [
            ['Build Volume', '220 x 220 x 250 mm'],
            ['Device Dimensions', '34.9 x 36.4 x 49 cm'],
            ['Net Weight', '7.12 kg'],
          ],
        },
      ],
    },
    {
      product: {
        id: 'p-3',
        title: 'Elegoo Mars 4 Ultra 9K Resin Printer',
        slug: 'elegoo-mars-4-ultra',
        description:
          'The Elegoo Mars 4 Ultra features a 7-inch 9K mono LCD offering stunning 18-micron XY resolution. It boasts high-speed printing with ACS light source, built-in Linux OS with 4GB memory, and Wi-Fi file transfer capability.',
        isActive: true,
        gstRatePercent: 18,
        hsnCode: '8477',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1608156639585-b3a032ef9689?w=1200&auto=format&fit=crop&q=80',
      variants: [
        {
          id: 'v-3',
          name: 'Default',
          sku: 'ELE-MARS4U',
          priceMinor: rupeesToMinor(28999),
          compareAtPriceMinor: rupeesToMinor(35000),
          stockQty: 0,
          allowBackorder: true,
          weightGrams: 12500,
          sortOrder: 0,
          supplier: {
            name: 'Elegoo Asia Warehouse',
            sku: 'MARS4ULTRA',
            costPriceMinor: rupeesToMinor(22400),
            leadTimeDays: 9,
          },
        },
      ],
      specs: [
        {
          heading: 'Technical Details',
          rows: [
            ['Brand', 'Elegoo'],
            ['Model', 'Mars 4 Ultra 9K'],
            ['Technology', 'MSLA Resin 3D Printing'],
            ['XY Resolution', '18 x 18 microns (9K)'],
            ['Build Volume', '153.3 x 77.7 x 165 mm'],
            ['OS & Storage', 'Linux OS with 4GB RAM'],
          ],
        },
      ],
    },
    {
      product: {
        id: 'p-4',
        title: 'Vero Premium PLA Filament 1kg',
        slug: 'vero-premium-pla-filament',
        description:
          'High quality 1.75mm PLA filament engineered for hassle-free 3D printing. Clog-free, bubble-free, and minimal warping. Vacuum sealed with desiccant to prevent moisture absorption.',
        isActive: true,
        gstRatePercent: 18,
        hsnCode: '3916',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=1200&auto=format&fit=crop&q=80',
      variants: [
        {
          id: 'v-4a',
          name: 'Coal Black',
          sku: 'VERO-PLA-BLK-1KG',
          priceMinor: rupeesToMinor(1499),
          compareAtPriceMinor: rupeesToMinor(1999),
          stockQty: 64,
          allowBackorder: false,
          weightGrams: 1200,
          sortOrder: 0,
          supplier: {
            name: 'Vero In-House',
            sku: 'PLA-BLK',
            costPriceMinor: rupeesToMinor(870),
            leadTimeDays: 1,
          },
        },
        {
          id: 'v-4b',
          name: 'Arctic White',
          sku: 'VERO-PLA-WHT-1KG',
          priceMinor: rupeesToMinor(1499),
          compareAtPriceMinor: rupeesToMinor(1999),
          stockQty: 41,
          allowBackorder: false,
          weightGrams: 1200,
          sortOrder: 1,
          supplier: {
            name: 'Vero In-House',
            sku: 'PLA-WHT',
            costPriceMinor: rupeesToMinor(870),
            leadTimeDays: 1,
          },
        },
        {
          id: 'v-4c',
          name: 'Signal Red',
          sku: 'VERO-PLA-RED-1KG',
          priceMinor: rupeesToMinor(1599),
          stockQty: 3,
          allowBackorder: false,
          weightGrams: 1200,
          sortOrder: 2,
          supplier: {
            name: 'Vero In-House',
            sku: 'PLA-RED',
            costPriceMinor: rupeesToMinor(910),
            leadTimeDays: 1,
          },
        },
      ],
      specs: [
        {
          heading: 'Material Specifications',
          rows: [
            ['Material', 'PLA (Polylactic Acid)'],
            ['Diameter', '1.75 mm ± 0.02 mm'],
            ['Print Temp', '190°C - 220°C'],
            ['Bed Temp', '0°C - 60°C'],
            ['Weight', '1.0 kg (Net)'],
          ],
        },
      ],
    },
    {
      product: {
        id: 'p-5',
        title: 'Vero Premium PETG Filament 1kg - Slate Grey',
        slug: 'vero-premium-petg-filament-grey',
        description:
          'Strong, heat-resistant, and chemical-resistant 1.75mm PETG filament. Combines the ease of PLA printing with the durability of ABS. Excellent bed adhesion and layer bonding.',
        isActive: true,
        gstRatePercent: 18,
        hsnCode: '3916',
      },
      imageUrl:
        'https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?w=1200&auto=format&fit=crop&q=80',
      variants: [
        {
          id: 'v-5',
          name: 'Default',
          sku: 'VERO-PETG-GRY-1KG',
          priceMinor: rupeesToMinor(1699),
          compareAtPriceMinor: rupeesToMinor(2299),
          stockQty: 27,
          allowBackorder: false,
          weightGrams: 1200,
          sortOrder: 0,
          supplier: {
            name: 'Vero In-House',
            sku: 'PETG-GRY',
            costPriceMinor: rupeesToMinor(1020),
            leadTimeDays: 1,
          },
        },
      ],
      specs: [],
    },
  ];

  const [variants, images, specs, specRows, users] = await Promise.all([
    variantsCollection(),
    productImagesCollection(),
    specificationsCollection(),
    specificationRowsCollection(),
    usersCollection(),
  ]);

  await products.insertMany(
    defs.map((d) => ({ ...d.product, currency: CURRENCY, createdAt: now, updatedAt: now }))
  );

  await variants.insertMany(
    defs.flatMap((d) =>
      d.variants.map((v) => ({ ...v, productId: d.product.id, isActive: true }))
    )
  );

  await images.insertMany(
    defs.map((d, i) => ({
      id: `img-${i + 1}`,
      productId: d.product.id,
      url: d.imageUrl,
      alt: d.product.title,
      width: 1200,
      height: 800,
      sortOrder: 0,
    }))
  );

  const specDocs = defs.flatMap((d) =>
    d.specs.map((s, i) => ({
      id: `spec-${d.product.id}-${i}`,
      productId: d.product.id,
      heading: s.heading,
      sortOrder: i,
      rows: s.rows,
    }))
  );

  if (specDocs.length > 0) {
    await specs.insertMany(
      specDocs.map(({ rows, ...spec }) => {
        void rows;
        return spec;
      })
    );
    await specRows.insertMany(
      specDocs.flatMap((spec) =>
        spec.rows.map(([label, value], i) => ({
          id: `row-${spec.id}-${i}`,
          specificationId: spec.id,
          label,
          value,
          sortOrder: i,
        }))
      )
    );
  }

  const seedUsers: User[] = [
    {
      id: 'u-admin',
      email: 'admin@verogoods.in',
      name: 'Vero Admin',
      phone: '9999999999',
      role: 'admin',
      createdAt: now,
    },
  ];
  await users.insertMany(seedUsers).catch(() => {
    // Users may already exist from a previous partial seed; not fatal.
  });
}
