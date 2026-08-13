import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    notification: { deleteMany: vi.fn() },
    $transaction: vi.fn((arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : Promise.resolve(arg(prisma)),
    ),
  };
  return { prismaMock: prisma };
});

vi.mock('../../lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('../billing/plans', () => ({
  assertPlanLimit: vi.fn(async () => {}),
  assertFeatureAccess: vi.fn(async () => {}),
  getPlan: vi.fn(),
  PLANS: [],
}));
vi.mock('../auth/auth.service', () => ({ revokeUserSessions: vi.fn(async () => {}) }));

import { createUser, updateUser, deleteUser } from './users.service';
import { AppError } from '../../middleware/error.middleware';

const TENANT = 'tenant-1';
const MANAGER_ROW = { id: 'u1', role: 'MANAGER', branchId: null, isActive: true };
const OWNER_ROW = { id: 'u1', role: 'OWNER', branchId: null, isActive: true };

const expectAppError = (promise: Promise<unknown>, status: number, code: string) =>
  expect(promise).rejects.toMatchObject({ statusCode: status, code });

// resetAllMocks (not clearAllMocks) also clears any pending mockResolvedValueOnce
// queue, which would otherwise leak into later tests.
const installTransaction = () => {
  prismaMock.$transaction.mockImplementation((arg: any) =>
    Array.isArray(arg) ? Promise.all(arg) : Promise.resolve(arg(prismaMock)),
  );
};

describe('createUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('blocks a MANAGER from assigning the OWNER role', async () => {
    await expectAppError(
      createUser(TENANT, 'MANAGER', { name: 'x', email: 'x@y.com', branchId: null, role: 'OWNER' }),
      403,
      'FORBIDDEN_ROLE_CHANGE',
    );
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('blocks SUPER_ADMIN at the service layer too', async () => {
    await expectAppError(
      createUser(TENANT, 'OWNER', { name: 'x', email: 'x@y.com', branchId: null, role: 'SUPER_ADMIN' as any }),
      400,
      'INVALID_ROLE',
    );
  });

  it('lets the OWNER create another OWNER', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(MANAGER_ROW);
    const out = await createUser(TENANT, 'OWNER', { name: 'x', email: 'x@y.com', branchId: null, role: 'OWNER' });
    expect(out).toEqual(MANAGER_ROW);
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: TENANT, role: 'OWNER' }),
    });
  });

  it('rejects a duplicate email', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'other', email: 'a@b.com' });
    await expectAppError(
      createUser(TENANT, 'OWNER', { name: 'x', email: 'a@b.com', branchId: null, role: 'CASHIER' }),
      409,
      'EMAIL_IN_USE',
    );
  });
});

describe('updateUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  it('throws 404 when the target is not in the tenant', async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    await expectAppError(updateUser(TENANT, 'other', 'me', 'OWNER', { name: 'n' }), 404, 'USER_NOT_FOUND');
  });

  it('blocks a MANAGER from editing an OWNER account', async () => {
    prismaMock.user.findFirst.mockResolvedValue(OWNER_ROW);
    await expectAppError(updateUser(TENANT, 'u1', 'me', 'MANAGER', { name: 'n' }), 403, 'FORBIDDEN_TARGET');
  });

  it('blocks a user from changing their own role', async () => {
    // A MANAGER promoting themselves to OWNER is already blocked earlier by
    // assertCanAssignRole; this guard covers any other self role change.
    prismaMock.user.findFirst.mockResolvedValue({ ...MANAGER_ROW, id: 'me' });
    await expectAppError(
      updateUser(TENANT, 'me', 'me', 'MANAGER', { role: 'CASHIER' }),
      403,
      'CANNOT_CHANGE_OWN_ROLE',
    );
  });

  it('blocks demoting the last active owner', async () => {
    prismaMock.user.findFirst.mockResolvedValue(OWNER_ROW);
    prismaMock.user.count.mockResolvedValue(1);
    await expectAppError(
      updateUser(TENANT, 'u1', 'me', 'OWNER', { role: 'CASHIER' }),
      400,
      'LAST_OWNER',
    );
  });

  it('allows demoting an owner when another active owner exists', async () => {
    prismaMock.user.findFirst
      .mockResolvedValueOnce(OWNER_ROW)
      .mockResolvedValueOnce(null); // email uniqueness check
    prismaMock.user.count.mockResolvedValue(2);
    prismaMock.user.update.mockResolvedValue({ ...MANAGER_ROW, role: 'CASHIER' });
    const out = await updateUser(TENANT, 'u1', 'me', 'OWNER', { role: 'CASHIER', email: 'a@b.com' });
    expect(out.role).toBe('CASHIER');
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1', tenantId: TENANT },
      data: expect.objectContaining({ role: 'CASHIER' }),
    });
  });

  it('rejects an empty update', async () => {
    prismaMock.user.findFirst.mockResolvedValue(MANAGER_ROW);
    await expectAppError(updateUser(TENANT, 'u1', 'me', 'OWNER', {}), 400, 'EMPTY_UPDATE');
  });

  it('revokes sessions when credentials change', async () => {
    prismaMock.user.findFirst.mockResolvedValue(MANAGER_ROW);
    prismaMock.user.update.mockResolvedValue(MANAGER_ROW);
    const { revokeUserSessions } = await import('../auth/auth.service');
    await updateUser(TENANT, 'u1', 'me', 'OWNER', { pin: '1234' });
    expect(revokeUserSessions).toHaveBeenCalledWith('u1');
  });
});

describe('deleteUser', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    installTransaction();
  });

  const zeroHistory = { _count: { orders: 0, shifts: 0, expenses: 0, notifications: 0 } };

  it('prevents deleting your own account', async () => {
    await expectAppError(deleteUser(TENANT, 'me', 'me', 'OWNER'), 400, 'CANNOT_DELETE_SELF');
  });

  it('prevents a MANAGER from deleting an OWNER', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', role: 'OWNER', tenantId: TENANT, ...zeroHistory });
    await expectAppError(deleteUser(TENANT, 'u1', 'me', 'MANAGER'), 403, 'FORBIDDEN_TARGET');
  });

  it('blocks deleting the last active owner', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', role: 'OWNER', tenantId: TENANT, ...zeroHistory });
    prismaMock.user.count.mockResolvedValue(1);
    await expectAppError(deleteUser(TENANT, 'u1', 'me', 'OWNER'), 400, 'LAST_OWNER');
  });

  it('blocks deleting a user with transaction history', async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'u1',
      role: 'MANAGER',
      tenantId: TENANT,
      _count: { orders: 3, shifts: 0, expenses: 0, notifications: 2 },
    });
    await expectAppError(deleteUser(TENANT, 'u1', 'me', 'OWNER'), 400, 'USER_HAS_HISTORY');
  });

  it('deletes the user and their notifications when clean', async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: 'u1', role: 'MANAGER', tenantId: TENANT, ...zeroHistory });
    prismaMock.notification.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.user.deleteMany.mockResolvedValue({ count: 1 });
    const out = await deleteUser(TENANT, 'u1', 'me', 'OWNER');
    expect(out).toEqual({ id: 'u1' });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

it('AppError carries statusCode and code', () => {
  const err = new AppError(403, 'nope', 'FORBIDDEN');
  expect(err).toBeInstanceOf(Error);
  expect(err.statusCode).toBe(403);
  expect(err.code).toBe('FORBIDDEN');
});
