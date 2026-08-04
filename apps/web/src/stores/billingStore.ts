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

interface BillingState {
  data: BillingOverview | null;
  loading: boolean;
  isActive: boolean;
  fetch: () => Promise<void>;
  refresh: () => Promise<void>;
  markInactive: () => void;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  data: null,
  loading: false,
  isActive: true,

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
}));

if (typeof window !== 'undefined') {
  window.addEventListener('casheer:subscription-inactive', () => {
    useBillingStore.getState().markInactive();
  });
}
