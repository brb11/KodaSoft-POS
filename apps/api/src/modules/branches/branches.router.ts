import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import * as branchesService from './branches.service';

export const branchesRouter: Router = Router();
branchesRouter.use(authenticate);
branchesRouter.use(requireActiveSubscription);

branchesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const data = await branchesService.getBranches(req.user!.tenantId);
  res.json({ success: true, data });
});

branchesRouter.post('/', async (req: AuthRequest, res: Response) => {
  const { name, address, phone } = req.body;
  const data = await branchesService.createBranch(req.user!.tenantId, { name, address, phone });
  res.status(201).json({ success: true, data });
});

branchesRouter.put('/:id', async (req: AuthRequest, res: Response) => {
  const { name, address, phone, isActive } = req.body;
  const data = await branchesService.updateBranch(req.user!.tenantId, req.params.id, { name, address, phone, isActive });
  res.json({ success: true, data });
});

branchesRouter.delete('/:id', async (req: AuthRequest, res: Response) => {
  const data = await branchesService.deleteBranch(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});
