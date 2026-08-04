import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import { createOrderSchema, orderQuerySchema, refundOrderSchema } from './orders.schema';
import * as ordersService from './orders.service';
import { z } from 'zod';

const voidOrderSchema = z.object({
  reason: z.string().optional(),
});

export const ordersRouter: Router = Router();
ordersRouter.use(authenticate);
ordersRouter.use(requireActiveSubscription);

ordersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const query = orderQuerySchema.parse(req.query);
  const data = await ordersService.getOrders(req.user!.tenantId, query);
  res.json({ success: true, data });
});

ordersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const data = await ordersService.getOrderById(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});

ordersRouter.post('/', async (req: AuthRequest, res: Response) => {
  const dto = createOrderSchema.parse(req.body);
  const data = await ordersService.createOrder(req.user!.tenantId, req.user!.sub, dto);
  res.status(201).json({ success: true, data });
});

ordersRouter.post('/:id/void', async (req: AuthRequest, res: Response) => {
  const dto = voidOrderSchema.parse(req.body ?? {});
  const data = await ordersService.voidOrder(req.user!.tenantId, req.params.id, req.user!.sub, dto.reason);
  res.json({ success: true, data });
});

ordersRouter.post('/:id/refund', async (req: AuthRequest, res: Response) => {
  const dto = refundOrderSchema.parse(req.body ?? {});
  const data = await ordersService.refundOrder(req.user!.tenantId, req.params.id, req.user!.sub, dto);
  res.json({ success: true, data });
});
