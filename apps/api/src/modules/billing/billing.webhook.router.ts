import { Router } from 'express';
import express from 'express';
import * as billingService from './billing.service';
import { WebhookContext } from './providers';

/**
 * Public webhook endpoint for payment providers.
 *
 * IMPORTANT: mounted in `main.ts` BEFORE `express.json()` so the raw request
 * body is preserved for gateway signature verification.
 *
 * POST /api/v1/billing/webhook/:provider
 *   - :provider = stripe | paytabs | moyasar | sandbox
 */
export const billingWebhookRouter: Router = Router();
billingWebhookRouter.use(express.raw({ type: '*/*' }));

billingWebhookRouter.post('/:provider', async (req, res) => {
  const ctx: WebhookContext = {
    rawBody: (req.body as Buffer | undefined)?.toString('utf8') ?? '',
    headers: req.headers as Record<string, string | string[] | undefined>,
  };

  const result = await billingService.processWebhook(req.params.provider, ctx);
  res.status(200).json({ success: true, ...result });
});
