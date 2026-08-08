import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';
import { PLANS, getPlan, PLAN_FEATURE_LABELS } from './plans';
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

const PERIOD_DAYS = 30;
const CHECKOUT_TTL_MS = 60 * 60 * 1000; // 1 hour to complete payment

function nextPeriodEnd(): Date {
  return new Date(Date.now() + PERIOD_DAYS * 24 * 60 * 60 * 1000);
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

export async function changePlan(tenantId: string, planKey: string) {
  const target = getPlan(planKey);
  await assertDowngradeSafe(tenantId, planKey);

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

// ─────────────────────────────────────────────
// CHECKOUT → PAYMENT PROVIDER → WEBHOOK → ACTIVE
// ─────────────────────────────────────────────

export interface CheckoutOptions {
  /** Target plan key. Omitted = pay/renew the current plan. */
  plan?: string;
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

  // If the customer explicitly picks a different plan, make sure a downgrade
  // won't strand them above the new limits — before any money is charged.
  if (opts.plan && opts.plan !== currentPlan) {
    await assertDowngradeSafe(tenantId, targetPlanKey);
  }

  const provider = getPaymentProvider();
  const customerEmail = await resolveOwnerEmail(tenantId);

  const payment = await prisma.subscriptionPayment.create({
    data: {
      tenantId,
      subscriptionId: tenant.subscription?.id,
      plan: target.key,
      amount: target.priceMonthly,
      currency: target.currency,
      mode: isSandbox() ? 'sandbox' : 'live',
      provider: provider.name,
      status: 'PENDING',
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
  await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.findUnique({ where: { tenantId: payment.tenantId } });

    await tx.tenant.update({ where: { id: payment.tenantId }, data: { plan: payment.plan } });
    await tx.subscription.upsert({
      where: { tenantId: payment.tenantId },
      update: {
        plan: payment.plan,
        status: 'ACTIVE',
        periodStart: now,
        periodEnd: nextPeriodEnd(),
        autoRenew: true,
        provider: payment.provider,
        providerRef: payment.providerRef,
      },
      create: {
        tenantId: payment.tenantId,
        plan: payment.plan,
        status: 'ACTIVE',
        trialStarted: now,
        periodStart: now,
        periodEnd: nextPeriodEnd(),
        autoRenew: true,
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
export async function renewSubscription(tenantId: string) {
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

  const checkout = await createCheckout(tenantId, {});
  if (isSandbox()) {
    return sandboxApprove(tenantId, checkout.payment.id);
  }

  const overview = await getBillingOverview(tenantId);
  return { ...overview, checkout: checkout.payment };
}

function getProviderByName(name: string): PaymentProvider {
  return PROVIDER_REGISTRY[name] ?? getPaymentProvider();
}
