import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    supplier: { findFirst: vi.fn(), update: vi.fn() },
    branch: { findFirst: vi.fn() },
    product: { findMany: vi.fn() },
    purchaseInvoice: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    purchaseItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    supplierPayment: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    inventory: { updateMany: vi.fn(), create: vi.fn() },
    inventoryMovement: { create: vi.fn() },
    $transaction: vi.fn((arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : Promise.resolve(arg(prisma)),
    ),
  };
  return { prismaMock: prisma };
});

vi.mock('../../lib/prisma', () => ({ prisma: prismaMock }));

import {
  listPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  confirmPurchase,
  cancelPurchase,
  createSupplierPayment,
  listSupplierPayments,
} from './purchases.service';
import { AppError } from '../../middleware/error.middleware';

const TENANT = 'tenant-1';
const USER = 'user-1';

const expectAppError = (promise: Promise<unknown>, status: number, code?: string) =>
  expect(promise).rejects.toMatchObject(
    code ? { statusCode: status, code } : { statusCode: status },
  );

const installTransaction = () => {
  prismaMock.$transaction.mockImplementation((arg: any) =>
    typeof arg === 'function' ? arg(prismaMock) : Promise.resolve(arg),
  );
};

const baseItem = {
  productId: 'p1',
  name: 'Widget',
  quantity: 10,
  unitPrice: 100,
  discountAmount: 0,
  taxRate: 15,
};

const createDto = {
  supplierId: 's1',
  branchId: 'b1',
  invoiceNumber: 'INV-001',
  items: [baseItem],
  discountAmount: 0,
};

const draftInvoice = (overrides: Record<string, any> = {}) => ({
  id: 'inv1',
  tenantId: TENANT,
  supplierId: 's1',
  branchId: 'b1',
  invoiceNumber: 'INV-001',
  status: 'DRAFT',
  subtotal: 1000,
  taxAmount: 150,
  discountAmount: 0,
  total: 1000,
  paidAmount: 0,
  items: [
    {
      productId: 'p1',
      variantId: null,
      name: 'Widget',
      sku: 'W1',
      quantity: 10,
      unitPrice: 100,
      discountAmount: 0,
      taxAmount: 150,
      subtotal: 1150,
    },
  ],
  supplier: { id: 's1', name: 'Acme' },
  branch: { id: 'b1', name: 'Main' },
  ...overrides,
});

// ─── listPurchases ────────────────────────────────────────────────────────────

describe('listPurchases', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('returns paginated purchase invoices', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([]);
    prismaMock.purchaseInvoice.count.mockResolvedValue(0);

    const out = await listPurchases(TENANT, { page: 1, limit: 20 });
    expect(out.items).toEqual([]);
    expect(out.totalPages).toBe(0);
  });

  it('applies status filter', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([]);
    prismaMock.purchaseInvoice.count.mockResolvedValue(0);

    await listPurchases(TENANT, { page: 1, limit: 10, status: 'CONFIRMED' });

    const where = prismaMock.purchaseInvoice.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('CONFIRMED');
  });

  it('applies supplierId and branchId filters', async () => {
    prismaMock.purchaseInvoice.findMany.mockResolvedValue([]);
    prismaMock.purchaseInvoice.count.mockResolvedValue(0);

    await listPurchases(TENANT, { page: 1, limit: 10, supplierId: 's1', branchId: 'b1' });

    const where = prismaMock.purchaseInvoice.findMany.mock.calls[0][0].where;
    expect(where.supplierId).toBe('s1');
    expect(where.branchId).toBe('b1');
  });
});

// ─── getPurchaseById ──────────────────────────────────────────────────────────

describe('getPurchaseById', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('returns the invoice when found', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(draftInvoice());
    const out = await getPurchaseById(TENANT, 'inv1');
    expect(out.id).toBe('inv1');
  });

  it('throws 404 when not found', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(null);
    await expectAppError(getPurchaseById(TENANT, 'missing'), 404);
  });
});

// ─── createPurchase ───────────────────────────────────────────────────────────

