import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { assertPlanLimit } from '../billing/plans';
import { AppError } from '../../middleware/error.middleware';

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
  data: { 
    name: string; 
    email: string; 
    password?: string; 
    pin?: string; 
    role: any; 
    branchId?: string 
  }
) {
  await assertPlanLimit(tenantId, 'users');
  const existingUser = await prisma.user.findUnique({ 
    where: { tenantId_email: { tenantId, email: data.email } } 
  });
  if (existingUser) throw new Error('Email is already registered');

  const payload: any = {
    tenantId,
    name: data.name,
    email: data.email,
    role: data.role,
    branchId: data.branchId,
  };

  if (data.password) {
    payload.passwordHash = await bcrypt.hash(data.password, 10);
  }
  
  if (data.pin) {
    if (data.pin.length !== 4) throw new Error('PIN must be exactly 4 digits');
    payload.pinHash = await bcrypt.hash(data.pin, 10);
  }

  const user = await prisma.user.create({ data: payload });
  return user;
}

export async function updateUser(
  tenantId: string, 
  id: string, 
  data: { 
    name: string; 
    role: any; 
    branchId?: string; 
    isActive: boolean;
    password?: string;
    pin?: string;
  }
) {
  const updateData: any = {
    name: data.name,
    role: data.role,
    isActive: data.isActive,
    branchId: data.branchId || null
  };

  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }
  
  if (data.pin) {
    if (data.pin.length !== 4) throw new Error('PIN must be exactly 4 digits');
    updateData.pinHash = await bcrypt.hash(data.pin, 10);
  }

  return prisma.user.update({
    where: { id, tenantId },
    data: updateData
  });
}

export async function deleteUser(tenantId: string, id: string, actingUserId: string) {
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
