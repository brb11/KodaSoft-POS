import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { PLANS, getPlan } from '../billing/plans';
import { revokeUserSessions } from '../auth/auth.service';

const PLATFORM_SLUG = 'casheer-platform';
const PLATFORM_ROLE = 'SUPER_ADMIN';

const TENANT_ROLES = ['CASHIER', 'MANAGER', 'OWNER'] as const;
type TenantRole = (typeof TENANT_ROLES)[number];

const PERIOD_DAYS: Record<string, number> = { monthly: 30, yearly: 365 };

function assertNotPlatform(slug: string): void {
  if (slug === PLATFORM_SLUG) {
    throw new AppError(400, 'The platform tenant cannot be modified', 'PLATFORM_TENANT');
  }
}

function fmtLocalDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function generateUniqueSlug(storeName: string): Promise<string> {
  const base =
    storeName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'store';

  const existing = await prisma.tenant.findUnique({ where: { slug: base } });
  if (!existing) return base;

  for (let i = 1; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    const taken = await prisma.tenant.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}

// ─────────────────────────────────────────────
// OVERVIEW
// ─────────────────────────────────────────────
export async function getOverview() {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const windowStart = new Date(todayStart);
  windowStart.setDate(windowStart.getDate() - 29);

  const [tenants, activeTenants, users, orders, todayOrders, subAgg, subscriptionRows] = await Promise.all([
    prisma.tenant.count({ where: { slug: { not: PLATFORM_SLUG } } }),
    prisma.tenant.count({ where: { slug: { not: PLATFORM_SLUG }, isActive: true } }),
    prisma.user.count({ where: { role: { not: PLATFORM_ROLE } } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.subscription.findMany({
      where: { tenant: { slug: { not: PLATFORM_SLUG } } },
      select: { status: true, plan: true, periodEnd: true },
    }),
  ]);

  const revenue = await prisma.order.aggregate({
    where: { status: { in: ['COMPLETED'] } },
    _sum: { total: true },
  });

  const todayRevenue = await prisma.order.aggregate({
    where: { status: { in: ['COMPLETED'] }, createdAt: { gte: todayStart } },
    _sum: { total: true },
  });

  const mrr = subscriptionRows
    .filter((s) => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + getPlan(s.plan).priceMonthly, 0);

  const expiringIn = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringSoon = subscriptionRows.filter(
    (s) => s.periodEnd && s.periodEnd >= todayStart && s.periodEnd <= expiringIn
  ).length;

  // Time series (last 30 days)
  const completedOrders = await prisma.order.findMany({
    where: { status: { in: ['COMPLETED'] }, createdAt: { gte: windowStart } },
    select: { createdAt: true, total: true, tenantId: true },
  });
  const newTenants = await prisma.tenant.findMany({
    where: { slug: { not: PLATFORM_SLUG }, createdAt: { gte: windowStart } },
    select: { createdAt: true },
  });

  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    days.push(fmtLocalDay(d));
  }
  const dayIndex = (d: Date) => days.indexOf(fmtLocalDay(d));

  const revenueSeries = days.map((day) => ({ date: day, value: 0 }));
  const ordersSeries = days.map((day) => ({ date: day, value: 0 }));
  const tenantSeries = days.map((day) => ({ date: day, value: 0 }));

  const revenueByTenant = new Map<string, number>();
  for (const o of completedOrders) {
    const idx = dayIndex(o.createdAt);
    if (idx === -1) continue;
    ordersSeries[idx].value += 1;
    revenueSeries[idx].value += Number(o.total);
    revenueByTenant.set(o.tenantId, (revenueByTenant.get(o.tenantId) ?? 0) + Number(o.total));
  }
  for (const t of newTenants) {
    const idx = dayIndex(t.createdAt);
    if (idx === -1) continue;
    tenantSeries[idx].value += 1;
  }

  const topTenantIds = [...revenueByTenant.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
  const topTenantRows = await prisma.tenant.findMany({
    where: { id: { in: topTenantIds } },
    select: { id: true, name: true, slug: true, plan: true },
  });
  const topTenantMap = new Map(topTenantRows.map((t) => [t.id, t]));
  const topTenants = topTenantIds.map((id) => {
    const t = topTenantMap.get(id);
    return {
      id,
      name: t?.name ?? '—',
      slug: t?.slug ?? '',
      plan: t?.plan ?? 'starter',
      revenue: revenueByTenant.get(id) ?? 0,
    };
  });

  const planRows = await prisma.subscription.groupBy({
    by: ['plan'],
    where: { tenant: { slug: { not: PLATFORM_SLUG } } },
    _count: { _all: true },
  });
  const planDistribution = planRows.map((r) => ({ key: r.plan, count: r._count._all }));

  const subscriptionsByStatus = subAgg.reduce(
    (acc, row) => ({ ...acc, [row.status]: row._count._all }),
    {} as Record<string, number>
  );

  return {
    tenants,
    activeTenants,
    suspendedTenants: tenants - activeTenants,
    users,
    orders,
    revenue: revenue._sum.total ?? 0,
    todayOrders,
    todayRevenue: todayRevenue._sum.total ?? 0,
    mrr,
    activeSubscriptions: subscriptionRows.filter((s) => s.status === 'ACTIVE').length,
    trialTenants: subscriptionRows.filter((s) => s.status === 'TRIAL').length,
    expiringSoon,
    subscriptionsByStatus,
    plans: PLANS.map((p) => ({ key: p.key, name: p.name, priceMonthly: p.priceMonthly, trialDays: p.trialDays })),
    revenueSeries,
    ordersSeries,
    tenantSeries,
    planDistribution,
    topTenants,
  };
}

// ─────────────────────────────────────────────
// TENANTS
// ─────────────────────────────────────────────
export async function listTenants(filters: {
  search?: string;
  status?: 'all' | 'active' | 'suspended';
  plan?: string;
  subStatus?: string;
  expiringSoon?: string;
  page: number;
  limit: number;
}) {
  const where: any = { slug: { not: PLATFORM_SLUG } };
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { slug: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.status === 'active') where.isActive = true;
  if (filters.status === 'suspended') where.isActive = false;
  if (filters.plan) where.plan = filters.plan;

  const subFilter: any = {};
  if (filters.subStatus) subFilter.status = filters.subStatus;
  if (filters.expiringSoon === 'true') {
    const now = new Date();
    const expiringIn = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    subFilter.periodEnd = { gte: now, lte: expiringIn };
  }
  if (Object.keys(subFilter).length > 0) where.subscription = { is: subFilter };

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: {
        subscription: true,
        _count: { select: { users: true, branches: true } },
      },
    }),
    prisma.tenant.count({ where }),
  ]);

  const ids = tenants.map((t) => t.id);
  const [revenueByTenant, ordersByTenant] = await Promise.all([
    prisma.order.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: ids }, status: { in: ['COMPLETED'] } },
      _sum: { total: true },
    }),
    prisma.order.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  const revenueMap = new Map(revenueByTenant.map((r) => [r.tenantId, r._sum.total ?? 0]));
  const ordersMap = new Map(ordersByTenant.map((r) => [r.tenantId, r._count._all]));

  const items = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    plan: t.plan,
    isActive: t.isActive,
    createdAt: t.createdAt,
    users: t._count.users,
    branches: t._count.branches,
    orders: ordersMap.get(t.id) ?? 0,
    revenue: revenueMap.get(t.id) ?? 0,
    subscription: t.subscription
      ? {
          plan: t.subscription.plan,
          status: t.subscription.status,
          periodEnd: t.subscription.periodEnd,
          autoRenew: t.subscription.autoRenew,
          provider: t.subscription.provider,
          billingCycle: t.subscription.billingCycle,
        }
      : null,
  }));

  return { items, total, page: filters.page, limit: filters.limit };
}

