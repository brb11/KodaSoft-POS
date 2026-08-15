import { createHmac } from 'crypto';
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
 * PayTabs payment provider (Saudi market).
 *
 * Flow:
 *  - `createCheckoutSession` → PayTabs `payment/request` returns a hosted
 *    `redirect_url` we send the customer to.
 *  - After payment, PayTabs posts to our `callback` (webhook) URL. We verify
 *    the HMAC-SHA256 `signature` before trusting the result.
 *
 * API: https://docs.paytabs.com/docs
 */
const BASE = 'https://secure.paytabs.sa';

interface PayTabsRequestResponse {
  tran_ref?: string;
  redirect_url?: string;
  payment_url?: string;
  message?: string;
}

interface PayTabsQueryResponse {
  tran_ref?: string;
  tran_status?: string;
  respStatus?: string;
  respMessage?: string;
}

export class PayTabsProvider implements PaymentProvider {
  readonly name = 'paytabs' as const;

  private get serverKey(): string {
    if (!env.PAYTABS_SERVER_KEY) {
      throw new AppError(500, 'PAYTABS_SERVER_KEY is not configured', 'PAYMENT_NOT_CONFIGURED');
    }
    return env.PAYTABS_SERVER_KEY;
  }

  private get profileId(): string {
    if (!env.PAYTABS_PROFILE_ID) {
      throw new AppError(500, 'PAYTABS_PROFILE_ID is not configured', 'PAYMENT_NOT_CONFIGURED');
    }
    return env.PAYTABS_PROFILE_ID;
  }

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    const response = await fetch(`${BASE}/payment/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: this.serverKey,
      },
      body: JSON.stringify({
        profile_id: this.profileId,
        tran_type: 'sale',
        tran_class: 'ecom',
        cart_id: input.metadata.paymentId,
        cart_currency: input.currency,
        cart_amount: input.amount,
        cart_description: input.description,
        customer_details: {
          name: input.planName,
          email: input.customerEmail,
          phone: '',
          street1: '',
          city: '',
          state: '',
          country: 'SA',
          zip: '',
        },
        callback: `${env.API_URL}/api/v1/billing/webhook/paytabs`,
        return: `${env.CLIENT_URL}/app/dashboard/settings?payment=return`,
        // Give the gateway a stable hint; the authoritative price is checked
        // again server-side before the subscription is activated.
        reference: 'CASHEER',
        language: 'en',
      }),
    });

    const data = (await response.json()) as PayTabsRequestResponse;
    if (!response.ok || !data.tran_ref) {
      throw new AppError(502, `PayTabs checkout failed: ${data.message ?? 'unknown error'}`, 'PAYMENT_PROVIDER_ERROR');
    }

    return {
      providerRef: data.tran_ref,
      checkoutUrl: data.redirect_url ?? data.payment_url ?? null,
    };
  }

  async handleWebhook(ctx: WebhookContext): Promise<WebhookResult> {
    const body = JSON.parse(ctx.rawBody || '{}') as Record<string, unknown>;
    this.verifySignature(body);

    const providerRef = String(body.tran_ref ?? '');
    if (!providerRef) throw new AppError(400, 'Missing tran_ref in PayTabs webhook', 'INVALID_WEBHOOK');

    const status = this.mapStatus(body);
    return { providerRef, status, transactionId: String(body.tran_ref), metadata: { respMessage: body.respMessage } };
  }

  async getStatus(providerRef: string): Promise<PaymentStatus> {
    const response = await fetch(`${BASE}/payment/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: this.serverKey },
      body: JSON.stringify({ profile_id: this.profileId, tran_ref: providerRef }),
    });
    const data = (await response.json()) as PayTabsQueryResponse;
    return this.mapStatus(data as unknown as Record<string, unknown>);
  }

  /** PayTabs signature = HMAC-SHA256 over the alphabetically-sorted concatenated
   *  values of the response fields, with the server key appended. */
  private verifySignature(body: Record<string, unknown>): void {
    const signature = String(body.signature ?? '');
    if (!signature) throw new AppError(400, 'Missing PayTabs signature', 'INVALID_WEBHOOK');

    const unsigned = Object.entries(body)
      .filter(([k, v]) => k !== 'signature' && v !== undefined && v !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => String(v))
      .join('');
    const expected = createHmac('sha256', this.serverKey).update(unsigned).digest('hex');
    if (expected !== signature) {
      throw new AppError(400, 'Invalid PayTabs webhook signature', 'INVALID_WEBHOOK');
    }
  }

  /** PayTabs `respStatus` / `tran_status`: A/H/C = paid. */
  private mapStatus(body: Record<string, unknown>): PaymentStatus {
    const status = String(body.respStatus ?? body.tran_status ?? '');
    if (status === 'A' || status === 'H' || status === 'C') return 'PAID';
    if (status === 'D' || status === 'E' || status === 'V') return 'FAILED';
    return 'FAILED';
  }
}
