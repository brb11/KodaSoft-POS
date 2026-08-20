import { Router, Response } from 'express';
import { authenticate, AuthRequest, requireRole } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import {
  createPurchaseSchema,
  updatePurchaseSchema,
  purchaseQuerySchema,
  confirmPurchaseSchema,
  createSupplierPaymentSchema,
  supplierPaymentQuerySchema,
} from './purchases.schema';
import * as purchasesService from './purchases.service';

export const purchasesRouter: Router = Router();
purchasesRouter.use(authenticate);
purchasesRouter.use(requireActiveSubscription);

// ─── Purchase Invoices ────────────────────────────────────────────────────────

purchasesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const query = purchaseQuerySchema.parse(req.query);
  const data = await purchasesService.listPurchases(req.user!.tenantId, query);
  res.json({ success: true, data });
});

purchasesRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const data = await purchasesService.getPurchaseById(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});

purchasesRouter.post('/', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const dto = createPurchaseSchema.parse(req.body);
  const data = await purchasesService.createPurchase(req.user!.tenantId, req.user!.sub, dto);
  res.status(201).json({ success: true, data });
});

purchasesRouter.put('/:id', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const dto = updatePurchaseSchema.parse(req.body);
  const data = await purchasesService.updatePurchase(req.user!.tenantId, req.params.id, dto);
  res.json({ success: true, data });
});

purchasesRouter.post('/:id/cancel', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const data = await purchasesService.cancelPurchase(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});

purchasesRouter.post('/:id/confirm', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const dto = confirmPurchaseSchema.parse(req.body);
  const data = await purchasesService.confirmPurchase(req.user!.tenantId, req.user!.sub, req.params.id, dto.branchId);
  res.json({ success: true, data });
});

// ─── Supplier Payments ────────────────────────────────────────────────────────

purchasesRouter.get('/payments/list', async (req: AuthRequest, res: Response) => {
  const query = supplierPaymentQuerySchema.parse(req.query);
  const data = await purchasesService.listSupplierPayments(req.user!.tenantId, query);
  res.json({ success: true, data });
});

purchasesRouter.post('/payments', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const dto = createSupplierPaymentSchema.parse(req.body);
  const data = await purchasesService.createSupplierPayment(req.user!.tenantId, req.user!.sub, dto);
  res.status(201).json({ success: true, data });
});
