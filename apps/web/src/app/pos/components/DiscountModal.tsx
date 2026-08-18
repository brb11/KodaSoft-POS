import React, { useState, useEffect } from 'react';
import { X, BadgePercent, MinusCircle } from 'lucide-react';
import { useLanguageStore } from '../../../stores/languageStore';
import { useCartStore } from '../../../stores/cartStore';

interface DiscountModalProps {
  open: boolean;
  onClose: () => void;
}

const PRESETS = [5, 10, 15, 20];

const roundCents = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

function allocateDiscount(lineSubtotals: number[], totalDiscount: number): number[] {
  if (totalDiscount <= 0) return lineSubtotals.map(() => 0);
  const total = lineSubtotals.reduce((a, b) => a + b, 0);
  if (total <= 0) return lineSubtotals.map(() => 0);
  let remaining = totalDiscount;
  const out = lineSubtotals.map((sub) => {
    const share = roundCents(totalDiscount * (sub / total));
    remaining = roundCents(remaining - share);
    return share;
  });
  out[out.length - 1] = roundCents(out[out.length - 1] + remaining);
  return out;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({ open, onClose }) => {
  const { t, language } = useLanguageStore();
  const { items, discount, discountType, setDiscount, getSubtotal } = useCartStore();

  const [type, setType] = useState<'percent' | 'fixed'>(discountType);
  const [value, setValue] = useState<string>(discount ? String(discount) : '');

  useEffect(() => {
    if (open) {
      setType(discountType);
      setValue(discount ? String(discount) : '');
    }
  }, [open, discount, discountType]);

  if (!open) return null;

  const subtotal = getSubtotal();
  const input = Number(value);
  const pct = type === 'percent' ? Math.max(0, Math.min(Number.isFinite(input) ? input : 0, 100)) : 0;
  const amount =
    type === 'percent'
      ? Math.min(subtotal, (subtotal * pct) / 100)
      : Math.min(subtotal, Number.isFinite(input) ? Math.max(0, input) : 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const apply = () => {
    const v = Number(value);
    if (!Number.isFinite(v) || v <= 0) {
      setDiscount(0, 'percent');
    } else if (type === 'percent') {
      setDiscount(Math.min(v, 100), 'percent');
    } else {
      setDiscount(v, 'fixed');
    }
    onClose();
  };

  const clear = () => {
    setDiscount(0, 'percent');
    setValue('');
    onClose();
  };

  // Mirrors cartStore calculations so the preview exactly matches the applied cart.
  const grossTotal = roundCents(items.reduce((sum, line) => sum + roundCents(line.price * line.quantity), 0));
  const previewVat = roundCents(
    items.reduce((sum, line) => sum + roundCents(line.price * line.quantity * (line.taxRate ?? 15) / (100 + (line.taxRate ?? 15))), 0)
  );
  const previewSubtotal = roundCents(items.reduce((sum, line) => {
    const rate = Number(line.taxRate ?? 15);
    return sum + roundCents(line.price * line.quantity * 100 / (100 + rate));
  }, 0));
  const previewTotal = roundCents(previewSubtotal + previewVat - amount);

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[78] backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <BadgePercent className="w-5 h-5 text-rose-500" />
            {t.discountTitle}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-xs font-semibold text-slate-500">{t.discountHint}</p>

          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('percent')}
              className={`py-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                type === 'percent'
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.discountPercent} %
            </button>
            <button
              type="button"
              onClick={() => setType('fixed')}
              className={`py-2.5 rounded-xl text-xs font-extrabold border transition-all ${
                type === 'fixed'
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.discountFixed} ({t.currency})
            </button>
          </div>

          {/* Presets */}
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setType('percent');
                  setValue(String(p));
                }}
                className={`py-2 rounded-xl text-sm font-extrabold border transition-all ${
                  type === 'percent' && Number(value) === p
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 hover:border-slate-400'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.discountLabel}</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={type === 'percent' ? 100 : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === 'percent' ? '10' : '0.00'}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-extrabold text-slate-800 focus:outline-none focus:border-rose-400 focus:bg-white transition-all"
              />
              <span className="text-xs font-extrabold text-slate-500 w-8 text-center">
                {type === 'percent' ? '%' : t.currency}
              </span>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 divide-y divide-slate-200/70 px-4 text-xs">
            <div className="flex items-center justify-between py-2">
              <span className="font-bold text-slate-500">{t.subtotal}</span>
              <span className="font-extrabold text-slate-800">{fmt(subtotal)}</span>
            </div>
            {amount > 0 && (
              <div className="flex items-center justify-between py-2">
                <span className="font-bold text-rose-500">{t.discountApplied}</span>
                <span className="font-extrabold text-rose-600">- {fmt(amount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-2">
              <span className="font-bold text-slate-500">{t.vat}</span>
              <span className="font-extrabold text-slate-800">{fmt(previewVat)}</span>
            </div>
            <div className="flex items-center justify-between py-2 font-extrabold text-sm text-slate-900">
              <span>{t.totalAmount}</span>
              <span className="text-cyan-600">{fmt(previewTotal)}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={clear}
              disabled={discount <= 0}
              className="flex items-center justify-center gap-1.5 flex-1 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-600 text-xs hover:bg-slate-50 disabled:opacity-40"
            >
              <MinusCircle className="w-3.5 h-3.5" />
              {t.discountRemove}
            </button>
            <button
              type="button"
              onClick={apply}
              className="flex-1 py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white rounded-xl font-bold text-xs shadow-md shadow-rose-500/25 disabled:opacity-50 transition-all"
            >
              {t.apply}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
