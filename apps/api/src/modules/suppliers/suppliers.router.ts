import { Router, Response } from 'express';
import { authenticate, AuthRequest, requireRole } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import { createSupplierSchema, updateSupplierSchema, supplierQuerySchema } from './suppliers.schema';
import * as suppliersService from './suppliers.service';

export const suppliersRouter: Router = Router();
suppliersRouter.use(authenticate);
suppliersRouter.use(requireActiveSubscription);

suppliersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const query = supplierQuerySchema.parse(req.query);
  const data = await suppliersService.getSuppliers(req.user!.tenantId, query);
  res.json({ success: true, data });
});

suppliersRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const data = await suppliersService.getSupplierById(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});

suppliersRouter.post('/', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const dto = createSupplierSchema.parse(req.body);
  const data = await suppliersService.createSupplier(req.user!.tenantId, dto);
  res.status(201).json({ success: true, data });
});

suppliersRouter.put('/:id', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const dto = updateSupplierSchema.parse(req.body);
  const data = await suppliersService.updateSupplier(req.user!.tenantId, req.params.id, dto);
  res.json({ success: true, data });
});

suppliersRouter.delete('/:id', requireRole('OWNER'), async (req: AuthRequest, res: Response) => {
  const data = await suppliersService.deleteSupplier(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});
