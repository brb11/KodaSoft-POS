export interface Overview {
  tenants: number;
  activeTenants: number;
  suspendedTenants: number;
  users: number;
  orders: number;
  revenue: number;
  todayOrders: number;
  todayRevenue: number;
  mrr: number;
  activeSubscriptions: number;
  trialTenants: number;
  expiringSoon: number;
  subscriptionsByStatus: Record<string, number>;
  plans: { key: string; name: string; priceMonthly: number; trialDays: number }[];
  revenueSeries: { date: string; value: number }[];
  ordersSeries: { date: string; value: number }[];
  tenantSeries: { date: string; value: number }[];
  planDistribution: { key: string; count: number }[];
  topTenants: { id: string; name: string; slug: string; plan: string; revenue: number }[];
}

export interface SubscriptionInfo {
  plan: string;
  status: string;
  periodEnd: string | null;
  periodStart: string | null;
  trialStarted: string | null;
  autoRenew: boolean;
  provider: string;
  billingCycle: string;
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  users: number;
  branches: number;
  orders: number;
  revenue: number;
  subscription: SubscriptionInfo | null;
}

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  branch?: { id: string; name: string } | null;
}

export interface TenantBranch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { orders: number };
}

export interface TenantPayment {
  id: string;
  plan: string;
  amount: string | number;
  currency: string;
  mode: string;
  provider: string;
  status: string;
  billingCycle: string;
  paidAt: string | null;
  createdAt: string;
  metadata?: any;
}

export interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: string;
  revenue: number;
  completedOrders: number;
  subscription: SubscriptionInfo | null;
  counts: { users: number; branches: number; products: number; categories: number; customers: number };
  users: TenantUser[];
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    createdAt: string;
    branch: { name: string } | null;
  }[];
  branches: TenantBranch[];
  payments: TenantPayment[];
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  tenant: { id: string; name: string; slug: string };
  branch: { id: string; name: string } | null;
}

export interface PaymentRow {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  plan: string;
  amount: string | number;
  currency: string;
  mode: string;
  provider: string;
  status: string;
  billingCycle: string;
  paidAt: string | null;
  createdAt: string;
  providerRef: string | null;
  metadata?: any;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
