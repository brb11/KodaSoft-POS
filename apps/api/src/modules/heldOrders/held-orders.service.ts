import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import type { CreateHeldOrderDto } from './held-orders.schema';

function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function createHeldOrder(tenantId: string, cashierId: string, dto: CreateHeldOrderDto) {
  const branch = await prisma.branch.findFirst({ where: { id: dto.branchId, tenantId } });
  if (!branch) throw new AppError(400, 'Branch not found');

  const itemCount = dto.items.reduce((sum, item) => sum + Math.max(0, Math.round(Number(item.quantity))), 0);
  const total = roundCents(dto.items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0));

  const held = await prisma.heldOrder.create({
    data: {
      tenantId,
      branchId: dto.branchId,
      cashierId,
      customer: dto.customer ? (dto.customer as Prisma.InputJsonValue) : undefined,
      items: dto.items as unknown as Prisma.InputJsonValue,
      itemCount,
      total,
      discount: roundCents(Math.max(0, Number(dto.discount))),
      discountType: dto.discountType,
    },
  });

  return {
    ...held,
    items: held.items,
    customer: held.customer,
    total: Number(held.total),
    discount: Number(held.discount),
  };
}

export async function listHeldOrders(tenantId: string, branchId: string) {
  const rows = await prisma.heldOrder.findMany({
    where: { tenantId, branchId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map((held) => ({
    ...held,
    items: held.items,
    customer: held.customer,
    total: Number(held.total),
    discount: Number(held.discount),
  }));
}

export async function deleteHeldOrder(tenantId: string, id: string) {
  const existing = await prisma.heldOrder.findFirst({ where: { id, tenantId } });
  if (!existing) throw new AppError(404, 'Held order not found');
  await prisma.heldOrder.delete({ where: { id } });
  return { id };
}
