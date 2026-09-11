import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore } from '../../stores/languageStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  Settings,
  Store,
  Save,
  Check,
  ShieldCheck,
  Sparkles,
  Loader2,
  Crown,
  CreditCard,
} from 'lucide-react';

interface BillingOverview {
  plan: string;
  planName: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  status: string;
  periodEnd: string | null;
  limits: { users: number; branches: number; products: number };
  usage: { users: number; branches: number; products: number };
  features: string[];
  billingCycle: 'monthly' | 'yearly';
}

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [form, setForm] = useState({ storeName: '', vatNumber: '', receiptFooter: '', trackInventory: true });
  const [saving, setSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Read-only plan overview. Plan details (usage, features, renewal date) are
  // shown as before, but all management (change plan, renew, pay, history) is
  // restricted to the platform administrator (Requirements #1/#5/#6).
  const [billing, setBilling] = useState<BillingOverview | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(true);

  const { t, language } = useLanguageStore();

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
      .then((res) => setBilling(res.data.data))
      .catch(() => setBilling(null))
      .finally(() => setLoadingBilling(false));
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

  const statusLabel = (status: string) => {
    switch (status) {
      case 'TRIAL': return t.saasTrial;
      case 'ACTIVE': return t.saasActiveSub;
      case 'PAST_DUE': return t.saasPastDue;
      case 'CANCELED': return t.saasCancelled;
      default: return status;
    }
  };

  const statusColor =
    billing?.status === 'ACTIVE'
      ? 'bg-emerald-100 text-emerald-700'
      : billing?.status === 'TRIAL'
      ? 'bg-cyan-100 text-cyan-700'
      : billing?.status === 'PAST_DUE'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-rose-100 text-rose-700';

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

        {/* Plan overview (read-only details; management is admin-only) */}
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
                  {billing.periodEnd && (
                    <div className="mt-4 pt-4 border-t border-white/15 flex items-center justify-between text-xs font-semibold flex-wrap gap-2">
                      <span className="text-indigo-100">
                        {billing.status === 'TRIAL' ? t.trialEndsOn : t.renewsOn}: {formatDate(billing.periodEnd)}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white/15 text-[10px] font-extrabold uppercase">
                        {billing.status === 'TRIAL' ? t.saasTrial : t.saasActiveSub}
                      </span>
                    </div>
                  )}
                </div>

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

                {/* Included features */}
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

                {/* Read-only note: management is done by the administrator */}
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                  <p className="text-xs font-medium text-cyan-800 leading-relaxed">{t.settingsContactAdminNote}</p>
                </div>
              </>
            ) : (
              <p className="text-xs font-semibold text-slate-400 py-6 text-center">{t.planLoading}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};