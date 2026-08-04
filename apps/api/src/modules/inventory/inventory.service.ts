import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { CreateAdjustmentDto } from './inventory.schema';

export async function createAdjustments(tenantId: string, userId: string, dto: CreateAdjustmentDto) {
  const productIds = dto.items.map((i) => i.productId);
  const branchIds = dto.items.map((i) => i.branchId);

  const [products, branches] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds }, tenantId }, select: { id: true, name: true, trackInventory: true } }),
    prisma.branch.findMany({ where: { id: { in: branchIds }, tenantId }, select: { id: true } }),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const branchSet = new Set(branches.map((b) => b.id));

  for (const item of dto.items) {
    const product = productMap.get(item.productId);
    if (!product) throw new AppError(400, `Product not found in this tenant`, 'PRODUCT_NOT_FOUND');
    if (!branchSet.has(item.branchId)) throw new AppError(400, `Branch not found in this tenant`, 'BRANCH_NOT_FOUND');
  }

  const batchId = `adj-${randomUUID()}`;
  const adjustments: Array<{ productId: string; branchId: string; quantity: number; note?: string; productName: string }> = [];

  await prisma.$transaction(async (tx) => {
    for (const item of dto.items) {
      const delta = Number(item.quantity);
      const product = productMap.get(item.productId)!;
      const variantId = item.variantId ?? null;

      if (!product.trackInventory) continue;

      if (delta < 0) {
        const result = await tx.inventory.updateMany({
          where: {
            productId: item.productId,
            variantId,
            branchId: item.branchId,
            quantity: { gte: -delta },
          },
          data: { quantity: { decrement: -delta } },
        });
        if (result.count === 0) {
          throw new AppError(400, `Insufficient stock for product "${product.name}"`, 'INSUFFICIENT_STOCK');
        }
      } else {
        const updated = await tx.inventory.updateMany({
          where: { productId: item.productId, variantId, branchId: item.branchId },
          data: { quantity: { increment: delta } },
        });
        if (updated.count === 0) {
          await tx.inventory.create({
            data: {
              productId: item.productId,
              variantId,
              branchId: item.branchId,
              quantity: delta,
              lowStockThreshold: 5,
            },
          });
        }
      }

      await tx.inventoryMovement.create({
        data: {
          branchId: item.branchId,
          productId: item.productId,
          variantId,
          type: 'adjustment',
          quantity: delta,
          referenceId: batchId,
          referenceType: 'adjustment',
          note: item.note,
          createdBy: userId,
        },
      });

      adjustments.push({ productId: item.productId, branchId: item.branchId, quantity: delta, note: item.note, productName: product.name });
    }
  });

  return { batchId, count: adjustments.length, items: adjustments };
}

export async function listAdjustments(tenantId: string, query: { page: number; limit: number; branchId?: string }) {
  const where: any = { type: 'adjustment', branch: { tenantId } };
  if (query.branchId) where.branchId = query.branchId;

  const [total, rows] = await Promise.all([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        product: { select: { id: true, name: true, nameAr: true, sku: true } },
        branch: { select: { id: true, name: true } },
      },
    }),
  ]);

  const userIds = [...new Set(rows.map((r) => r.createdBy).filter((id): id is string => Boolean(id)))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const items = rows.map((m) => ({
    id: m.id,
    productId: m.productId,
    productName: m.product.name,
    productNameAr: m.product.nameAr,
    sku: m.product.sku,
    branchId: m.branchId,
    branchName: m.branch.name,
    quantity: Number(m.quantity),
    note: m.note,
    createdBy: m.createdBy,
    createdByName: m.createdBy ? userMap.get(m.createdBy) || null : null,
    createdAt: m.createdAt,
  }));

  return { items, total, page: query.page, limit: query.limit };
}
