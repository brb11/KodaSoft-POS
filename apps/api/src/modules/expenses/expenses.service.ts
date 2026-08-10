import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import type { CreateExpenseDto } from './expenses.schema';

function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export const EXPENSE_CATEGORIES = ['GENERAL', 'SUPPLIES', 'UTILITIES', 'WITHDRAWAL', 'OTHER'] as const;

export async function createExpense(tenantId: string, userId: string, role: string, dto: CreateExpenseDto) {
  const branch = await prisma.branch.findFirst({ where: { id: dto.branchId, tenantId } });
  if (!branch) throw new AppError(400, 'Branch not found');

  if (dto.shiftId) {
    const shift = await prisma.shift.findFirst({ where: { id: dto.shiftId, branchId: dto.branchId } });
    if (!shift) throw new AppError(400, 'Shift not found for this branch');
  }

  // Cash withdrawals from the drawer are owner/manager only; regular expenses
  // may be recorded by any cashier during a shift. A withdrawal is always cash,
  // so it is forced paidFromCash = true regardless of what the client sent.
  if (dto.category === 'WITHDRAWAL' && role !== 'OWNER' && role !== 'MANAGER') {
    throw new AppError(403, 'Cash withdrawals require owner or manager permission');
  }

  return prisma.expense.create({
    data: {
      branchId: dto.branchId,
      shiftId: dto.shiftId,
      category: dto.category,
      amount: roundCents(dto.amount),
      description: dto.description.trim(),
      paidFromCash: dto.category === 'WITHDRAWAL' ? true : (dto.paidFromCash ?? true),
      createdBy: userId,
    },
    include: {
      branch: { select: { name: true } },
      shift: { select: { id: true, status: true } },
      createdByUser: { select: { name: true } },
    },
  });
}

export async function listExpenses(tenantId: string, query: {
  page: number;
  limit: number;
  branchId?: string;
  shiftId?: string;
  category?: string;
  from?: string;
  to?: string;
}) {
  const where: any = { branch: { tenantId } };
  if (query.branchId) where.branchId = query.branchId;
  if (query.shiftId) where.shiftId = query.shiftId;
  if (query.category) where.category = query.category;
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        shift: { select: { id: true, status: true } },
        createdByUser: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.expense.count({ where }),
  ]);

  return {
    items,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  };
}

export async function deleteExpense(tenantId: string, id: string) {
  const expense = await prisma.expense.findFirst({
    where: { id, branch: { tenantId } },
    include: { shift: { select: { status: true } } },
  });
  if (!expense) throw new AppError(404, 'Expense not found');

  // Prevent silently changing an already-reconciled drawer: expenses attached
  // to a closed shift are immutable.
  if (expense.shift?.status === 'CLOSED') {
    throw new AppError(400, 'Cannot delete an expense from a closed shift');
  }

  await prisma.expense.delete({ where: { id } });
  return { success: true };
}
