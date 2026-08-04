import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { PLANS, getPlan } from '../billing/plans';

const PLATFORM_SLUG = 'casheer-platform';
const PLATFORM_ROLE = 'SUPER_ADMIN';

export async function getOverview() {
  const [tenants, activeTenants, users, orders, todayOrders, subAgg] = await Promise.all([
    prisma.tenant.count({ where: { slug: { not: PLATFORM_SLUG } } }),
    prisma.tenant.count({ where: { slug: { not: PLATFORM_SLUG }, isActive: true } }),
    prisma.user.count({ where: { role: { not: PLATFORM_ROLE } } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const revenue = await prisma.order.aggregate({
    where: { status: { in: ['COMPLETED'] } },
    _sum: { total: true },
  });

  const todayRevenue = await prisma.order.aggregate({
    where: { status: { in: ['COMPLETED'] }, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    _sum: { total: true },
  });

  const subscriptions = await prisma.subscription.findMany({
    where: { tenant: { slug: { not: PLATFORM_SLUG } } },
    select: { status: true, plan: true },
  });

  const mrr = subscriptions
    .filter((s) => s.status === 'ACTIVE')
    .reduce((sum, s) => sum + getPlan(s.plan).priceMonthly, 0);

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
    subscriptionsByStatus: subAgg.reduce(
      (acc, row) => ({ ...acc, [row.status]: row._count._all }),
      {} as Record<string, number>
    ),
    plans: PLANS.map((p) => ({ key: p.key, name: p.name, priceMonthly: p.priceMonthly, trialDays: p.trialDays })),
  };
}

export async function listTenants() {
  const tenants = await prisma.tenant.findMany({
    where: { slug: { not: PLATFORM_SLUG } },
    orderBy: { createdAt: 'desc' },
    include: {
      subscription: true,
      _count: { select: { users: true, branches: true } },
    },
  });

  const [revenueByTenant, ordersByTenant] = await Promise.all([
    prisma.order.groupBy({
      by: ['tenantId'],
      where: { status: { in: ['COMPLETED'] } },
      _sum: { total: true },
    }),
    prisma.order.groupBy({
      by: ['tenantId'],
      _count: { _all: true },
    }),
  ]);

  const revenueMap = new Map(revenueByTenant.map((r) => [r.tenantId, r._sum.total ?? 0]));
  const ordersMap = new Map(ordersByTenant.map((r) => [r.tenantId, r._count._all]));

  return tenants.map((t) => ({
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
        }
      : null,
  }));
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

  const [revenue, users, recentOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { tenantId: id, status: { in: ['COMPLETED'] } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.user.findMany({
      where: { tenantId: id },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
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
  ]);

  const { _count, ...rest } = tenant;
  return {
    ...rest,
    revenue: revenue._sum.total ?? 0,
    completedOrders: revenue._count,
    users,
    recentOrders,
  };
}

export async function updateTenant(
  id: string,
  dto: { plan?: string; isActive?: boolean; subscriptionStatus?: string; autoRenew?: boolean }
) {
  const tenant = await prisma.tenant.findUnique({ where: { id }, include: { subscription: true } });
  if (!tenant) throw new AppError(404, 'Tenant not found');

  if (dto.plan && !PLANS.some((p) => p.key === dto.plan)) {
    throw new AppError(400, 'Unknown plan');
  }
  if (dto.subscriptionStatus && !['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'].includes(dto.subscriptionStatus)) {
    throw new AppError(400, 'Invalid subscription status');
  }

  return prisma.$transaction(async (tx) => {
    const planKey = dto.plan ?? tenant.plan;
    const updated = await tx.tenant.update({
      where: { id },
      data: {
        plan: planKey,
        isActive: dto.isActive,
      },
    });

    const subscription = await tx.subscription.upsert({
      where: { tenantId: id },
      update: {
        plan: planKey,
        status: dto.subscriptionStatus ?? tenant.subscription?.status ?? 'ACTIVE',
        autoRenew: dto.autoRenew,
      },
      create: {
        tenantId: id,
        plan: planKey,
        status: dto.subscriptionStatus ?? 'ACTIVE',
        autoRenew: dto.autoRenew ?? true,
      },
    });

    return { ...updated, subscription };
  });
}
