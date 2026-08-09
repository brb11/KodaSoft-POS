import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';

export type BillingCycle = 'monthly' | 'yearly';

export interface PlanLimits {
  branches: number;
  users: number;
  products: number;
}

export interface Plan {
  key: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  trialDays: number;
  limits: PlanLimits;
  features: {
    offline: boolean;
    advancedReports: boolean;
    multiBranch: boolean;
    zatca: boolean;
    customerDebts: boolean;
  };
}

export const PLANS: Plan[] = [
  {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 99,
    priceYearly: 990,
    currency: 'SAR',
    trialDays: 14,
    limits: { branches: 1, users: 5, products: 500 },
    features: { offline: false, advancedReports: false, multiBranch: false, zatca: true, customerDebts: false },
  },
  {
    key: 'pro',
    name: 'Professional',
    priceMonthly: 199,
    priceYearly: 1990,
    currency: 'SAR',
    trialDays: 14,
    limits: { branches: 3, users: 20, products: 5000 },
    features: { offline: true, advancedReports: true, multiBranch: true, zatca: true, customerDebts: true },
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 499,
    priceYearly: 4990,
    currency: 'SAR',
    trialDays: 14,
    limits: { branches: -1, users: -1, products: -1 },
    features: { offline: true, advancedReports: true, multiBranch: true, zatca: true, customerDebts: true },
  },
];

export function getPlan(key?: string | null): Plan {
  const plan = PLANS.find((p) => p.key === key) ?? PLANS.find((p) => p.key === 'starter')!;
  return plan;
}

export const PLAN_FEATURE_LABELS = {
  offline: 'Offline Mode',
  advancedReports: 'Advanced Reports',
  multiBranch: 'Multi-Branch',
  zatca: 'ZATCA e-Invoicing',
  customerDebts: 'Customer Accounts (Debts)',
} as const;

/**
 * Enforces a tenant's plan limit for the given resource (branches | users | products).
 * Trial subscriptions get full access to encourage onboarding.
 */
export async function assertPlanLimit(tenantId: string, resource: 'branches' | 'users' | 'products') {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true },
  });

  if (!tenant) throw new AppError(404, 'Tenant not found');

  // Trial = full access to all features.
  if (tenant.subscription?.status === 'TRIAL') return;

  const plan = getPlan(tenant.plan ?? tenant.subscription?.plan);
  const limit = plan.limits[resource];
  if (limit === -1) return;

  const modelMap = { users: 'user', branches: 'branch', products: 'product' } as const;
  const count = await (prisma as any)[modelMap[resource]].count({ where: { tenantId } });
  if (count >= limit) {
    throw new AppError(
      403,
      `Your ${plan.name} plan allows up to ${limit} ${resource}. Upgrade your plan to add more.`,
      'PLAN_LIMIT_REACHED'
    );
  }
}

/**
 * Enforces a plan feature flag. Trial subscriptions get full access.
 */
export async function assertFeatureAccess(tenantId: string, feature: keyof Plan['features']) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true },
  });

  if (!tenant) throw new AppError(404, 'Tenant not found');

  // Trial = full access to all features.
  if (tenant.subscription?.status === 'TRIAL') return;

  const plan = getPlan(tenant.plan ?? tenant.subscription?.plan);
  if (!plan.features[feature]) {
    throw new AppError(
      403,
      `Customer Accounts (debts) are not included in your ${plan.name} plan. Upgrade to Professional to enable them.`,
      'PLAN_FEATURE_LOCKED'
    );
  }
}
