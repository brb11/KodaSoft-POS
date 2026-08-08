import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const signupSchema = z.object({
  storeName: z.string().min(2, 'Store name is required'),
  ownerName: z.string().min(2, 'Owner name is required'),
  email: z.string().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  branchName: z.string().min(1).optional(),
  branchAddress: z.string().optional(),
  plan: z.string().optional(),
});

export const pinLoginSchema = z.object({
  pin: z.string().length(4).regex(/^\d+$/, 'PIN must be 4 digits'),
  branchId: z.string().uuid(),
});

export type LoginDto = z.infer<typeof loginSchema>;
export type SignupDto = z.infer<typeof signupSchema>;
export type PinLoginDto = z.infer<typeof pinLoginSchema>;