export async function getTenantDetail(id: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      subscription: true,
      _count: { select: { users: true, branches: true, products: true, categories: true, customers: true } },
    },
  });
  if (!tenant) throw new AppError(404, 'Tenant not found');
  assertNotPlatform(tenant.slug);

  const [revenue, users, recentOrders, branches, payments] = await Promise.all([
    prisma.order.aggregate({
      where: { tenantId: id, status: { in: ['COMPLETED'] } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.user.findMany({
      where: { tenantId: id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.order.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        branch: { select: { name: true } },
      },
    }),
    prisma.branch.findMany({
      where: { tenantId: id },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        isActive: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.subscriptionPayment.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const { _count, ...rest } = tenant;
  return {
    ...rest,
    revenue: revenue._sum.total ?? 0,
    completedOrders: revenue._count,
    counts: _count,
    users,
    recentOrders,
    branches,
    payments,
  };
}

export async function createTenant(dto: {
  name: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  plan: string;
  branchName?: string;
  branchAddress?: string;
  phone?: string;
}) {
  const existing = await prisma.user.findFirst({ where: { email: dto.ownerEmail.toLowerCase() } });
  if (existing) throw new AppError(409, 'An account with this email already exists', 'EMAIL_IN_USE');

  const plan = getPlan(dto.plan);
  const slug = await generateUniqueSlug(dto.name);
  const passwordHash = await bcrypt.hash(dto.ownerPassword, 10);
  const branchName = dto.branchName?.trim() || 'Main Branch';
  const periodEnd = new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: dto.name.trim(), slug, plan: plan.key },
    });

    const branch = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        name: branchName,
        address: dto.branchAddress,
        phone: dto.phone,
      },
    });

    await tx.subscription.create({
      data: {
        tenantId: tenant.id,
        plan: plan.key,
        status: plan.trialDays > 0 ? 'TRIAL' : 'ACTIVE',
        trialStarted: new Date(),
        periodStart: new Date(),
        periodEnd,
        billingCycle: 'monthly',
        provider: 'MANUAL',
      },
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: dto.ownerName.trim(),
        email: dto.ownerEmail.toLowerCase(),
        passwordHash,
        role: 'OWNER',
      },
    });

    return { tenant, user };
  });

  return result;
}

