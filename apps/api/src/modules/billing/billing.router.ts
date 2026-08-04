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

// PUT /api/v1/billing/plan — self-service upgrade/downgrade (OWNER only)
billingRouter.put('/plan', requireRole('OWNER'), async (req: AuthRequest, res) => {
  const { plan } = changePlanSchema.parse(req.body);
  const data = await billingService.changePlan(req.user!.tenantId, plan);
  res.json({ success: true, data });
});

// POST /api/v1/billing/renew — pay & reactivate the same plan after trial/expiry (OWNER only)
billingRouter.post('/renew', requireRole('OWNER'), async (req: AuthRequest, res) => {
  const data = await billingService.renewSubscription(req.user!.tenantId);
  res.json({ success: true, data });
});
