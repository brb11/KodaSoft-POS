import React, { useEffect, useState } from 'react';
import { X, Flame, Wallet, Banknote, Package, ShoppingBag, Zap, MoreHorizontal, Trash2, Plus } from 'lucide-react';
import { api } from '../../../lib/api';
import { useLanguageStore } from '../../../stores/languageStore';
import { useAuthStore } from '../../../stores/authStore';

export type ExpenseCategory = 'GENERAL' | 'SUPPLIES' | 'UTILITIES' | 'WITHDRAWAL' | 'OTHER';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['GENERAL', 'SUPPLIES', 'UTILITIES', 'WITHDRAWAL', 'OTHER'];

export function expenseCategoryLabel(t: any, category: string): string {
  switch (category) {
    case 'GENERAL': return t.catGeneral;
    case 'SUPPLIES': return t.catSupplies;
    case 'UTILITIES': return t.catUtilities;
    case 'WITHDRAWAL': return t.catWithdrawal;
    default: return t.catOther;
  }
}

export function expenseCategoryIcon(category: string, className = 'w-4 h-4') {
  switch (category) {
    case 'GENERAL': return <Package className={className} />;
    case 'SUPPLIES': return <ShoppingBag className={className} />;
    case 'UTILITIES': return <Zap className={className} />;
    case 'WITHDRAWAL': return <Wallet className={className} />;
    default: return <MoreHorizontal className={className} />;
  }
}

interface ExpenseRow {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  paidFromCash: boolean;
  createdAt: string;
  createdByUser?: { name: string };
  shift?: { id: string; status: string };
}

interface ExpensesModalProps {
  open: boolean;
  onClose: () => void;
  branchId: string | null;
  activeShift: any;
}

