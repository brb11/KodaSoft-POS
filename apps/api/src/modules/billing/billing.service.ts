import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { PLANS, getPlan, PLAN_FEATURE_LABELS, BillingCycle } from './plans';
import {
  getPaymentProvider,
  getPaymentProviderName,
  isSandbox,
  SandboxProvider,
  PayTabsProvider,
  MoyasarProvider,
  StripeProvider,
  WebhookContext,
  PaymentProvider,
} from './providers';

const PROVIDER_REGISTRY: Record<string, PaymentProvider> = {
  sandbox: new SandboxProvider(),
  stripe: new StripeProvider(),
  paytabs: new PayTabsProvider(),
  moyasar: new MoyasarProvider(),
};

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
    billingCycle: (tenant.subscription?.billingCycle as BillingCycle) ?? 'monthly',
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
    payment: {
      mode: isSandbox() ? 'sandbox' : 'live',
      provider: getPaymentProviderName(),
    },
  };
}

const CHECKOUT_TTL_MS = 60 * 60 * 1000; // 1 hour to complete payment

export function periodDays(cycle: BillingCycle): number {
  return cycle === 'yearly' ? 365 : 30;
}

function nextPeriodEnd(cycle: BillingCycle = 'monthly'): Date {
  return new Date(Date.now() + periodDays(cycle) * 24 * 60 * 60 * 1000);
}

export function isBillingCycle(value: string | undefined | null): value is BillingCycle {
  return value === 'monthly' || value === 'yearly';
}

export async function assertDowngradeSafe(tenantId: string, planKey: string): Promise<void> {
  const target = getPlan(planKey);
  const overview = await getBillingOverview(tenantId);

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
}

export async function changePlan(tenantId: string, planKey: string, billingCycle?: BillingCycle) {
  const target = getPlan(planKey);
  await assertDowngradeSafe(tenantId, planKey);
  const cycle = billingCycle ?? 'monthly';

  await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { tenantId } });
    const inactive = sub && (sub.status === 'PAST_DUE' || sub.status === 'CANCELED');

    await tx.tenant.update({ where: { id: tenantId }, data: { plan: target.key } });
    await tx.subscription.upsert({
      where: { tenantId },
      update: {
        plan: target.key,
        billingCycle: cycle,
        ...(inactive
          ? { status: 'ACTIVE', periodStart: new Date(), periodEnd: nextPeriodEnd(cycle), autoRenew: true }
          : {}),
      },
      create: {
        tenantId,
        plan: target.key,
        status: 'ACTIVE',
        billingCycle: cycle,
        trialStarted: new Date(),
        periodStart: new Date(),
        periodEnd: nextPeriodEnd(cycle),
        autoRenew: true,
      },
    });
  });

  return getBillingOverview(tenantId);
}

// ─────────────────────────────────────────────
// CHECKOUT → PAYMENT PROVIDER → WEBHOOK → ACTIVE
// ─────────────────────────────────────────────

export interface CheckoutOptions {
  /** Target plan key. Omitted = pay/renew the current plan. */
  plan?: string;
  /** Billing cycle for the payment. Defaults to the subscription's current cycle. */
  billingCycle?: BillingCycle;
}

