import { describe, it, expect } from 'vitest';
import { createUserSchema, updateUserSchema } from './users.schema';

describe('createUserSchema', () => {
  const base = { name: 'Ahmed', email: 'a@b.com', role: 'CASHIER' as const };

  it('accepts the three tenant roles', () => {
    for (const role of ['CASHIER', 'MANAGER', 'OWNER']) {
      expect(createUserSchema.parse({ ...base, role }).role).toBe(role);
    }
  });

  it('rejects SUPER_ADMIN (tenant role whitelist)', () => {
    expect(() => createUserSchema.parse({ ...base, role: 'SUPER_ADMIN' })).toThrow();
  });

  it('rejects a short password', () => {
    expect(() => createUserSchema.parse({ ...base, password: '1234' })).toThrow();
  });

  it('rejects a non-4-digit PIN', () => {
    expect(() => createUserSchema.parse({ ...base, pin: '12' })).toThrow();
    expect(() => createUserSchema.parse({ ...base, pin: 'abcd' })).toThrow();
  });

  it('treats empty-string pin/password/branchId as not provided', () => {
    const out = createUserSchema.parse({ ...base, pin: '', password: '', branchId: '' });
    expect(out.pin).toBeUndefined();
    expect(out.password).toBeUndefined();
    expect(out.branchId).toBeNull();
  });
});

describe('updateUserSchema', () => {
  it('accepts a partial update', () => {
    expect(updateUserSchema.parse({ role: 'MANAGER' }).role).toBe('MANAGER');
  });

  it('rejects an empty update', () => {
    expect(() => updateUserSchema.parse({})).toThrow();
  });

  it('rejects SUPER_ADMIN on update', () => {
    expect(() => updateUserSchema.parse({ role: 'SUPER_ADMIN' })).toThrow();
  });

  it('maps empty branchId to null (clear branch) and empty password to undefined', () => {
    const out = updateUserSchema.parse({ branchId: '', password: '', isActive: false });
    expect(out.branchId).toBeNull();
    expect(out.password).toBeUndefined();
    expect(out.isActive).toBe(false);
  });
});
