import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    supplier: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    purchaseInvoice: { count: vi.fn() },
    $transaction: vi.fn((arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : Promise.resolve(arg(prisma)),
    ),
  };
  return { prismaMock: prisma };
});

vi.mock('../../lib/prisma', () => ({ prisma: prismaMock }));

import { getSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier } from './suppliers.service';
import { AppError } from '../../middleware/error.middleware';

const TENANT = 'tenant-1';

const expectAppError = (promise: Promise<unknown>, status: number, code?: string) =>
  expect(promise).rejects.toMatchObject(
    code ? { statusCode: status, code } : { statusCode: status },
  );

const installTransaction = () => {
  prismaMock.$transaction.mockImplementation((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : Promise.resolve(arg(prismaMock)),
  );
};

describe('getSuppliers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('returns paginated suppliers with counts', async () => {
    const items = [{ id: 's1', name: 'Acme', _count: { purchaseInvoices: 3, supplierPayments: 1 } }];
    prismaMock.supplier.findMany.mockResolvedValue(items);
    prismaMock.supplier.count.mockResolvedValue(1);

    const out = await getSuppliers(TENANT, { page: 1, limit: 20 });

    expect(out.items).toEqual(items);
    expect(out.total).toBe(1);
    expect(out.totalPages).toBe(1);
    expect(prismaMock.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT } }),
    );
  });

  it('applies search filter across name, nameAr, phone, email', async () => {
    prismaMock.supplier.findMany.mockResolvedValue([]);
    prismaMock.supplier.count.mockResolvedValue(0);

    await getSuppliers(TENANT, { page: 1, limit: 10, search: 'test' });

    const where = prismaMock.supplier.findMany.mock.calls[0][0].where;
    expect(where.OR).toHaveLength(4);
    expect(where.OR[0]).toEqual({ name: { contains: 'test', mode: 'insensitive' } });
  });

  it('applies isActive filter', async () => {
    prismaMock.supplier.findMany.mockResolvedValue([]);
    prismaMock.supplier.count.mockResolvedValue(0);

    await getSuppliers(TENANT, { page: 1, limit: 10, isActive: false });

    const where = prismaMock.supplier.findMany.mock.calls[0][0].where;
    expect(where.isActive).toBe(false);
  });
});

describe('getSupplierById', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('returns the supplier when found', async () => {
    const supplier = { id: 's1', name: 'Acme', purchaseInvoices: [], supplierPayments: [] };
    prismaMock.supplier.findFirst.mockResolvedValue(supplier);

    const out = await getSupplierById(TENANT, 's1');
    expect(out).toEqual(supplier);
  });

  it('throws 404 when not found', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    await expectAppError(getSupplierById(TENANT, 'missing'), 404);
  });
});

describe('createSupplier', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('creates a supplier with all fields', async () => {
    const created = { id: 's1', name: 'Acme', tenantId: TENANT };
    prismaMock.supplier.create.mockResolvedValue(created);

    const out = await createSupplier(TENANT, {
      name: 'Acme',
      nameAr: 'أكمي',
      email: 'a@b.com',
      phone: '+966500',
      address: 'Riyadh',
      city: 'Riyadh',
      vatNumber: '12345',
      contactPerson: 'John',
      notes: 'Test',
    });

    expect(out).toEqual(created);
    expect(prismaMock.supplier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: TENANT,
        name: 'Acme',
        nameAr: 'أكمي',
        email: 'a@b.com',
        phone: '+966500',
      }),
    });
  });

  it('creates a supplier with minimal fields (name only)', async () => {
    prismaMock.supplier.create.mockResolvedValue({ id: 's1', name: 'Acme' });

    await createSupplier(TENANT, { name: 'Acme' });

    expect(prismaMock.supplier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Acme',
        nameAr: null,
        email: null,
        phone: null,
      }),
    });
  });
});

describe('updateSupplier', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('updates an existing supplier', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1' });
    prismaMock.supplier.update.mockResolvedValue({ id: 's1', name: 'Updated' });

    const out = await updateSupplier(TENANT, 's1', { name: 'Updated' });
    expect(out).toEqual({ id: 's1', name: 'Updated' });
    expect(prismaMock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' } }),
    );
  });

  it('throws 404 when supplier not found', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    await expectAppError(updateSupplier(TENANT, 'missing', { name: 'x' }), 404, 'SUPPLIER_NOT_FOUND');
  });

  it('sets nullable fields to null when empty string passed', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1' });
    prismaMock.supplier.update.mockResolvedValue({ id: 's1' });

    await updateSupplier(TENANT, 's1', { email: '', phone: '', notes: '' });

    expect(prismaMock.supplier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ email: null, phone: null, notes: null }),
      }),
    );
  });
});

describe('deleteSupplier', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('deletes a clean supplier', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1', balance: 0 });
    prismaMock.purchaseInvoice.count.mockResolvedValue(0);
    prismaMock.supplier.deleteMany.mockResolvedValue({ count: 1 });

    const out = await deleteSupplier(TENANT, 's1');
    expect(out).toEqual({ id: 's1' });
  });

  it('throws 404 when supplier not found', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(null);
    await expectAppError(deleteSupplier(TENANT, 'missing'), 404, 'SUPPLIER_NOT_FOUND');
  });

  it('blocks deletion when supplier has purchase invoices', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1', balance: 0 });
    prismaMock.purchaseInvoice.count.mockResolvedValue(3);

    await expectAppError(deleteSupplier(TENANT, 's1'), 400, 'SUPPLIER_HAS_INVOICES');
    expect(prismaMock.supplier.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks deletion when supplier has outstanding balance', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue({ id: 's1', balance: 500 });
    prismaMock.purchaseInvoice.count.mockResolvedValue(0);

    await expectAppError(deleteSupplier(TENANT, 's1'), 400, 'SUPPLIER_HAS_BALANCE');
    expect(prismaMock.supplier.deleteMany).not.toHaveBeenCalled();
  });
});
