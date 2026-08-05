import { z } from 'zod';

const heldOrderItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  nameAr: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().positive(),
  taxRate: z.coerce.number().nullable().optional(),
});

const customerSnapshotSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    phone: z.string().nullable().optional(),
  })
  .nullish();

export const createHeldOrderSchema = z.object({
  branchId: z.string().uuid(),
  items: z.array(heldOrderItemSchema).min(1).max(200),
  customer: customerSnapshotSchema,
  discount: z.coerce.number().min(0).default(0),
  discountType: z.enum(['percent', 'fixed']).default('percent'),
});

export const heldOrdersQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
});

export const heldOrderParamsSchema = z.object({
  id: z.string().uuid(),
});

export type CreateHeldOrderDto = z.infer<typeof createHeldOrderSchema>;
