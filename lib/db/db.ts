import 'server-only';
import clientPromise from './mongodb';

export type {
  User,
  Product,
  ProductImage,
  ProductSpecification,
  ProductSpecificationRow,
  OrderAddress,
  Order,
  OrderItem,
  DatabaseSchema,
} from './types';
export { OrderStatus, PaymentStatus } from './types';
import type { DatabaseSchema, Product, ProductImage, ProductSpecification, ProductSpecificationRow, Order, OrderItem, User } from './types';
import { OrderStatus, PaymentStatus } from './types';

// Initial Mock Seed Data
const getInitialDbState = (): DatabaseSchema => {
  const now = new Date().toISOString();
  
  const mockProducts: Product[] = [
    {
      id: 'p-1',
      title: 'Anycubic Kobra 2 Neo 3D Printer',
      slug: 'anycubic-kobra-2-neo',
      description: 'The Anycubic Kobra 2 Neo is an entry-level high-speed FDM 3D printer featuring a max print speed of 250mm/s, LeviQ 2.0 auto bed leveling, and a direct drive extruder. Ideal for beginners and hobbyists seeking speed and reliability.',
      price: 19999,
      compareAtPrice: 24999,
      currency: 'INR',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'p-2',
      title: 'Creality Ender 3 V3 SE 3D Printer',
      slug: 'creality-ender-3-v3-se',
      description: 'The Creality Ender 3 V3 SE sets a new standard for budget-friendly 3D printing. It comes equipped with a Sprite direct extruder, dual Z-axis rods, Y-axis linear shafts, automatic bed leveling, and a sleek user interface.',
      price: 18499,
      compareAtPrice: 21999,
      currency: 'INR',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'p-3',
      title: 'Elegoo Mars 4 Ultra 9K Resin Printer',
      slug: 'elegoo-mars-4-ultra',
      description: 'The Elegoo Mars 4 Ultra features a 7-inch 9K mono LCD offering stunning 18-micron XY resolution. It boasts high-speed printing with ACS light source, built-in Linux OS with 4GB memory, and Wi-Fi file transfer capability.',
      price: 28999,
      compareAtPrice: 35000,
      currency: 'INR',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'p-4',
      title: 'Vero Premium PLA Filament 1kg - Coal Black',
      slug: 'vero-premium-pla-filament-black',
      description: 'High quality 1.75mm PLA filament engineered for hassle-free 3D printing. Clog-free, bubble-free, and minimal warping. Vacuum sealed with desiccant to prevent moisture absorption.',
      price: 1499,
      compareAtPrice: 1999,
      currency: 'INR',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'p-5',
      title: 'Vero Premium PETG Filament 1kg - Slate Grey',
      slug: 'vero-premium-petg-filament-grey',
      description: 'Strong, heat-resistant, and chemical-resistant 1.75mm PETG filament. Combines the ease of PLA printing with the durability of ABS. Excellent bed adhesion and layer bonding.',
      price: 1699,
      compareAtPrice: 2299,
      currency: 'INR',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const mockImages: ProductImage[] = [
    { id: 'img-1', productId: 'p-1', url: 'https://images.unsplash.com/photo-1615840287214-7fe58a8e668f?w=600&auto=format&fit=crop&q=80', sortOrder: 0 },
    { id: 'img-2', productId: 'p-2', url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80', sortOrder: 0 },
    { id: 'img-3', productId: 'p-3', url: 'https://images.unsplash.com/photo-1608156639585-b3a032ef9689?w=600&auto=format&fit=crop&q=80', sortOrder: 0 },
    { id: 'img-4', productId: 'p-4', url: 'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=600&auto=format&fit=crop&q=80', sortOrder: 0 },
    { id: 'img-5', productId: 'p-5', url: 'https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?w=600&auto=format&fit=crop&q=80', sortOrder: 0 },
  ];

  const mockSpecs: ProductSpecification[] = [
    { id: 'spec-1', productId: 'p-1', heading: 'Technical Details', sortOrder: 0 },
    { id: 'spec-2', productId: 'p-1', heading: 'Dimensions', sortOrder: 1 },
    { id: 'spec-3', productId: 'p-2', heading: 'Technical Details', sortOrder: 0 },
    { id: 'spec-4', productId: 'p-2', heading: 'Dimensions', sortOrder: 1 },
    { id: 'spec-5', productId: 'p-3', heading: 'Technical Details', sortOrder: 0 },
    { id: 'spec-6', productId: 'p-4', heading: 'Material Specifications', sortOrder: 0 },
  ];

  const mockSpecRows: ProductSpecificationRow[] = [
    { id: 'row-1', specificationId: 'spec-1', label: 'Brand', value: 'Anycubic', sortOrder: 0 },
    { id: 'row-2', specificationId: 'spec-1', label: 'Model', value: 'Kobra 2 Neo', sortOrder: 1 },
    { id: 'row-3', specificationId: 'spec-1', label: 'Extruder Type', value: 'Direct Drive', sortOrder: 2 },
    { id: 'row-4', specificationId: 'spec-1', label: 'Max Print Speed', value: '250 mm/s', sortOrder: 3 },
    { id: 'row-5', specificationId: 'spec-1', label: 'Auto Leveling', value: 'LeviQ 2.0 (25-point)', sortOrder: 4 },
    { id: 'row-6', specificationId: 'spec-1', label: 'Print Platform', value: 'PEI Spring Steel', sortOrder: 5 },
    { id: 'row-7', specificationId: 'spec-2', label: 'Build Volume', value: '220 x 220 x 250 mm', sortOrder: 0 },
    { id: 'row-8', specificationId: 'spec-2', label: 'Product Dimensions', value: '48.5 x 44 x 44 cm', sortOrder: 1 },
    { id: 'row-9', specificationId: 'spec-2', label: 'Item Weight', value: '7.3 kg', sortOrder: 2 },
    { id: 'row-10', specificationId: 'spec-3', label: 'Brand', value: 'Creality', sortOrder: 0 },
    { id: 'row-11', specificationId: 'spec-3', label: 'Model', value: 'Ender 3 V3 SE', sortOrder: 1 },
    { id: 'row-12', specificationId: 'spec-3', label: 'Extruder Type', value: 'Sprite Direct Extruder', sortOrder: 2 },
    { id: 'row-13', specificationId: 'spec-3', label: 'Typical Speed', value: '180 mm/s', sortOrder: 3 },
    { id: 'row-14', specificationId: 'spec-3', label: 'Max Speed', value: '250 mm/s', sortOrder: 4 },
    { id: 'row-15', specificationId: 'spec-4', label: 'Build Volume', value: '220 x 220 x 250 mm', sortOrder: 0 },
    { id: 'row-16', specificationId: 'spec-4', label: 'Device Dimensions', value: '34.9 x 36.4 x 49 cm', sortOrder: 1 },
    { id: 'row-17', specificationId: 'spec-4', label: 'Net Weight', value: '7.12 kg', sortOrder: 2 },
    { id: 'row-18', specificationId: 'spec-5', label: 'Brand', value: 'Elegoo', sortOrder: 0 },
    { id: 'row-19', specificationId: 'spec-5', label: 'Model', value: 'Mars 4 Ultra 9K', sortOrder: 1 },
    { id: 'row-20', specificationId: 'spec-5', label: 'Technology', value: 'MSLA Resin 3D Printing', sortOrder: 2 },
    { id: 'row-21', specificationId: 'spec-5', label: 'XY Resolution', value: '18 x 18 microns (9K)', sortOrder: 3 },
    { id: 'row-22', specificationId: 'spec-5', label: 'Build Volume', value: '153.3 x 77.7 x 165 mm', sortOrder: 4 },
    { id: 'row-23', specificationId: 'spec-5', label: 'OS & Storage', value: 'Linux OS with 4GB RAM', sortOrder: 5 },
    { id: 'row-24', specificationId: 'spec-6', label: 'Material', value: 'PLA (Polylactic Acid)', sortOrder: 0 },
    { id: 'row-25', specificationId: 'spec-6', label: 'Diameter', value: '1.75 mm ± 0.02 mm', sortOrder: 1 },
    { id: 'row-26', specificationId: 'spec-6', label: 'Print Temp', value: '190°C - 220°C', sortOrder: 2 },
    { id: 'row-27', specificationId: 'spec-6', label: 'Bed Temp', value: '0°C - 60°C', sortOrder: 3 },
    { id: 'row-28', specificationId: 'spec-6', label: 'Weight', value: '1.0 kg (Net)', sortOrder: 4 },
  ];

  const mockUsers: User[] = [
    {
      id: 'u-admin',
      email: 'admin@verogoods.in',
      name: 'Vero Admin',
      phone: '9999999999',
      role: 'admin',
      createdAt: now,
    },
    {
      id: 'u-cust1',
      email: 'test@example.com',
      name: 'Aravind Kumar',
      phone: '9876543210',
      role: 'customer',
      createdAt: now,
    }
  ];

  return {
    users: mockUsers,
    products: mockProducts,
    productImages: mockImages,
    productSpecifications: mockSpecs,
    productSpecificationRows: mockSpecRows,
    orders: [],
    orderItems: [],
  };
};

export async function getDb(): Promise<DatabaseSchema> {
  const client = await clientPromise;
  const db = client.db();

  // Helper to fetch collection or seed it if empty
  const fetchOrSeed = async <T>(collectionName: string, defaultData: T[]): Promise<T[]> => {
    const collection = db.collection(collectionName);
    const count = await collection.countDocuments();
    if (count === 0 && defaultData.length > 0) {
      // Seed initial data without mongodb generated _id field leaking to client
      await collection.insertMany(defaultData as any);
      return defaultData;
    }
    const docs = await collection.find({}).toArray();
    return docs.map(doc => {
      const { _id, ...rest } = doc;
      return rest as unknown as T;
    });
  };

  const initialState = getInitialDbState();

  const users = await fetchOrSeed<User>('users', initialState.users);
  const products = await fetchOrSeed<Product>('products', initialState.products);
  const productImages = await fetchOrSeed<ProductImage>('productImages', initialState.productImages);
  const productSpecifications = await fetchOrSeed<ProductSpecification>('productSpecifications', initialState.productSpecifications);
  const productSpecificationRows = await fetchOrSeed<ProductSpecificationRow>('productSpecificationRows', initialState.productSpecificationRows);
  const orders = await fetchOrSeed<Order>('orders', []);
  const orderItems = await fetchOrSeed<OrderItem>('orderItems', []);

  return {
    users,
    products,
    productImages,
    productSpecifications,
    productSpecificationRows,
    orders,
    orderItems,
  };
}

export async function saveDb(schema: DatabaseSchema): Promise<void> {
  const client = await clientPromise;
  const db = client.db();

  const saveCollection = async <T extends { id?: string }>(collectionName: string, data: T[]) => {
    const collection = db.collection(collectionName);
    // Clear and rewrite (simplest way to sync local state back to DB for sandbox mode)
    await collection.deleteMany({});
    if (data.length > 0) {
      await collection.insertMany(data as any);
    }
  };

  await saveCollection('users', schema.users);
  await saveCollection('products', schema.products);
  await saveCollection('productImages', schema.productImages);
  await saveCollection('productSpecifications', schema.productSpecifications);
  await saveCollection('productSpecificationRows', schema.productSpecificationRows);
  await saveCollection('orders', schema.orders);
  await saveCollection('orderItems', schema.orderItems);
}