describe('createPurchase', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('creates a purchase invoice with calculated totals', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1' });
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(null); // no duplicate
    prismaMock.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Widget', sku: 'W1' }]);
    prismaMock.purchaseInvoice.create.mockResolvedValue(draftInvoice());

    const out = await createPurchase(TENANT, USER, createDto);

    expect(out).toBeDefined();
    expect(prismaMock.purchaseInvoice.create).toHaveBeenCalledTimes(1);

    const createArg = prismaMock.purchaseInvoice.create.mock.calls[0][0];
    expect(createArg.data.supplierId).toBe('s1');
    expect(createArg.data.branchId).toBe('b1');
    expect(createArg.data.invoiceNumber).toBe('INV-001');
    expect(createArg.data.createdBy).toBe(USER);
    // lineSubtotal = 10 * 100 = 1000, taxable = 1000, tax = 150, line total = 1150
    expect(createArg.data.subtotal).toBe(1150);
    expect(createArg.data.taxAmount).toBe(150);
  });

  it('throws when supplier not found', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    await expectAppError(createPurchase(TENANT, USER, createDto), 400, 'SUPPLIER_NOT_FOUND');
  });

  it('throws when branch not found', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1' });
    prismaMock.branch.findFirst.mockResolvedValue(null);
    await expectAppError(createPurchase(TENANT, USER, createDto), 400, 'BRANCH_NOT_FOUND');
  });

  it('throws on duplicate invoice number', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1' });
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue({ id: 'existing' });

    await expectAppError(createPurchase(TENANT, USER, createDto), 400, 'DUPLICATE_INVOICE_NUMBER');
  });

  it('throws when a product does not exist in tenant', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1' });
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(null);
    prismaMock.product.findMany.mockResolvedValue([]); // no products found

    await expectAppError(createPurchase(TENANT, USER, createDto), 400, 'PRODUCT_NOT_FOUND');
  });

  it('clamps discountAmount to subtotal', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1' });
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(null);
    prismaMock.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Widget', sku: 'W1' }]);
    prismaMock.purchaseInvoice.create.mockResolvedValue(draftInvoice());

    await createPurchase(TENANT, USER, { ...createDto, discountAmount: 999999 });

    const createArg = prismaMock.purchaseInvoice.create.mock.calls[0][0];
    expect(createArg.data.discountAmount).toBe(1150); // clamped to subtotal (which includes tax)
  });
});

// ─── updatePurchase ───────────────────────────────────────────────────────────

describe('updatePurchase', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('updates a draft invoice', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(draftInvoice());
    prismaMock.purchaseInvoice.update.mockResolvedValue(draftInvoice());

    const out = await updatePurchase(TENANT, 'inv1', { notes: 'Updated' });
    expect(out).toBeDefined();
    expect(prismaMock.purchaseInvoice.update).toHaveBeenCalled();
  });

  it('throws 404 when invoice not found', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(null);
    await expectAppError(updatePurchase(TENANT, 'missing', { notes: 'x' }), 404);
  });

  it('blocks editing a confirmed invoice', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(draftInvoice({ status: 'CONFIRMED' }));
    await expectAppError(updatePurchase(TENANT, 'inv1', { notes: 'x' }), 400, 'INVOICE_CONFIRMED');
  });

  it('blocks editing a cancelled invoice', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(draftInvoice({ status: 'CANCELLED' }));
    await expectAppError(updatePurchase(TENANT, 'inv1', { notes: 'x' }), 400, 'INVOICE_CANCELLED');
  });
});

// ─── cancelPurchase ──────────────────────────────────────────────────────────

describe('cancelPurchase', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('cancels a draft invoice', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(draftInvoice());
    prismaMock.purchaseInvoice.update.mockResolvedValue({ id: 'inv1', status: 'CANCELLED' });

    const out = await cancelPurchase(TENANT, 'inv1');
    expect(out.status).toBe('CANCELLED');
  });

  it('throws 404 when not found', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(null);
    await expectAppError(cancelPurchase(TENANT, 'missing'), 404);
  });

  it('throws when already cancelled', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(draftInvoice({ status: 'CANCELLED' }));
    await expectAppError(cancelPurchase(TENANT, 'inv1'), 400);
  });

  it('throws when invoice is confirmed (must use return)', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(draftInvoice({ status: 'CONFIRMED' }));
    await expectAppError(cancelPurchase(TENANT, 'inv1'), 400, 'INVOICE_CONFIRMED');
  });
});

// ─── confirmPurchase ─────────────────────────────────────────────────────────

describe('confirmPurchase', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('confirms a draft and updates inventory + supplier balance', async () => {
    const inv = draftInvoice();
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(inv);
    prismaMock.inventory.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.supplier.update.mockResolvedValue({});
    prismaMock.purchaseInvoice.update.mockResolvedValue({});
    // After confirming, getPurchaseById is called
    prismaMock.purchaseInvoice.findFirst.mockResolvedValueOnce(inv);

    await confirmPurchase(TENANT, USER, 'inv1', 'b1');

    // Stock was incremented
    expect(prismaMock.inventory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quantity: { increment: 10 } },
      }),
    );
    // Supplier balance increased
    expect(prismaMock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { balance: { increment: 1000 } },
      }),
    );
    // Status set to CONFIRMED
    expect(prismaMock.purchaseInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CONFIRMED' }),
      }),
    );
  });

  it('creates inventory record when none exists for the product', async () => {
    const inv = draftInvoice();
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(inv);
    prismaMock.inventory.updateMany.mockResolvedValue({ count: 0 }); // no existing inventory
    prismaMock.inventory.create.mockResolvedValue({});
    prismaMock.supplier.update.mockResolvedValue({});
    prismaMock.purchaseInvoice.update.mockResolvedValue({});

    await confirmPurchase(TENANT, USER, 'inv1', 'b1');

    expect(prismaMock.inventory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: 'p1',
          branchId: 'b1',
          quantity: 10,
        }),
      }),
    );
  });

  it('creates stock movement for each item', async () => {
    const inv = draftInvoice();
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(inv);
    prismaMock.inventory.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.supplier.update.mockResolvedValue({});
    prismaMock.purchaseInvoice.update.mockResolvedValue({});

    await confirmPurchase(TENANT, USER, 'inv1', 'b1');

    expect(prismaMock.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'purchase',
          productId: 'p1',
          referenceId: 'inv1',
          referenceType: 'purchase',
        }),
      }),
    );
  });

  it('throws 404 when invoice not found', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(null);
    await expectAppError(confirmPurchase(TENANT, USER, 'missing', 'b1'), 404);
  });

  it('throws when already confirmed', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(draftInvoice({ status: 'CONFIRMED' }));
    await expectAppError(confirmPurchase(TENANT, USER, 'inv1', 'b1'), 400);
  });

  it('throws when cancelled', async () => {
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(draftInvoice({ status: 'CANCELLED' }));
    await expectAppError(confirmPurchase(TENANT, USER, 'inv1', 'b1'), 400);
  });
});

