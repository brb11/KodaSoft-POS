import { prisma } from '../../lib/prisma';

type Period = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';

function periodWhere(period: Period = 'all', from?: string, to?: string) {
  if (from || to) {
    const w: any = {};
    if (from) w.gte = new Date(from);
    if (to) w.lte = new Date(to);
    return w;
  }
  const now = new Date();
  switch (period) {
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return { gte: d };
    }
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      d.setHours(0, 0, 0, 0);
      return { gte: d };
    }
    case 'month': {
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
    }
    case 'year': {
      return { gte: new Date(now.getFullYear(), 0, 1) };
    }
    default:
      return undefined;
  }
}

function addBranch(where: any, branchId?: string) {
  if (branchId) where.branchId = branchId;
  return where;
}

const PAYMENT_METHODS = [
  'CASH', 'CARD', 'MADA', 'VISA', 'MASTERCARD', 'APPLE_PAY', 'STC_PAY', 'BANK_TRANSFER', 'STORE_CREDIT', 'SPLIT',
];

// ─────────────────────────────────────────────
// 1. SALES REPORT
// ─────────────────────────────────────────────
export async function getSalesReport(
  tenantId: string,
  opts: { period?: Period; from?: string; to?: string; branchId?: string; groupBy?: string },
) {
  const { period = 'all', from, to, branchId, groupBy } = opts;
  const orderWhere: any = addBranch({ tenantId, status: 'COMPLETED', type: 'SALE' }, branchId);
  const createdAt = periodWhere(period, from, to);
  if (createdAt) orderWhere.createdAt = createdAt;

  const orders = await prisma.order.findMany({
    where: orderWhere,
    include: {
      payments: true,
      items: true,
      branch: { select: { name: true } },
      cashier: { select: { name: true } },
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const tax = orders.reduce((s, o) => s + Number(o.taxAmount), 0);
  const discount = orders.reduce((s, o) => s + Number(o.discountAmount), 0);
  const items = orders.reduce((s, o) => s + o.items.reduce((is, i) => is + Number(i.quantity), 0), 0);

  const summary = {
    revenue: +revenue.toFixed(2),
    orders: orders.length,
    items,
    tax: +tax.toFixed(2),
    discount: +discount.toFixed(2),
    avgOrderValue: orders.length ? +(revenue / orders.length).toFixed(2) : 0,
  };

  let breakdown: any[] = [];
  let series: any[] = [];

  const push = (map: Map<string, { name: string; revenue: number; orders: number; items: number }>, key: string, name: string, amount: number, itemQty = 0) => {
    const row = map.get(key) || { name, revenue: 0, orders: 0, items: 0 };
    row.revenue += amount;
    row.orders += 1;
    row.items += itemQty;
    map.set(key, row);
  };

  if (groupBy === 'branch' || groupBy === 'cashier' || groupBy === 'customer') {
    const map = new Map<string, { name: string; revenue: number; orders: number; items: number }>();
    for (const o of orders) {
      const key = groupBy === 'branch' ? o.branch.name
        : groupBy === 'cashier' ? o.cashier.name
        : (o.customer?.name || 'walk_in');
      const qty = o.items.reduce((s, i) => s + Number(i.quantity), 0);
      push(map, key, key === 'walk_in' ? 'Walk-in' : key, Number(o.total), qty);
    }
    breakdown = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  } else if (groupBy === 'payment') {
    const map = new Map<string, { name: string; revenue: number; orders: number; items: number }>();
    for (const o of orders) {
      for (const p of o.payments) {
        push(map, p.method, p.method, Number(p.amount));
      }
    }
    breakdown = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  } else if (groupBy === 'product' || groupBy === 'category') {
    const where: any = { order: orderWhere };
    const grouped = await prisma.orderItem.groupBy({
      by: groupBy === 'product' ? ['productId', 'name'] : ['productId'],
      where,
      _sum: { quantity: true, subtotal: true },
      _count: { id: true },
      orderBy: { _sum: { subtotal: 'desc' } },
    });
    if (groupBy === 'product') {
      breakdown = grouped.map((g) => ({
        key: g.productId,
        name: g.name,
        revenue: Number(g._sum.subtotal) || 0,
        orders: g._count.id,
        items: Number(g._sum.quantity) || 0,
      }));
    } else {
      const ids = grouped.map((g) => g.productId);
      const prods = await prisma.product.findMany({ where: { tenantId, id: { in: ids } }, select: { id: true, category: { select: { name: true, nameAr: true } } } });
      const catMap = new Map(prods.map((p) => [p.id, p.category?.name || 'uncategorized']));
      const agg = new Map<string, { name: string; revenue: number; orders: number; items: number }>();
      for (const g of grouped) {
        const cat = catMap.get(g.productId) || 'uncategorized';
        const row = agg.get(cat) || { name: cat, revenue: 0, orders: 0, items: 0 };
        row.revenue += Number(g._sum.subtotal) || 0;
        row.orders += g._count.id;
        row.items += Number(g._sum.quantity) || 0;
        agg.set(cat, row);
      }
      breakdown = [...agg.values()].sort((a, b) => b.revenue - a.revenue);
    }
  }

  if (!groupBy) {
    series = buildSeries(orders, period, from, to);
  }

  return { summary, breakdown, series };
}

function buildSeries(orders: any[], period: Period, from?: string, to?: string) {
  const now = new Date();
  let start: Date;
  let end = to ? new Date(to) : now;
  let bucket: 'day' | 'month' = 'day';

  if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    bucket = 'month';
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'today') {
    start = new Date(now); start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start = new Date(now); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0);
  } else if (from) {
    start = new Date(from);
    const rangeDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
    if (rangeDays > 92) bucket = 'month';
  } else {
    start = new Date(now); start.setDate(start.getDate() - 30);
  }

  const keyFn = bucket === 'month'
    ? (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    : (d: Date) => d.toISOString().slice(0, 10);

  const map = new Map<string, { revenue: number; orders: number }>();
  const fill = (d: Date) => { map.set(keyFn(d), { revenue: 0, orders: 0 }); };
  if (bucket === 'month') {
    for (let m = 0; m < 12; m++) fill(new Date(now.getFullYear(), m, 1));
  } else {
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      if (d.getTime() <= end.getTime()) fill(d);
    }
  }

  for (const o of orders) {
    const k = keyFn(o.createdAt);
    const row = map.get(k) || { revenue: 0, orders: 0 };
    row.revenue += Number(o.total);
    row.orders += 1;
    map.set(k, row);
  }

  return [...map.entries()].map(([date, data]) => ({
    date,
    label: bucket === 'month'
      ? new Date(date).toLocaleDateString('en-US', { month: 'short' })
      : new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    revenue: +data.revenue.toFixed(2),
    orders: data.orders,
  }));
}

// ─────────────────────────────────────────────
// 2. VAT REPORT
// ─────────────────────────────────────────────
export async function getVatReport(tenantId: string, opts: { from?: string; to?: string; branchId?: string }) {
  const where: any = addBranch({ tenantId, status: { in: ['COMPLETED', 'REFUNDED'] }, type: { in: ['SALE', 'RETURN'] } }, opts.branchId);
  const createdAt = periodWhere('custom', opts.from, opts.to);
  if (createdAt) where.createdAt = createdAt;

  const orders = await prisma.order.findMany({
    where,
    select: {
      type: true,
      status: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      total: true,
      items: {
        select: { quantity: true, refundedQuantity: true, subtotal: true, discountAmount: true, taxAmount: true },
      },
    },
  });

  let salesSubtotal = 0, salesDiscount = 0, salesTax = 0, salesTotal = 0;
  let returnsSubtotal = 0, returnsTax = 0, returnsTotal = 0;
  let taxOnDiscounts = 0, weightedRate = 0, rateBase = 0;

  for (const o of orders) {
    if (o.type === 'RETURN' || o.status === 'REFUNDED') {
      returnsSubtotal += Number(o.subtotal);
      returnsTax += Number(o.taxAmount);
      returnsTotal += Number(o.total);
      continue;
    }

    // Refunded portion of this order (0 for plain completed sales).
    let rSub = 0, rDisc = 0, rTax = 0;
    for (const line of o.items) {
      const qty = Number(line.quantity);
      const refunded = Number(line.refundedQuantity ?? 0);
      if (qty <= 0 || refunded <= 0) continue;
      const frac = Math.min(refunded / qty, 1);
      rSub += Number(line.subtotal) * frac;
      rDisc += Number(line.discountAmount) * frac;
      rTax += Number(line.taxAmount) * frac;
    }

    const netSubtotal = Number(o.subtotal) - rSub;
    const netDiscount = Number(o.discountAmount) - rDisc;
    const netTax = Number(o.taxAmount) - rTax;
    const netTotal = Number(o.total) - (rSub - rDisc + rTax);

    salesSubtotal += netSubtotal;
    salesDiscount += netDiscount;
    salesTax += netTax;
    salesTotal += netTotal;

    const base = netSubtotal - netDiscount;
    const rate = base > 0 ? netTax / base : 0;
    taxOnDiscounts += netDiscount * rate;
    weightedRate += rate * base;
    rateBase += base;

    returnsSubtotal += rSub;
    returnsTax += rTax;
    returnsTotal += rSub - rDisc + rTax;
  }

  const effectiveRate = rateBase > 0 ? weightedRate / rateBase : 0;

  return {
    totalBeforeTax: +(salesSubtotal - salesDiscount).toFixed(2),
    totalDiscount: +salesDiscount.toFixed(2),
    totalVat: +salesTax.toFixed(2),
    totalAfterTax: +salesTotal.toFixed(2),
    returnsSubtotal: +returnsSubtotal.toFixed(2),
    returnsVat: +returnsTax.toFixed(2),
    returnsTotal: +returnsTotal.toFixed(2),
    taxOnDiscounts: +taxOnDiscounts.toFixed(2),
    netVatDue: +(salesTax - returnsTax).toFixed(2),
    effectiveRate: +(effectiveRate * 100).toFixed(2),
  };
}

// ─────────────────────────────────────────────
// 3. INVOICE REPORT
// ─────────────────────────────────────────────
export async function getInvoiceReport(tenantId: string, opts: { from?: string; to?: string; branchId?: string }) {
  const base: any = addBranch({ tenantId }, opts.branchId);
  const createdAt = periodWhere('custom', opts.from, opts.to);
  if (createdAt) base.createdAt = createdAt;

  const [total, taxInvoices, simplifiedInvoices, voided, returned, incomplete, completed, totals] = await Promise.all([
    prisma.order.count({ where: base }),
    prisma.order.count({ where: { ...base, invoiceType: 'TAX' } }),
    prisma.order.count({ where: { ...base, invoiceType: 'SIMPLIFIED' } }),
    prisma.order.count({ where: { ...base, status: 'VOIDED' } }),
    prisma.order.count({ where: { ...base, status: 'REFUNDED' } }),
    prisma.order.count({ where: { ...base, status: 'PENDING' } }),
    prisma.order.count({ where: { ...base, status: 'COMPLETED' } }),
    prisma.order.aggregate({ where: { ...base, status: 'COMPLETED' }, _sum: { total: true, taxAmount: true, discountAmount: true } }),
  ]);

  return {
    total,
    taxInvoices,
    simplifiedInvoices,
    voided,
    returned,
    incomplete,
    suspended: incomplete,
    completed,
    totalValue: Number(totals._sum.total || 0),
    totalTax: Number(totals._sum.taxAmount || 0),
    totalDiscount: Number(totals._sum.discountAmount || 0),
  };
}

// ─────────────────────────────────────────────
// 4. PAYMENT METHODS REPORT
// ─────────────────────────────────────────────
export async function getPaymentMethodsReport(tenantId: string, opts: { from?: string; to?: string; branchId?: string }) {
  const where: any = { status: 'COMPLETED', order: addBranch({ tenantId }, opts.branchId) };
  const createdAt = periodWhere('custom', opts.from, opts.to);
  if (createdAt) where.order.createdAt = createdAt;

  const grouped = await prisma.payment.groupBy({
    by: ['method'],
    where,
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: 'desc' } },
  });

  const rows = PAYMENT_METHODS.map((m) => {
    const g = grouped.find((x) => x.method === m);
    return {
      method: m,
      count: g ? g._count.id : 0,
      total: Number(g?._sum.amount || 0),
    };
  }).sort((a, b) => b.total - a.total);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return {
    rows: rows.map((r) => ({ ...r, pct: grandTotal > 0 ? +((r.total / grandTotal) * 100).toFixed(2) : 0 })),
    grandTotal: +grandTotal.toFixed(2),
  };
}

