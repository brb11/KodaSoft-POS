import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useLanguageStore, localizedName } from '../../../stores/languageStore';
import { toQuery, ReportFilters } from './ReportFilters';
import { Boxes, AlertTriangle, CalendarX, Flame, ArrowRightLeft } from 'lucide-react';
import { ReportExportButton } from './ReportExportButton';

const MOVEMENT_LABELS: Record<string, string> = {
  sale: 'mvSale',
  purchase: 'mvPurchase',
  adjustment: 'mvAdjustment',
  wastage: 'mvWastage',
  return: 'mvReturn',
};

export const InventoryTab: React.FC<{ filters: ReportFilters }> = ({ filters }) => {
  const { t } = useLanguageStore();
  const [data, setData] = useState<any>(null);
  const [view, setView] = useState<'all' | 'low' | 'expired'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/reports/inventory${toQuery(filters)}`)
      .then((res) => active && setData(res.data.data))
      .catch(() => active && setData(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters]);

  if (loading) return <div className="py-12 text-center text-slate-400 text-sm">{t.loadingReports}</div>;
  if (!data) return <div className="py-12 text-center text-slate-400 text-sm">{t.noData}</div>;

  const totals = data.totals;
  const kpis = [
    { label: t.invCurrentStock, value: `${totals.itemCount}`, sub: t.invTotalUnits, subValue: totals.totalUnits, icon: <Boxes className="w-5 h-5" />, color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { label: t.invTotalValue, value: t.currency, sub: t.invTotalValue, subValue: totals.totalValue, icon: <Boxes className="w-5 h-5" />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: t.invLowStock, value: data.lowStock.length, icon: <AlertTriangle className="w-5 h-5" />, color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { label: t.invExpired, value: data.expired.length, icon: <CalendarX className="w-5 h-5" />, color: 'bg-rose-50 text-rose-600 border-rose-100' },
  ];

  const list = view === 'low' ? data.lowStock : view === 'expired' ? data.expired : data.currentStock;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ReportExportButton reportKey="inventory" data={data} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{k.label}</p>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${k.color}`}>{k.icon}</div>
            </div>
            <h3 className="text-2xl font-black text-slate-900">{k.value}{k.sub ? ` ${k.sub}` : ''}</h3>
            {k.sub && k.subValue !== undefined && (
              <p className="text-[11px] text-slate-500 font-semibold mt-1">{k.sub}: {k.subValue}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {(['all', 'low', 'expired'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${view === v ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-transparent shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {v === 'all' ? t.invCurrentStock : v === 'low' ? t.invLowStock : t.invExpired}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
            <tr>
              <th className="px-6 py-4 text-left">{t.invProduct}</th>
              <th className="px-6 py-4 text-left">{t.invQuantity}</th>
              <th className="px-6 py-4 text-left">{t.invThreshold}</th>
              <th className="px-6 py-4 text-left">{t.invExpiryDate}</th>
              <th className="px-6 py-4 text-right">{t.status}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((r: any) => (
              <tr key={r.id} className="hover:bg-slate-50/80">
                <td className="px-6 py-3.5 font-bold text-slate-900">{localizedName(r.name, r.nameAr)}</td>
                <td className="px-6 py-3.5 text-slate-600 font-semibold">{r.quantity}</td>
                <td className="px-6 py-3.5 text-slate-600 font-semibold">{r.lowStockThreshold}</td>
                <td className="px-6 py-3.5 text-slate-600">{r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '-'}</td>
                <td className="px-6 py-3.5 text-right">
                  {r.isExpired ? (
                    <span className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">{t.invExpired}</span>
                  ) : r.isLow ? (
                    <span className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">{t.invLowStock}</span>
                  ) : (
                    <span className="px-2 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">{t.active}</span>
                  )}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                  {view === 'low' ? t.invNoLow : view === 'expired' ? t.invNoExpired : t.noData}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
          <ArrowRightLeft className="w-4 h-4 text-cyan-600" /> {t.invMovements}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {data.movements.map((m: any) => (
            <div key={m.type} className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <p className="text-[11px] font-bold text-slate-500 uppercase">{t[(MOVEMENT_LABELS[m.type] || 'mvOther') as keyof typeof t]}</p>
              <p className="text-lg font-black text-slate-900 mt-1">{m.quantity}</p>
              <p className="text-[10px] text-slate-400 font-semibold">{m.count} {t.ordersCount}</p>
            </div>
          ))}
          {data.wastage !== 0 && (
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-center">
              <p className="text-[11px] font-bold text-rose-500 uppercase flex items-center justify-center gap-1"><Flame className="w-3 h-3" /> {t.invWastage}</p>
              <p className="text-lg font-black text-rose-600 mt-1">{data.wastage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
