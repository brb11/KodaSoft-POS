import { z } from 'zod';

const purchaseItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  name: z.string().min(1),
  sku: z.string().optional(),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Price must be non-negative'),
  discountAmount: z.number().min(0).default(0),
  taxRate: z.number().min(0).max(100).default(15),
});

export const createPurchaseSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid(),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, 'At least one item is required'),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export const updatePurchaseSchema = z.object({
  supplierId: z.string().uuid().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1).optional(),
  discountAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

export const purchaseQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  supplierId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const confirmPurchaseSchema = z.object({
  branchId: z.string().uuid(),
});

export const createSupplierPaymentSchema = z.object({
  supplierId: z.string().uuid(),
  purchaseInvoiceId: z.string().uuid().optional(),
  amount: z.number().positive('Amount must be positive'),
  method: z.enum(['CASH', 'BANK_TRANSFER', 'CARD', 'CHECK']).default('CASH'),
  reference: z.string().optional(),
  note: z.string().optional(),
});

export const supplierPaymentQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(200).default(20),
  supplierId: z.string().uuid().optional(),
});

export type CreatePurchaseDto = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseDto = z.infer<typeof updatePurchaseSchema>;
export type ConfirmPurchaseDto = z.infer<typeof confirmPurchaseSchema>;
export type CreateSupplierPaymentDto = z.infer<typeof createSupplierPaymentSchema>;
