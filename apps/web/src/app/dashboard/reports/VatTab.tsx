import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useLanguageStore } from '../../../stores/languageStore';
import { toQuery, ReportFilters } from './ReportFilters';
import { ReceiptText, Percent, BadgePercent, ArrowDownLeft, ShieldCheck } from 'lucide-react';
import { ReportExportButton } from './ReportExportButton';

export const VatTab: React.FC<{ filters: ReportFilters }> = ({ filters }) => {
  const { t } = useLanguageStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/reports/vat${toQuery(filters)}`)
      .then((res) => active && setData(res.data.data))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters]);

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">{t.loadingReports}</div>;
  if (!data) return <div className="py-12 text-center text-slate-400 text-sm">{t.noData}</div>;

  const kpis = [
    { label: t.vatBeforeTax, value: data.totalBeforeTax, icon: <ReceiptText className="w-5 h-5" />, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { label: t.vatCollected, value: data.totalVat, icon: <Percent className="w-5 h-5" />, color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
    { label: t.vatAfterTax, value: data.totalAfterTax, icon: <ShieldCheck className="w-5 h-5" />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: t.vatNetDue, value: data.netVatDue, icon: <BadgePercent className="w-5 h-5" />, color: 'bg-violet-50 text-violet-600 border-violet-100' },
  ];

  const rows = [
    { label: t.vatBeforeTax, value: data.totalBeforeTax },
    { label: t.vatDiscounts, value: data.totalDiscount },
    { label: t.vatCollected, value: data.totalVat },
    { label: t.vatAfterTax, value: data.totalAfterTax },
    { label: t.vatOnDiscounts, value: data.taxOnDiscounts },
    { label: t.vatReturnsSubtotal, value: data.returnsSubtotal },
    { label: t.vatReturns, value: data.returnsTotal },
    { label: t.vatReturnsTax, value: data.returnsVat },
    { label: t.vatNetDue, value: data.netVatDue, highlight: true },
    { label: t.vatEffectiveRate, value: `${data.effectiveRate}%`, isText: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ReportExportButton reportKey="vat" data={data} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{k.label}</p>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${k.color}`}>{k.icon}</div>
            </div>
            <h3 className="text-2xl font-black text-slate-900">{t.currency} {k.value.toLocaleString()}</h3>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-2xl">
        <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
          <ArrowDownLeft className="w-4 h-4 text-cyan-600" /> {t.reportVat}
        </h3>
        <div className="divide-y divide-slate-100">
          {rows.map((r, i) => (
            <div key={i} className={`flex justify-between py-3 text-sm ${r.highlight ? 'font-extrabold text-slate-900' : 'text-slate-600'}`}>
              <span>{r.label}</span>
              <span className={r.highlight ? 'text-cyan-600' : 'font-bold'}>{r.isText ? r.value : `${t.currency} ${r.value.toLocaleString()}`}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
