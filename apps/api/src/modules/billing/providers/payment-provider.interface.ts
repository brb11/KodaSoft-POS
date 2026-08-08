/**
 * Pluggable payment provider contract for subscription billing.
 *
 * The Checkout → Payment Provider → Webhook → Billing Service → ACTIVE flow is
 * implemented by two seams:
 *   1. `createCheckoutSession` — called by the billing service when a tenant
 *      checks out (new plan or renewal). Returns a hosted/redirect checkout.
 *   2. `handleWebhook` / `verifySignature` — called when the gateway notifies
 *      us of a payment result (PAID / FAILED / CANCELED).
 *
 * Sandbox mode (`PAYMENT_MODE=sandbox`) swaps in a SandboxProvider that never
 * talks to a real gateway: checkout returns immediately and the tenant
 * approves/declines the simulated payment via the billing API.
 */

export type PaymentStatus = 'PAID' | 'FAILED' | 'CANCELED';

export type PaymentProviderName = 'sandbox' | 'stripe' | 'paytabs' | 'moyasar';

export interface CheckoutInput {
  tenantId: string;
  subscriptionId?: string;
  plan: string;
  planName: string;
  amount: number;
  currency: string;
  customerEmail: string;
  description: string;
  /** Free-form app metadata (e.g. `{ paymentId }`) echoed back in the webhook. */
  metadata: Record<string, unknown>;
}

export interface CheckoutResult {
  /** Gateway transaction/reference id. */
  providerRef: string;
  /** URL the customer is redirected to for the hosted payment page. */
  checkoutUrl: string | null;
  /** Provider-specific extras surfaced to the frontend (e.g. sandbox action urls). */
  payload?: Record<string, unknown>;
}

export interface WebhookContext {
  rawBody: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface WebhookResult {
  /** Gateway transaction id used to correlate with our SubscriptionPayment. */
  providerRef: string;
  status: PaymentStatus;
  /** Optional gateway charge/payment id for auditing. */
  transactionId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult>;
  /**
   * Parses + verifies a gateway webhook call. Throws on invalid signature,
   * returns a normalized result otherwise.
   */
  handleWebhook(ctx: WebhookContext): Promise<WebhookResult>;
  /** Optional — used to poll a transaction status (PayTabs/Moyasar). */
  getStatus?(providerRef: string): Promise<PaymentStatus>;
}
