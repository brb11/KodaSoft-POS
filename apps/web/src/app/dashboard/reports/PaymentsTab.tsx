import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useLanguageStore, paymentMethodLabel } from '../../../stores/languageStore';
import { toQuery, ReportFilters } from './ReportFilters';
import { Wallet, CreditCard, Banknote, Smartphone, Landmark } from 'lucide-react';
import { ReportExportButton } from './ReportExportButton';

function methodIcon(method: string, className: string) {
  switch (method) {
    case 'CASH': return <Banknote className={className} />;
    case 'BANK_TRANSFER': return <Landmark className={className} />;
    case 'APPLE_PAY':
    case 'STC_PAY': return <Smartphone className={className} />;
    default: return <CreditCard className={className} />;
  }
}

export const PaymentsTab: React.FC<{ filters: ReportFilters }> = ({ filters }) => {
  const { t } = useLanguageStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/reports/payments${toQuery(filters)}`)
      .then((res) => active && setData(res.data.data))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters]);

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">{t.loadingReports}</div>;
  if (!data) return <div className="py-12 text-center text-slate-400 text-sm">{t.noData}</div>;

  const rows = (data.rows || []).filter((r: any) => r.total > 0 || r.count > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ReportExportButton reportKey="payments" data={data} />
      </div>

      <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-100">{t.payGrandTotal}</p>
          <h3 className="text-3xl font-black mt-1">{t.currency} {data.grandTotal.toLocaleString()}</h3>
        </div>
        <Wallet className="w-10 h-10 opacity-80" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
            <tr>
              <th className="px-6 py-4 text-left">{t.payMethod}</th>
              <th className="px-6 py-4 text-right">{t.payCount}</th>
              <th className="px-6 py-4 text-right">{t.payAmount}</th>
              <th className="px-6 py-4 text-right">{t.payShare}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r: any) => (
              <tr key={r.method} className="hover:bg-slate-50/80">
                <td className="px-6 py-4">
                  <span className="flex items-center gap-2 font-bold text-slate-900">
                    {methodIcon(r.method, 'w-4 h-4 text-cyan-600')}
                    {paymentMethodLabel(r.method)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-semibold text-slate-600">{r.count}</td>
                <td className="px-6 py-4 text-right font-extrabold text-slate-900">{t.currency} {r.total.toLocaleString()}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-bold text-cyan-600">{r.pct}%</span>
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" style={{ width: `${Math.min(100, r.pct)}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">{t.noData}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
