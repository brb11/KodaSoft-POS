import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { computeExpectedCash, cashExpenseTotal } from './expectedCash';

export async function getActiveShift(tenantId: string, branchId: string, userId: string) {
  if (!branchId) return null;
  return prisma.shift.findFirst({
    where: {
      branch: { tenantId },
      branchId,
      userId,
      status: 'OPEN'
    }
  });
}

export async function openShift(tenantId: string, branchId: string, userId: string, openingCash: number) {
  if (!branchId) throw new AppError(400, 'Branch is required to open a shift');

  // The branch is taken from the request body — verify it actually belongs to
  // this tenant before creating anything in it (cross-tenant write guard).
  const branch = await prisma.branch.findFirst({ where: { id: branchId, tenantId } });
  if (!branch) throw new AppError(400, 'Branch not found', 'BRANCH_NOT_FOUND');

  const existing = await getActiveShift(tenantId, branchId, userId);
  if (existing) throw new AppError(400, 'You already have an open shift');

  return prisma.shift.create({
    data: {
      branchId,
      userId,
      openingCash
    }
  });
}

export async function closeShift(tenantId: string, shiftId: string, closingCash: number, notes?: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { branch: true }
  });

  if (!shift || shift.branch.tenantId !== tenantId) {
    throw new AppError(404, 'Shift not found');
  }
  if (shift.status === 'CLOSED') {
    throw new AppError(400, 'Shift is already closed');
  }

  // Calculate expected cash based on cash sales during the shift
  const cashPayments = await prisma.payment.aggregate({
    where: {
      method: 'CASH',
      status: 'COMPLETED',
      order: { shiftId }
    },
    _sum: { amount: true }
  });

  // Cash outflows during the shift: only expenses actually paid from the cash
  // drawer reduce expected cash. Non-cash expenses are recorded but never
  // deducted from the drawer.
  const shiftExpenses = await prisma.expense.findMany({
    where: { shiftId },
    select: { amount: true, paidFromCash: true },
  });
  const totalCashExpenses = cashExpenseTotal(shiftExpenses);

  const totalCashSales = Number(cashPayments._sum.amount || 0);
  const expectedCash = computeExpectedCash(Number(shift.openingCash), totalCashSales, totalCashExpenses);

  return prisma.shift.update({
    where: { id: shiftId },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      closingCash,
      expectedCash,
      notes
    }
  });
}
