import { create } from 'zustand';
import { api } from '../lib/api';

export interface BillingOverview {
  plan: string;
  planName: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  status: string;
  trialStarted: string | null;
  periodEnd: string | null;
  autoRenew: boolean;
  limits: { users: number; branches: number; products: number };
  usage: { users: number; branches: number; products: number };
  features: string[];
  plans: { key: string; name: string; priceMonthly: number; priceYearly: number; trialDays: number }[];
}

export function isSubscriptionActive(data: BillingOverview): boolean {
  if (data.status === 'PAST_DUE' || data.status === 'CANCELED') return false;
  if (data.status === 'TRIAL' && data.periodEnd && new Date(data.periodEnd) < new Date()) return false;
  return true;
}

export type BillingCycle = 'monthly' | 'yearly';

export interface CheckoutPayment {
  id: string;
  plan: string;
  planName: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  mode: string;
  billingCycle: BillingCycle;
  sandbox: boolean;
  checkoutUrl: string | null;
  approveUrl: string | null;
  declineUrl: string | null;
}

export interface CheckoutInfo {
  payment: CheckoutPayment;
}

export interface PaymentRecord {
  id: string;
  plan: string;
  amount: number;
  currency: string;
  mode: string;
  provider: string;
  status: string;
  billingCycle: BillingCycle;
  providerRef: string | null;
  checkoutUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface BillingState {
  data: BillingOverview | null;
  loading: boolean;
  isActive: boolean;
  payments: PaymentRecord[];
  paymentsTotal: number;
  fetch: () => Promise<void>;
  refresh: () => Promise<void>;
  markInactive: () => void;
  checkout: (plan?: string, billingCycle?: BillingCycle) => Promise<CheckoutInfo>;
  renew: (billingCycle?: BillingCycle) => Promise<CheckoutInfo>;
  fetchPayments: () => Promise<void>;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  data: null,
  loading: false,
  isActive: true,
  payments: [],
  paymentsTotal: 0,

  fetch: async () => {
    if (get().data) return;
    await get().refresh();
  },

  refresh: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/billing/plan');
      const data = res.data.data as BillingOverview;
      set({ data, loading: false, isActive: isSubscriptionActive(data) });
    } catch {
      set({ loading: false });
    }
  },

  markInactive: () => set({ isActive: false }),

  checkout: async (plan?: string, billingCycle?: BillingCycle) => {
    const res = await api.post('/billing/checkout', { plan, billingCycle });
    return res.data.data as CheckoutInfo;
  },

  renew: async (billingCycle?: BillingCycle) => {
    const res = await api.post('/billing/renew', { billingCycle });
    return res.data.data as CheckoutInfo;
  },

  fetchPayments: async () => {
    try {
      const res = await api.get('/billing/payments');
      const data = res.data.data as { items: PaymentRecord[]; total: number };
      set({ payments: data.items, paymentsTotal: data.total });
    } catch {
      set({ payments: [], paymentsTotal: 0 });
    }
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('casheer:subscription-inactive', () => {
    useBillingStore.getState().markInactive();
  });
}
