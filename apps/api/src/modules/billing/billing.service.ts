import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { PLANS, getPlan, PLAN_FEATURE_LABELS } from './plans';

export async function getBillingOverview(tenantId: string) {
  const [tenant, users, branches, products] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, include: { subscription: true } }),
    prisma.user.count({ where: { tenantId } }),
    prisma.branch.count({ where: { tenantId } }),
    prisma.product.count({ where: { tenantId } }),
  ]);
  if (!tenant) throw new AppError(404, 'Tenant not found');

  const plan = getPlan(tenant.plan ?? tenant.subscription?.plan);

  return {
    plan: plan.key,
    planName: plan.name,
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    currency: plan.currency,
    status: tenant.subscription?.status ?? 'ACTIVE',
    trialStarted: tenant.subscription?.trialStarted ?? null,
    periodEnd: tenant.subscription?.periodEnd ?? null,
    autoRenew: tenant.subscription?.autoRenew ?? true,
    limits: plan.limits,
    usage: { users, branches, products },
    features: Object.entries(plan.features)
      .filter(([, enabled]) => enabled)
      .map(([feature]) => PLAN_FEATURE_LABELS[feature as keyof typeof PLAN_FEATURE_LABELS]),
    plans: PLANS.map((p) => ({
      key: p.key,
      name: p.name,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      trialDays: p.trialDays,
    })),
  };
}

const PERIOD_DAYS = 30;

function nextPeriodEnd(): Date {
  return new Date(Date.now() + PERIOD_DAYS * 24 * 60 * 60 * 1000);
}

export async function changePlan(tenantId: string, planKey: string) {
  const target = getPlan(planKey);
  const overview = await getBillingOverview(tenantId);

  // Downgrade safety: never leave a tenant above their new plan's limits.
  const overLimit: string[] = [];
  if (target.limits.users !== -1 && overview.usage.users > target.limits.users)
    overLimit.push(`${overview.usage.users} users (limit ${target.limits.users})`);
  if (target.limits.branches !== -1 && overview.usage.branches > target.limits.branches)
    overLimit.push(`${overview.usage.branches} branches (limit ${target.limits.branches})`);
  if (target.limits.products !== -1 && overview.usage.products > target.limits.products)
    overLimit.push(`${overview.usage.products} products (limit ${target.limits.products})`);

  if (overLimit.length) {
    throw new AppError(
      409,
      `Cannot downgrade to ${target.name}: current usage exceeds the plan (${overLimit.join(', ')}).`,
      'PLAN_DOWNGRADE_BLOCKED'
    );
  }

  await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { tenantId } });
    const inactive = sub && (sub.status === 'PAST_DUE' || sub.status === 'CANCELED');

    await tx.tenant.update({ where: { id: tenantId }, data: { plan: target.key } });
    await tx.subscription.upsert({
      where: { tenantId },
      update: {
        plan: target.key,
        ...(inactive
          ? { status: 'ACTIVE', periodStart: new Date(), periodEnd: nextPeriodEnd(), autoRenew: true }
          : {}),
      },
      create: {
        tenantId,
        plan: target.key,
        status: 'ACTIVE',
        trialStarted: new Date(),
        periodStart: new Date(),
        periodEnd: nextPeriodEnd(),
        autoRenew: true,
      },
    });
  });

  return getBillingOverview(tenantId);
}

export async function renewSubscription(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true },
  });
  if (!tenant) throw new AppError(404, 'Tenant not found');

  const plan = getPlan(tenant.plan ?? tenant.subscription?.plan);
  const sub = tenant.subscription;
  const inactive = sub && (sub.status === 'PAST_DUE' || sub.status === 'CANCELED');
  if (!inactive) return getBillingOverview(tenantId);

  await prisma.subscription.upsert({
    where: { tenantId },
    update: { status: 'ACTIVE', periodStart: new Date(), periodEnd: nextPeriodEnd(), autoRenew: true },
    create: {
      tenantId,
      plan: plan.key,
      status: 'ACTIVE',
      trialStarted: new Date(),
      periodStart: new Date(),
      periodEnd: nextPeriodEnd(),
      autoRenew: true,
    },
  });

  return getBillingOverview(tenantId);
}
