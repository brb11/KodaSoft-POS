import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useLanguageStore, localizedName } from '../../stores/languageStore';
import { useAuthStore } from '../../stores/authStore';
import {
  ArrowLeft, Loader2, ShoppingCart, CheckCircle2, XCircle, AlertTriangle,
  Package, CreditCard, Calendar, Building2, Truck, Edit2, Ban
} from 'lucide-react';

interface PurchaseDetail {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string | null;
  subtotal: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  total: number | string;
  paidAmount: number | string;
  status: string;
  notes?: string | null;
  createdBy?: string | null;
  supplier: any;
  branch: { id: string; name: string };
  items: any[];
  payments: any[];
}

export const PurchaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const canEdit = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const [invoice, setInvoice] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { if (id) fetchInvoice(); }, [id]);

  useEffect(() => {
    if (!msg) return;
    const timer = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [msg]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/purchases/${id}`);
      setInvoice(res.data.data);
    } catch (err) {
      console.error('Failed to load invoice:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!invoice) return;
    setConfirming(true);
    try {
      await api.post(`/purchases/${invoice.id}/confirm`, { branchId: invoice.branch.id });
      setMsg({ ok: true, text: t.confirmed || 'Invoice confirmed and stock updated' });
      fetchInvoice();
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.operationFailed || 'Operation failed' });
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!invoice) return;
    setCancelling(true);
    try {
      await api.post(`/purchases/${invoice.id}/cancel`);
      setMsg({ ok: true, text: t.cancelled || 'Invoice cancelled' });
      fetchInvoice();
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.operationFailed || 'Operation failed' });
    } finally {
      setCancelling(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'CONFIRMED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'CANCELLED') return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-cyan-500 animate-spin" /></div>;
  }

  if (!invoice) {
    return <div className="text-center py-20 text-slate-400"><ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-bold">{t.notFound || 'Invoice not found'}</p></div>;
  }

  const remaining = Number(invoice.total) - Number(invoice.paidAmount);

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold ${msg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <button onClick={() => navigate('/dashboard/purchases')} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-cyan-600" />
            {invoice.invoiceNumber}
            <span className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-bold border ${statusColor(invoice.status)}`}>{invoice.status}</span>
          </h1>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'DRAFT' && canEdit && (
            <>
              <button onClick={() => navigate(`/dashboard/purchases/${invoice.id}/edit`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-colors">
                <Edit2 className="w-3.5 h-3.5" /> {t.editLabel || 'Edit'}
              </button>
              <button onClick={handleConfirm} disabled={confirming}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50">
                {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {t.confirmInvoice || 'Confirm & Update Stock'}
              </button>
              <button onClick={handleCancel} disabled={cancelling}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                {t.cancelLabel || 'Cancel Invoice'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1"><Truck className="w-3.5 h-3.5" />{t.supplier || 'Supplier'}</div>
          <p className="text-sm font-bold text-slate-900">{localizedName(invoice.supplier?.name, invoice.supplier?.nameAr ?? undefined)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1"><Building2 className="w-3.5 h-3.5" />{t.branch || 'Branch'}</div>
          <p className="text-sm font-bold text-slate-900">{invoice.branch?.name}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1"><Calendar className="w-3.5 h-3.5" />{t.date || 'Date'}</div>
          <p className="text-sm font-bold text-slate-900">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
          {invoice.dueDate && <p className="text-[11px] text-slate-400">{t.dueDate || 'Due'}: {new Date(invoice.dueDate).toLocaleDateString()}</p>}
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-1"><CreditCard className="w-3.5 h-3.5" />{t.balance || 'Balance'}</div>
          <p className={`text-xl font-extrabold ${remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{remaining.toFixed(2)} {t.currency}</p>
          <p className="text-[11px] text-slate-400">{t.paidAmount || 'Paid'}: {Number(invoice.paidAmount).toFixed(2)}</p>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2"><Package className="w-4 h-4 text-cyan-600" />{t.items || 'Items'}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.product || 'Product'}</th>
                <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.qtyCol || 'Qty'}</th>
                <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.unitPrice || 'Unit Price'}</th>
                <th className="px-4 py-2.5 text-end text-xs font-bold text-slate-500">{t.discount || 'Discount'}</th>
                <th className="px-4 py-2.5 text-end text-xs font-bold text-slate-500">{t.tax || 'Tax'}</th>
                <th className="px-4 py-2.5 text-end text-xs font-bold text-slate-500">{t.totalColValue || 'Total'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoice.items.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50/40">
                  <td className="px-4 py-2.5">
                    <span className="font-bold text-slate-900">{item.name}</span>
                    {item.sku && <span className="text-[11px] text-slate-400 ml-2 font-mono">{item.sku}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{Number(item.quantity)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{Number(item.unitPrice).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-end text-slate-600">{Number(item.discountAmount).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-end text-slate-600">{Number(item.taxAmount).toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-end font-bold text-slate-900">{Number(item.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 w-full max-w-sm space-y-2">
          <div className="flex justify-between text-sm"><span className="text-slate-500">{t.subtotal || 'Subtotal'}</span><span className="font-bold">{Number(invoice.subtotal).toFixed(2)} {t.currency}</span></div>
          <div className="flex justify-between text-sm"><span className="text-slate-500">{t.vat || 'VAT'}</span><span className="font-bold">{Number(invoice.taxAmount).toFixed(2)} {t.currency}</span></div>
          {Number(invoice.discountAmount) > 0 && <div className="flex justify-between text-sm"><span className="text-rose-500">{t.discount || 'Discount'}</span><span className="font-bold text-rose-600">-{Number(invoice.discountAmount).toFixed(2)} {t.currency}</span></div>}
          <div className="border-t border-slate-200 pt-2 flex justify-between"><span className="font-extrabold">{t.totalColValue || 'Total'}</span><span className="font-extrabold text-lg text-cyan-600">{Number(invoice.total).toFixed(2)} {t.currency}</span></div>
        </div>
      </div>

      {/* Payment History */}
      {invoice.payments.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-600" />{t.payments || 'Payments'}</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.date || 'Date'}</th>
                <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.amount || 'Amount'}</th>
                <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.method || 'Method'}</th>
                <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500">{t.note || 'Note'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoice.payments.map((p: any) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 font-bold text-emerald-600">{Number(p.amount).toFixed(2)} {t.currency}</td>
                  <td className="px-4 py-2.5 text-slate-600">{p.method}</td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{p.note || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invoice.notes && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="font-extrabold text-slate-900 text-sm mb-2">{t.notes || 'Notes'}</h3>
          <p className="text-sm text-slate-600">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
};
