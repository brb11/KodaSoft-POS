import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import { createHeldOrderSchema, heldOrdersQuerySchema, heldOrderParamsSchema } from './held-orders.schema';
import * as heldOrdersService from './held-orders.service';

export const heldOrdersRouter: Router = Router();
heldOrdersRouter.use(authenticate);
heldOrdersRouter.use(requireActiveSubscription);

heldOrdersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const query = heldOrdersQuerySchema.parse(req.query);
  const branchId = query.branchId || req.user!.branchId;
  if (!branchId) {
    res.status(400).json({ success: false, message: 'Branch is required' });
    return;
  }
  const data = await heldOrdersService.listHeldOrders(req.user!.tenantId, branchId);
  res.json({ success: true, data });
});

heldOrdersRouter.post('/', async (req: AuthRequest, res: Response) => {
  const dto = createHeldOrderSchema.parse(req.body);
  const data = await heldOrdersService.createHeldOrder(req.user!.tenantId, req.user!.sub, dto);
  res.status(201).json({ success: true, data });
});

heldOrdersRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const { id } = heldOrderParamsSchema.parse(req.params);
  const data = await heldOrdersService.deleteHeldOrder(req.user!.tenantId, id);
  res.json({ success: true, data });
});
