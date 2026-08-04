import { Router, Response } from 'express';
import { authenticate, AuthRequest, requireRole } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import * as inventoryService from './inventory.service';
import { adjustmentQuerySchema, createAdjustmentSchema } from './inventory.schema';

export const inventoryRouter: Router = Router();
inventoryRouter.use(authenticate);
inventoryRouter.use(requireActiveSubscription);

inventoryRouter.post('/adjustments', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const dto = createAdjustmentSchema.parse(req.body);
  const data = await inventoryService.createAdjustments(req.user!.tenantId, req.user!.sub, dto);
  res.status(201).json({ success: true, data });
});

inventoryRouter.get('/adjustments', async (req: AuthRequest, res: Response) => {
  const query = adjustmentQuerySchema.parse(req.query);
  const data = await inventoryService.listAdjustments(req.user!.tenantId, query);
  res.json({ success: true, data });
});
