import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import type { CreateSettlementDto } from './debts.schema';

function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// The portion of an order charged on account that has since been refunded.
// Refunds of on-account sales reduce the debt, so a credit invoice's net
// outstanding amount is creditPaid minus this figure.
function refundedCreditOf(
  order: {
    items: Array<{ quantity: any; refundedQuantity: any; subtotal: any; taxAmount: any }>;
  },
  creditPaid: number
): number {
  const gross = order.items.reduce((sum, line) => {
    const qty = Number(line.quantity);
    const refunded = Number(line.refundedQuantity ?? 0);
    if (qty <= 0 || refunded <= 0) return sum;
    return sum + (Number(line.subtotal) + Number(line.taxAmount)) * Math.min(refunded / qty, 1);
  }, 0);
  return roundCents(Math.min(gross, creditPaid));
}

type AgingKey = 'current' | 'd30' | 'd60' | 'd90';

function ageBucket(days: number): AgingKey {
  if (days < 30) return 'current';
  if (days < 60) return 'd30';
  if (days < 90) return 'd60';
  return 'd90';
}

// Standard receivables aging: outstanding balance is allocated across credit
// invoices FIFO (oldest first) and bucketed by invoice age.
function buildAging(invoices: Array<{ date: number; amount: number }>, balance: number) {
  const aging: Record<AgingKey, number> = { current: 0, d30: 0, d60: 0, d90: 0 };
  const now = Date.now();
  let remaining = roundCents(balance);
  for (const inv of [...invoices].sort((a, b) => a.date - b.date)) {
    if (remaining <= 0) break;
    const taken = Math.min(inv.amount, remaining);
    remaining = roundCents(remaining - taken);
    const days = Math.floor((now - inv.date) / 86_400_000);
    aging[ageBucket(days)] = roundCents(aging[ageBucket(days)] + taken);
  }
  const overdue = roundCents(aging.d30 + aging.d60 + aging.d90);
  return { aging, overdue };
}

export async function getDebtsOverview(tenantId: string) {
  const customers = await prisma.customer.findMany({
    where: { tenantId, OR: [{ creditBalance: { gt: 0 } }, { creditLimit: { not: null } }] },
    include: {
      orders: {
        where: { status: 'COMPLETED', payments: { some: { method: 'STORE_CREDIT', status: 'COMPLETED' } } },
        select: {
          id: true,
          orderNumber: true,
          createdAt: true,
          items: { select: { quantity: true, refundedQuantity: true, subtotal: true, taxAmount: true } },
          payments: { where: { method: 'STORE_CREDIT', status: 'COMPLETED' }, select: { amount: true } },
        },
      },
    },
    orderBy: { creditBalance: 'desc' },
  });

  const rows = customers.map((c) => {
    const balance = Number(c.creditBalance);
    const limit = c.creditLimit ? Number(c.creditLimit) : null;

    const invoices = c.orders
      .map((o) => {
        const paid = o.payments.reduce((s, p) => s + Number(p.amount), 0);
        const amount = roundCents(paid - refundedCreditOf(o, paid));
        return { date: o.createdAt.getTime(), amount };
      })
      .filter((i) => i.amount > 0);

    const { aging, overdue } = buildAging(invoices, balance);
    const usagePct = limit && limit > 0 ? roundCents((balance / limit) * 100) : null;

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      balance,
      creditLimit: limit,
      usagePct,
      overLimit: limit != null && limit > 0 && balance > limit,
      aging,
      overdue,
    };
  });

  const totalReceivables = roundCents(rows.reduce((s, r) => s + r.balance, 0));
  const totalOverdue = roundCents(rows.reduce((s, r) => s + r.overdue, 0));

  return {
    totalReceivables,
    totalOverdue,
    totalCustomers: rows.filter((r) => r.balance > 0).length,
    rows,
  };
}

export async function recordSettlement(tenantId: string, userId: string, dto: CreateSettlementDto) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: dto.customerId, tenantId } });
    if (!customer) throw new AppError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');

    const branch = await tx.branch.findFirst({ where: { id: dto.branchId, tenantId } });
    if (!branch) throw new AppError(400, 'Branch not found', 'BRANCH_NOT_FOUND');

    const amount = roundCents(Number(dto.amount));
    const balance = Number(customer.creditBalance);
    if (amount > roundCents(balance + 0.001)) {
      throw new AppError(400, 'Payment amount exceeds the customer outstanding balance', 'PAYMENT_EXCEEDS_BALANCE');
    }

    const created = await tx.customerPayment.create({
      data: {
        tenantId,
        customerId: customer.id,
        branchId: branch.id,
        amount,
        method: dto.method,
        reference: dto.reference,
        note: dto.note,
        createdBy: userId,
      },
    });

    await tx.customer.update({
      where: { id: customer.id },
      data: { creditBalance: { decrement: amount } },
    });

    return created;
  });
}