export async function updateTenant(
  id: string,
  dto: {
    name?: string;
    isActive?: boolean;
    plan?: string;
    subscriptionStatus?: string;
    autoRenew?: boolean;
    billingCycle?: string;
    periodStart?: Date;
    periodEnd?: Date | null;
    trialStarted?: Date;
    provider?: string;
    extendTrialDays?: number;
  }
) {
  const tenant = await prisma.tenant.findUnique({ where: { id }, include: { subscription: true } });
  if (!tenant) throw new AppError(404, 'Tenant not found');
  assertNotPlatform(tenant.slug);

  if (dto.plan && !PLANS.some((p) => p.key === dto.plan)) throw new AppError(400, 'Unknown plan');
  if (dto.subscriptionStatus && !['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'].includes(dto.subscriptionStatus)) {
    throw new AppError(400, 'Invalid subscription status');
  }
  if (dto.billingCycle && !['monthly', 'yearly'].includes(dto.billingCycle)) {
    throw new AppError(400, 'Invalid billing cycle');
  }

  return prisma.$transaction(async (tx) => {
    const planKey = dto.plan ?? tenant.plan;
    const existing = tenant.subscription;

    let periodEnd = existing?.periodEnd ?? null;
    if (dto.periodEnd !== undefined) periodEnd = dto.periodEnd;
    if (dto.extendTrialDays && dto.extendTrialDays > 0) {
      const base = periodEnd && periodEnd > new Date() ? periodEnd : new Date();
      periodEnd = new Date(base.getTime() + dto.extendTrialDays * 24 * 60 * 60 * 1000);
    }

    const updated = await tx.tenant.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        plan: planKey,
        isActive: dto.isActive,
      },
    });

    const subscription = await tx.subscription.upsert({
      where: { tenantId: id },
      update: {
        plan: planKey,
        status: dto.subscriptionStatus ?? existing?.status ?? 'ACTIVE',
        autoRenew: dto.autoRenew,
        billingCycle: dto.billingCycle,
        periodStart: dto.periodStart === undefined ? undefined : dto.periodStart,
        periodEnd: dto.periodEnd === undefined ? (dto.extendTrialDays ? periodEnd : undefined) : periodEnd,
        trialStarted: dto.trialStarted === undefined ? undefined : dto.trialStarted,
        provider: dto.provider,
      },
      create: {
        tenantId: id,
        plan: planKey,
        status: dto.subscriptionStatus ?? 'ACTIVE',
        autoRenew: dto.autoRenew ?? true,
        billingCycle: dto.billingCycle ?? 'monthly',
        periodStart: dto.periodStart ?? new Date(),
        periodEnd,
        provider: dto.provider ?? 'MANUAL',
      },
    });

    return { ...updated, subscription };
  });
}

