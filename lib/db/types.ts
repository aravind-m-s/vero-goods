// Pure type definitions — no Node.js imports.
// Safe to import in both Client and Server Components.

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: 'admin' | 'customer';
  createdAt: string;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  sortOrder: number;
}

export interface ProductSpecification {
  id: string;
  productId: string;
  heading: string;
  sortOrder: number;
}

export interface ProductSpecificationRow {
  id: string;
  specificationId: string;
  label: string;
  value: string;
  sortOrder: number;
}

export interface OrderAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pinCode: string;
  country: string;
}

export enum OrderStatus {
  PLACED = "PLACED",
  CONFIRMED = "CONFIRMED",
  PACKED = "PACKED",
  SHIPPED = "SHIPPED",
  OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY",
  DELIVERED = "DELIVERED",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  PAID = "PAID",
  FAILED = "FAILED",
  COD = "COD",
  REFUNDED = "REFUNDED",
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  email: string;
  customerName: string;
  phone: string;
  shippingAddress: OrderAddress;
  totalAmount: number;
  paymentMethod: 'COD' | 'RAZORPAY';
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  trackingToken: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productTitle: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

export interface DatabaseSchema {
  users: User[];
  products: Product[];
  productImages: ProductImage[];
  productSpecifications: ProductSpecification[];
  productSpecificationRows: ProductSpecificationRow[];
  orders: Order[];
  orderItems: OrderItem[];
}
