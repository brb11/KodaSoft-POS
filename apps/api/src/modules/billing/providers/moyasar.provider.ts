import { env } from '../../../config/env';
import { AppError } from '../../../middleware/error.middleware';
import {
  CheckoutInput,
  CheckoutResult,
  PaymentProvider,
  PaymentStatus,
  WebhookContext,
  WebhookResult,
} from './payment-provider.interface';

/**
 * Moyasar payment provider (Saudi market).
 *
 * Flow:
 *  - `createCheckoutSession` → creates a credit-card payment via the Moyasar
 *    API and returns the hosted payment page URL (`pay.moyasar.com/{id}`).
 *  - Moyasar posts a webhook with the payment result. We verify the
 *    `X-Moyasar-Webhook-Secret` header matches our secret key.
 *
 * API: https://moyasar.com/docs/api
 */
const BASE = 'https://api.moyasar.com/v1';

interface MoyasarPayment {
  id?: string;
  status?: string;
  amount?: number;
  fee?: number;
  currency?: string;
  source?: Record<string, unknown>;
  message?: string;
}

export class MoyasarProvider implements PaymentProvider {
  readonly name = 'moyasar' as const;

  private get secretKey(): string {
    if (!env.MOYASAR_SECRET_KEY) {
      throw new AppError(500, 'MOYASAR_SECRET_KEY is not configured', 'PAYMENT_NOT_CONFIGURED');
    }
    return env.MOYASAR_SECRET_KEY;
  }

  private auth(): Record<string, string> {
    return {
      Authorization: `Basic ${Buffer.from(this.secretKey).toString('base64')}`,
      'Content-Type': 'application/json',
    };
  }

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    const response = await fetch(`${BASE}/payments`, {
      method: 'POST',
      headers: this.auth(),
      body: JSON.stringify({
        amount: Math.round(input.amount * 100), // halalas / cents
        currency: input.currency,
        description: input.description,
        callback_url: `${env.API_URL}/api/v1/billing/webhook/moyasar`,
        metadata: {
          source: 'casheer',
          paymentId: input.metadata.paymentId,
        },
        source: {
          type: 'creditcard',
        },
      }),
    });

    const data = (await response.json()) as MoyasarPayment;
    if (!response.ok || !data.id) {
      throw new AppError(502, `Moyasar checkout failed: ${data.message ?? 'unknown error'}`, 'PAYMENT_PROVIDER_ERROR');
    }

    return {
      providerRef: data.id,
      checkoutUrl: `https://pay.moyasar.com/${data.id}`,
    };
  }

  async handleWebhook(ctx: WebhookContext): Promise<WebhookResult> {
    const secret = Array.isArray(ctx.headers['x-moyasar-webhook-secret'])
      ? ctx.headers['x-moyasar-webhook-secret'][0]
      : ctx.headers['x-moyasar-webhook-secret'];
    if (!secret || secret !== this.secretKey) {
      throw new AppError(400, 'Invalid Moyasar webhook secret', 'INVALID_WEBHOOK');
    }

    const body = JSON.parse(ctx.rawBody || '{}') as { type?: string; data?: MoyasarPayment };
    const payment = body.data ?? (body as MoyasarPayment);
    const providerRef = String(payment.id ?? '');
    if (!providerRef) throw new AppError(400, 'Missing payment id in Moyasar webhook', 'INVALID_WEBHOOK');

    return { providerRef, status: this.mapStatus(payment), transactionId: providerRef };
  }

  async getStatus(providerRef: string): Promise<PaymentStatus> {
    const response = await fetch(`${BASE}/payments/${providerRef}`, { headers: this.auth() });
    const data = (await response.json()) as MoyasarPayment;
    if (!response.ok) throw new AppError(502, 'Failed to query Moyasar payment', 'PAYMENT_PROVIDER_ERROR');
    return this.mapStatus(data);
  }

  private mapStatus(payment: MoyasarPayment): PaymentStatus {
    switch (payment.status) {
      case 'paid':
      case 'authorized':
      case 'captured':
        return 'PAID';
      case 'failed':
      case 'canceled':
        return 'FAILED';
      default:
        return 'FAILED';
    }
  }
}
