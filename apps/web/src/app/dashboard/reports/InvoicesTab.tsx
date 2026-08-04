import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useLanguageStore } from '../../../stores/languageStore';
import { toQuery, ReportFilters } from './ReportFilters';
import { FileText, FileCheck2, FileX2, FileClock, Undo2, CircleOff } from 'lucide-react';
import { ReportExportButton } from './ReportExportButton';

export const InvoicesTab: React.FC<{ filters: ReportFilters }> = ({ filters }) => {
  const { t } = useLanguageStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/reports/invoices${toQuery(filters)}`)
      .then((res) => active && setData(res.data.data))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters]);

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">{t.loadingReports}</div>;
  if (!data) return <div className="py-12 text-center text-slate-400 text-sm">{t.noData}</div>;

  const cards = [
    { label: t.invoicesTotal, value: data.total, icon: <FileText className="w-5 h-5" />, color: 'bg-slate-50 text-slate-600 border-slate-200' },
    { label: t.invoicesTax, value: data.taxInvoices, icon: <FileCheck2 className="w-5 h-5" />, color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
    { label: t.invoicesSimplified, value: data.simplifiedInvoices, icon: <FileText className="w-5 h-5" />, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { label: t.invoicesCompleted, value: data.completed, icon: <FileCheck2 className="w-5 h-5" />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: t.invoicesCancelled, value: data.voided, icon: <FileX2 className="w-5 h-5" />, color: 'bg-rose-50 text-rose-600 border-rose-100' },
    { label: t.invoicesReturned, value: data.returned, icon: <Undo2 className="w-5 h-5" />, color: 'bg-orange-50 text-orange-600 border-orange-100' },
    { label: t.invoicesIncomplete, value: data.incomplete, icon: <FileClock className="w-5 h-5" />, color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { label: t.invoicesSuspended, value: data.suspended, icon: <CircleOff className="w-5 h-5" />, color: 'bg-violet-50 text-violet-600 border-violet-100' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ReportExportButton reportKey="invoices" data={data} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{c.label}</p>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${c.color}`}>{c.icon}</div>
            </div>
            <h3 className="text-2xl font-black text-slate-900">{c.value}</h3>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm max-w-2xl">
        <h3 className="text-base font-extrabold text-slate-900 mb-4">{t.invoicesValue}</h3>
        <div className="divide-y divide-slate-100">
          <div className="flex justify-between py-3 text-sm text-slate-600">
            <span>{t.invoicesValue}</span>
            <span className="font-bold">{t.currency} {data.totalValue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-3 text-sm text-slate-600">
            <span>{t.invoicesTaxValue}</span>
            <span className="font-bold">{t.currency} {data.totalTax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-3 text-sm text-slate-600">
            <span>{t.vatDiscounts}</span>
            <span className="font-bold">{t.currency} {data.totalDiscount.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
