import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth.middleware';
import * as saasService from './saas.service';

export const saasRouter: Router = Router();

saasRouter.use(authenticate, requireRole('SUPER_ADMIN'));

// GET /api/v1/saas/overview
saasRouter.get('/overview', async (_req, res) => {
  const data = await saasService.getOverview();
  res.json({ success: true, data });
});

// ── Tenants ────────────────────────────────

const listTenantsSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['all', 'active', 'suspended']).default('all'),
  plan: z.string().optional(),
  subStatus: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED']).optional(),
  expiringSoon: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/v1/saas/tenants
saasRouter.get('/tenants', async (req, res) => {
  const filters = listTenantsSchema.parse(req.query);
  const data = await saasService.listTenants(filters);
  res.json({ success: true, data });
});

const createTenantSchema = z.object({
  name: z.string().min(2).max(120),
  ownerName: z.string().min(2).max(120),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  plan: z.enum(['starter', 'pro', 'enterprise']),
  branchName: z.string().min(1).max(120).optional(),
  branchAddress: z.string().max(300).optional(),
  phone: z.string().max(30).optional(),
});

// POST /api/v1/saas/tenants
saasRouter.post('/tenants', async (req, res) => {
  const dto = createTenantSchema.parse(req.body);
  const data = await saasService.createTenant(dto);
  res.status(201).json({ success: true, data });
});

// GET /api/v1/saas/tenants/:id
saasRouter.get('/tenants/:id', async (req, res) => {
  const data = await saasService.getTenantDetail(req.params.id);
  res.json({ success: true, data });
});

const updateTenantSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
  plan: z.enum(['starter', 'pro', 'enterprise']).optional(),
  subscriptionStatus: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED']).optional(),
  autoRenew: z.boolean().optional(),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().nullable().optional(),
  trialStarted: z.string().datetime().optional(),
  provider: z.string().max(60).optional(),
  extendTrialDays: z.number().int().min(0).max(3650).optional(),
});

// PUT /api/v1/saas/tenants/:id
saasRouter.put('/tenants/:id', async (req, res) => {
  const dto = updateTenantSchema.parse(req.body);
  const parsed = {
    ...dto,
    periodStart: dto.periodStart === undefined ? undefined : new Date(dto.periodStart),
    periodEnd: dto.periodEnd === undefined ? undefined : dto.periodEnd === null ? null : new Date(dto.periodEnd),
    trialStarted: dto.trialStarted === undefined ? undefined : new Date(dto.trialStarted),
  };
  const data = await saasService.updateTenant(req.params.id, parsed);
  res.json({ success: true, data });
});

// DELETE /api/v1/saas/tenants/:id
saasRouter.delete('/tenants/:id', async (req, res) => {
  const data = await saasService.deleteTenant(req.params.id);
  res.json({ success: true, data });
});

// ── Users ──────────────────────────────────

const listUsersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  tenantId: z.string().uuid().optional(),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER']).optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/v1/saas/users
saasRouter.get('/users', async (req, res) => {
  const filters = listUsersSchema.parse(req.query);
  const data = await saasService.listUsers(filters);
  res.json({ success: true, data });
});

const createUserSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER']),
  branchId: z.string().uuid().nullable().optional(),
});

// POST /api/v1/saas/users
saasRouter.post('/users', async (req, res) => {
  const dto = createUserSchema.parse(req.body);
  const data = await saasService.createSaaSUser(dto);
  res.status(201).json({ success: true, data });
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  pin: z.string().regex(/^\d{4}$/).optional(),
  role: z.enum(['OWNER', 'MANAGER', 'CASHIER']).optional(),
  isActive: z.boolean().optional(),
  branchId: z.string().uuid().nullable().optional(),
});

// PUT /api/v1/saas/users/:id
saasRouter.put('/users/:id', async (req, res) => {
  const dto = updateUserSchema.parse(req.body);
  const data = await saasService.updateSaaSUser(req.params.id, dto);
  res.json({ success: true, data });
});

// DELETE /api/v1/saas/users/:id
saasRouter.delete('/users/:id', async (req, res) => {
  const data = await saasService.deleteSaaSUser(req.params.id);
  res.json({ success: true, data });
});

// ── Subscription payments ──────────────────

const listPaymentsSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'CANCELED']).optional(),
  plan: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/v1/saas/payments
saasRouter.get('/payments', async (req, res) => {
  const filters = listPaymentsSchema.parse(req.query);
  const data = await saasService.listPayments(filters);
  res.json({ success: true, data });
});

const createPaymentSchema = z.object({
  tenantId: z.string().uuid(),
  plan: z.enum(['starter', 'pro', 'enterprise']).optional(),
  amount: z.coerce.number().positive(),
  currency: z.string().max(10).optional(),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
  note: z.string().max(300).optional(),
});

// POST /api/v1/saas/payments
saasRouter.post('/payments', async (req, res) => {
  const dto = createPaymentSchema.parse(req.body);
  const data = await saasService.createManualPayment(dto);
  res.status(201).json({ success: true, data });
});

const updatePaymentStatusSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'CANCELED']),
});

// PUT /api/v1/saas/payments/:id/status
saasRouter.put('/payments/:id/status', async (req, res) => {
  const dto = updatePaymentStatusSchema.parse(req.body);
  const data = await saasService.updatePaymentStatus(req.params.id, dto.status);
  res.json({ success: true, data });
});
