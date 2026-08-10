import React, { useState } from 'react';
import { Download, X, Loader2, Check, CheckSquare, Square, FileUp, FileSpreadsheet, Printer, FileText } from 'lucide-react';
import { useLanguageStore } from '../../../stores/languageStore';
import type { ReportFilters } from './ReportFilters';
import {
  REPORT_KEYS,
  type ReportKey,
  type ExportFormat,
  fetchReportData,
  buildReportFile,
  downloadFiles,
} from '../../../lib/reportExport';

const FORMATS: { key: ExportFormat; icon: React.ReactNode; labelKey: string }[] = [
  { key: 'csv', icon: <FileText className="w-4 h-4" />, labelKey: 'csv' },
  { key: 'excel', icon: <FileSpreadsheet className="w-4 h-4" />, labelKey: 'excel' },
  { key: 'pdf', icon: <Printer className="w-4 h-4" />, labelKey: 'pdf' },
];

interface Props {
  filters: ReportFilters;
  onClose: () => void;
}

export const ExportModal: React.FC<Props> = ({ filters, onClose }) => {
  const { t } = useLanguageStore();
  const [selected, setSelected] = useState<Set<ReportKey>>(new Set(REPORT_KEYS));
  const [mode, setMode] = useState<'separate' | 'combined'>('separate');
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'' | 'ok' | 'error'>('');

  const toggle = (key: ReportKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === REPORT_KEYS.length ? new Set<ReportKey>() : new Set(REPORT_KEYS)));
  };

  const reportLabel = (key: ReportKey) => {
    const map: Record<ReportKey, string> = {
      sales: t.reportSales,
      vat: t.reportVat,
      invoices: t.reportInvoices,
      payments: t.reportPayments,
      inventory: t.reportInventory,
      shifts: t.reportShifts,
      debts: t.reportDebts,
      expenses: t.reportExpenses,
    };
    return map[key];
  };

  const run = async (keys: ReportKey[]) => {
    if (busy || keys.length === 0) return;
    setBusy(true);
    setStatus('');
    try {
      const files = [];
      for (const key of keys) {
        const data = await fetchReportData(key, filters);
        files.push(buildReportFile(key, t, data));
      }
      const meta = `${t.exportedOn} ${new Date().toLocaleString()}`;
      await downloadFiles(files, format, mode === 'combined', meta);
      setStatus('ok');
    } catch {
      setStatus('error');
    } finally {
      setBusy(false);
    }
  };

  const keys = [...selected];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100">
              <FileUp className="w-4 h-4" />
            </span>
            {t.exportReports}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <p className="text-xs font-semibold text-slate-500">{t.selectReportsToExport}</p>

          <div className="space-y-1.5">
            <button onClick={toggleAll} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-700">{t.exportAll}</span>
              {selected.size === REPORT_KEYS.length ? <CheckSquare className="w-4 h-4 text-cyan-600" /> : <Square className="w-4 h-4 text-slate-400" />}
            </button>
            {REPORT_KEYS.map((key) => {
              const checked = selected.has(key);
              return (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-colors ${checked ? 'border-cyan-200 bg-cyan-50/50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <span className={`text-sm font-semibold ${checked ? 'text-cyan-800' : 'text-slate-700'}`}>{reportLabel(key)}</span>
                  {checked ? <Check className="w-4 h-4 text-cyan-600" /> : <Square className="w-4 h-4 text-slate-300" />}
                </button>
              );
            })}
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.exportFormat}</p>
            <div className="grid grid-cols-3 gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFormat(f.key)}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-bold transition-colors ${format === f.key ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {f.icon}
                  {f.labelKey === 'pdf' ? t.exportPrint : f.labelKey.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{t.exportLayout}</p>
            <div className="space-y-1.5">
              <button
                onClick={() => setMode('separate')}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm font-semibold transition-colors ${mode === 'separate' ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${mode === 'separate' ? 'border-cyan-500' : 'border-slate-300'}`}>
                  {mode === 'separate' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />}
                </span>
                {t.exportSeparateFiles}
              </button>
              <button
                onClick={() => setMode('combined')}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left text-sm font-semibold transition-colors ${mode === 'combined' ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${mode === 'combined' ? 'border-cyan-500' : 'border-slate-300'}`}>
                  {mode === 'combined' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />}
                </span>
                {t.exportCombinedFile}
              </button>
            </div>
          </div>

          {status === 'ok' && <p className="text-xs font-bold text-emerald-600">{t.exportDone}</p>}
          {status === 'error' && <p className="text-xs font-bold text-rose-600">{t.exportFailed}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
            {t.cancel}
          </button>
          <button
            onClick={() => run(keys)}
            disabled={busy || keys.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 shadow-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {busy ? t.exporting : t.exportSelected}
          </button>
          <button
            onClick={() => run(REPORT_KEYS)}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-500 shadow-md hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {busy ? t.exporting : t.exportAll}
          </button>
        </div>
      </div>
    </div>
  );
};
