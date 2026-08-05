import { z } from 'zod';

export const zatcaModeSchema = z.enum(['sandbox', 'production']);

export const generateCredentialsSchema = z.object({
  mode: zatcaModeSchema.optional().default('sandbox'),
  vatNumber: z.string().min(15, 'VAT must be 15 digits').max(15),
  invoiceType: z.enum(['SIMPLIFIED', 'TAX']).optional().default('SIMPLIFIED'),
});

export const complianceCsidSchema = z.object({
  mode: zatcaModeSchema.optional().default('sandbox'),
  otp: z.string().min(1, 'OTP is required'),
});

export const productionCsidSchema = z.object({
  otp: z.string().min(1, 'OTP is required'),
});

export const setEnabledSchema = z.object({
  enabled: z.boolean(),
  mode: zatcaModeSchema.optional().default('sandbox'),
});

export const submissionParamsSchema = z.object({
  id: z.string().min(1),
});

export const submissionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  status: z.string().optional(),
});

export type GenerateCredentialsDto = z.infer<typeof generateCredentialsSchema>;
export type ComplianceCsidDto = z.infer<typeof complianceCsidSchema>;
export type ProductionCsidDto = z.infer<typeof productionCsidSchema>;
export type SetEnabledDto = z.infer<typeof setEnabledSchema>;
