import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock } = vi.hoisted(() => {
  const prisma = {
    tenant: { findUnique: vi.fn() },
    subscription: { update: vi.fn() },
  };
  return { prismaMock: prisma };
});

vi.mock('../../lib/prisma', () => ({ prisma: prismaMock }));

import { requireActiveSubscription } from './subscription.guard';
import { AppError } from '../../middleware/error.middleware';
import type { Response } from 'express';

const TENANT = { id: 't1', isActive: true, subscription: null, users: [{ isActive: true }] };
const ACTIVE_SUB = { id: 's1', tenantId: 't1', status: 'ACTIVE', periodEnd: null };

async function run(req: any) {
  const next = vi.fn();
  const res = {} as Response;
  await requireActiveSubscription(req, res, next);
  return { next };
}

const errorCode = (next: ReturnType<typeof vi.fn>) => {
  const err = next.mock.calls[0][0];
  expect(err).toBeInstanceOf(AppError);
  return err.code as string;
};

describe('requireActiveSubscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes through when there is no authenticated user', async () => {
    const { next } = await run({});
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('blocks when the tenant row is missing', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(null);
    const { next } = await run({ user: { tenantId: 'nope', sub: 'u1' } });
    expect(errorCode(next)).toBe(undefined);
    expect(next.mock.calls[0][0].statusCode).toBe(404);
  });

  it('blocks a suspended tenant even with an ACTIVE subscription', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ ...TENANT, isActive: false, subscription: ACTIVE_SUB });
    const { next } = await run({ user: { tenantId: 't1', sub: 'u1' } });
    expect(errorCode(next)).toBe('TENANT_SUSPENDED');
  });

  it('blocks a deactivated user', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ ...TENANT, users: [{ isActive: false }] });
    const { next } = await run({ user: { tenantId: 't1', sub: 'u1' } });
    expect(errorCode(next)).toBe('ACCOUNT_DEACTIVATED');
  });

  it('blocks when the JWT user is no longer in the tenant', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ ...TENANT, users: [] });
    const { next } = await run({ user: { tenantId: 't1', sub: 'ghost' } });
    expect(errorCode(next)).toBe('ACCOUNT_DEACTIVATED');
  });

  it('blocks a PAST_DUE subscription', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ ...TENANT, subscription: { ...ACTIVE_SUB, status: 'PAST_DUE' } });
    const { next } = await run({ user: { tenantId: 't1', sub: 'u1' } });
    expect(errorCode(next)).toBe('SUBSCRIPTION_INACTIVE');
  });

  it('blocks a CANCELED subscription', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ ...TENANT, subscription: { ...ACTIVE_SUB, status: 'CANCELED' } });
    const { next } = await run({ user: { tenantId: 't1', sub: 'u1' } });
    expect(errorCode(next)).toBe('SUBSCRIPTION_INACTIVE');
  });

  it('blocks an expired TRIAL and flips it to PAST_DUE', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      ...TENANT,
      subscription: { ...ACTIVE_SUB, status: 'TRIAL', periodEnd: new Date(Date.now() - 1000) },
    });
    prismaMock.subscription.update.mockResolvedValue({});
    const { next } = await run({ user: { tenantId: 't1', sub: 'u1' } });
    expect(errorCode(next)).toBe('SUBSCRIPTION_INACTIVE');
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { tenantId: 't1' },
      data: { status: 'PAST_DUE' },
    });
  });

  it('allows an active TRIAL', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({
      ...TENANT,
      subscription: { ...ACTIVE_SUB, status: 'TRIAL', periodEnd: new Date(Date.now() + 86_400_000) },
    });
    const { next } = await run({ user: { tenantId: 't1', sub: 'u1' } });
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('allows a tenant with no subscription row (legacy grace)', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue(TENANT);
    const { next } = await run({ user: { tenantId: 't1', sub: 'u1' } });
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('allows an active subscription', async () => {
    prismaMock.tenant.findUnique.mockResolvedValue({ ...TENANT, subscription: ACTIVE_SUB });
    const { next } = await run({ user: { tenantId: 't1', sub: 'u1' } });
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('forwards unexpected errors to next', async () => {
    prismaMock.tenant.findUnique.mockRejectedValue(new Error('db down'));
    const { next } = await run({ user: { tenantId: 't1', sub: 'u1' } });
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
