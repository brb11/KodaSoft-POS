export const PLAN_ORDER = ['starter', 'pro', 'enterprise'] as const;

export const SUB_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'] as const;

export const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'CANCELED'] as const;

export function planLabel(t: any, key: string): string {
  switch (key) {
    case 'starter': return t.saasStarter;
    case 'pro': return t.saasPro;
    case 'enterprise': return t.saasEnterprise;
    default: return key;
  }
}

export function subStatusLabel(t: any, status: string): string {
  switch (status) {
    case 'TRIAL': return t.saasTrial;
    case 'ACTIVE': return t.saasActiveSub;
    case 'PAST_DUE': return t.saasPastDue;
    case 'CANCELED': return t.saasCancelled;
    default: return status;
  }
}

export function paymentStatusLabel(t: any, status: string): string {
  switch (status) {
    case 'PAID': return t.saasPaid;
    case 'PENDING': return t.saasPending;
    case 'FAILED': return t.saasFailed;
    case 'CANCELED': return t.saasCanceledPay;
    default: return status;
  }
}

export function roleLabel(t: any, role: string): string {
  switch (role) {
    case 'OWNER': return t.ownerRole;
    case 'MANAGER': return t.managerRole;
    case 'CASHIER': return t.cashierRole;
    default: return role;
  }
}

export function billingCycleLabel(t: any, cycle: string): string {
  return cycle === 'yearly' ? t.saasYearly : t.saasMonthly;
}

export function formatMoney(language: string, n: number | string): string {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 0,
  }).format(Number(n));
}

export function formatDate(language: string, d?: string | null): string {
  if (!d) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'medium' }).format(new Date(d));
}

export function subStatusPillClass(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'bg-emerald-100 text-emerald-700';
    case 'TRIAL': return 'bg-cyan-100 text-cyan-700';
    case 'PAST_DUE': return 'bg-amber-100 text-amber-700';
    case 'CANCELED': return 'bg-rose-100 text-rose-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

export function paymentStatusPillClass(status: string): string {
  switch (status) {
    case 'PAID': return 'bg-emerald-100 text-emerald-700';
    case 'PENDING': return 'bg-amber-100 text-amber-700';
    case 'FAILED': return 'bg-rose-100 text-rose-700';
    case 'CANCELED': return 'bg-slate-100 text-slate-500';
    default: return 'bg-slate-100 text-slate-600';
  }
}

export function tenantStatusPillClass(isActive: boolean, subStatus?: string | null): string {
  if (!isActive) return 'bg-rose-100 text-rose-700';
  if (subStatus === 'PAST_DUE') return 'bg-amber-100 text-amber-700';
  if (subStatus === 'CANCELED') return 'bg-rose-100 text-rose-700';
  return 'bg-emerald-100 text-emerald-700';
}

export function inputClass(extra?: string): string {
  return `w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 ${extra ?? ''}`;
}

export const CHART_COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#64748b'];
