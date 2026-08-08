import { createHmac, timingSafeEqual } from 'crypto';
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
 * Stripe payment provider.
 *
 * Flow:
 *  - `createCheckoutSession` → Stripe Checkout Session (hosted page).
 *  - Stripe posts `checkout.session.completed` to our webhook URL. We verify
 *    the `Stripe-Signature` header (HMAC-SHA256) before trusting the result.
 *
 * API: https://docs.stripe.com/api
 */
const BASE = 'https://api.stripe.com/v1';

interface StripeSession {
  id?: string;
  url?: string;
  payment_status?: string;
  amount_total?: number;
  metadata?: Record<string, string>;
  customer_email?: string;
}

interface StripeEvent {
  type?: string;
  data?: { object?: StripeSession };
}

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe' as const;

  private get secretKey(): string {
    if (!env.STRIPE_SECRET_KEY) {
      throw new AppError(500, 'STRIPE_SECRET_KEY is not configured', 'PAYMENT_NOT_CONFIGURED');
    }
    return env.STRIPE_SECRET_KEY;
  }

  private get webhookSecret(): string {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError(500, 'STRIPE_WEBHOOK_SECRET is not configured', 'PAYMENT_NOT_CONFIGURED');
    }
    return env.STRIPE_WEBHOOK_SECRET;
  }

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set('success_url', `${env.CLIENT_URL}/dashboard/settings?payment=success`);
    params.set('cancel_url', `${env.CLIENT_URL}/dashboard/settings?payment=cancelled`);
    params.set('customer_email', input.customerEmail);
    params.set('metadata[paymentId]', String(input.metadata.paymentId));
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
    params.set('line_items[0][price_data][unit_amount]', String(Math.round(input.amount * 100)));
    params.set('line_items[0][price_data][product_data][name]', input.description);

    const response = await fetch(`${BASE}/checkout/sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const data = (await response.json()) as StripeSession & { error?: { message?: string } };
    if (!response.ok || !data.id) {
      throw new AppError(502, `Stripe checkout failed: ${data.error?.message ?? 'unknown error'}`, 'PAYMENT_PROVIDER_ERROR');
    }

    return { providerRef: data.id, checkoutUrl: data.url ?? null };
  }

  async handleWebhook(ctx: WebhookContext): Promise<WebhookResult> {
    this.verifySignature(ctx.rawBody, ctx.headers['stripe-signature']);

    const event = JSON.parse(ctx.rawBody || '{}') as StripeEvent;
    if (event.type !== 'checkout.session.completed') {
      // Ignore other events gracefully (still a valid signature).
      return { providerRef: '', status: 'CANCELED' };
    }

    const session = event.data?.object;
    const providerRef = String(session?.id ?? '');
    if (!providerRef) throw new AppError(400, 'Missing session id in Stripe webhook', 'INVALID_WEBHOOK');

    return {
      providerRef,
      status: session?.payment_status === 'paid' ? 'PAID' : 'FAILED',
      transactionId: providerRef,
      metadata: { amount_total: session?.amount_total, paymentId: session?.metadata?.paymentId },
    };
  }

  /** Stripe signature header: `t=<timestamp>,v1=<hmac-hex>` over `t=<ts>.<rawBody>`. */
  private verifySignature(
    rawBody: string,
    header: string | string[] | undefined
  ): void {
    const value = Array.isArray(header) ? header[0] : header;
    if (!value) throw new AppError(400, 'Missing Stripe-Signature header', 'INVALID_WEBHOOK');
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError(500, 'STRIPE_WEBHOOK_SECRET is not configured', 'PAYMENT_NOT_CONFIGURED');
    }

    const parts = Object.fromEntries(value.split(',').map((p) => p.split('=')));
    const timestamp = String(parts.t ?? '');
    const signature = String(parts.v1 ?? '');
    if (!timestamp || !signature) throw new AppError(400, 'Malformed Stripe signature', 'INVALID_WEBHOOK');

    const expected = createHmac('sha256', this.webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppError(400, 'Invalid Stripe webhook signature', 'INVALID_WEBHOOK');
    }
  }
}