export async function deleteTenant(id: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) throw new AppError(404, 'Tenant not found');
  assertNotPlatform(tenant.slug);

  const [orderCount, paymentCount, customerPaymentCount] = await Promise.all([
    prisma.order.count({ where: { tenantId: id } }),
    prisma.subscriptionPayment.count({ where: { tenantId: id } }),
    prisma.customerPayment.count({ where: { tenantId: id } }),
  ]);

  if (orderCount + paymentCount + customerPaymentCount > 0) {
    throw new AppError(
      409,
      'Tenant has transaction history and cannot be deleted. Suspend it instead.',
      'TENANT_HAS_HISTORY'
    );
  }

  await prisma.$transaction([
    prisma.refreshSession.deleteMany({ where: { user: { tenantId: id } } }),
    prisma.orderItem.deleteMany({ where: { order: { tenantId: id } } }),
    prisma.payment.deleteMany({ where: { order: { tenantId: id } } }),
    prisma.order.deleteMany({ where: { tenantId: id } }),
    prisma.inventoryMovement.deleteMany({ where: { branch: { tenantId: id } } }),
    prisma.inventory.deleteMany({ where: { branch: { tenantId: id } } }),
    prisma.productVariant.deleteMany({ where: { product: { tenantId: id } } }),
    prisma.product.deleteMany({ where: { tenantId: id } }),
    prisma.customerPayment.deleteMany({ where: { tenantId: id } }),
    prisma.expense.deleteMany({ where: { branch: { tenantId: id } } }),
    prisma.shift.deleteMany({ where: { branch: { tenantId: id } } }),
    prisma.heldOrder.deleteMany({ where: { tenantId: id } }),
    prisma.notification.deleteMany({ where: { tenantId: id } }),
    prisma.setting.deleteMany({ where: { tenantId: id } }),
    prisma.customer.deleteMany({ where: { tenantId: id } }),
    prisma.category.deleteMany({ where: { tenantId: id, parentId: { not: null } } }),
    prisma.category.deleteMany({ where: { tenantId: id } }),
    prisma.taxRate.deleteMany({ where: { tenantId: id } }),
    prisma.subscriptionPayment.deleteMany({ where: { tenantId: id } }),
    prisma.subscription.deleteMany({ where: { tenantId: id } }),
    prisma.zatcaCredential.deleteMany({ where: { tenantId: id } }),
    prisma.invoiceSubmission.deleteMany({ where: { tenantId: id } }),
    prisma.branch.deleteMany({ where: { tenantId: id } }),
    prisma.user.deleteMany({ where: { tenantId: id } }),
    prisma.tenant.deleteMany({ where: { id } }),
  ]);

  return { id };
}

// ─────────────────────────────────────────────
// USERS (platform-wide)
// ─────────────────────────────────────────────
export async function listUsers(filters: {
  search?: string;
  tenantId?: string;
  role?: string;
  status?: 'all' | 'active' | 'inactive';
  page: number;
  limit: number;
}) {
  const where: any = { role: { not: PLATFORM_ROLE } };
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  if (filters.tenantId) where.tenantId = filters.tenantId;
  if (filters.role) where.role = filters.role;
  if (filters.status === 'active') where.isActive = true;
  if (filters.status === 'inactive') where.isActive = false;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page: filters.page, limit: filters.limit };
}

