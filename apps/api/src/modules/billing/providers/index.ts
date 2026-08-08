import { env } from '../../../config/env';
import { PaymentProvider, PaymentProviderName } from './payment-provider.interface';
import { SandboxProvider } from './sandbox.provider';
import { PayTabsProvider } from './paytabs.provider';
import { MoyasarProvider } from './moyasar.provider';
import { StripeProvider } from './stripe.provider';

const sandboxProvider = new SandboxProvider();
const stripeProvider = new StripeProvider();
const paytabsProvider = new PayTabsProvider();
const moyasarProvider = new MoyasarProvider();

export { SandboxProvider, PayTabsProvider, MoyasarProvider, StripeProvider };
export * from './payment-provider.interface';

export function isSandbox(): boolean {
  return env.PAYMENT_MODE === 'sandbox';
}

export function getPaymentProviderName(): PaymentProviderName {
  if (isSandbox()) return 'sandbox';
  return env.PAYMENT_PROVIDER;
}

/**
 * Resolves the active payment provider:
 *  - `PAYMENT_MODE=sandbox`  → SandboxProvider (no real gateway, default).
 *  - `PAYMENT_MODE=live`     → the provider named by `PAYMENT_PROVIDER`.
 */
export function getPaymentProvider(): PaymentProvider {
  if (isSandbox()) return sandboxProvider;
  switch (env.PAYMENT_PROVIDER) {
    case 'paytabs':
      return paytabsProvider;
    case 'moyasar':
      return moyasarProvider;
    case 'stripe':
    default:
      return stripeProvider;
  }
}
