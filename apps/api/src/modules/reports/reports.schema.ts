import { z } from 'zod';

const optionalUuid = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : v),
  z.string().uuid().optional()
);

const optionalDate = z.preprocess(
  (v) => (v === '' || v === undefined ? undefined : v),
  z
    .string()
    .refine((s) => !isNaN(new Date(s).getTime()), 'Invalid date')
    .optional()
);

// Cap the window to 92 days so unbounded from/to ranges cannot force the API
// to load the tenant's entire order history.
const rangeFields = {
  branchId: optionalUuid,
  from: optionalDate,
  to: optionalDate,
};

export const summaryQuerySchema = z.object(rangeFields);

export const dailyQuerySchema = z.object({
  branchId: optionalUuid,
  days: z.coerce.number().int('days must be an integer').min(1).max(92).default(7),
});

export const topProductsQuerySchema = z.object({
  branchId: optionalUuid,
  limit: z.coerce.number().int('limit must be an integer').min(1).max(100).default(10),
});

export const hourlyQuerySchema = z.object({
  branchId: optionalUuid,
});

export const recentOrdersQuerySchema = z.object({
  limit: z.coerce.number().int('limit must be an integer').min(1).max(100).default(15),
});

export const salesQuerySchema = z.object({
  ...rangeFields,
  period: z.enum(['today', 'week', 'month', 'year', 'all', 'custom']).default('all'),
  groupBy: z.enum(['branch', 'cashier', 'customer', 'payment', 'product', 'category']).optional(),
});

export const debtsQuerySchema = z.object(rangeFields);
export const expensesQuerySchema = z.object(rangeFields);

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;
export type DailyQuery = z.infer<typeof dailyQuerySchema>;
export type TopProductsQuery = z.infer<typeof topProductsQuerySchema>;
export type RecentOrdersQuery = z.infer<typeof recentOrdersQuerySchema>;
export type SalesQuery = z.infer<typeof salesQuerySchema>;
export type RangeQuery = z.infer<typeof summaryQuerySchema>;
