import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useLanguageStore } from '../../../stores/languageStore';
import { toQuery, ReportFilters, formatDate } from './ReportFilters';
import { Clock, DollarSign, Wallet, TrendingUp, TrendingDown, Banknote, CreditCard, Undo2, Flame, ArrowUpRight } from 'lucide-react';
import { ReportExportButton } from './ReportExportButton';

export const ShiftsTab: React.FC<{ filters: ReportFilters }> = ({ filters }) => {
  const { t } = useLanguageStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/reports/shifts${toQuery(filters)}`)
      .then((res) => active && setData(res.data.data))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters]);

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">{t.loadingReports}</div>;
  if (!data) return <div className="py-12 text-center text-slate-400 text-sm">{t.noData}</div>;

  const rows = data.rows || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ReportExportButton reportKey="shifts" data={data} />
      </div>

      {rows.length === 0 && (
        <div className="py-12 text-center text-slate-400 text-sm">{t.noShifts}</div>
      )}

      {rows.map((s: any) => {
        const isClosed = s.status === 'CLOSED';
        const diff = s.difference;
        return (
          <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isClosed ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900">{s.cashier}</h3>
                  <p className="text-[11px] font-semibold text-slate-500">{s.branchName} · {formatDate(s.openedAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-lg text-[10px] font-extrabold border ${isClosed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  {isClosed ? t.shiftClosed : t.shiftOpen}
                </span>
                {s.orderCount > 0 && (
                  <span className="px-3 py-1 rounded-lg text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">{s.orderCount} {t.ordersCount}</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> {t.shiftOpeningCash}</p>
                <p className="text-lg font-black text-slate-900 mt-1">{t.currency} {s.openingCash}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> {t.shiftCashSales}</p>
                <p className="text-lg font-black text-slate-900 mt-1">{t.currency} {s.cashSales}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> {t.shiftCardSales}</p>
                <p className="text-lg font-black text-slate-900 mt-1">{t.currency} {s.cardSales}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> {t.shiftTotalSales}</p>
                <p className="text-lg font-black text-cyan-600 mt-1">{t.currency} {s.totalSales}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><Undo2 className="w-3.5 h-3.5" /> {t.shiftReturns}</p>
                <p className="text-lg font-black text-orange-600 mt-1">{t.currency} {s.refunds}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><Flame className="w-3.5 h-3.5" /> {t.shiftExpenses}</p>
                <p className="text-lg font-black text-rose-600 mt-1">{t.currency} {s.expenses}</p>
                {s.nonCashExpenses > 0 && (
                  <p className="text-[10px] font-bold text-amber-600 mt-0.5">
                    {t.nonCashNote}: {t.currency} {s.nonCashExpenses}
                  </p>
                )}
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><ArrowUpRight className="w-3.5 h-3.5" /> {t.shiftWithdrawals}</p>
                <p className="text-lg font-black text-violet-600 mt-1">{t.currency} {s.withdrawals}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> {t.shiftExpectedCash}</p>
                <p className="text-lg font-black text-slate-900 mt-1">{t.currency} {s.expectedCash ?? '-'}</p>
              </div>
            </div>

            {isClosed && (
              <div className={`mt-4 flex items-center justify-between rounded-xl border p-4 ${diff === null ? 'bg-slate-50 border-slate-100' : diff === 0 ? 'bg-emerald-50 border-emerald-100' : diff > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t.shiftDifference}</p>
                  <p className="text-xs font-semibold text-slate-500 mt-0.5">
                    {t.shiftClosingCash}: {s.closingCash !== null ? `${t.currency} ${s.closingCash}` : '-'}
                  </p>
                </div>
                {diff === null ? (
                  <span className="text-sm font-bold text-slate-400">{t.noData}</span>
                ) : (
                  <span className={`flex items-center gap-1.5 text-xl font-black ${diff === 0 ? 'text-emerald-600' : diff > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {diff > 0 ? <TrendingUp className="w-5 h-5" /> : diff < 0 ? <TrendingDown className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                    {diff > 0 ? '+' : ''}{t.currency} {diff}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
