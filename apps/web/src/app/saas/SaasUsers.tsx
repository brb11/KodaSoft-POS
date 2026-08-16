import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore, translate } from '../../stores/languageStore';
import type { Paged, PlatformUser, TenantRow } from './types';
import { roleLabel, formatDate, inputClass } from './helpers';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react';

interface Props {
  onOpenDetail: (tenantId: string) => void;
}

const ROLES = ['OWNER', 'MANAGER', 'CASHIER'];

export const SaasUsers: React.FC<Props> = ({ onOpenDetail }) => {
  const { t, language } = useLanguageStore();
  const [data, setData] = useState<Paged<PlatformUser> | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({ search: '', role: '', status: 'all', tenantId: '', page: 1 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PlatformUser | null>(null);
  const [deleting, setDeleting] = useState<PlatformUser | null>(null);
  const [form, setForm] = useState({ tenantId: '', name: '', email: '', password: '', pin: '', role: 'MANAGER' });
  const debounceRef = useRef<number | null>(null);

  const load = useCallback(async (f: typeof filters) => {
    setLoading(true);
    try {
      const res = await api.get('/saas/users', {
        params: { search: f.search || undefined, role: f.role || undefined, status: f.status, tenantId: f.tenantId || undefined, page: f.page, limit: 20 },
      });
      setData(res.data.data);
    } catch (err) {
      console.error('Failed to load users:', err);
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
      .then((res) => setTenants(res.data.data.items))
      .catch(() => undefined);
  }, []);

  const updateSearch = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setFilters((f) => ({ ...f, search: value, page: 1 })), 350);
  };

  const setFilter = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch, page: 1 }));

  const openAdd = () => {
    setEditing(null);
    setForm({ tenantId: tenants[0]?.id ?? '', name: '', email: '', password: '', pin: '', role: 'MANAGER' });
    setShowModal(true);
  };

  const openEdit = (u: PlatformUser) => {
    setEditing(u);
    setForm({ tenantId: u.tenant.id, name: u.name, email: u.email, password: '', pin: '', role: u.role });
    setShowModal(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (editing) {
        await api.put(`/saas/users/${editing.id}`, { name: form.name, email: form.email, role: form.role });
        setMsg({ ok: true, text: t.saasUserUpdated });
      } else {
        await api.post('/saas/users', {
          tenantId: form.tenantId,
          name: form.name,
          email: form.email,
          password: form.password || undefined,
          pin: form.pin || undefined,
          role: form.role,
        });
        setMsg({ ok: true, text: t.saasUserCreated });
      }
      setShowModal(false);
      load(filters);
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.saasCreateFailed });
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u: PlatformUser) => {
    setBusy(true);
    setMsg(null);
    try {
      await api.put(`/saas/users/${u.id}`, { isActive: !u.isActive });
      setMsg({ ok: true, text: t.saasSaved });
      load(filters);
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.saasUpdateFailed });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.delete(`/saas/users/${deleting.id}`);
      setMsg({ ok: true, text: t.saasUserDeleted });
      setDeleting(null);
      load(filters);
    } catch (err: any) {
      setMsg({
        ok: false,
        text: err.response?.data?.code === 'LAST_OWNER' ? t.saasLastOwner : err.response?.data?.message || t.saasDeleteFailed,
      });
    } finally {
      setBusy(false);
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
            <Users className="w-5 h-5 text-violet-600" /> {t.saasUsersNav}
            <span className="text-xs font-bold text-slate-400">({data?.total ?? 0})</span>
          </h2>
          <button onClick={openAdd} className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold rounded-xl px-4 py-2 text-xs shadow-md shadow-violet-500/25 transition-all">
            <Plus className="w-4 h-4" /> {t.saasAddUser}
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-200/80 flex flex-wrap items-center gap-3 bg-slate-50/60">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={searchInput} onChange={(e) => updateSearch(e.target.value)} placeholder={t.saasSearch} className={`${inputClass()} ltr:pl-9 rtl:pr-9`} />
          </div>
          <select value={filters.tenantId} onChange={(e) => setFilter({ tenantId: e.target.value })} className={inputClass('max-w-[180px]')}>
            <option value="">{t.saasAllTenants}</option>
            {tenants.map((tn) => (
              <option key={tn.id} value={tn.id}>{tn.name}</option>
            ))}
          </select>
          <select value={filters.role} onChange={(e) => setFilter({ role: e.target.value })} className={inputClass('max-w-[140px]')}>
            <option value="">{t.role}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{roleLabel(t, r)}</option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} className={inputClass('max-w-[130px]')}>
            <option value="all">{t.saasAll}</option>
            <option value="active">{t.active}</option>
            <option value="inactive">{t.inactive}</option>
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
                  <th className="px-6 py-3 font-bold text-start">{t.name}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.email}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasTenantCol}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.role}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasBranches}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasStatus}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasCreated}</th>
                  <th className="px-6 py-3 font-bold text-end">{t.saasActions}</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center font-black text-[10px]">
                          {u.name[0]?.toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500">{u.email}</td>
                    <td className="px-6 py-3">
                      <button onClick={() => onOpenDetail(u.tenant.id)} className="text-xs font-bold text-cyan-600 hover:underline">
                        {u.tenant.name}
                      </button>
                    </td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${u.role === 'OWNER' ? 'bg-amber-100 text-amber-700' : u.role === 'MANAGER' ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-600'}`}>
                        {roleLabel(t, u.role)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500">{u.branch?.name ?? '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {u.isActive ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500">{formatDate(language, u.createdAt)}</td>
                    <td className="px-6 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 transition-colors" title={t.edit}>
                          <UserRound className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => toggleActive(u)} disabled={busy} className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${u.isActive ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`} title={u.isActive ? t.saasSuspend : t.saasActivate}>
                          {u.isActive ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => setDeleting(u)} className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-colors" title={t.saasUserDeleted}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-extrabold text-slate-900">{editing ? t.edit : t.saasAddUser}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-4 text-xs">
              {!editing && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.saasSelectTenant} *</label>
                  <select required value={form.tenantId} onChange={(e) => setForm({ ...form, tenantId: e.target.value })} className={inputClass()}>
                    <option value="">{t.saasSelectTenant}</option>
                    {tenants.map((tn) => (
                      <option key={tn.id} value={tn.id}>{tn.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.name} *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass()} />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.email} *</label>
                <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass()} />
              </div>
              {!editing && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{t.password} *</label>
                    <input required type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass()} />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{t.saasUserPin}</label>
                    <input type="number" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} className={inputClass()} />
                  </div>
                </>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.role}</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass()}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{roleLabel(t, r)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  {t.cancel}
                </button>
                <button type="submit" disabled={busy} className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold rounded-xl px-4 py-2 text-xs disabled:opacity-60 transition-all">
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {editing ? t.save : t.saasAddUser}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" /> {t.saasUserDeleted}
            </h3>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">{translate(t.saasConfirmDeleteUser, { name: deleting.name })}</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setDeleting(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                {t.cancel}
              </button>
              <button onClick={confirmDelete} disabled={busy} className="inline-flex items-center gap-2 bg-red-600 text-white font-bold rounded-xl px-4 py-2 text-xs disabled:opacity-60 transition-all">
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t.saasUserDeleted}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
