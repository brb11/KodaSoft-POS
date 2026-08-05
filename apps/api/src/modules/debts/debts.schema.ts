import { z } from 'zod';

export const createSettlementSchema = z.object({
  customerId: z.string().uuid(),
  branchId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  method: z.enum(['CASH', 'CARD', 'MADA', 'VISA', 'MASTERCARD', 'APPLE_PAY', 'STC_PAY', 'BANK_TRANSFER']),
  reference: z.string().optional(),
  note: z.string().optional(),
});

export const settlementQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  customerId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const statementQuerySchema = z.object({
  customerId: z.string().uuid(),
});

export type CreateSettlementDto = z.infer<typeof createSettlementSchema>;
