import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  slug: z.string().min(1),
  imageUrl: z.string().url().optional(),
  parentId: z.string().uuid().optional(),
  sortOrder: z.coerce.number().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
