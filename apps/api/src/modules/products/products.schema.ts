import { z } from 'zod';

export const productUnitSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(50),
  barcode: z.string().max(100).optional(),
  factor: z.coerce.number().positive(),
  price: z.coerce.number().min(0),
});

export const createProductSchema = z.object({
  name: z.string().min(1),
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
  units: z.array(productUnitSchema).max(50).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  // Allow explicitly clearing the base unit label on edit.
  unit: z.string().max(30).nullable().optional(),
  // Allow toggling the product status from the UI (activate/reactivate).
  isActive: z.boolean().optional(),
});

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
