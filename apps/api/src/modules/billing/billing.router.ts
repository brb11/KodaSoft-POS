import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../../middleware/auth.middleware';
import type { BillingCycle } from './plans';
import * as billingService from './billing.service';

export const billingRouter: Router = Router();
billingRouter.use(authenticate);

const billingCycleSchema = z.enum(['monthly', 'yearly']).optional();

// Note: Any authenticated user may read the plan overview (the client-side
// paywall and SubscriptionGuard need the status/plan/limits). All subscription
// MANAGEMENT below is restricted to SUPER_ADMIN (Requirement #6). Store users
// (OWNER/CASHIER/MANAGER) cannot change plans, renew, check out, pay online, or
// view the payment ledger — the SaaS console is the only way to do that.

// GET /api/v1/billing/plan — current plan, usage, and catalog for the tenant
billingRouter.get('/plan', async (req: AuthRequest, res) => {
  const data = await billingService.getBillingOverview(req.user!.tenantId);
  res.json({ success: true, data });
});

const changePlanSchema = z.object({ plan: z.string(), billingCycle: billingCycleSchema });

// PUT /api/v1/billing/plan — immediate plan change (SUPER_ADMIN only; no
// payment). For the payment-driven flow use POST /billing/checkout.
billingRouter.put('/plan', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res) => {
  const { plan, billingCycle } = changePlanSchema.parse(req.body);
  const data = await billingService.changePlan(req.user!.tenantId, plan, billingCycle as BillingCycle | undefined);
  res.json({ success: true, data });
});

// POST /api/v1/billing/renew — reactivate the same plan after trial/expiry
// (SUPER_ADMIN only). Sandbox mode auto-completes; live mode returns a checkout
// session. Store users are directed to contact their administrator.
billingRouter.post('/renew', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res) => {
  const body = z.object({ billingCycle: billingCycleSchema }).safeParse(req.body);
  const billingCycle = body.success ? body.data.billingCycle : undefined;
  const data = await billingService.renewSubscription(req.user!.tenantId, billingCycle as BillingCycle | undefined);
  res.json({ success: true, data });
});

const checkoutSchema = z.object({
  plan: z.string().optional(),
  billingCycle: billingCycleSchema,
});

// POST /api/v1/billing/checkout — start a checkout (SUPER_ADMIN only).
// Body: { plan?: 'starter'|'pro'|'enterprise', billingCycle?: 'monthly'|'yearly' } —
// omit plan to renew the current plan; omit billingCycle to keep the current one.
// Returns a hosted checkout session (live) or a sandbox payment to approve/decline.
billingRouter.post('/checkout', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res) => {
  const { plan, billingCycle } = checkoutSchema.parse(req.body);
  const data = await billingService.createCheckout(req.user!.tenantId, {
    plan,
    billingCycle: billingCycle as BillingCycle | undefined,
  });
  res.json({ success: true, data });
});

// POST /api/v1/billing/checkout/:id/sandbox/approve — simulate a successful payment
// (sandbox mode only). Runs the same activation path a webhook would.
billingRouter.post('/checkout/:id/sandbox/approve', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res) => {
  const data = await billingService.sandboxApprove(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});

// POST /api/v1/billing/checkout/:id/sandbox/decline — simulate a declined payment.
billingRouter.post('/checkout/:id/sandbox/decline', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res) => {
  const data = await billingService.sandboxDecline(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});

const paymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/v1/billing/payments — payment/checkout history (SUPER_ADMIN only)
billingRouter.get('/payments', requireRole('SUPER_ADMIN'), async (req: AuthRequest, res) => {
  const { page, limit } = paymentsQuerySchema.parse(req.query);
  const data = await billingService.listPayments(req.user!.tenantId, page, limit);
  res.json({ success: true, data });
});