// ─────────────────────────────────────────────
// 5. INVENTORY REPORT
// ─────────────────────────────────────────────
export async function getInventoryReport(tenantId: string, opts: { branchId?: string; from?: string; to?: string }) {
  const invWhere: any = { branch: { tenantId } };
  if (opts.branchId) invWhere.branchId = opts.branchId;

  const [stock, movRows] = await Promise.all([
    prisma.inventory.findMany({
      where: invWhere,
      include: { product: { select: { id: true, name: true, nameAr: true, sku: true, cost: true, category: { select: { name: true, nameAr: true } } } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.inventoryMovement.groupBy({
      by: ['type'],
      where: { branch: addBranch({ tenantId }, opts.branchId), ...(opts.from || opts.to ? { createdAt: { ...(opts.from ? { gte: new Date(opts.from) } : {}), ...(opts.to ? { lte: new Date(opts.to) } : {}) } } : {}) },
      _sum: { quantity: true },
      _count: { id: true },
    }),
  ]);

  const now = new Date();
  const currentStock = stock.map((inv) => {
    const qty = Number(inv.quantity);
    const threshold = Number(inv.lowStockThreshold);
    return {
      id: inv.id,
      productId: inv.productId,
      name: inv.product.name,
      nameAr: inv.product.nameAr,
      sku: inv.product.sku,
      cost: Number(inv.product.cost),
      category: inv.product.category?.name || '',
      quantity: qty,
      lowStockThreshold: threshold,
      isLow: qty <= threshold,
      expiryDate: inv.expiryDate,
      isExpired: inv.expiryDate ? inv.expiryDate.getTime() < now.getTime() : false,
      stockValue: +(qty * Number(inv.product.cost)).toFixed(2),
    };
  });

  const lowStock = currentStock.filter((i) => i.isLow);
  const expired = currentStock.filter((i) => i.isExpired);

  const movements = movRows.map((m) => ({
    type: m.type,
    count: m._count.id,
    quantity: Number(m._sum.quantity || 0),
  }));

  const wastage = movements.find((m) => m.type === 'wastage')?.quantity || 0;

  return {
    currentStock,
    lowStock,
    expired,
    movements,
    wastage,
    totals: {
      itemCount: currentStock.length,
      totalUnits: currentStock.reduce((s, i) => s + i.quantity, 0),
      totalValue: +currentStock.reduce((s, i) => s + i.stockValue, 0).toFixed(2),
    },
  };
}

// ─────────────────────────────────────────────
// 6. SHIFT REPORT
// ─────────────────────────────────────────────
export async function getShiftReport(tenantId: string, opts: { from?: string; to?: string; branchId?: string }) {
  const where: any = { branch: { tenantId } };
  if (opts.branchId) where.branchId = opts.branchId;
  const createdAt = periodWhere('custom', opts.from, opts.to);
  if (createdAt) where.openedAt = createdAt;

  const shifts = await prisma.shift.findMany({
    where,
    include: {
      user: { select: { name: true } },
      branch: { select: { name: true } },
      orders: {
        include: {
          payments: true,
          items: { select: { quantity: true, refundedQuantity: true, subtotal: true, taxAmount: true } },
        },
        where: { status: { in: ['COMPLETED', 'REFUNDED'] } },
      },
      expenses: true,
    },
    orderBy: { openedAt: 'desc' },
  });

  const rows = shifts.map((s) => {
    const sales = s.orders.filter((o) => o.status === 'COMPLETED');
    const cashSales = sales.reduce((sum, o) => sum + o.payments.filter((p) => p.method === 'CASH').reduce((ps, p) => ps + Number(p.amount), 0), 0);
    const cardSales = sales.reduce((sum, o) => sum + o.payments.filter((p) => p.method !== 'CASH').reduce((ps, p) => ps + Number(p.amount), 0), 0);
    const refundedGross = (o: (typeof sales)[number]) =>
      o.items.reduce((sum, line) => {
        const qty = Number(line.quantity);
        const refunded = Number(line.refundedQuantity ?? 0);
        if (qty <= 0 || refunded <= 0) return sum;
        return sum + (Number(line.subtotal) + Number(line.taxAmount)) * Math.min(refunded / qty, 1);
      }, 0);
    const refunds =
      s.orders
        .filter((o) => o.status === 'REFUNDED')
        .reduce((sum, o) => sum + Number(o.total), 0) +
      sales
        .reduce((sum, o) => sum + refundedGross(o), 0);
    const expenses = s.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const withdrawals = s.expenses.filter((e) => e.category === 'WITHDRAWAL').reduce((sum, e) => sum + Number(e.amount), 0);
    const expectedCash = s.expectedCash ? Number(s.expectedCash) : null;

    return {
      id: s.id,
      branchName: s.branch.name,
      cashier: s.user.name,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      status: s.status,
      openingCash: Number(s.openingCash),
      closingCash: s.closingCash ? Number(s.closingCash) : null,
      expectedCash,
      difference: s.closingCash && expectedCash !== null ? +(Number(s.closingCash) - expectedCash).toFixed(2) : null,
      cashSales: +cashSales.toFixed(2),
      cardSales: +cardSales.toFixed(2),
      totalSales: +(cashSales + cardSales).toFixed(2),
      refunds: +refunds.toFixed(2),
      expenses: +expenses.toFixed(2),
      withdrawals: +withdrawals.toFixed(2),
      orderCount: s.orders.length,
    };
  });

  return { rows };
}

export async function getSalesSummary(tenantId: string, branchId?: string, from?: string, to?: string) {
  const where: any = { tenantId, status: 'COMPLETED' };
  if (branchId) where.branchId = branchId;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const orders = await prisma.order.findMany({
    where,
    include: { payments: true, items: true },
  });

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const totalItemsSold = orders.reduce((s, o) => s + o.items.reduce((is, i) => is + Number(i.quantity), 0), 0);
  const totalTax = orders.reduce((s, o) => s + Number(o.taxAmount), 0);
  const totalDiscount = orders.reduce((s, o) => s + Number(o.discountAmount), 0);

  const cashPayments = orders.reduce((s, o) => s + o.payments.filter(p => p.method === 'CASH').reduce((ps, p) => ps + Number(p.amount), 0), 0);
  const cardPayments = orders.reduce((s, o) => s + o.payments.filter(p => p.method === 'CARD').reduce((ps, p) => ps + Number(p.amount), 0), 0);

  return {
    totalRevenue: +totalRevenue.toFixed(2),
    totalOrders,
    avgOrderValue: +avgOrderValue.toFixed(2),
    totalItemsSold,
    totalTax: +totalTax.toFixed(2),
    totalDiscount: +totalDiscount.toFixed(2),
    paymentBreakdown: {
      cash: +cashPayments.toFixed(2),
      card: +cardPayments.toFixed(2),
    },
  };
}

export async function getDailySales(tenantId: string, branchId?: string, days: number = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const where: any = { tenantId, status: 'COMPLETED', createdAt: { gte: since } };
  if (branchId) where.branchId = branchId;

  const orders = await prisma.order.findMany({
    where,
    select: { total: true, createdAt: true, items: true },
    orderBy: { createdAt: 'asc' },
  });

  const dailyMap: Record<string, { revenue: number; orders: number; items: number }> = {};

  // Pre-fill all days
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dailyMap[key] = { revenue: 0, orders: 0, items: 0 };
  }

  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    if (!dailyMap[key]) dailyMap[key] = { revenue: 0, orders: 0, items: 0 };
    dailyMap[key].revenue += Number(order.total);
    dailyMap[key].orders += 1;
    dailyMap[key].items += order.items.reduce((s, i) => s + Number(i.quantity), 0);
  }

  return Object.entries(dailyMap).map(([date, data]) => ({
    date,
    label: new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    revenue: +data.revenue.toFixed(2),
    orders: data.orders,
    items: data.items,
  }));
}

export async function getTopProducts(tenantId: string, branchId?: string, limit: number = 10) {
  const where: any = { order: { tenantId, status: 'COMPLETED' } };
  if (branchId) where.order.branchId = branchId;

  const items = await prisma.orderItem.groupBy({
    by: ['productId', 'name'],
    where,
    _sum: { quantity: true, subtotal: true },
    _count: { id: true },
    orderBy: { _sum: { subtotal: 'desc' } },
    take: limit,
  });

  return items.map((item, index) => ({
    rank: index + 1,
    productId: item.productId,
    name: item.name,
    unitsSold: Number(item._sum.quantity) || 0,
    revenue: Number(item._sum.subtotal) || 0,
    orderCount: item._count.id,
  }));
}

export async function getHourlySales(tenantId: string, branchId?: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const where: any = { tenantId, status: 'COMPLETED', createdAt: { gte: today } };
  if (branchId) where.branchId = branchId;

  const orders = await prisma.order.findMany({
    where,
    select: { total: true, createdAt: true },
  });

  const hourlyMap: Record<number, { revenue: number; orders: number }> = {};
  for (let h = 0; h < 24; h++) {
    hourlyMap[h] = { revenue: 0, orders: 0 };
  }

  for (const order of orders) {
    const hour = order.createdAt.getHours();
    hourlyMap[hour].revenue += Number(order.total);
    hourlyMap[hour].orders += 1;
  }

  return Object.entries(hourlyMap).map(([hour, data]) => ({
    hour: Number(hour),
    label: `${String(hour).padStart(2, '0')}:00`,
    revenue: +data.revenue.toFixed(2),
    orders: data.orders,
  }));
}

export async function getRecentOrders(tenantId: string, limit: number = 15) {
  return prisma.order.findMany({
    where: { tenantId },
    include: {
      items: true,
      payments: true,
      cashier: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
