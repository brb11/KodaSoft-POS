import { prisma } from '../../lib/prisma';
import { assertPlanLimit } from '../billing/plans';
import { AppError } from '../../middleware/error.middleware';

export async function getBranches(tenantId: string) {
  return prisma.branch.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { users: true, orders: true }
      }
    }
  });
}

export async function createBranch(tenantId: string, data: { name: string; address?: string; phone?: string }) {
  await assertPlanLimit(tenantId, 'branches');
  return prisma.branch.create({
    data: {
      tenantId,
      name: data.name,
      address: data.address,
      phone: data.phone,
    }
  });
}

export async function updateBranch(tenantId: string, id: string, data: { name: string; address?: string; phone?: string; isActive: boolean }) {
  return prisma.branch.update({
    where: { id, tenantId },
    data
  });
}

export async function deleteBranch(tenantId: string, id: string) {
  const branch = await prisma.branch.findFirst({
    where: { id, tenantId },
    include: {
      _count: {
        select: { users: true, orders: true, inventory: true, shifts: true, expenses: true, inventoryMovements: true },
      },
    },
  });

  if (!branch) throw new AppError(404, 'Branch not found', 'BRANCH_NOT_FOUND');

  const { users, orders, inventory, shifts, expenses, inventoryMovements } = branch._count;
  if (users + orders + inventory + shifts + expenses + inventoryMovements > 0) {
    throw new AppError(400, 'Branch is in use and cannot be deleted', 'BRANCH_IN_USE');
  }

  const result = await prisma.branch.deleteMany({ where: { id, tenantId } });
  if (result.count === 0) throw new AppError(404, 'Branch not found', 'BRANCH_NOT_FOUND');
  return { id };
}
