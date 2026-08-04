import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../../middleware/auth.middleware';
import * as saasService from './saas.service';

export const saasRouter: Router = Router();

saasRouter.use(authenticate, requireRole('SUPER_ADMIN'));

// GET /api/v1/saas/overview
saasRouter.get('/overview', async (_req, res) => {
  const data = await saasService.getOverview();
  res.json({ success: true, data });
});

// GET /api/v1/saas/tenants
saasRouter.get('/tenants', async (_req, res) => {
  const data = await saasService.listTenants();
  res.json({ success: true, data });
});

// GET /api/v1/saas/tenants/:id
saasRouter.get('/tenants/:id', async (req: AuthRequest, res) => {
  const data = await saasService.getTenantDetail(req.params.id);
  res.json({ success: true, data });
});

const updateTenantSchema = z.object({
  plan: z.string().optional(),
  isActive: z.boolean().optional(),
  subscriptionStatus: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED']).optional(),
  autoRenew: z.boolean().optional(),
});

// PUT /api/v1/saas/tenants/:id
saasRouter.put('/tenants/:id', async (req: AuthRequest, res) => {
  const dto = updateTenantSchema.parse(req.body);
  const data = await saasService.updateTenant(req.params.id, dto);
  res.json({ success: true, data });
});