export async function createSaaSUser(dto: {
  tenantId: string;
  name: string;
  email: string;
  password?: string;
  pin?: string;
  role: TenantRole;
  branchId?: string | null;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: dto.tenantId } });
  if (!tenant) throw new AppError(404, 'Tenant not found');
  assertNotPlatform(tenant.slug);

  const existing = await prisma.user.findFirst({ where: { email: dto.email.toLowerCase() } });
  if (existing) throw new AppError(409, 'An account with this email already exists', 'EMAIL_IN_USE');

  if (dto.branchId) {
    const branch = await prisma.branch.findFirst({ where: { id: dto.branchId, tenantId: dto.tenantId } });
    if (!branch) throw new AppError(400, 'Branch does not belong to this tenant', 'INVALID_BRANCH');
  }

  const payload: any = {
    tenantId: dto.tenantId,
    branchId: dto.branchId ?? null,
    name: dto.name.trim(),
    email: dto.email.toLowerCase(),
    role: dto.role,
  };

  payload.passwordHash = await bcrypt.hash(dto.password || 'changeme123', 10);
  if (dto.pin) payload.pinHash = await bcrypt.hash(dto.pin, 10);

  return prisma.user.create({ data: payload });
}

export async function updateSaaSUser(
  id: string,
  dto: {
    name?: string;
    email?: string;
    password?: string;
    pin?: string;
    role?: TenantRole;
    isActive?: boolean;
    branchId?: string | null;
  }
) {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, branchId: true, tenantId: true, tenant: { select: { slug: true } } } });
  if (!user) throw new AppError(404, 'User not found');
  assertNotPlatform(user.tenant.slug);

  const updateData: any = {};
  if (dto.name !== undefined) updateData.name = dto.name.trim();
  if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
  if (dto.branchId !== undefined) updateData.branchId = dto.branchId || null;

  if (dto.role !== undefined) {
    if (!TENANT_ROLES.includes(dto.role)) throw new AppError(400, 'Invalid role', 'INVALID_ROLE');
    if (user.role === 'OWNER' && dto.role !== 'OWNER') {
      const ownerCount = await prisma.user.count({ where: { tenantId: user.tenantId, role: 'OWNER', isActive: true } });
      if (ownerCount <= 1) throw new AppError(400, 'Cannot demote the last active owner', 'LAST_OWNER');
    }
    updateData.role = dto.role;
  }

  if (dto.isActive === false && user.role === 'OWNER') {
    const ownerCount = await prisma.user.count({ where: { tenantId: user.tenantId, role: 'OWNER', isActive: true } });
    if (ownerCount <= 1) throw new AppError(400, 'Cannot deactivate the last active owner', 'LAST_OWNER');
  }

  if (dto.email) {
    const normalized = dto.email.toLowerCase();
    const existing = await prisma.user.findFirst({ where: { email: normalized } });
    if (existing && existing.id !== id) throw new AppError(409, 'An account with this email already exists', 'EMAIL_IN_USE');
    updateData.email = normalized;
  }

  const credentialsChanged = Boolean(dto.password || dto.pin);
  if (dto.password) updateData.passwordHash = await bcrypt.hash(dto.password, 10);
  if (dto.pin) {
    if (!/^\d{4}$/.test(dto.pin)) throw new AppError(400, 'PIN must be exactly 4 digits', 'INVALID_PIN');
    updateData.pinHash = await bcrypt.hash(dto.pin, 10);
  }

  if (Object.keys(updateData).length === 0) throw new AppError(400, 'Nothing to update', 'EMPTY_UPDATE');

  const updated = await prisma.user.update({ where: { id }, data: updateData });
  if (credentialsChanged) await revokeUserSessions(id);
  return updated;
}

export async function deleteSaaSUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      tenant: { select: { slug: true } },
      _count: { select: { orders: true, shifts: true, expenses: true } },
    },
  });
  if (!user) throw new AppError(404, 'User not found');
  assertNotPlatform(user.tenant.slug);

  if (user.role === 'OWNER') {
    const ownerCount = await prisma.user.count({ where: { tenantId: user.tenantId, role: 'OWNER', isActive: true } });
    if (ownerCount <= 1) throw new AppError(400, 'Cannot delete the last active owner', 'LAST_OWNER');
  }

  const { orders, shifts, expenses } = user._count;
  if (orders + shifts + expenses > 0) {
    throw new AppError(400, 'User has transaction history and cannot be deleted. Deactivate instead.', 'USER_HAS_HISTORY');
  }

  await prisma.$transaction([
    prisma.refreshSession.deleteMany({ where: { userId: id } }),
    prisma.notification.deleteMany({ where: { userId: id } }),
    prisma.user.deleteMany({ where: { id } }),
  ]);
  return { id };
}

