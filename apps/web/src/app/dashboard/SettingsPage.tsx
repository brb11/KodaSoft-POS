import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore } from '../../stores/languageStore';
import { useAuthStore } from '../../stores/authStore';
import { useBillingStore, type CheckoutInfo, type PaymentRecord, type BillingCycle } from '../../stores/billingStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { CheckoutModal } from '../../components/billing/CheckoutModal';
import {
  Settings,
  Store,
  CreditCard,
  Save,
  Check,
  ShieldCheck,
  Sparkles,
  Loader2,
  Crown,
  AlertTriangle,
  History,
} from 'lucide-react';

interface BillingOverview {
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
  billingCycle: BillingCycle;
  plans: { key: string; name: string; priceMonthly: number; priceYearly: number; trialDays: number }[];
}

const PLAN_ORDER = ['starter', 'pro', 'enterprise'];

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [form, setForm] = useState({ storeName: '', vatNumber: '', receiptFooter: '', trackInventory: true });
  const [saving, setSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [changing, setChanging] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [planMsg, setPlanMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');

  const { t, language } = useLanguageStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    api.get('/settings').then((res) => {
      const data = res.data.data || {};
      setSettings(data);
      setForm({ storeName: data.storeName || '', vatNumber: data.vatNumber || '', receiptFooter: data.receiptFooter || '', trackInventory: data.trackInventory !== false });
    });
  }, []);

  useEffect(() => {
    api
      .get('/billing/plan')
      .then((res) => {
        const data = res.data.data;
        setBilling(data);
        if (data?.billingCycle) setCycle(data.billingCycle);
      })
      .catch(() => setPlanMsg({ ok: false, text: t.planChangeFailed }))
      .finally(() => setLoadingBilling(false));

    api
      .get('/billing/payments')
      .then((res) => setPayments(res.data.data.items))
      .catch(() => setPayments([]));
  }, []);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSettingsMsg(null);
    try {
      const res = await api.put('/settings', form);
      setSettingsMsg({ ok: true, text: t.settingsSaved });
      useSettingsStore.getState().set(res.data.data);
    } catch {
      setSettingsMsg({ ok: false, text: t.settingsSaveFailed });
    } finally {
      setSaving(false);
    }
  };

  const changePlan = async (planKey: string) => {
    const planName = billing?.plans.find((p) => p.key === planKey)?.name ?? planKey;
    if (!window.confirm(`${t.confirmPlanChange} ${planName}?`)) return;
    setChanging(planKey);
    setPlanMsg(null);
    try {
      // Payment-driven flow: Checkout → Payment Provider → Webhook → ACTIVE.
      const res = await api.post('/billing/checkout', { plan: planKey, billingCycle: cycle });
      setCheckout(res.data.data as CheckoutInfo);
    } catch (err: any) {
      setPlanMsg({ ok: false, text: err.response?.data?.message || t.planChangeFailed });
    } finally {
      setChanging(null);
    }
  };

  const renew = async () => {
    setRenewing(true);
    setPlanMsg(null);
    try {
      // Renew runs the same checkout flow (no plan = keep the current plan).
      const res = await api.post('/billing/renew', { billingCycle: cycle });
      setCheckout(res.data.data as CheckoutInfo);
    } catch {
      setPlanMsg({ ok: false, text: t.renewFailed });
    } finally {
      setRenewing(false);
    }
  };

  const handleCheckoutProcessed = async () => {
    setCheckout(null);
    try {
      const [plan, pay] = await Promise.all([
        api.get('/billing/plan'),
        api.get('/billing/payments'),
      ]);
      const data = plan.data.data;
      setBilling(data);
      if (data?.billingCycle) setCycle(data.billingCycle);
      setPayments(pay.data.data.items);
      await useBillingStore.getState().refresh();
      setPlanMsg({ ok: true, text: t.checkoutSuccess });
    } catch {
      setPlanMsg({ ok: false, text: t.checkoutFailed });
    }
  };

  const planLabel = (key: string) => {
    switch (key) {
      case 'starter': return t.saasStarter;
      case 'pro': return t.saasPro;
      case 'enterprise': return t.saasEnterprise;
      default: return key;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'TRIAL': return t.saasTrial;
      case 'ACTIVE': return t.saasActiveSub;
      case 'PAST_DUE': return t.saasPastDue;
      case 'CANCELED': return t.saasCancelled;
      default: return status;
    }
  };

  const paymentStatusLabel = (status: string) => {
    switch (status) {
      case 'PAID': return t.paymentStatusPaid;
      case 'PENDING': return t.paymentStatusPending;
      case 'FAILED': return t.paymentStatusFailed;
      case 'CANCELED': return t.paymentStatusCanceled;
      default: return status;
    }
  };

  const paymentStatusColor = (status: string) =>
    status === 'PAID'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'PENDING'
      ? 'bg-cyan-100 text-cyan-700'
      : status === 'FAILED'
      ? 'bg-rose-100 text-rose-700'
      : 'bg-slate-100 text-slate-600';

  const formatDate = (d: string | null) =>
    d
      ? new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'medium' }).format(new Date(d))
      : '—';

  const formatMoney = (n: number) =>
    new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: 0,
    }).format(n);

  const usageRows = [
    { label: t.usersUsage, used: billing?.usage.users ?? 0, limit: billing?.limits.users ?? -1 },
    { label: t.branchesUsage, used: billing?.usage.branches ?? 0, limit: billing?.limits.branches ?? -1 },
    { label: t.productsUsage, used: billing?.usage.products ?? 0, limit: billing?.limits.products ?? -1 },
  ];

  const statusColor =
    billing?.status === 'ACTIVE'
      ? 'bg-emerald-100 text-emerald-700'
      : billing?.status === 'TRIAL'
      ? 'bg-cyan-100 text-cyan-700'
      : billing?.status === 'PAST_DUE'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-rose-100 text-rose-700';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
              <Settings className="w-5 h-5" />
            </div>
            {t.settingsTitle}
          </h1>
          <p className="text-slate-500 text-xs mt-1 ml-[52px]">{t.settingsDesc}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* Store Information */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 self-start">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200">
              <Store className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">{t.storeInformation}</h2>
              <p className="text-[10px] text-slate-400 font-semibold">{t.storeInfoDesc}</p>
            </div>
          </div>

          <form onSubmit={saveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.storeNameField}</label>
              <input
                type="text"
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.vatNumberField}</label>
              <input
                type="text"
                value={form.vatNumber}
                onChange={(e) => setForm({ ...form, vatNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.receiptFooterField}</label>
              <textarea
                value={form.receiptFooter}
                onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all shadow-sm resize-none"
              />
            </div>

            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <div>
                <p className="text-xs font-extrabold text-slate-800">{t.enableInventory}</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{t.enableInventoryDesc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.trackInventory}
                onClick={() => setForm({ ...form, trackInventory: !form.trackInventory })}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${form.trackInventory ? 'bg-gradient-to-r from-cyan-500 to-blue-600' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${form.trackInventory ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            {settingsMsg && (
              <div className={`p-3 rounded-xl text-xs font-medium ${settingsMsg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                {settingsMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t.saveSettings}
            </button>
          </form>
        </div>

        {/* Plan & Billing */}
        <div className="xl:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-200">
                  <CreditCard className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">{t.planBilling}</h2>
                  <p className="text-[10px] text-slate-400 font-semibold">{t.planBillingDesc}</p>
                </div>
              </div>
              {billing && (
                <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${statusColor}`}>
                  {statusLabel(billing.status)}
                </span>
              )}
            </div>

            {loadingBilling ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t.planLoading}
              </div>
            ) : billing ? (
              <>
                {/* Current plan summary */}
                <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-500/25 mb-6">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
                        {billing.plan === 'enterprise' ? <Crown className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-indigo-200 font-bold">{t.currentPlanLabel}</p>
                        <p className="text-2xl font-extrabold">{billing.planName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold">{formatMoney(billing.billingCycle === 'yearly' ? billing.priceYearly : billing.priceMonthly)}</p>
                      <p className="text-[10px] text-indigo-200 font-bold">{billing.billingCycle === 'yearly' ? t.saasPerYear : t.saasPerMonth}</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/15 flex items-center justify-between text-xs font-semibold flex-wrap gap-2">
                    <span className="text-indigo-100">
                      {billing.status === 'TRIAL' ? t.trialEndsOn : t.renewsOn}: {formatDate(billing.periodEnd)}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-white/15 text-[10px] font-extrabold uppercase">
                      {billing.status === 'TRIAL' ? t.saasTrial : t.saasActiveSub}
                    </span>
                  </div>
                </div>

                {/* Renew banner when inactive */}
                {(billing.status === 'PAST_DUE' || billing.status === 'CANCELED') && (
                  <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      <h3 className="text-xs font-extrabold text-amber-800">{t.renewTitle}</h3>
                    </div>
                    <p className="text-xs font-medium text-amber-700 mb-3">{t.renewDesc}</p>
                    <button
                      onClick={renew}
                      disabled={renewing}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-700 disabled:opacity-50"
                    >
                      {renewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                      {renewing ? t.renewing : t.renewNow}
                    </button>
                  </div>
                )}

                {/* Usage vs limits */}
                <div className="mb-6">
                  <h3 className="text-xs font-extrabold text-slate-900 mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-600" /> {t.usageLabel}
                  </h3>
                  <div className="space-y-4">
                    {usageRows.map((row) => {
                      const unlimited = row.limit === -1;
                      const pct = unlimited ? 100 : Math.min(100, Math.round((row.used / row.limit) * 100));
                      const barColor = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
                      return (
                        <div key={row.label}>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-bold text-slate-600">{row.label}</span>
                            <span className={`font-extrabold ${pct >= 100 ? 'text-rose-600' : 'text-slate-700'}`}>
                              {row.used} / {unlimited ? t.unlimited : row.limit}
                            </span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${unlimited ? 100 : pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Features */}
                {billing.features.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-extrabold text-slate-900 mb-2.5">{t.featuresLabel}</h3>
                    <div className="flex flex-wrap gap-2">
                      {billing.features.map((f) => (
                        <span key={f} className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1.5">
                          <Check className="w-3 h-3" /> {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {planMsg && (
                  <div className={`mb-5 p-3 rounded-xl text-xs font-medium ${planMsg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                    {planMsg.text}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Plan selector */}
          {billing && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <h3 className="text-xs font-extrabold text-slate-900 mb-1">{t.changePlan}</h3>
              <p className="text-[11px] text-slate-400 font-semibold mb-4">{t.choosePlanDesc}</p>

              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit mb-5">
                <button
                  type="button"
                  onClick={() => setCycle('monthly')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                    cycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.billingMonthly}
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('yearly')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    cycle === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.billingYearly}
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-extrabold">
                    {t.yearlySaveNote}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PLAN_ORDER.map((key) => {
                  const plan = billing.plans.find((p) => p.key === key)!;
                  const isCurrent = key === billing.plan;
                  const isManager = user?.role === 'MANAGER';
                  return (
                    <div
                      key={key}
                      className={`rounded-2xl border p-5 transition-all ${
                        isCurrent
                          ? 'border-cyan-500 bg-cyan-50/50 shadow-md shadow-cyan-500/10'
                          : 'border-slate-200 bg-white hover:border-cyan-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {key === 'enterprise' && <Crown className="w-4 h-4 text-amber-500" />}
                          <span className="font-extrabold text-slate-900 text-sm">{planLabel(key)}</span>
                        </div>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500 text-white text-[9px] font-extrabold uppercase">
                            {t.currentPlanBadge}
                          </span>
                        )}
                      </div>
                      <p className="text-2xl font-extrabold text-slate-900">
                        {formatMoney(cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly)}
                        <span className="text-[11px] text-slate-400 font-bold">
                          {cycle === 'yearly' ? ` / ${t.saasPerYear}` : t.saasPerMonth}
                        </span>
                      </p>
                      <button
                        onClick={() => changePlan(key)}
                        disabled={isCurrent || isManager || changing === key}
                        className={`mt-4 w-full py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                          isCurrent
                            ? 'bg-cyan-500/10 text-cyan-600'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20 hover:from-cyan-600 hover:to-blue-700'
                        }`}
                      >
                        {changing === key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        {isCurrent ? t.currentPlanBadge : t.saasUpgrade}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment history */}
          {billing && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-200">
                  <History className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900">{t.paymentHistory}</h3>
                  <p className="text-[10px] text-slate-400 font-semibold">{t.planBillingDesc}</p>
                </div>
              </div>

              {payments.length === 0 ? (
                <p className="text-xs font-semibold text-slate-400 py-4 text-center">{t.paymentHistoryEmpty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100">
                        <th className="py-2 pr-3">{t.checkoutPlanLabel}</th>
                        <th className="py-2 pr-3">{t.checkoutAmount}</th>
                        <th className="py-2 pr-3">{t.billingCycleLabel}</th>
                        <th className="py-2 pr-3">{t.checkoutProvider}</th>
                        <th className="py-2 pr-3">{t.status}</th>
                        <th className="py-2">{t.exportedOn}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {payments.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2.5 pr-3 text-xs font-bold text-slate-800">{planLabel(p.plan)}</td>
                          <td className="py-2.5 pr-3 text-xs font-extrabold text-slate-800">{formatMoney(p.amount)}</td>
                          <td className="py-2.5 pr-3 text-xs font-semibold text-slate-500">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-extrabold uppercase">
                              {p.billingCycle === 'yearly' ? t.billingYearly : t.billingMonthly}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-xs font-semibold text-slate-500">{p.provider}</td>
                          <td className="py-2.5 pr-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${paymentStatusColor(p.status)}`}>
                              {paymentStatusLabel(p.status)}
                            </span>
                          </td>
                          <td className="py-2.5 text-xs text-slate-500">{formatDate(p.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <CheckoutModal checkout={checkout} onClose={() => setCheckout(null)} onProcessed={handleCheckoutProcessed} />
    </div>
  );
};
