import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth.middleware';
import { requireActiveSubscription } from '../billing/subscription.guard';
import {
  generateCredentialsSchema,
  complianceCsidSchema,
  complianceChecksSchema,
  productionCsidSchema,
  setEnabledSchema,
  submissionParamsSchema,
  submissionsQuerySchema,
} from './zatca.schema';
import * as zatcaService from './zatca.service';

export const zatcaRouter: Router = Router();
zatcaRouter.use(authenticate);
zatcaRouter.use(requireActiveSubscription);

// ZATCA compliance status for the tenant.
zatcaRouter.get('/', async (req: AuthRequest, res: Response) => {
  const data = await zatcaService.getStatus(req.user!.tenantId);
  res.json({ success: true, data });
});

// Generate key pair + CSR (+ self-signed sandbox test certificate).
zatcaRouter.post('/credentials', async (req: AuthRequest, res: Response) => {
  const dto = generateCredentialsSchema.parse(req.body ?? {});
  const data = await zatcaService.generateCredentials(req.user!.tenantId, dto);
  res.json({ success: true, data });
});

// Request the compliance CSID from FATURA (requires the onboarding OTP).
zatcaRouter.post('/compliance', async (req: AuthRequest, res: Response) => {
  const dto = complianceCsidSchema.parse(req.body ?? {});
  const data = await zatcaService.issueComplianceCsid(req.user!.tenantId, dto);
  res.json({ success: true, data });
});

// Run the mandatory FATURA compliance-invoice checks (6 sample documents).
zatcaRouter.post('/compliance/checks', async (req: AuthRequest, res: Response) => {
  const dto = complianceChecksSchema.parse(req.body ?? {});
  const data = await zatcaService.runComplianceChecks(req.user!.tenantId, dto);
  res.json({ success: true, data });
});

// Upgrade the compliance CSID to a production CSID.
zatcaRouter.post('/production', async (req: AuthRequest, res: Response) => {
  const dto = productionCsidSchema.parse(req.body ?? {});
  const data = await zatcaService.issueProductionCsid(req.user!.tenantId, dto);
  res.json({ success: true, data });
});

// Enable/disable ZATCA for the tenant.
zatcaRouter.post('/enable', async (req: AuthRequest, res: Response) => {
  const dto = setEnabledSchema.parse(req.body ?? {});
  const data = await zatcaService.setEnabled(req.user!.tenantId, dto);
  res.json({ success: true, data });
});

// Revoke credentials for an environment.
zatcaRouter.delete('/credentials/:mode', async (req: AuthRequest, res: Response) => {
  const mode = String(req.params.mode);
  if (mode !== 'sandbox' && mode !== 'production') {
    res.status(400).json({ success: false, message: 'Invalid mode' });
    return;
  }
  const data = await zatcaService.revokeCredentials(req.user!.tenantId, mode);
  res.json({ success: true, data });
});

// Invoice submissions (audit).
zatcaRouter.get('/submissions', async (req: AuthRequest, res: Response) => {
  const query = submissionsQuerySchema.parse(req.query);
  const data = await zatcaService.listSubmissions(req.user!.tenantId, query);
  res.json({ success: true, data });
});

zatcaRouter.get('/submissions/:id', async (req: AuthRequest, res: Response) => {
  const { id } = submissionParamsSchema.parse(req.params);
  const data = await zatcaService.getSubmission(req.user!.tenantId, id);
  res.json({ success: true, data });
});

zatcaRouter.post('/submissions/:id/retry', async (req: AuthRequest, res: Response) => {
  const { id } = submissionParamsSchema.parse(req.params);
  const data = await zatcaService.retrySubmission(req.user!.tenantId, id);
  res.json({ success: true, data });
});
