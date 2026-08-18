import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { assertFeatureAccess } from '../billing/plans';
import { isInventoryEnabled } from '../settings/settings.service';
import { signAndSubmitOrder } from '../zatca/zatca.service';
import type { CreateOrderDto, RefundOrderDto } from './orders.schema';

const DEFAULT_TAX_RATE = 15;

function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Sum of on-account (STORE_CREDIT) payment amounts. These represent the
// portion of an order charged to the customer's credit account rather than
// collected as cash/card.
function creditTotal(payments: Array<{ method: string; amount: number | string | { toString(): string } }>): number {
  return roundCents(
    payments
      .filter((p) => p.method === 'STORE_CREDIT')
      .reduce((s, p) => s + Number(p.amount), 0)
  );
}

// ZATCA invoice identifiers: a UUID for the invoice and a base64 SHA-256 hash
// over a deterministic canonical representation of the invoice amounts. The
// hash is stored for audit/Phase-2 reporting readiness (real Phase-2 requires
// a CSID certificate and FATURA clearance, which is provider-integrated).
function generateInvoiceMetadata(opts: {
  orderNumber: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  issuedAt?: Date;
}) {
  const invoiceUuid = randomUUID();
  const canonical = [
    `INV=${opts.orderNumber}`,
    `UUID=${invoiceUuid}`,
    `ISSUED=${(opts.issuedAt ?? new Date()).toISOString()}`,
    `SUBTOTAL=${opts.subtotal.toFixed(2)}`,
    `DISCOUNT=${opts.discountAmount.toFixed(2)}`,
    `TOTAL=${opts.total.toFixed(2)}`,
    `VAT=${opts.taxAmount.toFixed(2)}`,
  ].join('|');
  const invoiceHash = createHash('sha256').update(canonical).digest('base64');
  return { invoiceUuid, invoiceHash };
}

// Split an order-level discount across lines proportionally to their subtotal.
// Remainder (cents rounding) is assigned to the largest line so that the
// sum of per-line discounts always equals the order discount exactly.
function allocateDiscount(lineSubtotals: number[], totalDiscount: number): number[] {
  if (totalDiscount <= 0) return lineSubtotals.map(() => 0);
  const total = lineSubtotals.reduce((a, b) => a + b, 0);
  if (total <= 0) return lineSubtotals.map(() => 0);
  let remaining = totalDiscount;
  const out = lineSubtotals.map((sub) => {
    const share = roundCents(totalDiscount * (sub / total));
    remaining = roundCents(remaining - share);
    return share;
  });
  if (remaining !== 0) {
    let largest = 0;
    for (let i = 1; i < lineSubtotals.length; i++) if (lineSubtotals[i] > lineSubtotals[largest]) largest = i;
    out[largest] = roundCents(out[largest] + remaining);
  }
  return out;
}

function isUniqueViolation(err: unknown): boolean {
  return (err as any)?.code === 'P2002';
}

// Collision-safe, per-branch sequential order number backed by a PostgreSQL
// sequence. Sequences are non-transactional so a failed insert leaves a gap
// but never a duplicate, and the unique (branchId, orderNumber) index is the
// final safety net.
async function generateOrderNumber(tx: Prisma.TransactionClient, branchId: string, now: Date): Promise<string> {
  const seqName = `casheer_order_seq_${branchId.replace(/-/g, '')}`;
  await tx.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${seqName}" START 1`);
  const rows = await tx.$queryRawUnsafe<{ nextval: bigint }[]>(`SELECT nextval('"${seqName}"') AS nextval`);
  const seq = Number(rows[0].nextval);
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `ORD-${datePart}-${String(seq).padStart(6, '0')}`;
}

