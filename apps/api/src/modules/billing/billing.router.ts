import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../../middleware/auth.middleware';
import * as billingService from './billing.service';

export const billingRouter: Router = Router();
billingRouter.use(authenticate);

// GET /api/v1/billing/plan — current plan, usage, and catalog for the tenant
billingRouter.get('/plan', async (req: AuthRequest, res) => {
  const data = await billingService.getBillingOverview(req.user!.tenantId);
  res.json({ success: true, data });
});

const changePlanSchema = z.object({ plan: z.string() });

// PUT /api/v1/billing/plan — immediate plan change (OWNER only; no payment).
// For the payment-driven flow use POST /billing/checkout.
billingRouter.put('/plan', requireRole('OWNER'), async (req: AuthRequest, res) => {
  const { plan } = changePlanSchema.parse(req.body);
  const data = await billingService.changePlan(req.user!.tenantId, plan);
  res.json({ success: true, data });
});

// POST /api/v1/billing/renew — pay & reactivate the same plan after trial/expiry
// (OWNER only). Sandbox mode auto-completes; live mode returns a checkout session.
billingRouter.post('/renew', requireRole('OWNER'), async (req: AuthRequest, res) => {
  const data = await billingService.renewSubscription(req.user!.tenantId);
  res.json({ success: true, data });
});

const checkoutSchema = z.object({ plan: z.string().optional() });

// POST /api/v1/billing/checkout — start a checkout (OWNER only).
// Body: { plan?: 'starter'|'pro'|'enterprise' } — omit plan to renew the current plan.
// Returns a hosted checkout session (live) or a sandbox payment to approve/decline.
billingRouter.post('/checkout', requireRole('OWNER'), async (req: AuthRequest, res) => {
  const { plan } = checkoutSchema.parse(req.body);
  const data = await billingService.createCheckout(req.user!.tenantId, { plan });
  res.json({ success: true, data });
});

// POST /api/v1/billing/checkout/:id/sandbox/approve — simulate a successful payment
// (sandbox mode only). Runs the same activation path a webhook would.
billingRouter.post('/checkout/:id/sandbox/approve', requireRole('OWNER'), async (req: AuthRequest, res) => {
  const data = await billingService.sandboxApprove(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});

// POST /api/v1/billing/checkout/:id/sandbox/decline — simulate a declined payment.
billingRouter.post('/checkout/:id/sandbox/decline', requireRole('OWNER'), async (req: AuthRequest, res) => {
  const data = await billingService.sandboxDecline(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});

const paymentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/v1/billing/payments — payment/checkout history (OWNER only)
billingRouter.get('/payments', requireRole('OWNER'), async (req: AuthRequest, res) => {
  const { page, limit } = paymentsQuerySchema.parse(req.query);
  const data = await billingService.listPayments(req.user!.tenantId, page, limit);
  res.json({ success: true, data });
});
