import { z } from 'zod';

export const adjustmentItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  branchId: z.string().uuid(),
  quantity: z.number().refine((n) => n !== 0, 'Quantity must be non-zero'),
  note: z.string().max(300).optional(),
});

export const createAdjustmentSchema = z.object({
  items: z.array(adjustmentItemSchema).min(1).max(500),
});

export const adjustmentQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(50),
  branchId: z.string().uuid().optional(),
});

export type CreateAdjustmentDto = z.infer<typeof createAdjustmentSchema>;
