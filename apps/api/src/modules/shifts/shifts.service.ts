import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';

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

  // Calculate cash payouts (expenses) during shift
  const expenses = await prisma.expense.aggregate({
    where: { shiftId },
    _sum: { amount: true }
  });

  const totalCashSales = Number(cashPayments._sum.amount || 0);
  const totalExpenses = Number(expenses._sum.amount || 0);
  const expectedCash = Number(shift.openingCash) + totalCashSales - totalExpenses;

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
