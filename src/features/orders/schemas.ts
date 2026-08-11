import { z } from 'zod';
import { OrderStatus } from '@/features/orders/types';

export const OrderStatusUpdateSchema = z.object({
  status: z.enum(OrderStatus),
  note: z.string().max(500).optional(),
  trackingNumber: z.string().max(80).optional(),
  courier: z.string().max(80).optional(),
});

export const ExportFilterSchema = z.object({
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
