import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import { assertFeatureAccess } from '../billing/plans';
import * as reportsService from './reports.service';
import * as debtsService from '../debts/debts.service';
import {
  summaryQuerySchema,
  dailyQuerySchema,
  topProductsQuerySchema,
  hourlyQuerySchema,
  recentOrdersQuerySchema,
  salesQuerySchema,
  debtsQuerySchema,
  expensesQuerySchema,
} from './reports.schema';

export const reportsRouter: Router = Router();
reportsRouter.use(authenticate);
reportsRouter.use(requireActiveSubscription);

reportsRouter.get('/summary', async (req: AuthRequest, res: Response) => {
  const { branchId, from, to } = summaryQuerySchema.parse(req.query);
  const data = await reportsService.getSalesSummary(req.user!.tenantId, branchId, from, to);
  res.json({ success: true, data });
});

reportsRouter.get('/daily', async (req: AuthRequest, res: Response) => {
  const { branchId, days } = dailyQuerySchema.parse(req.query);
  const data = await reportsService.getDailySales(req.user!.tenantId, branchId, days);
  res.json({ success: true, data });
});

reportsRouter.get('/top-products', async (req: AuthRequest, res: Response) => {
  const { branchId, limit } = topProductsQuerySchema.parse(req.query);
  const data = await reportsService.getTopProducts(req.user!.tenantId, branchId, limit);
  res.json({ success: true, data });
});

reportsRouter.get('/hourly', async (req: AuthRequest, res: Response) => {
  const { branchId } = hourlyQuerySchema.parse(req.query);
  const data = await reportsService.getHourlySales(req.user!.tenantId, branchId);
  res.json({ success: true, data });
});

reportsRouter.get('/recent-orders', async (req: AuthRequest, res: Response) => {
  const { limit } = recentOrdersQuerySchema.parse(req.query);
  const data = await reportsService.getRecentOrders(req.user!.tenantId, limit);
  res.json({ success: true, data });
});

reportsRouter.get('/sales', async (req: AuthRequest, res: Response) => {
  const { period, from, to, branchId, groupBy } = salesQuerySchema.parse(req.query);
  const data = await reportsService.getSalesReport(req.user!.tenantId, { period, from, to, branchId, groupBy });
  res.json({ success: true, data });
});

reportsRouter.get('/vat', async (req: AuthRequest, res: Response) => {
  const { from, to, branchId } = summaryQuerySchema.parse(req.query);
  const data = await reportsService.getVatReport(req.user!.tenantId, { from, to, branchId });
  res.json({ success: true, data });
});

reportsRouter.get('/invoices', async (req: AuthRequest, res: Response) => {
  const { from, to, branchId } = summaryQuerySchema.parse(req.query);
  const data = await reportsService.getInvoiceReport(req.user!.tenantId, { from, to, branchId });
  res.json({ success: true, data });
});

reportsRouter.get('/payments', async (req: AuthRequest, res: Response) => {
  const { from, to, branchId } = summaryQuerySchema.parse(req.query);
  const data = await reportsService.getPaymentMethodsReport(req.user!.tenantId, { from, to, branchId });
  res.json({ success: true, data });
});

reportsRouter.get('/inventory', async (req: AuthRequest, res: Response) => {
  const { branchId, from, to } = summaryQuerySchema.parse(req.query);
  const data = await reportsService.getInventoryReport(req.user!.tenantId, { branchId, from, to });
  res.json({ success: true, data });
});

reportsRouter.get('/shifts', async (req: AuthRequest, res: Response) => {
  const { from, to, branchId } = summaryQuerySchema.parse(req.query);
  const data = await reportsService.getShiftReport(req.user!.tenantId, { from, to, branchId });
  res.json({ success: true, data });
});

reportsRouter.get('/debts', async (req: AuthRequest, res: Response) => {
  // Customer accounts (debts) is a Professional/Enterprise feature — the
  // dedicated debts router guards it, so this aggregation route must too,
  // otherwise starter tenants could read debt overviews via /reports.
  await assertFeatureAccess(req.user!.tenantId, 'customerDebts');
  const { from, to, branchId } = debtsQuerySchema.parse(req.query);
  const data = await debtsService.getDebtsReport(req.user!.tenantId, { from, to, branchId });
  res.json({ success: true, data });
});

reportsRouter.get('/expenses', async (req: AuthRequest, res: Response) => {
  const { from, to, branchId } = expensesQuerySchema.parse(req.query);
  const data = await reportsService.getExpensesReport(req.user!.tenantId, { from, to, branchId });
  res.json({ success: true, data });
});
