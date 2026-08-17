import { z } from 'zod';
import { OrderStatus } from '@/features/orders/types';

export const OrderStatusUpdateSchema = z.object({
  status: z.enum(OrderStatus),
  note: z.string().max(500).optional(),
  trackingNumber: z.string().max(80).optional(),
  courier: z.string().max(80).optional(),
});

/**
 * Shipment details on their own, with no status move attached.
 *
 * The AWB is issued by the courier, which is often hours after the parcel is
 * handed over — so shipping an order cannot wait on it. This is the endpoint
 * that fills it in afterwards. At least one field must be present, or the call
 * is a write that changes nothing.
 */
export const OrderShipmentUpdateSchema = z
  .object({
    trackingNumber: z.string().max(80).optional(),
    courier: z.string().max(80).optional(),
  })
  .refine((data) => data.trackingNumber !== undefined || data.courier !== undefined, {
    message: 'Provide a tracking number, a courier, or both',
  });

/**
 * Capped at 100. Each order in the batch is its own read, transition check and
 * write, so an uncapped list is a request that never finishes.
 */
export const OrderBulkStatusUpdateSchema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(100),
  status: z.enum(OrderStatus),
  note: z.string().max(500).optional(),
});

export const ExportFilterSchema = z.object({
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  supplier: z.string().optional(),
});