export const ExpensesModal: React.FC<ExpensesModalProps> = ({ open, onClose, branchId, activeShift }) => {
  const { t, language } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const canWithdraw = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const canDelete = canWithdraw;

  const [category, setCategory] = useState<ExpenseCategory>('GENERAL');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paidFromCash, setPaidFromCash] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const load = async () => {
    if (!open) return;
    setLoading(true);
    try {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const res = await api.get('/expenses', {
        params: { branchId: branchId || undefined, shiftId: activeShift?.id, from: from.toISOString(), limit: 100 },
      });
      setItems(res.data.data.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setCategory('GENERAL');
      setAmount('');
      setDescription('');
      setPaidFromCash(true);
      setConfirmId(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const fmt = (n: number) =>
    new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: 'SAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);

  const totalExpenses = items.reduce((s, e) => (e.category === 'WITHDRAWAL' ? s : s + e.amount), 0);
  const totalWithdrawals = items.filter((e) => e.category === 'WITHDRAWAL').reduce((s, e) => s + e.amount, 0);
  const isWithdrawal = category === 'WITHDRAWAL';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!branchId) {
      alert(t.noBranchAssigned);
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0 || !description.trim()) return;
    setSaving(true);
    try {
      await api.post('/expenses', {
        branchId,
        shiftId: activeShift?.id || undefined,
        category,
        amount: amt,
        description: description.trim(),
        paidFromCash,
      });
      setAmount('');
      setDescription('');
      setCategory('GENERAL');
      setPaidFromCash(true);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.message || t.expenseRecordFailed);
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    try {
      await api.delete(`/expenses/${id}`);
      setConfirmId(null);
      await load();
    } catch (err: any) {
      const status = err?.response?.status;
      alert(status === 400 ? t.expenseDeleteBlocked : t.expenseDeleteFailed);
      setConfirmId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[78] backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-500" />
            {t.expensesTitle}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <p className="text-xs font-semibold text-slate-500">{t.expensesDesc}</p>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-extrabold text-rose-500 uppercase tracking-wider">{t.expTotalExpenses}</p>
              <p className="text-lg font-black text-rose-600 mt-0.5">{fmt(totalExpenses)}</p>
            </div>
            <div className="bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-extrabold text-violet-500 uppercase tracking-wider">{t.expTotalWithdrawals}</p>
              <p className="text-lg font-black text-violet-600 mt-0.5">{fmt(totalWithdrawals)}</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="space-y-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.expenseCategory}</label>
              <div className="grid grid-cols-3 gap-1.5">
                {EXPENSE_CATEGORIES.map((c) => {
                  const isWithdrawal = c === 'WITHDRAWAL';
                  const disabled = isWithdrawal && !canWithdraw;
                  const selected = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setCategory(c);
                        if (c === 'WITHDRAWAL') setPaidFromCash(true);
                      }}
                      title={disabled ? t.withdrawalManagerOnly : undefined}
                      className={`flex items-center justify-center gap-1 px-1.5 py-2 rounded-xl text-[10px] font-extrabold border transition-all disabled:opacity-35 disabled:cursor-not-allowed ${
                        selected
                          ? isWithdrawal
                            ? 'bg-violet-50 border-violet-300 text-violet-700'
                            : 'bg-rose-50 border-rose-300 text-rose-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {expenseCategoryIcon(c, 'w-3.5 h-3.5')}
                      {expenseCategoryLabel(t, c)}
                    </button>
                  );
                })}
              </div>
              {category === 'WITHDRAWAL' && canWithdraw && (
                <p className="mt-1.5 text-[10px] font-bold text-violet-500">{t.expWithdrawalLabel}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.expenseAmount} *</label>
              <div className="relative">
                <span className="absolute ltr:left-3 rtl:right-3 top-2 text-[10px] font-bold text-slate-400">{t.currency}</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  autoFocus
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl ltr:pl-10 ltr:pr-3 rtl:pr-10 rtl:pl-3 py-2 text-sm font-extrabold text-slate-800 focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.expenseDescription} *</label>
              <textarea
                required
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.expenseDescriptionPlaceholder}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-400 resize-none"
              />
            </div>

            <div className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${paidFromCash ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/50 border-amber-200'}`}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" /> {t.paidFromCashLabel}
                </p>
                <p className="text-[10px] font-semibold text-slate-500 mt-0.5 leading-relaxed">
                  {isWithdrawal ? t.withdrawalAlwaysCash : paidFromCash ? t.paidFromCashHint : t.paidFromCashOffHint}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={paidFromCash}
                disabled={isWithdrawal}
                onClick={() => setPaidFromCash((v) => !v)}
                className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors disabled:opacity-40 ${paidFromCash ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-all ${paidFromCash ? 'ltr:left-[20px] rtl:right-[20px]' : 'ltr:left-[2px] rtl:right-[2px]'}`} />
              </button>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600 text-white rounded-xl font-bold text-xs shadow-md shadow-rose-500/25 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
            >
              <Plus className="w-4 h-4" />
              {saving ? t.processing : t.addExpense}
            </button>
          </form>

          {/* Today's list */}
          <div>
            <h4 className="text-xs font-extrabold text-slate-700 mb-2 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-400" /> {t.todayExpenses}
            </h4>
            {loading ? (
              <div className="py-6 text-center text-xs text-slate-400">{t.loading}</div>
            ) : items.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">{t.noExpensesYet}</div>
            ) : (
              <div className="space-y-2">
                {items.map((e) => {
                  const isWithdrawal = e.category === 'WITHDRAWAL';
                  return (
                    <div
                      key={e.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border p-3 ${isWithdrawal ? 'bg-violet-50/50 border-violet-100' : 'bg-slate-50/70 border-slate-200/70'}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`p-1.5 rounded-lg ${isWithdrawal ? 'bg-violet-100 text-violet-600' : 'bg-rose-100 text-rose-600'}`}>
                          {expenseCategoryIcon(e.category, 'w-3.5 h-3.5')}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-800 truncate">{e.description || expenseCategoryLabel(t, e.category)}</p>
                          <p className="text-[10px] text-slate-500">
                            {expenseCategoryLabel(t, e.category)} · {new Date(e.createdAt).toLocaleTimeString()}
                            {e.createdByUser ? ` · ${e.createdByUser.name}` : ''}
                          </p>
                          {e.paidFromCash === false && (
                            <span className="mt-1 inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-extrabold">
                              {t.nonCashBadge}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-black ${isWithdrawal ? 'text-violet-600' : 'text-rose-600'}`}>
                          {fmt(e.amount)}
                        </span>
                        {canDelete && (
                          <button
                            onClick={() => del(e.id)}
                            className={`p-1.5 rounded-lg transition-colors ${confirmId === e.id ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                            title={confirmId === e.id ? t.expDeleteConfirm : t.delete}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
