import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useLanguageStore } from '../../../stores/languageStore';
import { toQuery, ReportFilters } from './ReportFilters';
import { Flame, Wallet, Landmark, Layers } from 'lucide-react';
import { ReportExportButton } from './ReportExportButton';
import { expenseCategoryLabel, expenseCategoryIcon } from '../../pos/components/ExpensesModal';

export const ExpensesTab: React.FC<{ filters: ReportFilters }> = ({ filters }) => {
  const { t } = useLanguageStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/reports/expenses${toQuery(filters)}`)
      .then((res) => active && setData(res.data.data))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters]);

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">{t.loadingReports}</div>;
  if (!data) return <div className="py-12 text-center text-slate-400 text-sm">{t.noData}</div>;

  const rows = data.rows || [];
  const totals = data.totals || {};

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ReportExportButton reportKey="expenses" data={data} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-rose-500 to-orange-500 rounded-2xl p-5 text-white shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-100">{t.expTotalExpenses}</p>
            <h3 className="text-2xl font-black mt-1">{t.currency} {totals.totalExpenses?.toLocaleString?.() ?? totals.totalExpenses}</h3>
            <p className="text-xs font-semibold text-rose-100 mt-1">{totals.count ?? 0} {t.expCountCol}</p>
          </div>
          <Flame className="w-10 h-10 opacity-80" />
        </div>
        <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-violet-100">{t.expTotalWithdrawals}</p>
            <h3 className="text-2xl font-black mt-1">{t.currency} {totals.totalWithdrawals?.toLocaleString?.() ?? totals.totalWithdrawals}</h3>
            <p className="text-xs font-semibold text-violet-100 mt-1">{t.expWithdrawalLabel}</p>
          </div>
          <Wallet className="w-10 h-10 opacity-80" />
        </div>
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-100">{t.expNonCashTotal}</p>
            <h3 className="text-2xl font-black mt-1">{t.currency} {totals.nonCashExpenses?.toLocaleString?.() ?? totals.nonCashExpenses ?? 0}</h3>
            <p className="text-xs font-semibold text-emerald-100 mt-1">{t.paidFromCashOffHint}</p>
          </div>
          <Landmark className="w-10 h-10 opacity-80" />
        </div>
      </div>

      {(data.byCategory || []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-4">
            <Layers className="w-4 h-4 text-cyan-600" /> {t.expByCategory}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {(data.byCategory as any[]).map((c) => (
              <div key={c.category} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                  {expenseCategoryIcon(c.category, 'w-3.5 h-3.5 text-cyan-600')}
                  {expenseCategoryLabel(t, c.category)}
                </span>
                <p className="text-sm font-black text-slate-900 mt-1">{t.currency} {c.total.toLocaleString()}</p>
                <p className="text-[10px] font-semibold text-slate-400">{c.count} {t.expCountCol}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-xs min-w-[640px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
            <tr>
              <th className="px-6 py-4 text-left">{t.expDateCol}</th>
              <th className="px-6 py-4 text-left">{t.expCategoryCol}</th>
              <th className="px-6 py-4 text-left">{t.expDescCol}</th>
              <th className="px-6 py-4 text-left">{t.expPaidFromCol}</th>
              <th className="px-6 py-4 text-left">{t.expBranchCol}</th>
              <th className="px-6 py-4 text-left">{t.expCashierCol}</th>
              <th className="px-6 py-4 text-right">{t.expAmountCol}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r: any) => {
              const isWithdrawal = r.category === 'WITHDRAWAL';
              return (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-4 text-slate-600 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 font-bold ${isWithdrawal ? 'text-violet-700' : 'text-slate-800'}`}>
                      {expenseCategoryIcon(r.category, 'w-3.5 h-3.5')}
                      {expenseCategoryLabel(t, r.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600 max-w-[240px] truncate">{r.description || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold border ${r.paidFromCash !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {r.paidFromCash !== false ? t.cashBadge : t.nonCashBadge}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{r.branchName}</td>
                  <td className="px-6 py-4 text-slate-600">{r.cashier}</td>
                  <td className={`px-6 py-4 text-right font-extrabold ${isWithdrawal ? 'text-violet-600' : 'text-rose-600'}`}>
                    {t.currency} {Number(r.amount).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">{t.noExpensesYet}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
