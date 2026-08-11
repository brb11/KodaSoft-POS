import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore, translate, paymentMethodLabel } from '../../stores/languageStore';
import { useAuthStore } from '../../stores/authStore';
import {
  HandCoins,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Landmark,
  Banknote,
  Wallet,
  AlertTriangle,
} from 'lucide-react';

interface DebtRow {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  balance: number;
  creditLimit: number | null;
  usagePct: number | null;
  overLimit: boolean;
  aging: { current: number; d30: number; d60: number; d90: number };
  overdue: number;
}

interface StatementEntry {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'REFUND';
  ref: string;
  note: string | null;
  amount: number;
  balance: number;
  items?: Array<{
    id: string;
    name: string;
    sku: string | null;
    quantity: number;
    refundedQuantity: number;
    unitPrice: number;
    subtotal: number;
    taxAmount: number;
  }>;
}

const SETTLE_METHODS = ['CASH', 'CARD'];

export const CustomerAccountsPage: React.FC = () => {
  const { t } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const isManager = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const [rows, setRows] = useState<DebtRow[]>([]);
  const [totals, setTotals] = useState({ totalReceivables: 0, totalOverdue: 0, totalCustomers: 0 });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [payCustomer, setPayCustomer] = useState<DebtRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [payForm, setPayForm] = useState({ branchId: '', amount: '', method: 'CASH', reference: '', note: '' });

  const [stmtCustomer, setStmtCustomer] = useState<DebtRow | null>(null);
  const [stmtEntries, setStmtEntries] = useState<StatementEntry[]>([]);
  const [stmtLoading, setStmtLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchDebts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/debts');
      setRows(res.data.data.rows || []);
      setTotals({
        totalReceivables: res.data.data.totalReceivables || 0,
        totalOverdue: res.data.data.totalOverdue || 0,
        totalCustomers: res.data.data.totalCustomers || 0,
      });
    } catch (err) {
      console.error('Failed to load debts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDebts();
    api
      .get('/branches')
      .then((res) => setBranches(res.data?.data || []))
      .catch(() => setBranches([]));
  }, []);

  const openPayment = (r: DebtRow) => {
    setPayCustomer(r);
    setPayForm({ branchId: branches[0]?.id || '', amount: '', method: 'CASH', reference: '', note: '' });
    setMsg(null);
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payCustomer) return;
    setSaving(true);
    try {
      await api.post('/debts/payments', {
        customerId: payCustomer.id,
        branchId: payForm.branchId,
        amount: Number(payForm.amount),
        method: payForm.method,
        reference: payForm.reference || undefined,
        note: payForm.note || undefined,
      });
      setMsg({ ok: true, text: t.recordPaymentSuccess });
      setPayCustomer(null);
      fetchDebts();
    } catch (err: any) {
      setMsg({
        ok: false,
        text:
          err?.response?.data?.code === 'PAYMENT_EXCEEDS_BALANCE'
            ? t.paymentExceedsBalance
            : err?.response?.data?.message || t.recordPaymentFailed,
      });
      setPayCustomer(null);
    } finally {
      setSaving(false);
    }
  };

  const openStatement = async (r: DebtRow) => {
    setStmtCustomer(r);
    setStmtEntries([]);
    setExpanded(null);
    setStmtLoading(true);
    try {
      const res = await api.get(`/debts/statement?customerId=${r.id}`);
      setStmtEntries(res.data.data.entries || []);
    } catch (err) {
      console.error('Failed to load statement:', err);
    } finally {
      setStmtLoading(false);
    }
  };

  const typeLabel = (type: string) =>
    type === 'INVOICE' ? t.statementInvoice : type === 'PAYMENT' ? t.statementPayment : t.statementRefund;

  const summaryCard = (label: string, value: number, icon: React.ReactNode, accent: string) => (
    <div className={`bg-gradient-to-br ${accent} rounded-2xl p-5 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{label}</p>
          <h3 className="text-2xl font-black mt-1">{t.currency} {value.toLocaleString()}</h3>
        </div>
        {icon}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
            <HandCoins className="w-5 h-5" />
          </div>
          {t.customerAccountsTitle}
        </h1>
        <p className="text-slate-500 text-xs mt-1 ml-[52px]">{t.customerAccountsDesc}</p>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCard(t.totalReceivables, totals.totalReceivables, <Wallet className="w-9 h-9 opacity-80" />, 'from-cyan-500 to-blue-600')}
        {summaryCard(t.totalOverdue, totals.totalOverdue, <AlertTriangle className="w-9 h-9 opacity-80" />, 'from-amber-500 to-orange-600')}
        {summaryCard(t.debtCustomers, totals.totalCustomers, <HandCoins className="w-9 h-9 opacity-80" />, 'from-emerald-500 to-teal-600')}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs min-w-[760px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold">
            <tr>
              <th className="px-6 py-4">{t.customerName}</th>
              <th className="px-6 py-4 text-right">{t.debtBalance}</th>
              <th className="px-6 py-4 text-right">{t.creditLimitCol}</th>
              <th className="px-6 py-4 text-right">{t.usage}</th>
              <th className="px-6 py-4 text-center">{t.agingCurrent}</th>
              <th className="px-6 py-4 text-center">{t.aging30}</th>
              <th className="px-6 py-4 text-center">{t.aging60}</th>
              <th className="px-6 py-4 text-center">{t.aging90}</th>
              <th className="px-6 py-4 text-right">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={9} className="px-6 py-8 text-center text-slate-400">{t.loading}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="px-6 py-8 text-center text-slate-400">{t.noDebts}</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">{r.name}</div>
                    {r.phone && <div className="text-[11px] text-slate-400 font-mono" dir="ltr">{r.phone}</div>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center gap-1 font-extrabold ${r.balance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {t.currency} {r.balance.toFixed(2)}
                      {r.overLimit && <AlertTriangle className="w-3.5 h-3.5" />}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-500">
                    {r.creditLimit != null ? `${t.currency} ${r.creditLimit.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {r.usagePct != null ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-bold text-cyan-600">{r.usagePct.toFixed(0)}%</span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${r.overLimit ? 'bg-rose-500' : 'bg-gradient-to-r from-cyan-500 to-blue-600'}`}
                            style={{ width: `${Math.min(100, r.usagePct)}%` }}
                          />
                        </div>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600 font-semibold">{r.aging.current.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center text-slate-600 font-semibold">{r.aging.d30.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center text-slate-600 font-semibold">{r.aging.d60.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    {r.aging.d90 > 0 ? <span className="font-extrabold text-rose-600">{r.aging.d90.toFixed(2)}</span> : <span className="text-slate-400">0.00</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button onClick={() => openStatement(r)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition" title={t.statement}>
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      {isManager && (
                        <button onClick={() => openPayment(r)} className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition" title={t.recordPayment}>
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isManager && (
        <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> {t.managerOnly}
        </p>
      )}

      {/* Record payment modal */}
      {payCustomer && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-1">{t.recordPaymentTitle}</h3>
            <p className="text-xs text-slate-500 mb-4">
              {payCustomer.name} — <span className="font-bold text-rose-600">{t.currency} {payCustomer.balance.toFixed(2)}</span> {t.debtBalance}
            </p>
            <form onSubmit={submitPayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.branch}</label>
                <select value={payForm.branchId} onChange={(e) => setPayForm({ ...payForm, branchId: e.target.value })} required className="w-full bg-slate-50 border rounded-xl px-3 py-2">
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.paymentAmount}</label>
                <input type="number" min="0.01" step="0.01" max={payCustomer.balance} required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.paymentMethod}</label>
                <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2">
                  {SETTLE_METHODS.map((m) => <option key={m} value={m}>{paymentMethodLabel(m)}</option>)}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.paymentReference}</label>
                <input type="text" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} placeholder={t.paymentReferencePlaceholder} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.paymentNote}</label>
                <textarea rows={2} value={payForm.note} onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} placeholder={t.paymentNotePlaceholder} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setPayCustomer(null)} disabled={saving} className="px-4 py-2 border rounded-xl font-bold disabled:opacity-50">{t.cancel}</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} {t.recordPayment}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Statement modal */}
      {stmtCustomer && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">{t.statementTitle}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {stmtCustomer.name}
                  {stmtCustomer.phone ? ` — ${stmtCustomer.phone}` : ''}
                  <span className="ms-2 font-bold text-rose-600">{t.currency} {stmtCustomer.balance.toFixed(2)} {t.debtBalance}</span>
                </p>
              </div>
              <button onClick={() => setStmtCustomer(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">✕</button>
            </div>
            {stmtLoading ? (
              <div className="py-12 text-center text-slate-400 text-xs">{t.loading}</div>
            ) : stmtEntries.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">{t.noStatement}</div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[560px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold">
                  <tr>
                    <th className="px-4 py-3 text-left">{t.statementDate}</th>
                    <th className="px-4 py-3 text-left">{t.statementType}</th>
                    <th className="px-4 py-3 text-left">{t.statementRef}</th>
                    <th className="px-4 py-3 text-right">{t.statementAmount}</th>
                    <th className="px-4 py-3 text-right">{t.statementBalance}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stmtEntries.map((e) => {
                    const canExpand = e.type === 'INVOICE' && (e.items?.length || 0) > 0;
                    const isOpen = expanded === e.id;
                    return (
                      <React.Fragment key={e.id}>
                        <tr className="hover:bg-slate-50/80">
                          <td className="px-4 py-3 text-slate-500" dir="ltr">{new Date(e.date).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                              e.type === 'INVOICE' ? 'bg-rose-50 text-rose-600' : e.type === 'PAYMENT' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {typeLabel(e.type)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-mono">
                            <span className="inline-flex items-center gap-1.5">
                              {e.ref}
                              {canExpand && (
                                <button
                                  onClick={() => setExpanded(isOpen ? null : e.id)}
                                  className="p-1 rounded-lg bg-slate-100 hover:bg-cyan-100 text-slate-500 hover:text-cyan-700 transition-colors"
                                  title={t.invoiceDetails}
                                >
                                  {isOpen ? '−' : '+'}
                                </button>
                              )}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${e.amount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {e.amount > 0 ? '+' : ''}{t.currency} {e.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-slate-900">{t.currency} {e.balance.toFixed(2)}</td>
                        </tr>
                        {canExpand && isOpen && (
                          <tr>
                            <td colSpan={5} className="px-4 pb-4">
                              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-100 text-slate-500 uppercase font-bold">
                                    <tr>
                                      <th className="px-4 py-2 text-left">{t.productName}</th>
                                      <th className="px-4 py-2 text-center">{t.qtyCol}</th>
                                      <th className="px-4 py-2 text-right">{t.unitPriceCol}</th>
                                      <th className="px-4 py-2 text-right">{t.totalCol}</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {e.items!.map((it) => (
                                      <tr key={it.id}>
                                        <td className="px-4 py-2 font-semibold text-slate-800">
                                          {it.name}
                                          {it.sku && <span className="ms-1.5 text-[10px] text-slate-400 font-mono" dir="ltr">{it.sku}</span>}
                                          {it.refundedQuantity > 0 && (
                                            <span className="ms-1.5 text-[10px] font-bold text-amber-600">({t.statementRefund} ×{it.refundedQuantity})</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-2 text-center text-slate-600">{it.quantity}</td>
                                        <td className="px-4 py-2 text-right text-slate-600">{t.currency} {it.unitPrice.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right font-bold text-slate-800">{t.currency} {it.subtotal.toFixed(2)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