// ─────────────────────────────────────────────
// SUBSCRIPTION PAYMENTS (platform ledger)
// ─────────────────────────────────────────────
export async function listPayments(filters: {
  search?: string;
  status?: string;
  plan?: string;
  page: number;
  limit: number;
}) {
  const where: any = { tenant: { slug: { not: PLATFORM_SLUG } } };
  if (filters.status) where.status = filters.status;
  if (filters.plan) where.plan = filters.plan;
  if (filters.search) {
    where.OR = [
      { tenant: { name: { contains: filters.search, mode: 'insensitive' } } },
      { tenant: { slug: { contains: filters.search, mode: 'insensitive' } } },
      { providerRef: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.subscriptionPayment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.subscriptionPayment.count({ where }),
  ]);

  return {
    items: items.map((p) => ({ ...p, tenantId: p.tenant.id, tenantName: p.tenant.name, tenantSlug: p.tenant.slug })),
    total,
    page: filters.page,
    limit: filters.limit,
  };
}

async function activateSubscriptionForPlan(tx: any, tenantId: string, planKey: string, billingCycle: string, provider: string) {
  const days = PERIOD_DAYS[billingCycle] ?? PERIOD_DAYS.monthly;
  const now = new Date();
  const periodStart = now;
  const periodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  await tx.tenant.update({ where: { id: tenantId }, data: { plan: planKey } });
  await tx.subscription.upsert({
    where: { tenantId },
    update: { plan: planKey, status: 'ACTIVE', billingCycle, periodStart, periodEnd, autoRenew: true, provider },
    create: { tenantId, plan: planKey, status: 'ACTIVE', billingCycle, periodStart, periodEnd, autoRenew: true, provider },
  });
}

export async function createManualPayment(dto: {
  tenantId: string;
  plan?: string;
  amount: number;
  currency?: string;
  billingCycle?: string;
  note?: string;
}) {
  const tenant = await prisma.tenant.findUnique({ where: { id: dto.tenantId }, include: { subscription: true } });
  if (!tenant) throw new AppError(404, 'Tenant not found');
  assertNotPlatform(tenant.slug);

  const plan = getPlan(dto.plan ?? tenant.plan);
  const billingCycle = dto.billingCycle ?? tenant.subscription?.billingCycle ?? 'monthly';

  return prisma.$transaction(async (tx) => {
    const payment = await tx.subscriptionPayment.create({
      data: {
        tenantId: tenant.id,
        plan: plan.key,
        amount: dto.amount,
        currency: dto.currency ?? 'SAR',
        mode: 'live',
        provider: 'MANUAL',
        status: 'PAID',
        billingCycle,
        metadata: dto.note ? { note: dto.note } : undefined,
        paidAt: new Date(),
      },
    });

    await activateSubscriptionForPlan(tx, tenant.id, plan.key, billingCycle, 'MANUAL');
    return payment;
  });
}

export async function updatePaymentStatus(id: string, status: string) {
  if (!['PENDING', 'PAID', 'FAILED', 'CANCELED'].includes(status)) {
    throw new AppError(400, 'Invalid payment status');
  }

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id },
    include: { tenant: { include: { subscription: true } } },
  });
  if (!payment) throw new AppError(404, 'Payment not found');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.subscriptionPayment.update({
      where: { id },
      data: { status, paidAt: status === 'PAID' ? new Date() : payment.paidAt },
    });

    if (status === 'PAID') {
      await activateSubscriptionForPlan(tx, payment.tenantId, payment.plan, payment.billingCycle ?? 'monthly', payment.provider);
    }

    return updated;
  });
}
