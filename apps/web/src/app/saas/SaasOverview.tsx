import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore } from '../../stores/languageStore';
import type { Overview } from './types';
import type { TenantFilters } from './SaasTenants';
import { planLabel, subStatusLabel, formatMoney, CHART_COLORS } from './helpers';
import {
  Activity,
  Building2,
  CreditCard,
  DollarSign,
  Loader2,
  PauseCircle,
  PlayCircle,
  ShoppingCart,
  Store,
  TrendingUp,
  Users,
  AlarmClock,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const SUB_STATUS_KEYS = ['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED'];

interface Props {
  onOpenTenants?: (filters?: Partial<TenantFilters>) => void;
  onOpenUsers?: () => void;
  onOpenTenantDetail?: (tenantId: string) => void;
}

export const SaasOverview: React.FC<Props> = ({ onOpenTenants, onOpenUsers, onOpenTenantDetail }) => {
  const { t, language } = useLanguageStore();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get('/saas/overview')
      .then((res) => active && setOverview(res.data.data))
      .catch((err) => console.error('Failed to load SaaS overview:', err))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center text-slate-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t.saasLoading}
      </div>
    );
  }

  const o = overview as Overview;
  const planDistributionData = o.planDistribution.map((p) => ({
    name: planLabel(t, p.key),
    value: p.count,
  }));
  const statusData = SUB_STATUS_KEYS.map((key) => ({
    name: subStatusLabel(t, key),
    value: o.subscriptionsByStatus[key] ?? 0,
    color: key === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : key === 'TRIAL' ? 'bg-cyan-100 text-cyan-700' : key === 'PAST_DUE' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700',
  }));

  const kpiCards = [
    { label: t.saasTotalTenants, value: o.tenants, icon: Store, color: 'bg-cyan-50 text-cyan-600', target: onOpenTenants },
    { label: t.saasActiveTenants, value: o.activeTenants, icon: PlayCircle, color: 'bg-emerald-50 text-emerald-600', target: () => onOpenTenants?.({ status: 'active' }) },
    { label: t.saasSuspendedTenants, value: o.suspendedTenants, icon: PauseCircle, color: 'bg-rose-50 text-rose-600', target: () => onOpenTenants?.({ status: 'suspended' }) },
    { label: t.saasTotalUsers, value: o.users, icon: Users, color: 'bg-violet-50 text-violet-600', target: onOpenUsers },
    { label: t.saasTotalOrders, value: o.orders, icon: ShoppingCart, color: 'bg-blue-50 text-blue-600' },
    { label: t.saasTotalRevenue, value: formatMoney(language, o.revenue), icon: DollarSign, color: 'bg-amber-50 text-amber-600' },
    { label: t.saasTodayOrders, value: o.todayOrders, icon: Activity, color: 'bg-indigo-50 text-indigo-600' },
    { label: t.saasMRR, value: formatMoney(language, o.mrr), icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
  ];

  const smallCards = [
    { label: t.saasActiveSubscriptions, value: o.activeSubscriptions, icon: ShieldCheck, color: 'bg-emerald-50 text-emerald-600', target: () => onOpenTenants?.({ subStatus: 'ACTIVE' }) },
    { label: t.saasTrialTenants, value: o.trialTenants, icon: Sparkles, color: 'bg-cyan-50 text-cyan-600', target: () => onOpenTenants?.({ subStatus: 'TRIAL' }) },
    { label: t.saasExpiringSoon, value: o.expiringSoon, icon: AlarmClock, color: 'bg-amber-50 text-amber-600', target: () => onOpenTenants?.({ expiringSoon: true }) },
  ];

  const tooltipStyle = {
    borderRadius: 12,
    border: '1px solid #e2e8f0',
    fontSize: 12,
    fontWeight: 600,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          const inner = (
            <>
              <div className={`w-10 h-10 rounded-xl ${card.color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-extrabold text-slate-900">{card.value}</p>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">{card.label}</p>
            </>
          );
          const base = 'bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm w-full text-start';
          return card.target ? (
            <button
              key={card.label}
              onClick={() => (card.target as () => void)()}
              className={`${base} cursor-pointer hover:border-cyan-300 hover:shadow-md transition-all`}
            >
              {inner}
            </button>
          ) : (
            <div key={card.label} className={base}>
              {inner}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {smallCards.map((card) => {
          const Icon = card.icon;
          const inner = (
            <>
              <div className={`w-11 h-11 shrink-0 rounded-xl ${card.color} flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-extrabold text-slate-900">{card.value}</p>
                <p className="text-xs text-slate-500 font-semibold">{card.label}</p>
              </div>
            </>
          );
          const base = 'bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex items-center gap-4 w-full text-start';
          return card.target ? (
            <button
              key={card.label}
              onClick={() => (card.target as () => void)()}
              className={`${base} cursor-pointer hover:border-cyan-300 hover:shadow-md transition-all`}
            >
              {inner}
            </button>
          ) : (
            <div key={card.label} className={base}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* Revenue trend */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-600" /> {t.saasRevenueTrend}
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={o.revenueSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={42} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={2.5} fill="url(#revGrad)" name={t.saasTotalRevenue} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Orders + tenants */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-600" /> {t.saasOrdersTrend}
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={o.ordersSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={18} name={t.saasOrdersCount} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-violet-600" /> {t.saasNewTenantsTrend}
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={o.tenantSeries} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={18} name={t.saasTenants} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Plan distribution + subscription status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-cyan-600" /> {t.saasPlanDistribution}
          </h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planDistributionData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {planDistributionData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {planDistributionData.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-semibold text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  {p.name}
                </span>
                <span className="font-extrabold text-slate-800">{p.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> {t.saasSubStatusOverview}
          </h2>
          <div className="space-y-3">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${s.color}`}>{s.name}</span>
                <span className="text-xl font-extrabold text-slate-900">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-600" /> {t.saasTopTenants}
          </h2>
          {o.topTenants.length === 0 ? (
            <p className="text-xs text-slate-400">{t.noData}</p>
          ) : (
            <div className="space-y-3">
              {o.topTenants.map((tenant, i) => (
                <button
                  key={tenant.id}
                  onClick={() => onOpenTenantDetail?.(tenant.id)}
                  className="w-full flex items-center gap-3 text-start hover:bg-slate-50 rounded-xl px-2 py-1.5 -mx-2 transition-colors group"
                >
                  <span className="w-6 h-6 shrink-0 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-black">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-extrabold text-slate-800 truncate group-hover:text-cyan-600">{tenant.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {planLabel(t, tenant.plan)} · {tenant.slug}
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-slate-800">{formatMoney(language, tenant.revenue)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subscriptions by plan */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-cyan-600" /> {t.saasSubscriptions}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {o.plans.map((plan) => {
            const count = o.planDistribution.find((p) => p.key === plan.key)?.count ?? 0;
            return (
              <div key={plan.key} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500">{planLabel(t, plan.key)}</p>
                <p className="text-xl font-extrabold text-slate-900 mt-1">{count}</p>
                <p className="text-[10px] text-slate-400">
                  {formatMoney(language, plan.priceMonthly)} {t.saasPerMonth}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
