import { z } from 'zod';

export const createOrderItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  name: z.string().min(1),
  sku: z.string().optional(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  subtotal: z.coerce.number().min(0),
  modifiers: z.any().optional(),
});

export const createPaymentSchema = z.object({
  method: z.enum(['CASH', 'CARD', 'STORE_CREDIT']),
  amount: z.coerce.number().positive(),
  reference: z.string().optional(),
});

export const createOrderSchema = z.object({
  branchId: z.string().uuid(),
  shiftId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  type: z.enum(['SALE', 'RETURN', 'EXCHANGE']).default('SALE'),
  invoiceType: z.enum(['SIMPLIFIED', 'TAX']).optional(),
  idempotencyKey: z.string().uuid().optional(),
  subtotal: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0),
  paidAmount: z.coerce.number().min(0),
  changeAmount: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
  items: z.array(createOrderItemSchema).min(1),
  payments: z.array(createPaymentSchema).min(1),
});

export const refundOrderSchema = z.object({
  reason: z.string().optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().uuid(),
        quantity: z.coerce.number().positive(),
      }),
    )
    .optional(),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  branchId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'VOIDED', 'REFUNDED']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;
export type RefundOrderDto = z.infer<typeof refundOrderSchema>;
