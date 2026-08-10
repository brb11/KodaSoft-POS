import React, { useEffect, useState } from 'react';
import { X, Banknote, CreditCard, HandCoins, Plus, Minus, Split, Wallet, CircleDollarSign } from 'lucide-react';
import { useLanguageStore } from '../../../stores/languageStore';

export type PaymentMethod = 'CASH' | 'CARD' | 'STORE_CREDIT';

export interface PaymentInput {
  method: PaymentMethod;
  amount: number;
}

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  total: number;
  canUseCredit: boolean;
  hasCustomer: boolean;
  onPay: (payments: PaymentInput[]) => void;
}

interface Row {
  id: number;
  method: PaymentMethod;
  amount: string;
}

let rowSeq = 0;
const nextId = () => ++rowSeq;

const roundCents = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const PaymentModal: React.FC<PaymentModalProps> = ({ open, onClose, total, canUseCredit, hasCustomer, onPay }) => {
  const { t, language } = useLanguageStore();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (open) {
      setRows([{ id: nextId(), method: 'CASH', amount: String(total) }]);
    }
  }, [open, total]);

  if (!open) return null;

  const fmt = (n: number) =>
    new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const parseAmount = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const paid = roundCents(rows.reduce((s, r) => s + parseAmount(r.amount), 0));
  const remaining = roundCents(total - paid);
  const balanced = Math.abs(remaining) < 0.005;
  const allRowsValid = rows.length > 0 && rows.every((r) => parseAmount(r.amount) > 0);
  const creditRows = rows.filter((r) => r.method === 'STORE_CREDIT');
  const creditBlocked = creditRows.length > 0 && (!canUseCredit || !hasCustomer);
  const canPay = allRowsValid && balanced && !creditBlocked;

  const setMethod = (id: number, method: PaymentMethod) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, method } : r)));

  const setAmount = (id: number, amount: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, amount } : r)));

  const removeRow = (id: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs));

  const addRow = () =>
    setRows((rs) => [...rs, { id: nextId(), method: 'CARD', amount: remaining > 0 ? String(remaining) : '' }]);

  const setAll = (method: PaymentMethod) => setRows([{ id: nextId(), method, amount: String(total) }]);

  const splitEvenly = () => {
    const count = rows.length;
    if (count === 0) return;
    const share = roundCents(total / count);
    const parts = new Array<number>(count).fill(share);
    parts[count - 1] = roundCents(total - share * (count - 1));
    setRows(rows.map((r, i) => ({ ...r, amount: String(parts[i]) })));
  };

  const fillRemainder = (id: number) => {
    if (remaining <= 0) return;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, amount: String(roundCents(parseAmount(r.amount) + remaining)) } : r)));
  };

  const handlePay = () => {
    if (!canPay) return;
    onPay(
      rows.map((r) => ({
        method: r.method,
        amount: roundCents(parseAmount(r.amount)),
      })),
    );
  };

  const methodMeta = (m: PaymentMethod) =>
    m === 'CASH'
      ? { icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' }
      : m === 'CARD'
        ? { icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' }
        : { icon: HandCoins, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[78] backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Split className="w-5 h-5 text-cyan-600" />
            {t.paySplit}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Total due */}
        <div className="px-6 pt-5 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">{t.totalDue}</span>
          <span className="text-2xl font-extrabold text-slate-900">{fmt(total)}</span>
        </div>

        {/* Quick actions */}
        <div className="px-6 pt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAll('CASH')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <Banknote className="w-3.5 h-3.5" /> {t.payAllCash}
          </button>
          <button
            type="button"
            onClick={() => setAll('CARD')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" /> {t.payAllCard}
          </button>
          <button
            type="button"
            onClick={splitEvenly}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <CircleDollarSign className="w-3.5 h-3.5 text-cyan-600" /> {t.splitEvenly}
          </button>
        </div>

        {/* Payment rows */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5">
          {rows.map((row) => {
            const meta = methodMeta(row.method);
            return (
              <div key={row.id} className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={row.method}
                    onChange={(e) => setMethod(row.id, e.target.value as PaymentMethod)}
                    className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-extrabold border focus:outline-none focus:ring-2 focus:ring-cyan-200 ${meta.bg} ${meta.color}`}
                  >
                    <option value="CASH">{t.payCash}</option>
                    <option value="CARD">{t.payCard}</option>
                    <option value="STORE_CREDIT" disabled={!canUseCredit || !hasCustomer}>
                      {t.payOnAccount}
                    </option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 transition-colors"
                    title={t.remove}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute ltr:left-3 rtl:right-3 top-2 text-[10px] font-bold text-slate-400">
                      {t.currency}
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => setAmount(row.id, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handlePay()}
                      placeholder="0.00"
                      className={`w-full bg-white border border-slate-200 rounded-xl ltr:pl-10 ltr:pr-3 rtl:pr-10 rtl:pl-3 py-2 text-sm font-extrabold text-slate-800 focus:outline-none focus:border-cyan-500 ${remaining > 0 ? '' : 'border-slate-200'}`}
                    />
                  </div>
                  {remaining > 0.005 && (
                    <button
                      type="button"
                      onClick={() => fillRemainder(row.id)}
                      className="px-3 py-2 rounded-xl text-[10px] font-extrabold bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100 transition-colors whitespace-nowrap"
                    >
                      {t.payRemainder}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addRow}
            className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-2xl text-xs font-bold text-slate-500 hover:text-cyan-700 hover:border-cyan-300 hover:bg-cyan-50/40 transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> {t.addPaymentMethod}
          </button>

          {creditBlocked && (
            <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              {t.paymentCreditHint}
            </p>
          )}
        </div>

        {/* Summary & pay */}
        <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50/60 space-y-3">
          <div className="rounded-2xl bg-white border border-slate-200/80 px-4 py-3 text-xs space-y-1.5">
            {rows.map((r) => {
              const n = parseAmount(r.amount);
              if (n <= 0) return null;
              return (
                <div key={r.id} className="flex justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-slate-500">
                    {(() => {
                      const Icon = methodMeta(r.method).icon;
                      return <Icon className={`w-3.5 h-3.5 ${methodMeta(r.method).color}`} />;
                    })()}
                    {paymentLabel(r.method, t)}
                  </span>
                  <span className="font-extrabold text-slate-800">{fmt(n)}</span>
                </div>
              );
            })}
            <div className={`flex justify-between pt-1.5 border-t border-slate-100 ${balanced ? '' : 'font-bold'}`}>
              <span>{t.remainingDue}</span>
              <span className={balanced ? 'text-emerald-600 font-extrabold' : remaining > 0 ? 'text-amber-600 font-extrabold' : 'text-rose-600 font-extrabold'}>
                {fmt(balanced ? 0 : remaining)}
              </span>
            </div>
            {!balanced && (
              <p className="text-[10px] font-bold text-rose-500">{t.paymentTotalMismatch}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 text-xs hover:bg-slate-100"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={handlePay}
              disabled={!canPay}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-extrabold text-xs shadow-md shadow-emerald-500/25 disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2 transition-all"
            >
              <Wallet className="w-4 h-4" />
              {t.payNow}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function paymentLabel(method: PaymentMethod, t: any): string {
  if (method === 'CASH') return t.payCash;
  if (method === 'CARD') return t.payCard;
  return t.payOnAccount;
}
