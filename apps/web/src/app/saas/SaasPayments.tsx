import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore } from '../../stores/languageStore';
import type { Paged, PaymentRow, TenantRow } from './types';
import { PLAN_ORDER, planLabel, paymentStatusLabel, formatMoney, formatDate, paymentStatusPillClass, inputClass } from './helpers';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Plus,
  Search,
  X,
  XCircle,
} from 'lucide-react';

const STATUS_FILTERS = ['', 'PENDING', 'PAID', 'FAILED', 'CANCELED'];

export const SaasPayments: React.FC = () => {
  const { t, language } = useLanguageStore();
  const [data, setData] = useState<Paged<PaymentRow> | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', status: '', plan: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showRecord, setShowRecord] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [form, setForm] = useState({ tenantId: '', plan: 'starter', amount: '', currency: 'SAR', billingCycle: 'monthly', note: '' });
  const debounceRef = useRef<number | null>(null);

  const load = useCallback(async (f: typeof filters) => {
    setLoading(true);
    try {
      const res = await api.get('/saas/payments', {
        params: { search: f.search || undefined, status: f.status || undefined, plan: f.plan || undefined, page: f.page, limit: 20 },
      });
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  useEffect(() => {
    api
      .get('/saas/tenants', { params: { limit: 100, page: 1 } })
      .then((res) => {
        setTenants(res.data.data.items);
        setForm((f) => ({ ...f, tenantId: res.data.data.items[0]?.id ?? '' }));
      })
      .catch(() => undefined);
  }, []);

  const updateSearch = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setFilters((f) => ({ ...f, search: value, page: 1 })), 350);
  };

  const setFilter = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  const updateStatus = async (p: PaymentRow, status: string) => {
    setBusy(p.id);
    setMsg(null);
    try {
      await api.put(`/saas/payments/${p.id}/status`, { status });
      setMsg({ ok: true, text: t.saasPaymentStatusUpdated });
      load(filters);
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.saasUpdateFailed });
    } finally {
      setBusy(null);
    }
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecordLoading(true);
    setMsg(null);
    try {
      await api.post('/saas/payments', {
        tenantId: form.tenantId,
        plan: form.plan,
        amount: Number(form.amount),
        currency: form.currency,
        billingCycle: form.billingCycle,
        note: form.note || undefined,
      });
      setMsg({ ok: true, text: t.saasPaymentRecorded });
      setShowRecord(false);
      setForm((f) => ({ ...f, amount: '', note: '' }));
      setFilters((f) => ({ ...f, page: 1 }));
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.saasUpdateFailed });
    } finally {
      setRecordLoading(false);
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-5">
      {msg && (
        <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${msg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-600" /> {t.saasPayments}
            <span className="text-xs font-bold text-slate-400">({data?.total ?? 0})</span>
          </h2>
          <button onClick={() => setShowRecord(true)} className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl px-4 py-2 text-xs shadow-md shadow-amber-500/25 transition-all">
            <Plus className="w-4 h-4" /> {t.saasRecordPayment}
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-200/80 flex flex-wrap items-center gap-3 bg-slate-50/60">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={searchInput} onChange={(e) => updateSearch(e.target.value)} placeholder={t.saasSearch} className={`${inputClass()} ltr:pl-9 rtl:pr-9`} />
          </div>
          <select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} className={inputClass('max-w-[140px]')}>
            {STATUS_FILTERS.map((s) => (
              <option key={s || 'all'} value={s}>{s ? paymentStatusLabel(t, s) : t.saasFilterStatus}</option>
            ))}
          </select>
          <select value={filters.plan} onChange={(e) => setFilter({ plan: e.target.value })} className={inputClass('max-w-[150px]')}>
            <option value="">{t.saasPlanFilter}</option>
            {PLAN_ORDER.map((key) => (
              <option key={key} value={key}>{planLabel(t, key)}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t.saasLoading}
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">{t.saasNoResults}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-[10px] uppercase text-slate-400 border-b border-slate-200/80 bg-slate-50/60">
                  <th className="px-6 py-3 font-bold text-start">{t.saasTenantCol}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasPlan}</th>
                  <th className="px-6 py-3 font-bold text-end">{t.saasPaymentAmount}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasPaymentMode}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasPaymentStatus}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasPaymentDate}</th>
                  <th className="px-6 py-3 font-bold text-end">{t.saasActions}</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3">
                      <p className="font-bold text-slate-800">{p.tenantName}</p>
                      <p className="text-[10px] text-slate-400">casheer.app/{p.tenantSlug}</p>
                    </td>
                    <td className="px-6 py-3">
                      <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[10px] font-extrabold uppercase">{planLabel(t, p.plan)}</span>
                    </td>
                    <td className="px-6 py-3 text-end font-bold text-slate-800">
                      {formatMoney(language, p.amount)}
                      <span className="block text-[9px] text-slate-400 font-semibold uppercase">
                        {p.billingCycle === 'yearly' ? t.saasYearly : t.saasMonthly}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500 uppercase">{p.mode || p.provider || '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${paymentStatusPillClass(p.status)}`}>
                        {paymentStatusLabel(t, p.status)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500">{formatDate(language, p.paidAt ?? p.createdAt)}</td>
                    <td className="px-6 py-3">
                      {p.status === 'PENDING' || p.status === 'FAILED' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => updateStatus(p, 'PAID')}
                            disabled={busy === p.id}
                            className="inline-flex items-center gap-1 p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold transition-colors disabled:opacity-50"
                            title={t.saasMarkPaid}
                          >
                            <Check className="w-3.5 h-3.5" /> {t.saasMarkPaid}
                          </button>
                          <button
                            onClick={() => updateStatus(p, 'FAILED')}
                            disabled={busy === p.id}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50"
                            title={t.saasMarkFailed}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => updateStatus(p, 'CANCELED')}
                            disabled={busy === p.id}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors disabled:opacity-50"
                            title={t.saasMarkCanceled}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-3 border-t border-slate-200/80 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 font-semibold">
            {t.saasPageOf} {filters.page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filters.page <= 1 || loading} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors" title={t.saasPrev}>
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </button>
            <button onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))} disabled={filters.page >= totalPages || loading} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors" title={t.saasNext}>
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {showRecord && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-extrabold text-slate-900">{t.saasRecordPayment}</h3>
              <button onClick={() => setShowRecord(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={recordPayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasSelectTenant} *</label>
                <select required value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} className={inputClass()}>
                  {tenants.map((tn) => (
                    <option key={tn.id} value={tn.id}>{tn.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasPlan}</label>
                <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className={inputClass()}>
                  {PLAN_ORDER.map((key) => (
                    <option key={key} value={key}>{planLabel(t, key)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasPaymentAmount} *</label>
                <input required type="number" min={1} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass()} />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasCurrency}</label>
                <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputClass()} />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasBillingCycle}</label>
                <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })} className={inputClass()}>
                  <option value="monthly">{t.saasMonthly}</option>
                  <option value="yearly">{t.saasYearly}</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasPaymentNote}</label>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} className={inputClass()} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRecord(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  {t.cancel}
                </button>
                <button type="submit" disabled={recordLoading} className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl px-4 py-2 text-xs disabled:opacity-60 transition-all">
                  {recordLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t.saasRecordPayment}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