export async function getOrders(
  tenantId: string,
  query: { page: number; limit: number; branchId?: string; status?: string; from?: string; to?: string; search?: string },
) {
  const { page, limit, branchId, status, from, to, search } = query;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (branchId) where.branchId = branchId;
  if (status) where.status = status;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customer: { is: { name: { contains: search, mode: 'insensitive' } } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      include: {
        items: true,
        payments: true,
        cashier: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getOrderById(tenantId: string, id: string) {
  const order = await prisma.order.findFirst({
    where: { id, tenantId },
    include: {
      items: { include: { product: true } },
      payments: true,
      cashier: { select: { id: true, name: true } },
      customer: true,
      shift: true,
    },
  });
  if (!order) throw new AppError(404, 'Order not found');
  return order;
}

export async function createOrder(tenantId: string, cashierId: string, dto: CreateOrderDto) {
  if (dto.type !== 'SALE') {
    throw new AppError(400, 'Only SALE orders can be created. Returns must be processed via the refund endpoint');
  }

  if (dto.idempotencyKey) {
    const existing = await prisma.order.findFirst({ where: { tenantId, idempotencyKey: dto.idempotencyKey } });
    if (existing) return existing;
  }

  const creditTotalAmount = creditTotal(dto.payments);
  if (creditTotalAmount > 0) {
    await assertFeatureAccess(tenantId, 'customerDebts');
    if (!dto.customerId) {
      throw new AppError(400, 'A customer must be selected for on-account sales', 'CUSTOMER_REQUIRED');
    }
  }

  const inventoryEnabled = await isInventoryEnabled(tenantId);

  try {
    const order = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.findFirst({ where: { id: dto.branchId, tenantId } });
      if (!branch) throw new AppError(400, 'Branch not found');

      if (dto.shiftId) {
        const shift = await tx.shift.findFirst({ where: { id: dto.shiftId, branchId: dto.branchId, status: 'OPEN' } });
        if (!shift) throw new AppError(400, 'Shift not found or not open');
      }

      const productIds = [...new Set(dto.items.map((i) => i.productId))];
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, tenantId },
        include: { taxRate: true },
      });
      if (products.length !== productIds.length) {
        throw new AppError(400, 'One or more products not found');
      }

      const variantIds = dto.items.filter((i) => i.variantId).map((i) => i.variantId as string);
      const variants = variantIds.length ? await tx.productVariant.findMany({ where: { id: { in: variantIds } } }) : [];

      const productMap = new Map(products.map((p) => [p.id, p]));
      const variantMap = new Map(variants.map((v) => [v.id, v]));

      for (const product of products) {
        if (!product.isActive) throw new AppError(400, `Product "${product.name}" is inactive`);
      }

      // Server-authoritative line pricing from the database.
      const lines = dto.items.map((item) => {
        const product = productMap.get(item.productId)!;
        const modifier = item.variantId ? Number(variantMap.get(item.variantId)?.priceModifier ?? 0) : 0;
        const unitPrice = roundCents(Number(product.price) + modifier);
        const quantity = Number(item.quantity);
        const grossTotal = roundCents(unitPrice * quantity);
        const rate = product.taxRate ? Number(product.taxRate.rate) : DEFAULT_TAX_RATE;
        return { item, product, unitPrice, quantity, grossTotal, rate };
      });

      const grossTotal = roundCents(lines.reduce((s, l) => s + l.grossTotal, 0));
      const orderDiscount = roundCents(Math.min(Math.max(dto.discountAmount, 0), grossTotal));
      const lineDiscounts = allocateDiscount(lines.map((l) => l.grossTotal), orderDiscount);

      const lineTaxes = lines.map((l, i) => {
        const netLine = roundCents(l.grossTotal - lineDiscounts[i]);
        return roundCents((netLine * l.rate) / (100 + l.rate));
      });
      const taxAmount = roundCents(lineTaxes.reduce((s, t) => s + t, 0));
      const lineSubtotals = lines.map((l, i) => roundCents(l.grossTotal - lineDiscounts[i] - lineTaxes[i]));
      const subtotal = roundCents(lineSubtotals.reduce((s, t) => s + t, 0));
      const total = roundCents(subtotal + taxAmount);

      const paidAmount = roundCents(Math.max(dto.paidAmount, 0));
      if (paidAmount < total) {
        throw new AppError(400, 'Paid amount cannot be less than order total');
      }
      const paymentsTotal = roundCents(dto.payments.reduce((s, p) => s + Number(p.amount), 0));
      if (paymentsTotal !== paidAmount) {
        throw new AppError(400, 'Payments total must equal the paid amount');
      }
      const changeAmount = roundCents(paidAmount - total);

      const orderNumber = await generateOrderNumber(tx, dto.branchId, new Date());
      const zatca = generateInvoiceMetadata({
        orderNumber,
        subtotal,
        discountAmount: orderDiscount,
        taxAmount,
        total,
      });

      const newOrder = await tx.order.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          shiftId: dto.shiftId,
          customerId: dto.customerId,
          cashierId,
          orderNumber,
          status: 'COMPLETED',
          type: 'SALE',
          invoiceType: dto.invoiceType || (dto.customerId ? 'TAX' : 'SIMPLIFIED'),
          idempotencyKey: dto.idempotencyKey,
          invoiceUuid: zatca.invoiceUuid,
          invoiceHash: zatca.invoiceHash,
          subtotal,
          discountAmount: orderDiscount,
          taxAmount,
          total,
          paidAmount,
          changeAmount,
          notes: dto.notes,
          items: {
            create: lines.map((l, i) => ({
              productId: l.product.id,
              variantId: l.item.variantId,
              name: l.item.name,
              sku: l.item.sku,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discountAmount: lineDiscounts[i],
              taxAmount: lineTaxes[i],
              subtotal: lineSubtotals[i],
              modifiers: l.item.modifiers,
            })),
          },
          payments: {
            create: dto.payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              reference: p.reference,
              status: 'COMPLETED',
            })),
          },
        },
        include: { items: true, payments: true },
      });

      // Atomic stock guard: decrement only if quantity is sufficient.
      for (const l of lines) {
        if (!inventoryEnabled || !l.product.trackInventory) continue;
        const result = await tx.inventory.updateMany({
          where: {
            productId: l.product.id,
            variantId: l.item.variantId ?? null,
            branchId: dto.branchId,
            quantity: { gte: l.quantity },
          },
          data: { quantity: { decrement: l.quantity } },
        });
        if (result.count === 0) {
          throw new AppError(400, `Insufficient stock for product "${l.product.name}"`, 'INSUFFICIENT_STOCK');
        }

        await tx.inventoryMovement.create({
          data: {
            branchId: dto.branchId,
            productId: l.product.id,
            variantId: l.item.variantId,
            type: 'sale',
            quantity: -l.quantity,
            referenceId: newOrder.id,
            referenceType: 'order',
            createdBy: cashierId,
          },
        });
      }

      // On-account portion: charge the customer's debt account.
      if (creditTotalAmount > 0 && dto.customerId) {
        const customer = await tx.customer.findFirst({ where: { id: dto.customerId, tenantId } });
        if (!customer) throw new AppError(400, 'Customer not found', 'CUSTOMER_NOT_FOUND');

        const limit = customer.creditLimit ? Number(customer.creditLimit) : null;
        const newBalance = roundCents(Number(customer.creditBalance) + creditTotalAmount);
        if (limit != null && limit > 0 && newBalance > limit) {
          throw new AppError(
            400,
            `This sale (${newBalance.toFixed(2)}) exceeds the customer credit limit (${limit.toFixed(2)})`,
            'CREDIT_LIMIT_EXCEEDED'
          );
        }

        await tx.customer.update({
          where: { id: customer.id },
          data: { creditBalance: { increment: creditTotalAmount } },
        });
      }

      return newOrder;
    });

    // ZATCA Phase-2: sign the invoice and report it to FATURA (when enabled).
    if (order.type === 'SALE') {
      const signedOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: { items: { include: { product: { include: { taxRate: true } } } } },
      });
      const zatca = await signAndSubmitOrder(tenantId, {
        id: order.id,
        orderNumber: order.orderNumber,
        invoiceType: order.invoiceType,
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        taxAmount: Number(order.taxAmount),
        total: Number(order.total),
        invoiceUuid: order.invoiceUuid || '',
        branchId: order.branchId,
        customerId: order.customerId,
        notes: order.notes,
        createdAt: order.createdAt,
        items: (signedOrder?.items ?? []).map((item) => ({
          name: item.name,
          sku: item.sku,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discountAmount: Number(item.discountAmount),
          taxAmount: Number(item.taxAmount),
          subtotal: Number(item.subtotal),
          taxRate: item.product.taxRate ? Number(item.product.taxRate.rate) : DEFAULT_TAX_RATE,
        })),
      }).catch(() => ({ signed: false as const }));

      if (zatca.signed && zatca.invoiceHash) {
        order.invoiceHash = zatca.invoiceHash;
        order.invoiceSignature = zatca.invoiceSignature ?? null;
        order.zatcaStatus = zatca.status ?? null;
      }
    }

    return order;
  } catch (err) {
    // Concurrent duplicate with the same idempotency key: return the winner.
    if (dto.idempotencyKey && isUniqueViolation(err)) {
      const existing = await prisma.order.findFirst({ where: { tenantId, idempotencyKey: dto.idempotencyKey } });
      if (existing) return existing;
    }
    throw err;
  }
}

