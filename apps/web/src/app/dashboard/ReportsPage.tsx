import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore } from '../../stores/languageStore';
import { ReportFilters } from './reports/ReportFilters';
import { SalesTab } from './reports/SalesTab';
import { VatTab } from './reports/VatTab';
import { InvoicesTab } from './reports/InvoicesTab';
import { PaymentsTab } from './reports/PaymentsTab';
import { InventoryTab } from './reports/InventoryTab';
import { ShiftsTab } from './reports/ShiftsTab';
import { DebtsTab } from './reports/DebtsTab';
import { ExpensesTab } from './reports/ExpensesTab';
import {
  BarChart3,
  ReceiptText,
  Percent,
  FileText,
  Wallet,
  Boxes,
  Clock,
  CalendarDays,
  Download,
  HandCoins,
  Flame,
} from 'lucide-react';
import { ExportModal } from './reports/ExportModal';

type TabKey = 'sales' | 'vat' | 'invoices' | 'payments' | 'inventory' | 'shifts' | 'debts' | 'expenses';

const TABS: { key: TabKey; icon: React.ReactNode; labelKey: string; descKey: string }[] = [
  { key: 'sales', icon: <BarChart3 className="w-4 h-4" />, labelKey: 'reportSales', descKey: 'reportSalesDesc' },
  { key: 'vat', icon: <Percent className="w-4 h-4" />, labelKey: 'reportVat', descKey: 'reportVatDesc' },
  { key: 'invoices', icon: <FileText className="w-4 h-4" />, labelKey: 'reportInvoices', descKey: 'reportInvoicesDesc' },
  { key: 'payments', icon: <Wallet className="w-4 h-4" />, labelKey: 'reportPayments', descKey: 'reportPaymentsDesc' },
  { key: 'inventory', icon: <Boxes className="w-4 h-4" />, labelKey: 'reportInventory', descKey: 'reportInventoryDesc' },
  { key: 'shifts', icon: <Clock className="w-4 h-4" />, labelKey: 'reportShifts', descKey: 'reportShiftsDesc' },
  { key: 'debts', icon: <HandCoins className="w-4 h-4" />, labelKey: 'reportDebts', descKey: 'reportDebtsDesc' },
  { key: 'expenses', icon: <Flame className="w-4 h-4" />, labelKey: 'reportExpenses', descKey: 'reportExpensesDesc' },
];

const PERIODS = ['periodToday', 'periodWeek', 'periodMonth', 'periodYear', 'periodCustom', 'periodAll'];

export const ReportsPage: React.FC = () => {
  const { t } = useLanguageStore();
  const [tab, setTab] = useState<TabKey>('sales');
  const [period, setPeriod] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [branchId, setBranchId] = useState('');
  const [branches, setBranches] = useState<any[]>([]);
  const [applied, setApplied] = useState(false);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    api
      .get('/branches')
      .then((res) => setBranches(res.data?.data || []))
      .catch(() => setBranches([]));
  }, []);

  const appliedFilters = useMemo<ReportFilters>(() => {
    if (!applied) return { period: 'all' };
    return { period, from, to, branchId };
  }, [applied, period, from, to, branchId]);

  const apply = () => {
    if (period === 'custom') {
      if (!from || !to) return;
    }
    setApplied(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center justify-between gap-2.5">
          <span className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
              <BarChart3 className="w-5 h-5" />
            </div>
            {t.reportsTitle}
          </span>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md hover:opacity-90 transition-opacity"
          >
            <Download className="w-4 h-4" />
            {t.export}
          </button>
        </h1>
        <p className="text-slate-500 text-xs mt-1 ml-[52px]">{t.reportsDesc}</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tabDef) => (
            <button
              key={tabDef.key}
              onClick={() => setTab(tabDef.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${tab === tabDef.key ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-transparent shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {tabDef.icon}
              {(t[tabDef.labelKey as keyof typeof t] as string) || tabDef.key}
            </button>
          ))}
        </div>

        <p className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
          {(t[TABS.find((tabDef) => tabDef.key === tab)!.descKey as keyof typeof t] as string) || ''}
        </p>

        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t.period || 'الفترة'}</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p.replace('period', '').toLowerCase()}>
                  {(t[p as keyof typeof t] as string) || p}
                </option>
              ))}
            </select>
          </div>

          {period === 'custom' && (
            <>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t.fromDate}</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t.toDate}</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{t.branch}</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
            >
              <option value="">{t.periodAll}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={apply}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md hover:opacity-90 transition-opacity"
          >
            <CalendarDays className="w-4 h-4" />
            {t.apply}
          </button>
        </div>
      </div>

      <div key={tab + appliedFilters.period + appliedFilters.from + appliedFilters.to + appliedFilters.branchId}>
        {tab === 'sales' && <SalesTab filters={appliedFilters} />}
        {tab === 'vat' && <VatTab filters={appliedFilters} />}
        {tab === 'invoices' && <InvoicesTab filters={appliedFilters} />}
        {tab === 'payments' && <PaymentsTab filters={appliedFilters} />}
        {tab === 'inventory' && <InventoryTab filters={appliedFilters} />}
        {tab === 'shifts' && <ShiftsTab filters={appliedFilters} />}
        {tab === 'debts' && <DebtsTab filters={appliedFilters} />}
        {tab === 'expenses' && <ExpensesTab filters={appliedFilters} />}
      </div>

      {showExport && <ExportModal filters={appliedFilters} onClose={() => setShowExport(false)} />}
    </div>
  );
};
