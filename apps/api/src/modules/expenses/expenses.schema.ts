import { z } from 'zod';

export const expenseCategorySchema = z.enum(['GENERAL', 'SUPPLIES', 'UTILITIES', 'WITHDRAWAL', 'OTHER']);

export const createExpenseSchema = z.object({
  branchId: z.string().uuid(),
  shiftId: z.string().uuid().optional(),
  category: expenseCategorySchema,
  amount: z.coerce.number().positive(),
  description: z.string().min(1).max(500),
  paidFromCash: z.boolean().optional(),
});

export const expenseQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  branchId: z.string().uuid().optional(),
  shiftId: z.string().uuid().optional(),
  category: expenseCategorySchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;
