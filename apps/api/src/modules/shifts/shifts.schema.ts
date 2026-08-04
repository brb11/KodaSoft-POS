import { z } from 'zod';

export const openShiftSchema = z.object({
  branchId: z.string().uuid(),
  openingCash: z.coerce.number().min(0).default(0),
  notes: z.string().optional(),
});

export const closeShiftSchema = z.object({
  closingCash: z.coerce.number().min(0),
  notes: z.string().optional(),
});

export type OpenShiftDto = z.infer<typeof openShiftSchema>;
export type CloseShiftDto = z.infer<typeof closeShiftSchema>;