export async function voidOrder(tenantId: string, id: string, cashierId: string, reason?: string) {
  const order = await getOrderById(tenantId, id);
  if (order.status !== 'COMPLETED') throw new AppError(400, 'Only completed orders can be voided');
  if (order.items.some((item) => Number(item.refundedQuantity) > 0)) {
    throw new AppError(400, 'Orders with returned items cannot be voided');
  }

  const inventoryEnabled = await isInventoryEnabled(tenantId);

  return prisma.$transaction(async (tx) => {
    const voided = await tx.order.update({
      where: { id },
      data: {
        status: 'VOIDED',
        notes: [order.notes, reason ? `Void: ${reason}` : null].filter(Boolean).join(' | '),
      },
    });

    // Reverse any on-account amount so the voided sale no longer counts as
    // debt. Never push the balance below zero (the debt may already have been
    // settled before the void).
    const creditPaid = creditTotal(order.payments);
    if (order.customerId && creditPaid > 0) {
      await tx.customer.updateMany({
        where: { id: order.customerId, creditBalance: { gte: creditPaid } },
        data: { creditBalance: { decrement: creditPaid } },
      });
    }

    // Restore inventory
    for (const item of order.items) {
      if (!inventoryEnabled || !item.product?.trackInventory) continue;
      await tx.inventory.updateMany({
        where: { productId: item.productId, variantId: item.variantId ?? null, branchId: order.branchId },
        data: { quantity: { increment: item.quantity } },
      });

      await tx.inventoryMovement.create({
        data: {
          branchId: order.branchId,
          productId: item.productId,
          variantId: item.variantId,
          type: 'adjustment',
          quantity: Math.abs(Number(item.quantity)),
          referenceId: id,
          referenceType: 'void',
          note: reason,
          createdBy: cashierId,
        },
      });
    }

    return voided;
  });
}

