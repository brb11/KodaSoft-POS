import { Router, Response } from 'express';
import { authenticate, AuthRequest, requireRole } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import { createExpenseSchema, expenseQuerySchema } from './expenses.schema';
import * as expensesService from './expenses.service';

export const expensesRouter: Router = Router();
expensesRouter.use(authenticate);
expensesRouter.use(requireActiveSubscription);

// Cashiers may record expenses during a shift; WITHDRAWAL is gated in the service.
expensesRouter.post('/', async (req: AuthRequest, res: Response) => {
  const dto = createExpenseSchema.parse(req.body);
  const data = await expensesService.createExpense(req.user!.tenantId, req.user!.sub, req.user!.role, dto);
  res.status(201).json({ success: true, data });
});

expensesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const query = expenseQuerySchema.parse(req.query);
  const data = await expensesService.listExpenses(req.user!.tenantId, query);
  res.json({ success: true, data });
});

expensesRouter.delete('/:id', requireRole('OWNER', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const data = await expensesService.deleteExpense(req.user!.tenantId, req.params.id);
  res.json({ success: true, data });
});
