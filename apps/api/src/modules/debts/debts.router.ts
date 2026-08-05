import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest, requireRole } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import { assertFeatureAccess } from '../billing/plans';
import { createSettlementSchema, settlementQuerySchema, statementQuerySchema } from './debts.schema';
import * as debtsService from './debts.service';

export const debtsRouter: Router = Router();
debtsRouter.use(authenticate);
debtsRouter.use(requireActiveSubscription);

// Customer Accounts is a Professional/Enterprise feature (trials get full access).
async function requireDebtsFeature(req: AuthRequest, _res: Response, next: NextFunction): Promise<void> {
  try {
    await assertFeatureAccess(req.user!.tenantId, 'customerDebts');
    next();
  } catch (err) {
    next(err);
  }
}

debtsRouter.use(requireDebtsFeature);

debtsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const data = await debtsService.getDebtsOverview(req.user!.tenantId);
  res.json({ success: true, data });
});

debtsRouter.get('/payments', async (req: AuthRequest, res: Response) => {
  const query = settlementQuerySchema.parse(req.query);
  const data = await debtsService.getSettlements(req.user!.tenantId, query);
  res.json({ success: true, data });
});

debtsRouter.post('/payments', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const dto = createSettlementSchema.parse(req.body);
  const data = await debtsService.recordSettlement(req.user!.tenantId, req.user!.sub, dto);
  res.status(201).json({ success: true, data });
});

debtsRouter.get('/statement', async (req: AuthRequest, res: Response) => {
  const query = statementQuerySchema.parse(req.query);
  const data = await debtsService.getCustomerStatement(req.user!.tenantId, query.customerId);
  res.json({ success: true, data });
});

debtsRouter.get('/report', async (req: AuthRequest, res: Response) => {
  const { from, to, branchId } = req.query as any;
  const data = await debtsService.getDebtsReport(req.user!.tenantId, { from, to, branchId });
  res.json({ success: true, data });
});