async function resolveOwnerEmail(tenantId: string): Promise<string | null> {
  const owner = await prisma.user.findFirst({
    where: { tenantId, role: 'OWNER', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  return owner?.email ?? null;
}

/**
 * Step 1 (Checkout): validates the target plan, records a PENDING payment and
 * asks the active payment provider for a hosted checkout session.
 */
export async function createCheckout(tenantId: string, opts: CheckoutOptions = {}) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true },
  });
  if (!tenant) throw new AppError(404, 'Tenant not found');

  const currentPlan = tenant.plan ?? tenant.subscription?.plan ?? 'starter';
  const targetPlanKey = opts.plan ?? currentPlan;
  const target = getPlan(targetPlanKey);
  const billingCycle: BillingCycle =
    opts.billingCycle ?? (isBillingCycle(tenant.subscription?.billingCycle) ? tenant.subscription!.billingCycle : 'monthly');

  // If the customer explicitly picks a different plan, make sure a downgrade
  // won't strand them above the new limits — before any money is charged.
  if (opts.plan && opts.plan !== currentPlan) {
    await assertDowngradeSafe(tenantId, targetPlanKey);
  }

  const provider = getPaymentProvider();
  const customerEmail = await resolveOwnerEmail(tenantId);
  const amount = billingCycle === 'yearly' ? target.priceYearly : target.priceMonthly;

  const payment = await prisma.subscriptionPayment.create({
    data: {
      tenantId,
      subscriptionId: tenant.subscription?.id,
      plan: target.key,
      amount,
      currency: target.currency,
      mode: isSandbox() ? 'sandbox' : 'live',
      provider: provider.name,
      status: 'PENDING',
      billingCycle,
      customerEmail,
      expiresAt: new Date(Date.now() + CHECKOUT_TTL_MS),
    },
  });

  const checkout = await provider.createCheckoutSession({
    tenantId,
    subscriptionId: tenant.subscription?.id,
    plan: target.key,
    planName: target.name,
    amount: Number(payment.amount),
    currency: payment.currency,
    customerEmail: customerEmail ?? '',
    description: `KodaSoft-POS ${target.name} plan subscription`,
    metadata: { paymentId: payment.id },
  });

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      providerRef: checkout.providerRef,
      checkoutUrl: checkout.checkoutUrl,
      metadata: checkout.payload ? (checkout.payload as any) : undefined,
    },
  });

  return {
    payment: {
      id: payment.id,
      plan: target.key,
      planName: target.name,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: 'PENDING',
      provider: provider.name,
      mode: isSandbox() ? 'sandbox' : 'live',
      billingCycle,
      sandbox: isSandbox(),
      checkoutUrl: checkout.checkoutUrl ?? null,
      approveUrl: isSandbox() ? `/api/v1/billing/checkout/${payment.id}/sandbox/approve` : null,
      declineUrl: isSandbox() ? `/api/v1/billing/checkout/${payment.id}/sandbox/decline` : null,
    },
  };
}

/**
 * Step 5 (Billing Service → ACTIVE): the single activation path. Applied by the
 * webhook handler (real gateways) and the sandbox approve endpoint (simulation).
 * Idempotent — replaying a webhook is harmless.
 */
export async function activateFromPayment(paymentId: string): Promise<ReturnType<typeof getBillingOverview>> {
  const payment = await prisma.subscriptionPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');

  if (payment.status === 'PAID') return getBillingOverview(payment.tenantId);
  if (payment.status !== 'PENDING') {
    throw new AppError(409, 'This payment was already processed', 'PAYMENT_ALREADY_PROCESSED');
  }

  const now = new Date();
  const cycle: BillingCycle = isBillingCycle(payment.billingCycle) ? payment.billingCycle : 'monthly';
  await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { tenantId: payment.tenantId } });

    await tx.tenant.update({ where: { id: payment.tenantId }, data: { plan: payment.plan } });
    await tx.subscription.upsert({
      where: { tenantId: payment.tenantId },
      update: {
        plan: payment.plan,
        status: 'ACTIVE',
        periodStart: now,
        periodEnd: nextPeriodEnd(cycle),
        autoRenew: true,
        billingCycle: cycle,
        provider: payment.provider,
        providerRef: payment.providerRef,
      },
      create: {
        tenantId: payment.tenantId,
        plan: payment.plan,
        status: 'ACTIVE',
        trialStarted: now,
        periodStart: now,
        periodEnd: nextPeriodEnd(cycle),
        autoRenew: true,
        billingCycle: cycle,
        provider: payment.provider,
        providerRef: payment.providerRef,
      },
    });

    await tx.subscriptionPayment.update({
      where: { id: payment.id },
      data: { status: 'PAID', paidAt: now, subscriptionId: sub?.id },
    });
  });

  return getBillingOverview(payment.tenantId);
}

/**
 * Step 4 (Webhook): the public endpoint called by the payment gateway. It
 * verifies the signature, maps the event to our PENDING payment and — on
 * success — activates the subscription.
 */