export async function refundOrder(tenantId: string, id: string, cashierId: string, dto: RefundOrderDto) {
  const order = await getOrderById(tenantId, id);
  if (order.status !== 'COMPLETED') throw new AppError(400, 'Only completed orders can be refunded');

  const inventoryEnabled = await isInventoryEnabled(tenantId);

  return prisma.$transaction(async (tx) => {
    const itemsToRefund = dto.items
      ? dto.items.map((refundItem) => {
          const line = order.items.find((oi) => oi.id === refundItem.orderItemId);
          if (!line) throw new AppError(400, 'Order item not found');
          const remaining = Number(line.quantity) - Number(line.refundedQuantity);
          if (refundItem.quantity > remaining) {
            throw new AppError(400, 'Refund quantity exceeds the remaining refundable quantity');
          }
          return { line, quantity: refundItem.quantity };
        })
      : order.items
          .filter((line) => Number(line.quantity) - Number(line.refundedQuantity) > 0)
          .map((line) => ({ line, quantity: Number(line.quantity) - Number(line.refundedQuantity) }));

    if (itemsToRefund.length === 0) throw new AppError(400, 'Nothing left to refund');

    // Restore stock, record a return movement and track refunded quantity per line.
    for (const { line, quantity } of itemsToRefund) {
      if (inventoryEnabled && line.product?.trackInventory) {
        await tx.inventory.updateMany({
          where: { productId: line.productId, variantId: line.variantId ?? null, branchId: order.branchId },
          data: { quantity: { increment: quantity } },
        });
      }

      if (inventoryEnabled) {
        await tx.inventoryMovement.create({
          data: {
            branchId: order.branchId,
            productId: line.productId,
            variantId: line.variantId,
            type: 'return',
            quantity,
            referenceId: order.id,
            referenceType: 'refund',
            note: dto.reason,
            createdBy: cashierId,
          },
        });
      }

      await tx.orderItem.update({
        where: { id: line.id },
        data: { refundedQuantity: { increment: quantity } },
      });
    }

    const refundedMap = new Map(itemsToRefund.map((r) => [r.line.id, r.quantity]));
    const fullyRefunded = order.items.every((line) => {
      const newRefunded = Number(line.refundedQuantity) + (refundedMap.get(line.id) ?? 0);
      return newRefunded >= Number(line.quantity) - 1e-6;
    });

    // A refund of an on-account sale reduces the customer's debt (the refunded
    // gross, capped at the amount originally charged to the account).
    const creditPaid = creditTotal(order.payments);
    const refundedGross = itemsToRefund.reduce((sum, { line, quantity }) => {
      const gross = Number(line.subtotal) + Number(line.taxAmount);
      const qty = Number(line.quantity);
      if (qty <= 0) return sum;
      return sum + roundCents(gross * (quantity / qty));
    }, 0);
    const refundedCredit = roundCents(Math.min(refundedGross, creditPaid));
    if (order.customerId && refundedCredit > 0) {
      await tx.customer.updateMany({
        where: { id: order.customerId, creditBalance: { gte: refundedCredit } },
        data: { creditBalance: { decrement: refundedCredit } },
      });
    }

    const updated = await tx.order.update({
      where: { id },
      data: {
        status: fullyRefunded ? 'REFUNDED' : 'COMPLETED',
        paidAmount: fullyRefunded ? 0 : order.paidAmount,
        notes: [order.notes, dto.reason ? `Refund: ${dto.reason}` : 'Refunded'].filter(Boolean).join(' | '),
      },
    });

    if (fullyRefunded) {
      await tx.payment.updateMany({
        where: { orderId: id, status: 'COMPLETED' },
        data: { status: 'REFUNDED' },
      });
    }

    return updated;
  });
}
