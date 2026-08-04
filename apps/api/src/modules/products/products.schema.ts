import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  price: z.coerce.number().positive(),
  cost: z.coerce.number().min(0).default(0),
  taxRateId: z.string().uuid().optional(),
  unit: z.string().default('pcs'),
  trackInventory: z.boolean().default(true),
  type: z.enum(['retail', 'fnb']).default('retail'),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(5000).default(20),
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  isActive: z.preprocess((val) => {
    if (val === 'true' || val === '1') return true;
    if (val === 'false' || val === '0') return false;
    return undefined;
  }, z.boolean().optional()),
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
