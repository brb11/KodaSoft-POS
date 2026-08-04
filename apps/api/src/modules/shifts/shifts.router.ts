import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import * as shiftsService from './shifts.service';

export const shiftsRouter: Router = Router();
shiftsRouter.use(authenticate);
shiftsRouter.use(requireActiveSubscription);

shiftsRouter.get('/active', async (req: AuthRequest, res: Response) => {
  const branchId = (req.query as any).branchId || req.user!.branchId;
  const shift = await shiftsService.getActiveShift(req.user!.tenantId, branchId, req.user!.sub);
  res.json({ success: true, data: shift });
});

shiftsRouter.post('/open', async (req: AuthRequest, res: Response) => {
  const branchId = req.body.branchId || req.user!.branchId;
  const shift = await shiftsService.openShift(req.user!.tenantId, branchId, req.user!.sub, req.body.openingCash);
  res.status(201).json({ success: true, data: shift });
});

shiftsRouter.post('/:id/close', async (req: AuthRequest, res: Response) => {
  const shift = await shiftsService.closeShift(req.user!.tenantId, req.params.id, req.body.closingCash, req.body.notes);
  res.json({ success: true, data: shift });
});