// ─── createSupplierPayment ───────────────────────────────────────────────────

describe('createSupplierPayment', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('records a standalone payment (no linked invoice)', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1', balance: 500 });
    prismaMock.supplierPayment.create.mockResolvedValue({ id: 'pay1' });
    prismaMock.supplier.update.mockResolvedValue({});

    const out = await createSupplierPayment(TENANT, USER, {
      supplierId: 's1',
      amount: 200,
      method: 'CASH',
    });

    expect(out).toEqual({ id: 'pay1' });
    expect(prismaMock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { balance: { decrement: 200 } },
      }),
    );
    // No invoice update
    expect(prismaMock.purchaseInvoice.update).not.toHaveBeenCalled();
  });

  it('records payment linked to a confirmed invoice', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1', balance: 1000 });
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue({
      id: 'inv1',
      total: 1000,
      paidAmount: 0,
      status: 'CONFIRMED',
    });
    prismaMock.supplierPayment.create.mockResolvedValue({ id: 'pay1' });
    prismaMock.supplier.update.mockResolvedValue({});
    prismaMock.purchaseInvoice.update.mockResolvedValue({});

    await createSupplierPayment(TENANT, USER, {
      supplierId: 's1',
      purchaseInvoiceId: 'inv1',
      amount: 500,
      method: 'BANK_TRANSFER',
    });

    expect(prismaMock.purchaseInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { paidAmount: 500 },
      }),
    );
  });

  it('throws when supplier not found', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    await expectAppError(
      createSupplierPayment(TENANT, USER, { supplierId: 'missing', amount: 100, method: 'CASH' }),
      404,
      'SUPPLIER_NOT_FOUND',
    );
  });

  it('throws when linked invoice not found', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1', balance: 500 });
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue(null);

    await expectAppError(
      createSupplierPayment(TENANT, USER, {
        supplierId: 's1',
        purchaseInvoiceId: 'missing',
        amount: 100,
        method: 'CASH',
      }),
      404,
      'PURCHASE_INVOICE_NOT_FOUND',
    );
  });

  it('throws when linked invoice is not CONFIRMED', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1', balance: 500 });
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue({
      id: 'inv1', total: 1000, paidAmount: 0, status: 'DRAFT',
    });

    await expectAppError(
      createSupplierPayment(TENANT, USER, {
        supplierId: 's1',
        purchaseInvoiceId: 'inv1',
        amount: 100,
        method: 'CASH',
      }),
      400,
      'INVOICE_NOT_CONFIRMED',
    );
  });

  it('throws when payment exceeds remaining invoice balance', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1', balance: 500 });
    prismaMock.purchaseInvoice.findFirst.mockResolvedValue({
      id: 'inv1', total: 1000, paidAmount: 900, status: 'CONFIRMED',
    });

    await expectAppError(
      createSupplierPayment(TENANT, USER, {
        supplierId: 's1',
        purchaseInvoiceId: 'inv1',
        amount: 200, // remaining = 100
        method: 'CASH',
      }),
      400,
      'PAYMENT_EXCEEDS_BALANCE',
    );
  });
});

// ─── listSupplierPayments ────────────────────────────────────────────────────

describe('listSupplierPayments', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('returns paginated supplier payments', async () => {
    prismaMock.supplierPayment.findMany.mockResolvedValue([]);
    prismaMock.supplierPayment.count.mockResolvedValue(0);

    const out = await listSupplierPayments(TENANT, { page: 1, limit: 20 });
    expect(out.items).toEqual([]);
    expect(out.totalPages).toBe(0);
  });

  it('applies supplierId filter', async () => {
    prismaMock.supplierPayment.findMany.mockResolvedValue([]);
    prismaMock.supplierPayment.count.mockResolvedValue(0);

    await listSupplierPayments(TENANT, { page: 1, limit: 10, supplierId: 's1' });

    const where = prismaMock.supplierPayment.findMany.mock.calls[0][0].where;
    expect(where.supplierId).toBe('s1');
  });
});