export async function getSettlements(
  tenantId: string,
  query: { page: number; limit: number; customerId?: string; branchId?: string; from?: string; to?: string }
) {
  const { page, limit, customerId, branchId, from, to } = query;
  const skip = (page - 1) * limit;

  const where: any = { tenantId };
  if (customerId) where.customerId = customerId;
  if (branchId) where.branchId = branchId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    prisma.customerPayment.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customerPayment.count({ where }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getCustomerStatement(tenantId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId } });
  if (!customer) throw new AppError(404, 'Customer not found', 'CUSTOMER_NOT_FOUND');

  const [orders, payments] = await Promise.all([
    prisma.order.findMany({
      where: { tenantId, customerId, status: 'COMPLETED', payments: { some: { method: 'STORE_CREDIT', status: 'COMPLETED' } } },
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            name: true,
            sku: true,
            quantity: true,
            refundedQuantity: true,
            unitPrice: true,
            discountAmount: true,
            taxAmount: true,
            subtotal: true,
          },
        },
        payments: { where: { method: 'STORE_CREDIT', status: 'COMPLETED' }, select: { amount: true } },
      },
    }),
    prisma.customerPayment.findMany({
      where: { tenantId, customerId },
      select: {
        id: true,
        amount: true,
        reference: true,
        note: true,
        createdAt: true,
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const entries: Array<{
    id: string;
    date: Date;
    type: 'INVOICE' | 'PAYMENT' | 'REFUND';
    ref: string;
    note: string | null;
    amount: number;
    items?: Array<{
      id: string;
      name: string;
      sku: string | null;
      quantity: number;
      refundedQuantity: number;
      unitPrice: number;
      subtotal: number;
      taxAmount: number;
    }>;
  }> = [];

  for (const o of orders) {
    const paid = o.payments.reduce((s, p) => s + Number(p.amount), 0);
    const items = o.items.map((i) => ({
      id: i.id,
      name: i.name,
      sku: i.sku,
      quantity: Number(i.quantity),
      refundedQuantity: Number(i.refundedQuantity ?? 0),
      unitPrice: Number(i.unitPrice),
      subtotal: Number(i.subtotal),
      taxAmount: Number(i.taxAmount),
    }));
    if (paid > 0) {
      entries.push({ id: o.id, date: o.createdAt, type: 'INVOICE', ref: o.orderNumber, note: null, amount: roundCents(paid), items });
    }
    const refunded = refundedCreditOf(o, paid);
    if (refunded > 0) {
      entries.push({ id: `${o.id}-refund`, date: o.updatedAt, type: 'REFUND', ref: o.orderNumber, note: 'Refund', amount: -refunded });
    }
  }
  for (const p of payments) {
    entries.push({
      id: p.id,
      date: p.createdAt,
      type: 'PAYMENT',
      ref: p.reference || p.branch.name,
      note: p.note,
      amount: -Number(p.amount),
    });
  }

  entries.sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0;
  const ledger = entries.map((e) => {
    running = roundCents(running + e.amount);
    return { ...e, amount: roundCents(e.amount), balance: running };
  });

  return {
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      creditLimit: customer.creditLimit ? Number(customer.creditLimit) : null,
      balance: Number(customer.creditBalance),
    },
    entries: ledger,
  };
}

export async function getDebtsReport(
  tenantId: string,
  opts: { from?: string; to?: string; branchId?: string }
) {
  const overview = await getDebtsOverview(tenantId);

  const where: any = { tenantId };
  if (opts.branchId) where.branchId = opts.branchId;
  if (opts.from || opts.to) {
    where.createdAt = {};
    if (opts.from) where.createdAt.gte = new Date(opts.from);
    if (opts.to) where.createdAt.lte = new Date(opts.to);
  }
  const agg = await prisma.customerPayment.aggregate({ where, _sum: { amount: true }, _count: true });

  return {
    totals: {
      totalReceivables: overview.totalReceivables,
      totalOverdue: overview.totalOverdue,
      totalCustomers: overview.totalCustomers,
    },
    rows: overview.rows,
    settlements: {
      count: agg._count,
      total: roundCents(Number(agg._sum.amount || 0)),
    },
  };
}