export async function processWebhook(providerName: string, ctx: WebhookContext) {
  const provider = getProviderByName(providerName);
  const result = await provider.handleWebhook(ctx);

  if (!result.providerRef) {
    return { ignored: true, reason: 'event not applicable' };
  }

  const payment = await prisma.subscriptionPayment.findFirst({
    where: { provider: providerName, providerRef: result.providerRef },
  });
  if (!payment) {
    return { ignored: true, reason: 'unknown providerRef' };
  }

  if (result.status === 'PAID') {
    const data = await activateFromPayment(payment.id);
    return { success: true, paymentId: payment.id, status: 'PAID', data };
  }

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: { status: result.status === 'FAILED' ? 'FAILED' : 'CANCELED' },
  });
  return { success: false, paymentId: payment.id, status: result.status };
}

/** Sandbox: simulate a successful gateway notification (OWNER endpoint). */
export async function sandboxApprove(tenantId: string, paymentId: string) {
  const payment = await prisma.subscriptionPayment.findFirst({ where: { id: paymentId, tenantId } });
  if (!payment) throw new AppError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');
  if (payment.provider !== 'sandbox') throw new AppError(400, 'Not a sandbox payment', 'NOT_SANDBOX_PAYMENT');

  return activateFromPayment(payment.id);
}

/** Sandbox: simulate a declined/failed payment. */
export async function sandboxDecline(tenantId: string, paymentId: string) {
  const payment = await prisma.subscriptionPayment.findFirst({ where: { id: paymentId, tenantId } });
  if (!payment) throw new AppError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');
  if (payment.provider !== 'sandbox') throw new AppError(400, 'Not a sandbox payment', 'NOT_SANDBOX_PAYMENT');
  if (payment.status !== 'PENDING') {
    throw new AppError(409, 'This payment was already processed', 'PAYMENT_ALREADY_PROCESSED');
  }

  await prisma.subscriptionPayment.update({ where: { id: payment.id }, data: { status: 'CANCELED' } });
  return { success: true, paymentId: payment.id, status: 'CANCELED' };
}

export async function listPayments(tenantId: string, page = 1, limit = 20) {
  const [total, items] = await Promise.all([
    prisma.subscriptionPayment.count({ where: { tenantId } }),
    prisma.subscriptionPayment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    items: items.map((p) => ({
      id: p.id,
      plan: p.plan,
      amount: Number(p.amount),
      currency: p.currency,
      mode: p.mode,
      provider: p.provider,
      status: p.status,
      billingCycle: (p.billingCycle as BillingCycle) ?? 'monthly',
      providerRef: p.providerRef,
      checkoutUrl: p.checkoutUrl,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    })),
    total,
    page,
    limit,
  };
}

/**
 * Backward-compatible renew: when the subscription is inactive, run the
 * checkout flow. In sandbox mode the payment is auto-approved immediately so
 * callers keep getting the billing overview (same shape as before). In live
 * mode the caller receives a checkout session to redirect the customer to.
 */
export async function renewSubscription(tenantId: string, billingCycle?: BillingCycle) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { subscription: true },
  });
  if (!tenant) throw new AppError(404, 'Tenant not found');

  const sub = tenant.subscription;
  const now = new Date();
  const trialExpired = sub?.status === 'TRIAL' && !!sub.periodEnd && sub.periodEnd < now;
  const inactive = !!sub && (sub.status === 'PAST_DUE' || sub.status === 'CANCELED' || trialExpired);
  if (!inactive) return getBillingOverview(tenantId);

  const cycle: BillingCycle =
    billingCycle ?? (isBillingCycle(sub?.billingCycle) ? sub!.billingCycle : 'monthly');
  const checkout = await createCheckout(tenantId, { billingCycle: cycle });
  if (isSandbox()) {
    return sandboxApprove(tenantId, checkout.payment.id);
  }

  const overview = await getBillingOverview(tenantId);
  return { ...overview, checkout: checkout.payment };
}

function getProviderByName(name: string): PaymentProvider {
  return PROVIDER_REGISTRY[name] ?? getPaymentProvider();
}
