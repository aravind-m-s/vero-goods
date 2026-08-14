import React from 'react';
import { Badge } from '@/shared/ui/badge';
import { OrderStatus } from '@/features/orders/types';

/**
 * One definition of how a status looks and reads, shared by the tracking page
 * and the account order history so the two never drift apart.
 */
export const STATUS_BADGES: Record<
  OrderStatus,
  'default' | 'info' | 'warning' | 'success' | 'danger'
> = {
  [OrderStatus.PLACED]: 'warning',
  [OrderStatus.CONFIRMED]: 'info',
  [OrderStatus.PACKED]: 'info',
  [OrderStatus.SHIPPED]: 'info',
  [OrderStatus.OUT_FOR_DELIVERY]: 'info',
  [OrderStatus.DELIVERED]: 'success',
  [OrderStatus.CANCELLED]: 'danger',
  [OrderStatus.RETURN_REQUESTED]: 'warning',
  [OrderStatus.RETURNED]: 'danger',
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PLACED]: 'Order placed',
  [OrderStatus.CONFIRMED]: 'Confirmed',
  [OrderStatus.PACKED]: 'Packed',
  [OrderStatus.SHIPPED]: 'Shipped',
  [OrderStatus.OUT_FOR_DELIVERY]: 'Out for delivery',
  [OrderStatus.DELIVERED]: 'Delivered',
  [OrderStatus.CANCELLED]: 'Cancelled',
  [OrderStatus.RETURN_REQUESTED]: 'Return requested',
  [OrderStatus.RETURNED]: 'Returned',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_BADGES[status]}>{STATUS_LABELS[status]}</Badge>;
}
