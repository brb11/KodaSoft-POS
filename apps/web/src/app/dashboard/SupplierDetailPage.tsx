import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useLanguageStore, localizedName } from '../../stores/languageStore';
import {
  ArrowLeft, Loader2, Truck, Phone, Mail, MapPin, Building2, Receipt,
  DollarSign, CheckCircle2, XCircle, CreditCard, Plus, Calendar, X
} from 'lucide-react';

interface SupplierDetail {
  id: string;
  name: string;
  nameAr?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  vatNumber?: string | null;
  contactPerson?: string | null;
  notes?: string | null;
  balance: number | string;
  isActive: boolean;
  purchaseInvoices: any[];
  supplierPayments: any[];
}

export const SupplierDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguageStore();
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'CASH', reference: '', note: '' });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { if (id) fetchSupplier(); }, [id]);

  useEffect(() => {
    if (!msg) return;
    const timer = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [msg]);

  const fetchSupplier = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/suppliers/${id}`);
      setSupplier(res.data.data);
    } catch (err) {
      console.error('Failed to load supplier:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;
    try {
      await api.post('/purchases/payments', {
        supplierId: supplier.id,
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
        note: paymentForm.note || undefined,
      });
      setMsg({ ok: true, text: t.paymentSuccess || 'Payment recorded successfully' });
      setShowPaymentModal(false);
      setPaymentForm({ amount: '', method: 'CASH', reference: '', note: '' });
      fetchSupplier();
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.paymentFailed || 'Payment failed' });
    }
  };

  const statusColor = (status: string) => {
    if (status === 'CONFIRMED') return 'bg-emerald-100 text-emerald-700';
    if (status === 'CANCELLED') return 'bg-rose-100 text-rose-700';
    return 'bg-amber-100 text-amber-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-20 text-slate-400">
        <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-bold">{t.notFound || 'Supplier not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold ${msg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/dashboard/suppliers')} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-slate-900">{localizedName(supplier.name, supplier.nameAr ?? undefined)}</h1>
          <p className="text-sm text-slate-500">{supplier.contactPerson}</p>
        </div>
        <button onClick={() => setShowPaymentModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95">
          <CreditCard className="w-4 h-4" />
          {t.recordPayment || 'Record Payment'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
            <DollarSign className="w-3.5 h-3.5" />
            {t.outstandingBalance || 'Outstanding Balance'}
          </div>
          <p className={`text-xl font-extrabold ${Number(supplier.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {Number(supplier.balance).toFixed(2)} {t.currency}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
            <Receipt className="w-3.5 h-3.5" />
            {t.totalInvoices || 'Total Invoices'}
          </div>
          <p className="text-xl font-extrabold text-slate-900">{supplier.purchaseInvoices.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
            <CreditCard className="w-3.5 h-3.5" />
            {t.totalPayments || 'Total Payments'}
          </div>
          <p className="text-xl font-extrabold text-slate-900">{supplier.supplierPayments.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1">
            <Phone className="w-3.5 h-3.5" />
            {t.contactInfo || 'Contact'}
          </div>
          <p className="text-sm font-bold text-slate-900">{supplier.phone || '-'}</p>
          <p className="text-xs text-slate-500">{supplier.email || ''}</p>
        </div>
      </div>

      {supplier.vatNumber && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Building2 className="w-4 h-4" />
          <span className="font-bold">{t.vatNumberLabel || 'VAT Number'}:</span>
          <span className="font-mono">{supplier.vatNumber}</span>
        </div>
      )}

      {/* Purchase Invoices */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-cyan-600" />
            {t.purchaseInvoices || 'Purchase Invoices'}
          </h3>
        </div>
        {supplier.purchaseInvoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.noInvoices || 'No purchase invoices yet'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.invoiceNumber || 'Invoice #'}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.date || 'Date'}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.branch || 'Branch'}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.totalColValue || 'Total'}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.paidAmount || 'Paid'}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.status || 'Status'}</th>
                  <th className="px-4 py-2.5 text-end text-xs font-bold text-slate-500">{t.actionsLabel || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {supplier.purchaseInvoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-slate-900 font-mono">{inv.invoiceNumber}</td>
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-slate-600">{inv.branch?.name || '-'}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">{Number(inv.total).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{Number(inv.paidAmount).toFixed(2)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold ${statusColor(inv.status)}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-end">
                      <button onClick={() => navigate(`/dashboard/purchases/${inv.id}`)} className="text-xs font-bold text-cyan-600 hover:text-cyan-700">
                        {t.viewDetails || 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment History */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            {t.paymentHistory || 'Payment History'}
          </h3>
        </div>
        {supplier.supplierPayments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">{t.noPayments || 'No payments yet'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.date || 'Date'}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.amount || 'Amount'}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.method || 'Method'}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.invoiceNumber || 'Invoice'}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.note || 'Note'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {supplier.supplierPayments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 text-slate-600 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 font-bold text-emerald-600">-{Number(p.amount).toFixed(2)} {t.currency}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.method}</td>
                    <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{p.purchaseInvoice?.invoiceNumber || '-'}</td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs">{p.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-extrabold text-slate-900">{t.recordPayment || 'Record Payment'}</h3>
              <button onClick={() => setShowPaymentModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handlePayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.amount || 'Amount'} *</label>
                <input type="number" step="0.01" min="0.01" required value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:border-cyan-500" />
                <p className="text-xs text-slate-400 mt-1">{t.outstandingBalance || 'Balance'}: {Number(supplier.balance).toFixed(2)} {t.currency}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.method || 'Method'}</label>
                <select value={paymentForm.method} onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500">
                  <option value="CASH">CASH</option>
                  <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                  <option value="CARD">CARD</option>
                  <option value="CHECK">CHECK</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.reference || 'Reference'}</label>
                <input type="text" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.note || 'Note'}</label>
                <input type="text" value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                  {t.cancel || 'Cancel'}
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all">
                  {t.confirm || 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
