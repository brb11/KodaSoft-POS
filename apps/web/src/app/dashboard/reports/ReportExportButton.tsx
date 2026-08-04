import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, FileText, FileSpreadsheet, FileDown } from 'lucide-react';
import { useLanguageStore } from '../../../stores/languageStore';
import { buildReportFile, downloadFiles, type ReportKey, type ExportFormat } from '../../../lib/reportExport';

interface Props {
  reportKey: ReportKey;
  data: any;
}

const FORMATS: { key: ExportFormat; icon: React.ReactNode; label: string }[] = [
  { key: 'csv', icon: <FileText className="w-3.5 h-3.5" />, label: 'CSV' },
  { key: 'excel', icon: <FileSpreadsheet className="w-3.5 h-3.5" />, label: 'Excel' },
  { key: 'pdf', icon: <FileDown className="w-3.5 h-3.5" />, label: 'PDF' },
];

export const ReportExportButton: React.FC<Props> = ({ reportKey, data }) => {
  const { t } = useLanguageStore();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const run = async (format: ExportFormat) => {
    setOpen(false);
    if (!data || busy) return;
    setBusy(true);
    try {
      const file = buildReportFile(reportKey, t, data);
      const meta = `${t.exportedOn} ${new Date().toLocaleString()}`;
      await downloadFiles([file], format, false, meta);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={!data || busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        {t.export}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-20">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              onClick={() => run(f.key)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 transition-colors"
            >
              {f.icon}
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
