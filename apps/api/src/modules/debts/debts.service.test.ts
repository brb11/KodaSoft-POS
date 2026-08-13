import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    customer: { findFirst: vi.fn(), updateMany: vi.fn() },
    branch: { findFirst: vi.fn() },
    customerPayment: { create: vi.fn() },
    $transaction: vi.fn((arg: any) => Promise.resolve(arg(prisma))),
  };
  return { prismaMock: prisma };
});

vi.mock('../../lib/prisma', () => ({ prisma: prismaMock }));

import { recordSettlement } from './debts.service';

const DTO = { customerId: 'c1', branchId: 'b1', amount: 50, method: 'CASH' as const };

describe('recordSettlement', () => {
  beforeEach(() => vi.clearAllMocks());

  const customer = (creditBalance: number) => ({ id: 'c1', tenantId: 't1', creditBalance });

  it('records a settlement and decrements the balance atomically', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(customer(100));
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1', tenantId: 't1' });
    prismaMock.customerPayment.create.mockResolvedValue({ id: 'p1' });
    prismaMock.customer.updateMany.mockResolvedValue({ count: 1 });

    const out = await recordSettlement('t1', 'u1', DTO);

    expect(out).toEqual({ id: 'p1' });
    // The decrement is guarded by the current balance — never negative.
    expect(prismaMock.customer.updateMany).toHaveBeenCalledWith({
      where: { id: 'c1', tenantId: 't1', creditBalance: { gte: 50 } },
      data: { creditBalance: { decrement: 50 } },
    });
  });

  it('rejects a payment above the current balance', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(customer(10));
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1', tenantId: 't1' });

    await expect(recordSettlement('t1', 'u1', { ...DTO, amount: 50 })).rejects.toMatchObject({
      statusCode: 400,
      code: 'PAYMENT_EXCEEDS_BALANCE',
    });
    expect(prismaMock.customerPayment.create).not.toHaveBeenCalled();
  });

  it('rolls back the payment when the balance was consumed concurrently (race)', async () => {
    prismaMock.customer.findFirst.mockResolvedValue(customer(100));
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1', tenantId: 't1' });
    prismaMock.customerPayment.create.mockResolvedValue({ id: 'p1' });
    prismaMock.customer.updateMany.mockResolvedValue({ count: 0 }); // lost the race

    await expect(recordSettlement('t1', 'u1', DTO)).rejects.toMatchObject({
      statusCode: 409,
      code: 'PAYMENT_EXCEEDS_BALANCE',
    });
    // The payment row is created inside the transaction and rolled back on throw.
    expect(prismaMock.customerPayment.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.customer.updateMany).toHaveBeenCalledTimes(1);
  });
});
