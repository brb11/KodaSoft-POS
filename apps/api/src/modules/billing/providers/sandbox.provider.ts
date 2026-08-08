import { randomUUID } from 'crypto';
import {
  CheckoutInput,
  CheckoutResult,
  PaymentProvider,
  PaymentStatus,
  WebhookContext,
  WebhookResult,
} from './payment-provider.interface';

/**
 * Sandbox payment provider. Active whenever `PAYMENT_MODE=sandbox` (the
 * default). Never contacts a real gateway: checkout is instant and the
 * tenant approves/declines the simulated payment through the billing API
 * (`POST /billing/checkout/:id/sandbox/approve|decline`).
 */
export class SandboxProvider implements PaymentProvider {
  readonly name = 'sandbox' as const;

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    const providerRef = `sandbox_${randomUUID()}`;
    return {
      providerRef,
      checkoutUrl: null,
      payload: {
        sandbox: true,
        amount: input.amount,
        currency: input.currency,
        plan: input.plan,
        planName: input.planName,
      },
    };
  }

  /** Simulated gateway notification — used by the internal simulate path so the
   *  same "webhook → billing service → ACTIVE" activation runs. */
  async handleWebhook(ctx: WebhookContext): Promise<WebhookResult> {
    const body = JSON.parse(ctx.rawBody || '{}');
    const status: PaymentStatus = body.status === 'FAILED' || body.status === 'CANCELED' ? body.status : 'PAID';
    return { providerRef: String(body.providerRef ?? ''), status, transactionId: body.transactionId };
  }
}
