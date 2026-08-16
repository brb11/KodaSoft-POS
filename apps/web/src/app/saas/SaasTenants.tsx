import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore, translate } from '../../stores/languageStore';
import type { Paged, TenantRow } from './types';
import { PLAN_ORDER, planLabel, subStatusLabel, formatMoney, formatDate, tenantStatusPillClass, inputClass } from './helpers';
import {
  AlarmClock,
  Building2,
  CheckCircle2,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Store,
  Trash2,
  X,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Props {
  onOpenDetail: (tenantId: string) => void;
  initialFilters?: Partial<TenantFilters>;
}

export interface TenantFilters {
  search: string;
  status: string;
  plan: string;
  subStatus: string;
  expiringSoon: boolean;
  page: number;
}

const DEFAULT_FILTERS: TenantFilters = { search: '', status: 'all', plan: '', subStatus: '', expiringSoon: false, page: 1 };

export const SaasTenants: React.FC<Props> = ({ onOpenDetail, initialFilters }) => {
  const { t, language } = useLanguageStore();
  const [data, setData] = useState<Paged<TenantRow> | null>(null);
  const [filters, setFilters] = useState<TenantFilters>({ ...DEFAULT_FILTERS, ...initialFilters });
  const [searchInput, setSearchInput] = useState(initialFilters?.search ?? '');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TenantRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    plan: 'starter',
    branchName: '',
    branchAddress: '',
    phone: '',
  });
  const debounceRef = useRef<number | null>(null);

  const load = useCallback(async (f: TenantFilters) => {
    setLoading(true);
    try {
      const res = await api.get('/saas/tenants', {
        params: {
          search: f.search || undefined,
          status: f.status,
          plan: f.plan || undefined,
          subStatus: f.subStatus || undefined,
          expiringSoon: f.expiringSoon ? 'true' : undefined,
          page: f.page,
          limit: 20,
        },
      });
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to load tenants:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filters);
  }, [filters, load]);

  const updateSearch = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setFilters((f) => ({ ...f, search: value, page: 1 }));
    }, 350);
  };

  const setFilter = (patch: Partial<TenantFilters>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  const updateTenant = async (tenant: TenantRow, body: Record<string, any>) => {
    setUpdating(tenant.id);
    try {
      await api.put(`/saas/tenants/${tenant.id}`, body);
      setMsg({ ok: true, text: t.saasUpdated });
      load(filters);
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.saasUpdateFailed });
    } finally {
      setUpdating(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/saas/tenants/${deleting.id}`);
      setMsg({ ok: true, text: t.saasTenantDeleted });
      setDeleting(null);
      load(filters);
    } catch (err: any) {
      setMsg({
        ok: false,
        text: err.response?.data?.code === 'TENANT_HAS_HISTORY' ? t.saasTenantHasHistory : err.response?.data?.message || t.saasDeleteFailed,
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const createTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await api.post('/saas/tenants', createForm);
      setMsg({ ok: true, text: t.saasTenantCreated });
      setShowCreate(false);
      setCreateForm({ name: '', ownerName: '', ownerEmail: '', ownerPassword: '', plan: 'starter', branchName: '', branchAddress: '', phone: '' });
      setFilters((f) => ({ ...f, page: 1 }));
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.saasCreateFailed });
    } finally {
      setCreateLoading(false);
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
            <Building2 className="w-5 h-5 text-cyan-600" /> {t.saasTenants}
            <span className="text-xs font-bold text-slate-400">({data?.total ?? 0})</span>
          </h2>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl px-4 py-2 text-xs shadow-md shadow-cyan-500/25 hover:from-cyan-600 hover:to-blue-700 transition-all"
          >
            <Plus className="w-4 h-4" /> {t.saasNewTenant}
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-slate-200/80 space-y-2.5 bg-slate-50/60">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => updateSearch(e.target.value)}
                placeholder={t.saasSearch}
                className={`${inputClass()} ltr:pl-9 rtl:pr-9`}
              />
            </div>
            <select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} className={inputClass('max-w-[140px]')}>
              <option value="all">{t.saasAll}</option>
              <option value="active">{t.saasActiveTenants}</option>
              <option value="suspended">{t.saasSuspendedTenants}</option>
            </select>
            <select value={filters.subStatus} onChange={(e) => setFilter({ subStatus: e.target.value })} className={inputClass('max-w-[150px]')}>
              <option value="">{t.saasSubStatusAll}</option>
              {['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'].map((s) => (
                <option key={s} value={s}>{subStatusLabel(t, s)}</option>
              ))}
            </select>
            <select value={filters.plan} onChange={(e) => setFilter({ plan: e.target.value })} className={inputClass('max-w-[150px]')}>
              <option value="">{t.saasPlanFilter}</option>
              {PLAN_ORDER.map((key) => (
                <option key={key} value={key}>{planLabel(t, key)}</option>
              ))}
            </select>
            <button
              onClick={() => setFilter({ expiringSoon: !filters.expiringSoon })}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                filters.expiringSoon
                  ? 'bg-amber-100 text-amber-700 border border-amber-300'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <AlarmClock className="w-3.5 h-3.5" /> {t.saasExpiringSoon7}
            </button>
          </div>
          {(filters.subStatus || filters.expiringSoon) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-extrabold uppercase text-slate-400">{t.saasActiveFilters}:</span>
              {filters.subStatus && (
                <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[10px] font-extrabold uppercase">
                  {subStatusLabel(t, filters.subStatus)}
                </span>
              )}
              {filters.expiringSoon && (
                <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-extrabold uppercase">
                  {t.saasExpiringSoon7}
                </span>
              )}
              <button
                onClick={() => setFilter({ subStatus: '', expiringSoon: false })}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-800 transition-colors"
              >
                <X className="w-3 h-3" /> {t.saasClearFilter}
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center text-slate-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t.saasLoading}
          </div>
        ) : data && data.items.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">{filters.search || filters.status !== 'all' || filters.plan || filters.subStatus || filters.expiringSoon ? t.saasNoResults : t.saasNoTenants}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-[10px] uppercase text-slate-400 border-b border-slate-200/80 bg-slate-50/60">
                  <th className="px-6 py-3 font-bold text-start">{t.saasTenantCol}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasPlan}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasStatus}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasUsers}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasBranches}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasOrdersCount}</th>
                  <th className="px-6 py-3 font-bold text-end">{t.saasRevenue}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasCreated}</th>
                  <th className="px-6 py-3 font-bold text-end">{t.saasActions}</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3">
                      <button onClick={() => onOpenDetail(tenant.id)} className="flex items-center gap-3 text-start group">
                        <div className="w-8 h-8 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-black text-xs">
                          {tenant.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 group-hover:text-cyan-600">{tenant.name}</p>
                          <p className="text-[10px] text-slate-400">casheer.app/{tenant.slug}</p>
                        </div>
                      </button>
                    </td>
                    <td className="px-6 py-3">
                      <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[10px] font-extrabold uppercase">
                        {planLabel(t, tenant.plan)}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${tenantStatusPillClass(tenant.isActive, tenant.subscription?.status)}`}>
                        {tenant.isActive ? subStatusLabel(t, tenant.subscription?.status ?? 'ACTIVE') : t.inactive}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600">{tenant.users}</td>
                    <td className="px-6 py-3 text-slate-600">{tenant.branches}</td>
                    <td className="px-6 py-3 text-slate-600">{tenant.orders}</td>
                    <td className="px-6 py-3 text-end font-bold text-slate-800">{formatMoney(language, tenant.revenue)}</td>
                    <td className="px-6 py-3 text-slate-500 text-xs">{formatDate(language, tenant.createdAt)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenDetail(tenant.id)}
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 transition-colors"
                          title={t.saasDetail}
                        >
                          <Store className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateTenant(tenant, { isActive: !tenant.isActive })}
                          disabled={updating === tenant.id}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                            tenant.isActive
                              ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-700'
                              : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                          }`}
                          title={tenant.isActive ? t.saasSuspend : t.saasActivate}
                        >
                          {tenant.isActive ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setDeleting(tenant)}
                          disabled={updating === tenant.id}
                          className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-colors disabled:opacity-50"
                          title={t.saasDeleteTenant}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-slate-200/80 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 font-semibold">
            {t.saasPageOf} {filters.page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, f.page - 1) }))}
              disabled={filters.page <= 1 || loading}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              title={t.saasPrev}
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </button>
            <button
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
              disabled={filters.page >= totalPages || loading}
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
              title={t.saasNext}
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* Create tenant modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-extrabold text-slate-900">{t.saasCreateTenant}</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={createTenant} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasTenantName} *</label>
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasOwnerName} *</label>
                <input
                  required
                  value={createForm.ownerName}
                  onChange={(e) => setCreateForm({ ...createForm, ownerName: e.target.value })}
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasOwnerEmail} *</label>
                <input
                  required
                  type="email"
                  value={createForm.ownerEmail}
                  onChange={(e) => setCreateForm({ ...createForm, ownerEmail: e.target.value })}
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasOwnerPassword} *</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  value={createForm.ownerPassword}
                  onChange={(e) => setCreateForm({ ...createForm, ownerPassword: e.target.value })}
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasPlan}</label>
                <select value={createForm.plan} onChange={(e) => setCreateForm({ ...createForm, plan: e.target.value })} className={inputClass()}>
                  {PLAN_ORDER.map((key) => (
                    <option key={key} value={key}>{planLabel(t, key)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasBranchName}</label>
                <input
                  value={createForm.branchName}
                  onChange={(e) => setCreateForm({ ...createForm, branchName: e.target.value })}
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasBranchAddress}</label>
                <input
                  value={createForm.branchAddress}
                  onChange={(e) => setCreateForm({ ...createForm, branchAddress: e.target.value })}
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.saasPhone}</label>
                <input
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  className={inputClass()}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl px-4 py-2 text-xs shadow-md shadow-cyan-500/25 disabled:opacity-60 transition-all"
                >
                  {createLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t.saasCreateTenant}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleting && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" /> {t.saasDeleteTenant}
            </h3>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">{translate(t.saasConfirmDeleteTenant, { name: deleting.name })}</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                {t.cancel}
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 bg-red-600 text-white font-bold rounded-xl px-4 py-2 text-xs disabled:opacity-60 transition-all"
              >
                {deleteLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t.saasDeleteTenant}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
