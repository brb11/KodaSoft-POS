import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useLanguageStore } from '../../stores/languageStore';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import {
  Building2,
  LayoutDashboard,
  Store,
  LogOut,
  Users,
  ShoppingCart,
  DollarSign,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
  ArrowLeft,
  TrendingUp,
  Activity,
  Loader2,
} from 'lucide-react';

interface Overview {
  tenants: number;
  activeTenants: number;
  suspendedTenants: number;
  users: number;
  orders: number;
  revenue: number;
  todayOrders: number;
  todayRevenue: number;
  mrr: number;
  subscriptionsByStatus: Record<string, number>;
  plans: { key: string; name: string; priceMonthly: number }[];
}

interface TenantRow {
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
  subscription: { plan: string; status: string; periodEnd: string | null; autoRenew: boolean; provider: string } | null;
}

interface TenantDetail extends Omit<TenantRow, 'users'> {
  users: { id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string }[];
  products: number;
  categories: number;
  customers: number;
  completedOrders: number;
  recentOrders: { id: string; orderNumber: string; status: string; total: number; createdAt: string; branch: { name: string } }[];
}

const PLAN_ORDER = ['starter', 'pro', 'enterprise'];

export const SaasConsole: React.FC = () => {
  const [view, setView] = useState<'overview' | 'tenants'>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selected, setSelected] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t, language } = useLanguageStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadOverview();
    loadTenants();
  }, []);

  const loadOverview = async () => {
    try {
      const res = await api.get('/saas/overview');
      setOverview(res.data.data);
    } catch (err) {
      console.error('Failed to load SaaS overview:', err);
    }
  };

  const loadTenants = async () => {
    try {
      setLoading(true);
      const res = await api.get('/saas/tenants');
      setTenants(res.data.data);
    } catch (err) {
      console.error('Failed to load tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (tenantId: string) => {
    try {
      const res = await api.get(`/saas/tenants/${tenantId}`);
      setSelected(res.data.data);
    } catch (err) {
      console.error('Failed to load tenant detail:', err);
    }
  };

  const updateTenant = async (tenantId: string, body: Record<string, any>) => {
    setUpdating(tenantId);
    setNotice('');
    try {
      await api.put(`/saas/tenants/${tenantId}`, body);
      setNotice(t.saasUpdated);
      await Promise.all([loadTenants(), loadOverview()]);
      if (selected?.id === tenantId) openDetail(tenantId);
    } catch (err: any) {
      setNotice(err.response?.data?.message || t.saasUpdateFailed);
    } finally {
      setUpdating(null);
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

  const formatMoney = (n: number | string) =>
    new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      maximumFractionDigits: 0,
    }).format(Number(n));

  const formatDate = (d: string) =>
    new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'medium' }).format(new Date(d));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const kpiCards = [
    { label: t.saasTotalTenants, value: overview?.tenants ?? '—', icon: Store, color: 'bg-cyan-50 text-cyan-600' },
    { label: t.saasActiveTenants, value: overview?.activeTenants ?? '—', icon: PlayCircle, color: 'bg-emerald-50 text-emerald-600' },
    { label: t.saasSuspendedTenants, value: overview?.suspendedTenants ?? '—', icon: PauseCircle, color: 'bg-rose-50 text-rose-600' },
    { label: t.saasTotalUsers, value: overview?.users ?? '—', icon: Users, color: 'bg-violet-50 text-violet-600' },
    { label: t.saasTotalOrders, value: overview?.orders ?? '—', icon: ShoppingCart, color: 'bg-blue-50 text-blue-600' },
    { label: t.saasTotalRevenue, value: overview ? formatMoney(overview.revenue) : '—', icon: DollarSign, color: 'bg-amber-50 text-amber-600' },
    { label: t.saasTodayOrders, value: overview?.todayOrders ?? '—', icon: Activity, color: 'bg-indigo-50 text-indigo-600' },
    { label: t.saasMRR, value: overview ? formatMoney(overview.mrr) : '—', icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col justify-between shadow-xl">
        <div>
          <div className="p-6 border-b border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-tight">
                KodaSoft-<span className="text-cyan-400">POS</span>
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{t.saasConsole}</p>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setView('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                view === 'overview' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> {t.saasOverview}
            </button>
            <button
              onClick={() => setView('tenants')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                view === 'tenants' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <Building2 className="w-4 h-4" /> {t.saasTenants}
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black text-xs">
                {user?.name?.[0] || 'S'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold truncate">{user?.name}</p>
                <p className="text-[10px] text-cyan-400 uppercase font-extrabold">SUPER ADMIN</p>
              </div>
            </div>
            <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-xl transition-colors" title={t.saasLogout}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-slate-200/80 px-8 py-3.5 flex items-center justify-between shadow-xs">
          <span className="text-xs font-extrabold text-slate-500 tracking-wider">{t.saasConsole}</span>
          <LanguageSwitcher />
        </header>

        <div className="p-8 flex-1">
          {notice && (
            <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-medium">
              {notice}
            </div>
          )}

          {view === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
                      <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <p className="text-2xl font-extrabold text-slate-900">{card.value}</p>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">{card.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
                <h2 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-600" /> {t.saasSubscriptions}
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {(overview?.plans ?? []).map((plan) => {
                    const count = overview?.subscriptionsByStatus[plan.key] ?? 0;
                    return (
                      <div key={plan.key} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-xs font-bold text-slate-500">{planLabel(plan.key)}</p>
                        <p className="text-xl font-extrabold text-slate-900 mt-1">{count}</p>
                        <p className="text-[10px] text-slate-400">
                          {formatMoney(plan.priceMonthly)} {t.saasPerMonth}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {view === 'tenants' && (
            <div className="space-y-6">
              {selected ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/60">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setSelected(null)} className="p-2 rounded-xl text-slate-500 hover:bg-slate-200/70 transition-colors" title={t.saasBack}>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <h2 className="text-lg font-extrabold text-slate-900">{selected.name}</h2>
                        <p className="text-xs text-slate-500">casheer.app/{selected.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        selected.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {selected.isActive ? t.active : t.inactive}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[10px] font-extrabold uppercase">
                        {planLabel(selected.plan)}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{t.saasRevenue}</p>
                      <p className="text-lg font-extrabold text-slate-900 mt-1">{formatMoney(selected.revenue)}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{t.saasOrdersCount}</p>
                      <p className="text-lg font-extrabold text-slate-900 mt-1">{selected.orders}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{t.saasUsers}</p>
                      <p className="text-lg font-extrabold text-slate-900 mt-1">{selected.users.length}</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{t.saasMemberSince}</p>
                      <p className="text-sm font-extrabold text-slate-900 mt-1">{formatDate(selected.createdAt)}</p>
                    </div>
                  </div>

                  <div className="px-6 py-5 border-t border-slate-200/80 space-y-5">
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">{t.saasPlan}</label>
                        <select
                          value={selected.plan}
                          onChange={(e) => {
                            const plan = e.target.value;
                            setSelected({ ...selected, plan });
                            updateTenant(selected.id, { plan });
                          }}
                          disabled={updating === selected.id}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                        >
                          {PLAN_ORDER.map((key) => (
                            <option key={key} value={key}>{planLabel(key)}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => updateTenant(selected.id, { isActive: !selected.isActive })}
                        disabled={updating === selected.id}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 ${
                          selected.isActive
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {selected.isActive ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                        {selected.isActive ? t.saasSuspend : t.saasActivate}
                      </button>
                      {selected.subscription && (
                        <div className="text-xs text-slate-500 font-semibold">
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-extrabold">
                            {statusLabel(selected.subscription.status)}
                          </span>
                          {selected.subscription.periodEnd && (
                            <span className="ml-2">· {formatDate(selected.subscription.periodEnd)}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xs font-extrabold text-slate-900 mb-3">{t.saasRecentOrders}</h3>
                      {selected.recentOrders.length === 0 ? (
                        <p className="text-xs text-slate-400">{t.noData}</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-200/80">
                                <th className="pb-2 font-bold">{t.orderNumber}</th>
                                <th className="pb-2 font-bold">{t.branch}</th>
                                <th className="pb-2 font-bold">{t.status}</th>
                                <th className="pb-2 font-bold">{t.orderDate}</th>
                                <th className="pb-2 font-bold text-right">{t.orderTotal}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selected.recentOrders.map((o) => (
                                <tr key={o.id} className="border-b border-slate-100">
                                  <td className="py-2.5 font-bold text-slate-700">#{o.orderNumber}</td>
                                  <td className="py-2.5 text-slate-500">{o.branch?.name}</td>
                                  <td className="py-2.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                      o.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : o.status === 'VOIDED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      {o.status}
                                    </span>
                                  </td>
                                  <td className="py-2.5 text-slate-500">{formatDate(o.createdAt)}</td>
                                  <td className="py-2.5 text-right font-bold text-slate-800">{formatMoney(o.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200/80">
                    <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-cyan-600" /> {t.saasTenants}
                      <span className="text-xs font-bold text-slate-400">({tenants.length})</span>
                    </h2>
                  </div>
                  {loading ? (
                    <div className="p-10 flex items-center justify-center text-slate-400 text-sm">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t.saasLoading}
                    </div>
                  ) : tenants.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-sm">{t.saasNoTenants}</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[10px] uppercase text-slate-400 border-b border-slate-200/80 bg-slate-50/60">
                            <th className="px-6 py-3 font-bold">{t.saasTenant}</th>
                            <th className="px-6 py-3 font-bold">{t.saasPlan}</th>
                            <th className="px-6 py-3 font-bold">{t.saasStatus}</th>
                            <th className="px-6 py-3 font-bold">{t.saasUsers}</th>
                            <th className="px-6 py-3 font-bold">{t.saasBranches}</th>
                            <th className="px-6 py-3 font-bold">{t.saasOrdersCount}</th>
                            <th className="px-6 py-3 font-bold text-right">{t.saasRevenue}</th>
                            <th className="px-6 py-3 font-bold">{t.saasCreated}</th>
                            <th className="px-6 py-3 font-bold text-right">{t.saasActions}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tenants.map((tenant) => (
                            <tr key={tenant.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                              <td className="px-6 py-3">
                                <button onClick={() => openDetail(tenant.id)} className="flex items-center gap-3 text-left group">
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
                                  {planLabel(tenant.plan)}
                                </span>
                              </td>
                              <td className="px-6 py-3">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                  !tenant.isActive
                                    ? 'bg-rose-100 text-rose-700'
                                    : tenant.subscription?.status === 'PAST_DUE'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {tenant.isActive ? statusLabel(tenant.subscription?.status ?? 'ACTIVE') : t.inactive}
                                </span>
                              </td>
                              <td className="px-6 py-3 text-slate-600">{tenant.users}</td>
                              <td className="px-6 py-3 text-slate-600">{tenant.branches}</td>
                              <td className="px-6 py-3 text-slate-600">{tenant.orders}</td>
                              <td className="px-6 py-3 text-right font-bold text-slate-800">{formatMoney(tenant.revenue)}</td>
                              <td className="px-6 py-3 text-slate-500 text-xs">{formatDate(tenant.createdAt)}</td>
                              <td className="px-6 py-3">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => openDetail(tenant.id)}
                                    className="p-2 rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 transition-colors"
                                    title={t.saasDetail}
                                  >
                                    <Store className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => updateTenant(tenant.id, { isActive: !tenant.isActive })}
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
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
