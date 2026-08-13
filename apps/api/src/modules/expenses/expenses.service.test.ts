import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    branch: { findFirst: vi.fn() },
    shift: { findFirst: vi.fn() },
    expense: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), delete: vi.fn(), count: vi.fn() },
  };
  return { prismaMock: prisma };
});

vi.mock('../../lib/prisma', () => ({ prisma: prismaMock }));

import { createExpense, deleteExpense } from './expenses.service';

const DTO = { branchId: 'b1', shiftId: 's1', category: 'SUPPLIES' as const, amount: 25.5, description: 'Pens' };

describe('createExpense', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a branch that does not belong to the tenant', async () => {
    prismaMock.branch.findFirst.mockResolvedValue(null);
    await expect(createExpense('t1', 'u1', 'CASHIER', DTO)).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.expense.create).not.toHaveBeenCalled();
  });

  it('rejects an expense attached to a closed shift', async () => {
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prismaMock.shift.findFirst.mockResolvedValue({ id: 's1', status: 'CLOSED' });
    await expect(createExpense('t1', 'u1', 'CASHIER', DTO)).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.expense.create).not.toHaveBeenCalled();
  });

  it('allows an expense on the open shift', async () => {
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prismaMock.shift.findFirst.mockResolvedValue({ id: 's1', status: 'OPEN' });
    prismaMock.expense.create.mockResolvedValue({ id: 'e1' });
    const out = await createExpense('t1', 'u1', 'CASHIER', DTO);
    expect(out).toEqual({ id: 'e1' });
    expect(prismaMock.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ branchId: 'b1', shiftId: 's1', amount: 25.5 }),
      }),
    );
  });

  it('blocks cash withdrawals for cashiers', async () => {
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prismaMock.shift.findFirst.mockResolvedValue({ id: 's1', status: 'OPEN' });
    await expect(
      createExpense('t1', 'u1', 'CASHIER', { ...DTO, category: 'WITHDRAWAL' }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(prismaMock.expense.create).not.toHaveBeenCalled();
  });

  it('allows withdrawals for a manager', async () => {
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prismaMock.shift.findFirst.mockResolvedValue({ id: 's1', status: 'OPEN' });
    prismaMock.expense.create.mockResolvedValue({ id: 'e1' });
    const out = await createExpense('t1', 'u1', 'MANAGER', { ...DTO, category: 'WITHDRAWAL' });
    expect(out).toEqual({ id: 'e1' });
  });
});

describe('deleteExpense', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks deleting an expense from a closed shift', async () => {
    prismaMock.expense.findFirst.mockResolvedValue({ id: 'e1', shift: { status: 'CLOSED' } });
    await expect(deleteExpense('t1', 'e1')).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.expense.delete).not.toHaveBeenCalled();
  });

  it('allows deleting an expense from an open shift', async () => {
    prismaMock.expense.findFirst.mockResolvedValue({ id: 'e1', shift: { status: 'OPEN' } });
    prismaMock.expense.delete.mockResolvedValue({ id: 'e1' });
    const out = await deleteExpense('t1', 'e1');
    expect(out).toEqual({ success: true });
  });
});
