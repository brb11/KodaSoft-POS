import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { assertPlanLimit } from '../billing/plans';
import { AppError } from '../../middleware/error.middleware';
import { revokeUserSessions } from '../auth/auth.service';
import type { CreateUserDto, UpdateUserDto } from './users.schema';

const TENANT_ROLES = ['CASHIER', 'MANAGER', 'OWNER'] as const;
type TenantRole = (typeof TENANT_ROLES)[number];

// A manager may create/manage CASHIER and MANAGER accounts, but never an OWNER.
function assertCanAssignRole(actingRole: string, targetRole: string | undefined): void {
  if (!targetRole) return;
  if (!TENANT_ROLES.includes(targetRole as TenantRole)) {
    throw new AppError(400, 'Invalid role', 'INVALID_ROLE');
  }
  if (actingRole !== 'OWNER' && targetRole === 'OWNER') {
    throw new AppError(403, 'Only the owner can assign the owner role', 'FORBIDDEN_ROLE_CHANGE');
  }
}

/**
 * Returns true if `pin` is already used by another active user in the same branch.
 * Must compare against bcrypt hashes so we need O(n) comparisons.
 * Branches rarely have more than ~20 users so this is acceptable.
 */
async function isPinTakenInBranch(branchId: string, pin: string, excludeUserId?: string): Promise<boolean> {
  const others = await prisma.user.findMany({
    where: {
      branchId,
      isActive: true,
      pinHash: { not: null },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { pinHash: true },
  });

  for (const u of others) {
    if (u.pinHash && (await bcrypt.compare(pin, u.pinHash))) return true;
  }
  return false;
}

export async function getUsers(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      branch: { select: { id: true, name: true } },
    },
    orderBy: { role: 'asc' },
  });
}

export async function createUser(
  tenantId: string,
  actingRole: string,
  data: CreateUserDto
) {
  await assertPlanLimit(tenantId, 'users');
  assertCanAssignRole(actingRole, data.role);

  const existingUser = await prisma.user.findFirst({ 
    where: { email: data.email } 
  });
  if (existingUser) throw new AppError(409, 'هذا البريد الإلكتروني مستخدم بالفعل', 'EMAIL_IN_USE');

  const payload: any = {
    tenantId,
    name: data.name,
    email: data.email,
    role: data.role,
    branchId: data.branchId ?? null,
  };

  if (data.password) {
    payload.passwordHash = await bcrypt.hash(data.password, 10);
  }
  
  if (data.pin) {
    if (!/^\d{4}$/.test(data.pin)) throw new AppError(400, 'PIN must be exactly 4 digits', 'INVALID_PIN');
    const branchId = data.branchId;
    if (branchId && (await isPinTakenInBranch(branchId, data.pin))) {
      throw new AppError(409, 'هذا الرقم السري مستخدم بالفعل في هذا الفرع، يرجى اختيار رقم آخر', 'PIN_ALREADY_IN_USE');
    }
    payload.pinHash = await bcrypt.hash(data.pin, 10);
  }

  const user = await prisma.user.create({ data: payload });
  return user;
}

export async function updateUser(
  tenantId: string,
  id: string,
  actingUserId: string,
  actingRole: string,
  data: UpdateUserDto
) {
  const target = await prisma.user.findFirst({
    where: { id, tenantId },
    select: { id: true, role: true, branchId: true, isActive: true },
  });
  if (!target) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');

  // Only the owner may modify an owner account.
  if (target.role === 'OWNER' && actingRole !== 'OWNER') {
    throw new AppError(403, 'Only the owner can manage owner accounts', 'FORBIDDEN_TARGET');
  }

  assertCanAssignRole(actingRole, data.role);

  // A user may never change their own role (self-escalation guard).
  if (id === actingUserId && data.role && data.role !== target.role) {
    throw new AppError(403, 'You cannot change your own role', 'CANNOT_CHANGE_OWN_ROLE');
  }

  // Protect the last active owner from being demoted or deactivated.
  if (target.role === 'OWNER' && (data.role && data.role !== 'OWNER' || data.isActive === false)) {
    const ownerCount = await prisma.user.count({ where: { tenantId, role: 'OWNER', isActive: true } });
    if (ownerCount <= 1) {
      throw new AppError(400, 'Cannot demote or deactivate the last active owner', 'LAST_OWNER');
    }
  }

  const updateData: any = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.branchId !== undefined) updateData.branchId = data.branchId || null;

  if (data.email) {
    const existing = await prisma.user.findFirst({ where: { email: data.email } });
    if (existing && existing.id !== id) {
      throw new AppError(409, 'هذا البريد الإلكتروني مستخدم بالفعل', 'EMAIL_IN_USE');
    }
    updateData.email = data.email;
  }

  const credentialsChanged = Boolean(data.password || data.pin);

  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }
  
  if (data.pin) {
    if (!/^\d{4}$/.test(data.pin)) throw new AppError(400, 'PIN must be exactly 4 digits', 'INVALID_PIN');
    // Fetch the user's current branchId to scope the uniqueness check
    const branchId = data.branchId ?? target.branchId ?? null;
    if (branchId && (await isPinTakenInBranch(branchId, data.pin, id))) {
      throw new AppError(409, 'هذا الرقم السري مستخدم بالفعل في هذا الفرع، يرجى اختيار رقم آخر', 'PIN_ALREADY_IN_USE');
    }
    updateData.pinHash = await bcrypt.hash(data.pin, 10);
  }

  // Checked last so a credentials-only update (e.g. { pin }) is still valid.
  if (Object.keys(updateData).length === 0) {
    throw new AppError(400, 'Nothing to update', 'EMPTY_UPDATE');
  }

  const user = await prisma.user.update({
    where: { id, tenantId },
    data: updateData
  });

  // Force re-login everywhere when credentials change: all existing refresh
  // sessions become invalid immediately.
  if (credentialsChanged) {
    await revokeUserSessions(id);
  }

  return user;
}

export async function deleteUser(tenantId: string, id: string, actingUserId: string, actingRole: string) {
  if (id === actingUserId) {
    throw new AppError(400, 'You cannot delete your own account', 'CANNOT_DELETE_SELF');
  }

  const user = await prisma.user.findFirst({
    where: { id, tenantId },
    include: {
      _count: {
        select: { orders: true, shifts: true, expenses: true, notifications: true },
      },
    },
  });
  if (!user) throw new AppError(404, 'User not found', 'USER_NOT_FOUND');

  // Only the owner may delete an owner account.
  if (user.role === 'OWNER' && actingRole !== 'OWNER') {
    throw new AppError(403, 'Only the owner can manage owner accounts', 'FORBIDDEN_TARGET');
  }

  if (user.role === 'OWNER') {
    const ownerCount = await prisma.user.count({ where: { tenantId, role: 'OWNER', isActive: true } });
    if (ownerCount <= 1) {
      throw new AppError(400, 'Cannot delete the last active owner', 'LAST_OWNER');
    }
  }

  const { orders, shifts, expenses } = user._count;
  if (orders + shifts + expenses > 0) {
    throw new AppError(400, 'User has transaction history and cannot be deleted. Deactivate instead.', 'USER_HAS_HISTORY');
  }

  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { userId: id } }),
    prisma.user.deleteMany({ where: { id, tenantId } }),
  ]);
  return { id };
}
