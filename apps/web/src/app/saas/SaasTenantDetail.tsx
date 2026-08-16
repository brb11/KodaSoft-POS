import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore, translate } from '../../stores/languageStore';
import type { TenantDetail, TenantUser } from './types';
import { PLAN_ORDER, planLabel, subStatusLabel, roleLabel, formatMoney, formatDate, tenantStatusPillClass, subStatusPillClass, paymentStatusPillClass, inputClass } from './helpers';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  KeyRound,
  Loader2,
  PauseCircle,
  PlayCircle,
  Plus,
  Save,
  Store,
  Trash2,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react';

interface Props {
  tenantId: string;
  onBack: () => void;
}

const ROLES = ['OWNER', 'MANAGER', 'CASHIER'];

export const SaasTenantDetail: React.FC<Props> = ({ tenantId, onBack }) => {
  const { t, language } = useLanguageStore();
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Subscription form
  const [subForm, setSubForm] = useState({
    plan: 'starter',
    subscriptionStatus: 'TRIAL',
    autoRenew: true,
    billingCycle: 'monthly',
    periodStart: '',
    periodEnd: '',
    trialStarted: '',
    provider: '',
    extendTrialDays: '',
  });
  const [subSaving, setSubSaving] = useState(false);

  // User modals
  const [showUserModal, setShowUserModal] = useState<'add' | 'edit' | 'reset' | null>(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', pin: '', role: 'MANAGER' });
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<TenantUser | null>(null);
  const [userBusy, setUserBusy] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/saas/tenants/${tenantId}`);
      const d: TenantDetail = res.data.data;
      setDetail(d);
      setSubForm({
        plan: d.subscription?.plan ?? d.plan ?? 'starter',
        subscriptionStatus: d.subscription?.status ?? 'TRIAL',
        autoRenew: d.subscription?.autoRenew ?? true,
        billingCycle: d.subscription?.billingCycle ?? 'monthly',
        periodStart: d.subscription?.periodStart ? toDateInput(d.subscription.periodStart) : '',
        periodEnd: d.subscription?.periodEnd ? toDateInput(d.subscription.periodEnd) : '',
        trialStarted: d.subscription?.trialStarted ? toDateInput(d.subscription.trialStarted) : '',
        provider: d.subscription?.provider ?? '',
        extendTrialDays: '',
      });
    } catch (err) {
      console.error('Failed to load tenant detail:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const toDateInput = (iso: string) => {
    const d = new Date(iso);
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${d.getUTCFullYear()}-${mm}-${dd}`;
  };

  const saveSubscription = async () => {
    setSubSaving(true);
    setMsg(null);
    const toISO = (v: string) => (v ? new Date(v + 'T00:00:00Z').toISOString() : undefined);
    try {
      await api.put(`/saas/tenants/${tenantId}`, {
        plan: subForm.plan,
        subscriptionStatus: subForm.subscriptionStatus,
        autoRenew: subForm.autoRenew,
        billingCycle: subForm.billingCycle,
        periodStart: toISO(subForm.periodStart),
        periodEnd: subForm.periodEnd ? toISO(subForm.periodEnd) : null,
        trialStarted: toISO(subForm.trialStarted),
        provider: subForm.provider || undefined,
        extendTrialDays: subForm.extendTrialDays ? Number(subForm.extendTrialDays) : undefined,
      });
      setMsg({ ok: true, text: t.saasSaved });
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.saasUpdateFailed });
    } finally {
      setSubSaving(false);
    }
  };

  const toggleTenantActive = async () => {
    if (!detail) return;
    setMsg(null);
    try {
      await api.put(`/saas/tenants/${tenantId}`, { isActive: !detail.isActive });
      setMsg({ ok: true, text: t.saasSaved });
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.saasUpdateFailed });
    }
  };

  const submitUser = async () => {
    setUserBusy(true);
    setMsg(null);
    try {
      if (showUserModal === 'add') {
        await api.post('/saas/users', {
          tenantId,
          name: userForm.name,
          email: userForm.email,
          password: userForm.password || undefined,
          pin: userForm.pin || undefined,
          role: userForm.role,
        });
        setMsg({ ok: true, text: t.saasUserCreated });
      } else if (showUserModal === 'edit' && editingUser) {
        await api.put(`/saas/users/${editingUser.id}`, {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
        });
        setMsg({ ok: true, text: t.saasUserUpdated });
      }
      setShowUserModal(null);
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || (showUserModal === 'add' ? t.saasCreateFailed : t.saasUpdateFailed) });
    } finally {
      setUserBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!editingUser) return;
    setUserBusy(true);
    setMsg(null);
    try {
      await api.put(`/saas/users/${editingUser.id}`, { password: userForm.password });
      setMsg({ ok: true, text: t.saasSaved });
      setShowUserModal(null);
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.saasUpdateFailed });
    } finally {
      setUserBusy(false);
    }
  };

  const toggleUserActive = async (u: TenantUser) => {
    setUserBusy(true);
    setMsg(null);
    try {
      await api.put(`/saas/users/${u.id}`, { isActive: !u.isActive });
      setMsg({ ok: true, text: t.saasSaved });
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.saasUpdateFailed });
    } finally {
      setUserBusy(false);
    }
  };

  const deleteUser = async () => {
    if (!deletingUser) return;
    setUserBusy(true);
    setMsg(null);
    try {
      await api.delete(`/saas/users/${deletingUser.id}`);
      setMsg({ ok: true, text: t.saasUserDeleted });
      setDeletingUser(null);
      load();
    } catch (err: any) {
      setMsg({
        ok: false,
        text: err.response?.data?.code === 'LAST_OWNER' ? t.saasLastOwner : err.response?.data?.message || t.saasDeleteFailed,
      });
    } finally {
      setUserBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center text-slate-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t.saasLoading}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-10 text-center text-slate-400 text-sm">
        {t.noData}
        <div className="mt-4">
          <button onClick={onBack} className="inline-flex items-center gap-2 text-xs font-bold text-cyan-600 hover:underline">
            <ArrowRight className="w-4 h-4 rtl:rotate-180" /> {t.saasTenants}
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    { label: t.saasRevenue, value: formatMoney(language, detail.revenue), icon: CreditCard, color: 'bg-amber-50 text-amber-600' },
    { label: t.saasOrdersCount, value: detail.completedOrders, icon: Building2, color: 'bg-blue-50 text-blue-600' },
    { label: t.usersTitle, value: detail.counts.users, icon: Users, color: 'bg-violet-50 text-violet-600' },
    { label: t.saasBranches, value: detail.counts.branches, icon: Store, color: 'bg-cyan-50 text-cyan-600' },
    { label: t.saasProducts, value: detail.counts.products, icon: Building2, color: 'bg-emerald-50 text-emerald-600' },
    { label: t.saasCategories, value: detail.counts.categories, icon: Building2, color: 'bg-indigo-50 text-indigo-600' },
    { label: t.saasCustomers, value: detail.counts.customers, icon: Users, color: 'bg-rose-50 text-rose-600' },
  ];

  const openUserModal = (mode: 'add' | 'edit', u?: TenantUser) => {
    setEditingUser(u ?? null);
    setUserForm({
      name: u?.name ?? '',
      email: u?.email ?? '',
      password: '',
      pin: '',
      role: u?.role ?? 'MANAGER',
    });
    setShowUserModal(mode);
  };

  const openResetModal = (u: TenantUser) => {
    setEditingUser(u);
    setUserForm({ name: '', email: '', password: '', pin: '', role: u.role });
    setShowUserModal('reset');
  };

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-2 rounded-lg text-slate-500 hover:bg-white border border-slate-200 transition-colors" title={t.saasTenants}>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center font-black text-lg">
            {detail.name[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              {detail.name}
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${tenantStatusPillClass(detail.isActive, detail.subscription?.status)}`}>
                {detail.isActive ? subStatusLabel(t, detail.subscription?.status ?? 'ACTIVE') : t.inactive}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[10px] font-extrabold uppercase">
                {planLabel(t, detail.plan)}
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-semibold">casheer.app/{detail.slug} · {formatDate(language, detail.createdAt)}</p>
          </div>
        </div>
        <button
          onClick={toggleTenantActive}
          className={`inline-flex items-center gap-2 font-bold rounded-xl px-4 py-2 text-xs transition-all ${
            detail.isActive
              ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          {detail.isActive ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
          {detail.isActive ? t.saasSuspend : t.saasActivate}
        </button>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${msg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm">
              <div className={`w-8 h-8 rounded-lg ${card.color} flex items-center justify-center mb-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-base font-extrabold text-slate-900">{card.value}</p>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription manager */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900 mb-5 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-cyan-600" /> {t.saasSubscription}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">{t.saasPlan}</label>
              <select value={subForm.plan} onChange={(e) => setSubForm({ ...subForm, plan: e.target.value })} className={inputClass()}>
                {PLAN_ORDER.map((key) => (
                  <option key={key} value={key}>{planLabel(t, key)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">{t.saasSubscriptionStatus}</label>
              <select value={subForm.subscriptionStatus} onChange={(e) => setSubForm({ ...subForm, subscriptionStatus: e.target.value })} className={inputClass()}>
                {['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED'].map((s) => (
                  <option key={s} value={s}>{subStatusLabel(t, s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">{t.saasBillingCycle}</label>
              <select value={subForm.billingCycle} onChange={(e) => setSubForm({ ...subForm, billingCycle: e.target.value })} className={inputClass()}>
                <option value="monthly">{t.saasMonthly}</option>
                <option value="yearly">{t.saasYearly}</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">{t.saasProvider}</label>
              <input value={subForm.provider} onChange={(e) => setSubForm({ ...subForm, provider: e.target.value })} placeholder="stripe / tamara / manual" className={inputClass()} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">{t.saasPeriodStart}</label>
              <input type="date" value={subForm.periodStart} onChange={(e) => setSubForm({ ...subForm, periodStart: e.target.value })} className={inputClass()} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">{t.saasPeriodEnd}</label>
              <input type="date" value={subForm.periodEnd} onChange={(e) => setSubForm({ ...subForm, periodEnd: e.target.value })} className={inputClass()} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">{t.saasTrialStarted}</label>
              <input type="date" value={subForm.trialStarted} onChange={(e) => setSubForm({ ...subForm, trialStarted: e.target.value })} className={inputClass()} />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">{t.saasExtendTrial}</label>
              <input type="number" min={0} value={subForm.extendTrialDays} onChange={(e) => setSubForm({ ...subForm, extendTrialDays: e.target.value })} placeholder={t.saasExtend} className={inputClass()} />
            </div>
          </div>
          <label className="mt-4 inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={subForm.autoRenew}
              onChange={(e) => setSubForm({ ...subForm, autoRenew: e.target.checked })}
              className="w-4 h-4 rounded accent-cyan-600"
            />
            <span className="text-xs font-bold text-slate-700">{t.saasAutoRenew}</span>
          </label>
          <div className="mt-5">
            <button
              onClick={saveSubscription}
              disabled={subSaving}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl px-5 py-2.5 text-xs shadow-md shadow-cyan-500/25 disabled:opacity-60 transition-all"
            >
              {subSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t.saasSaveChanges}
            </button>
          </div>
        </div>

        {/* Recent orders */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-600" /> {t.saasRecentOrders}
          </h2>
          {detail.recentOrders.length === 0 ? (
            <p className="text-xs text-slate-400">{t.noData}</p>
          ) : (
            <div className="space-y-2.5">
              {detail.recentOrders.map((o) => (
                <div key={o.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{o.orderNumber}</p>
                    <p className="text-[10px] text-slate-400">{o.branch?.name} · {formatDate(language, o.createdAt)}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-xs font-extrabold text-slate-800">{formatMoney(language, o.total)}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${o.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : o.status === 'CANCELED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                      {o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Users */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-600" /> {t.usersTitle}
            <span className="text-xs font-bold text-slate-400">({detail.users.length})</span>
          </h2>
          <button onClick={() => openUserModal('add')} className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold rounded-xl px-3.5 py-2 text-xs shadow-md shadow-violet-500/25 transition-all">
            <Plus className="w-3.5 h-3.5" /> {t.saasAddUser}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-[10px] uppercase text-slate-400 border-b border-slate-200/80 bg-slate-50/60">
                <th className="px-6 py-3 font-bold text-start">{t.name}</th>
                <th className="px-6 py-3 font-bold text-start">{t.email}</th>
                <th className="px-6 py-3 font-bold text-start">{t.role}</th>
                <th className="px-6 py-3 font-bold text-start">{t.saasBranches}</th>
                <th className="px-6 py-3 font-bold text-start">{t.saasStatus}</th>
                <th className="px-6 py-3 font-bold text-start">{t.saasCreated}</th>
                  <th className="px-6 py-3 font-bold text-end">{t.saasActions}</th>
              </tr>
            </thead>
            <tbody>
              {detail.users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center font-black text-[10px]">
                        {u.name[0]?.toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-xs">{u.email}</td>
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
                      <button onClick={() => openUserModal('edit', u)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 transition-colors" title={t.edit}>
                        <UserRound className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openResetModal(u)} className="p-1.5 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-700 transition-colors" title={t.saasResetPassword}>
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleUserActive(u)} disabled={userBusy} className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${u.isActive ? 'text-rose-500 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`} title={u.isActive ? t.saasSuspend : t.saasActivate}>
                        {u.isActive ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setDeletingUser(u)} className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 transition-colors" title={t.saasDeleteTenant}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Branches */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-cyan-600" /> {t.saasBranches}
            <span className="text-xs font-bold text-slate-400">({detail.branches.length})</span>
          </h2>
        </div>
        {detail.branches.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">{t.noData}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {detail.branches.map((b) => {
              const open = expanded[b.id];
              return (
                <div key={b.id}>
                  <button onClick={() => toggleExpand(b.id)} className="w-full px-6 py-4 flex items-center gap-3 hover:bg-slate-50/60 text-start">
                    <div className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-700 flex items-center justify-center">
                      <Store className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        {b.name}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${b.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {b.isActive ? t.active : t.inactive}
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {b.address || '—'} {b.phone ? `· ${b.phone}` : ''}
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="text-[10px] text-slate-400 font-semibold">{t.saasOrdersCount}</p>
                      <p className="text-sm font-extrabold text-slate-800">{b._count?.orders ?? 0}</p>
                    </div>
                    {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {open && (
                    <div className="px-16 pb-4 text-xs text-slate-500 space-y-1">
                      <p><span className="font-bold text-slate-700">{t.saasBranchAddress}:</span> {b.address || '—'}</p>
                      <p><span className="font-bold text-slate-700">{t.saasPhone}:</span> {b.phone || '—'}</p>
                      <p><span className="font-bold text-slate-700">{t.saasCreated}:</span> {formatDate(language, b.createdAt)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payments */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200/80">
          <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-amber-600" /> {t.saasPayments}
            <span className="text-xs font-bold text-slate-400">({detail.payments.length})</span>
          </h2>
        </div>
        {detail.payments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">{t.noData}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-[10px] uppercase text-slate-400 border-b border-slate-200/80 bg-slate-50/60">
                  <th className="px-6 py-3 font-bold text-start">{t.saasPlan}</th>
                  <th className="px-6 py-3 font-bold text-end">{t.saasPaymentAmount}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasPaymentMode}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasPaymentStatus}</th>
                  <th className="px-6 py-3 font-bold text-start">{t.saasPaymentDate}</th>
                </tr>
              </thead>
              <tbody>
                {detail.payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-6 py-3">
                      <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[10px] font-extrabold uppercase">{planLabel(t, p.plan)}</span>
                    </td>
                    <td className="px-6 py-3 text-end font-bold text-slate-800">{formatMoney(language, p.amount)}</td>
                    <td className="px-6 py-3 text-xs text-slate-500 uppercase">{p.mode || p.provider || '—'}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${paymentStatusPillClass(p.status)}`}>
                        {p.status === 'PAID' ? t.saasPaid : p.status === 'PENDING' ? t.saasPending : p.status === 'FAILED' ? t.saasFailed : t.saasCanceledPay}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500">{formatDate(language, p.paidAt ?? p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-extrabold text-slate-900">
                {showUserModal === 'add' ? t.saasAddUser : showUserModal === 'edit' ? t.edit : t.saasResetPassword}
              </h3>
              <button onClick={() => setShowUserModal(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                showUserModal === 'reset' ? resetPassword() : submitUser();
              }}
              className="space-y-4 text-xs"
            >
              {showUserModal === 'reset' ? (
                <>
                  <p className="text-slate-500">{translate(t.saasResetPasswordFor, { name: editingUser?.name ?? '' })}</p>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{t.password} *</label>
                    <input required type="password" minLength={8} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className={inputClass()} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{t.name} *</label>
                    <input required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className={inputClass()} />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{t.email} *</label>
                    <input required type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} className={inputClass()} />
                  </div>
                  {showUserModal === 'add' && (
                    <>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">{t.password} *</label>
                        <input required type="password" minLength={8} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className={inputClass()} />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">{t.saasUserPin}</label>
                        <input type="number" value={userForm.pin} onChange={(e) => setUserForm({ ...userForm, pin: e.target.value })} className={inputClass()} />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{t.role}</label>
                    <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className={inputClass()}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{roleLabel(t, r)}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowUserModal(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  {t.cancel}
                </button>
                <button type="submit" disabled={userBusy} className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold rounded-xl px-4 py-2 text-xs disabled:opacity-60 transition-all">
                  {userBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {showUserModal === 'reset' ? t.saasSaveChanges : showUserModal === 'add' ? t.saasAddUser : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete user confirm */}
      {deletingUser && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600" /> {t.saasUserDeleted}
            </h3>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">{translate(t.saasConfirmDeleteUser, { name: deletingUser.name })}</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={() => setDeletingUser(null)} className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                {t.cancel}
              </button>
              <button onClick={deleteUser} disabled={userBusy} className="inline-flex items-center gap-2 bg-red-600 text-white font-bold rounded-xl px-4 py-2 text-xs disabled:opacity-60 transition-all">
                {userBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t.saasUserDeleted}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
