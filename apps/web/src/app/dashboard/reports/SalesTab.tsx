import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useLanguageStore, localizedName } from '../../../stores/languageStore';
import { toQuery, ReportFilters } from './ReportFilters';
import { CircleDollarSign, ReceiptText, ShoppingBag, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ReportExportButton } from './ReportExportButton';

interface GroupOption {
  value: string;
  label: string;
}

const GROUP_OPTIONS = ['', 'branch', 'cashier', 'customer', 'product', 'category', 'payment'];

function groupLabel(t: any, value: string): string {
  switch (value) {
    case '': return t.groupNone;
    case 'branch': return t.groupBranch;
    case 'cashier': return t.groupCashier;
    case 'customer': return t.groupCustomer;
    case 'product': return t.groupProduct;
    case 'category': return t.groupCategory;
    case 'payment': return t.groupPayment;
    default: return value;
  }
}

export const SalesTab: React.FC<{ filters: ReportFilters }> = ({ filters }) => {
  const { t } = useLanguageStore();
  const [data, setData] = useState<any>(null);
  const [groupBy, setGroupBy] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/reports/sales${toQuery(filters, { groupBy })}`)
      .then((res) => active && setData(res.data.data))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters, groupBy]);

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">{t.loadingReports}</div>;
  if (!data) return <div className="py-12 text-center text-slate-400 text-sm">{t.noData}</div>;

  const s = data.summary;

  const kpis = [
    { label: t.totalRevenue, value: s.revenue, icon: <CircleDollarSign className="w-5 h-5" />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: t.ordersCount, value: s.orders, icon: <ReceiptText className="w-5 h-5" />, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { label: t.itemsSold, value: s.items, icon: <ShoppingBag className="w-5 h-5" />, color: 'bg-orange-50 text-orange-600 border-orange-100' },
    { label: t.avgOrderValue, value: s.avgOrderValue, icon: <Wallet className="w-5 h-5" />, color: 'bg-violet-50 text-violet-600 border-violet-100', currency: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {GROUP_OPTIONS.map((g) => (
            <button
              key={g}
              onClick={() => setGroupBy(g)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${groupBy === g ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-transparent shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {groupLabel(t, g)}
            </button>
          ))}
        </div>
        <ReportExportButton reportKey="sales" data={data} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{k.label}</p>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${k.color}`}>{k.icon}</div>
            </div>
            <h3 className="text-2xl font-black text-slate-900">
              {k.currency ? `${t.currency} ` : ''}{k.value?.toLocaleString?.() ?? k.value}
            </h3>
          </div>
        ))}
      </div>

      {groupBy ? (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-4 text-left">{groupLabel(t, groupBy)}</th>
                <th className="px-6 py-4 text-right">{t.ordersCount}</th>
                <th className="px-6 py-4 text-right">{t.itemsSold}</th>
                <th className="px-6 py-4 text-right">{t.totalRevenue}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.breakdown || []).map((r: any, i: number) => (
                <tr key={i} className="hover:bg-slate-50/80">
                  <td className="px-6 py-3.5 font-bold text-slate-900">{r.name === 'Walk-in' ? t.walkInCustomer : localizedName(r.name, r.nameAr)}</td>
                  <td className="px-6 py-3.5 text-right text-slate-600 font-semibold">{r.orders}</td>
                  <td className="px-6 py-3.5 text-right text-slate-600 font-semibold">{r.items}</td>
                  <td className="px-6 py-3.5 text-right font-extrabold text-cyan-600">{t.currency} {r.revenue.toFixed(2)}</td>
                </tr>
              ))}
              {(!data.breakdown || data.breakdown.length === 0) && (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">{t.noData}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-base font-extrabold text-slate-900 mb-4">{t.revenueOverPeriod}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#0F172A', marginBottom: '8px' }}
                />
                <Bar dataKey="revenue" fill="#06B6D4" radius={[6, 6, 0, 0]} name={`${t.currency} ${t.revenue}`} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
