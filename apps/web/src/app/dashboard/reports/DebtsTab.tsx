import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useLanguageStore } from '../../../stores/languageStore';
import { toQuery, ReportFilters } from './ReportFilters';
import { Wallet, AlertTriangle, HandCoins, CheckCircle2 } from 'lucide-react';
import { ReportExportButton } from './ReportExportButton';

export const DebtsTab: React.FC<{ filters: ReportFilters }> = ({ filters }) => {
  const { t } = useLanguageStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/reports/debts${toQuery(filters)}`)
      .then((res) => active && setData(res.data.data))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters]);

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">{t.loadingReports}</div>;
  if (!data) return <div className="py-12 text-center text-slate-400 text-sm">{t.noData}</div>;

  const rows = data.rows || [];
  const totals = data.totals || {};
  const settlements = data.settlements || { count: 0, total: 0 };

  const agingHead = [
    t.agingCurrent, t.aging30, t.aging60, t.aging90,
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ReportExportButton reportKey="debts" data={data} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-100">{t.totalReceivables}</p>
            <h3 className="text-3xl font-black mt-1">{t.currency} {totals.totalReceivables?.toLocaleString()}</h3>
          </div>
          <Wallet className="w-10 h-10 opacity-80" />
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-100">{t.totalOverdue}</p>
            <h3 className="text-3xl font-black mt-1">{t.currency} {totals.totalOverdue?.toLocaleString()}</h3>
          </div>
          <AlertTriangle className="w-10 h-10 opacity-80" />
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">{t.debtsSettlements}</p>
            <h3 className="text-3xl font-black mt-1">{t.currency} {settlements.total?.toLocaleString()}</h3>
            <p className="text-xs font-bold opacity-80 mt-1">{settlements.count} {t.settlementsCount}</p>
          </div>
          <CheckCircle2 className="w-10 h-10 opacity-80" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2 bg-slate-50/50">
          <HandCoins className="w-4 h-4 text-cyan-600" />
          <h3 className="text-sm font-extrabold text-slate-800">{t.reportDebts}</h3>
        </div>
        <table className="w-full text-xs min-w-[720px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
            <tr>
              <th className="px-6 py-4 text-left">{t.customerName}</th>
              <th className="px-6 py-4 text-right">{t.debtBalance}</th>
              <th className="px-6 py-4 text-right">{t.creditLimitCol}</th>
              {agingHead.map((h) => (
                <th key={h} className="px-6 py-4 text-right">{h}</th>
              ))}
              <th className="px-6 py-4 text-right">{t.overdue}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r: any) => (
              <tr key={r.id} className="hover:bg-slate-50/80">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{r.name}</div>
                  {r.phone && <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{r.phone}</div>}
                </td>
                <td className="px-6 py-4 text-right font-extrabold text-slate-900">{t.currency} {r.balance.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-slate-500">{r.creditLimit != null ? `${t.currency} ${r.creditLimit.toFixed(2)}` : '—'}</td>
                <td className="px-6 py-4 text-right text-slate-600">{r.aging.current.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-slate-600">{r.aging.d30.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-slate-600">{r.aging.d60.toFixed(2)}</td>
                <td className="px-6 py-4 text-right text-slate-600">{r.aging.d90.toFixed(2)}</td>
                <td className="px-6 py-4 text-right font-extrabold text-rose-600">{t.currency} {r.overdue.toFixed(2)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400">{t.noDebts}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
