import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    branch: { findFirst: vi.fn() },
    shift: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    payment: { aggregate: vi.fn() },
    expense: { findMany: vi.fn() },
  };
  return { prismaMock: prisma };
});

vi.mock('../../lib/prisma', () => ({ prisma: prismaMock }));

import { openShift, closeShift } from './shifts.service';

describe('openShift', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires a branch id', async () => {
    await expect(openShift('t1', '', 'u1', 0)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('blocks opening a shift in a branch of another tenant', async () => {
    prismaMock.branch.findFirst.mockResolvedValue(null);
    await expect(openShift('t1', 'b1', 'u1', 100)).rejects.toMatchObject({ code: 'BRANCH_NOT_FOUND' });
    expect(prismaMock.shift.create).not.toHaveBeenCalled();
  });

  it('opens a shift when the branch belongs to the tenant', async () => {
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1', tenantId: 't1' });
    prismaMock.shift.findFirst.mockResolvedValue(null);
    prismaMock.shift.create.mockResolvedValue({ id: 's1' });
    const out = await openShift('t1', 'b1', 'u1', 100);
    expect(out).toEqual({ id: 's1' });
    expect(prismaMock.shift.create).toHaveBeenCalledWith({
      data: { branchId: 'b1', userId: 'u1', openingCash: 100 },
    });
  });

  it('rejects when the user already has an open shift', async () => {
    prismaMock.branch.findFirst.mockResolvedValue({ id: 'b1', tenantId: 't1' });
    prismaMock.shift.findFirst.mockResolvedValue({ id: 's1' });
    await expect(openShift('t1', 'b1', 'u1', 100)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('closeShift', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks closing a shift from another tenant', async () => {
    prismaMock.shift.findUnique.mockResolvedValue({ id: 's1', branch: { tenantId: 'other' } });
    await expect(closeShift('t1', 's1', 100)).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.shift.update).not.toHaveBeenCalled();
  });
});
