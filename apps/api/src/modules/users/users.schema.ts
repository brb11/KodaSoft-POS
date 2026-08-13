import { z } from 'zod';

// Tenant-level roles only. SUPER_ADMIN is a platform role and can never be
// assigned at tenant level — it would otherwise grant full SaaS-console access
// (see /api/v1/saas/**) via a single manager-created user.
export const tenantRoleSchema = z.enum(['CASHIER', 'MANAGER', 'OWNER']);

// The web UI always sends password/pin/branchId (possibly empty strings when
// "unchanged"). Treat ''/null as "not provided" so an empty string does not
// fail min-length/uuid validation and does not overwrite the stored value.
const optionalPassword = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().min(8, 'Password must be at least 8 characters').optional()
);

const optionalPin = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z
    .string()
    .length(4, 'PIN must be exactly 4 digits')
    .regex(/^\d{4}$/, 'PIN must be exactly 4 digits')
    .optional()
);

const optionalBranchId = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.string().uuid().nullable()
);

const baseFields = {
  name: z.string().min(1).max(120),
  email: z.string().email(),
  branchId: optionalBranchId,
  password: optionalPassword,
  pin: optionalPin,
};

export const createUserSchema = z.object({
  ...baseFields,
  role: tenantRoleSchema,
});

export const updateUserSchema = z
  .object({
    ...baseFields,
    role: tenantRoleSchema.optional(),
    email: z.string().email().optional(),
    isActive: z.boolean().optional(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
