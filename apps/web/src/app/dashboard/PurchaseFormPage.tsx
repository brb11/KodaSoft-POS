import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useLanguageStore, localizedName } from '../../stores/languageStore';
import {
  ArrowLeft, Loader2, Plus, Trash2, Save, ShoppingCart, CheckCircle2, XCircle, Package
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  nameAr?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price: number | string;
  cost: number | string;
  taxRate?: { rate: number } | number | null;
}

interface Supplier { id: string; name: string; nameAr?: string | null; }
interface Branch { id: string; name: string; }

interface LineItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
}

const emptyLine = (): LineItem => ({
  productId: '', name: '', sku: '', quantity: 1, unitPrice: 0, discountAmount: 0, taxRate: 15,
});

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const PurchaseFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { t } = useLanguageStore();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyLine()]);

  useEffect(() => { loadFormData(); }, []);

  useEffect(() => {
    if (!msg) return;
    const timer = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [msg]);

  const loadFormData = async () => {
    try {
      setLoading(true);
      const [supRes, branchRes, prodRes] = await Promise.all([
        api.get('/suppliers', { params: { limit: 200, isActive: true } }),
        api.get('/branches'),
        api.get('/products', { params: { limit: 1000 } }),
      ]);
      setSuppliers(supRes.data.data.items || []);
      setBranches(branchRes.data.data || []);
      setProducts(prodRes.data.data.items || []);

      if (isEdit && id) {
        const invRes = await api.get(`/purchases/${id}`);
        const inv = invRes.data.data;
        setSupplierId(inv.supplierId);
        setBranchId(inv.branchId);
        setInvoiceNumber(inv.invoiceNumber);
        setInvoiceDate(new Date(inv.invoiceDate).toISOString().split('T')[0]);
        setDueDate(inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '');
        setDiscountAmount(Number(inv.discountAmount));
        setNotes(inv.notes || '');
        setItems(inv.items.map((it: any) => ({
          productId: it.productId,
          name: it.name,
          sku: it.sku || '',
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discountAmount: Number(it.discountAmount),
          taxRate: 15,
        })));
      }
    } catch (err) {
      console.error('Failed to load form data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getProductTaxRate = (productId: string): number => {
    const p = products.find((x) => x.id === productId);
    if (!p) return 15;
    if (typeof p.taxRate === 'object' && p.taxRate !== null && 'rate' in p.taxRate) return Number((p.taxRate as any).rate);
    if (typeof p.taxRate === 'number') return p.taxRate;
    return 15;
  };

  const onProductSelect = (index: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      productId: p.id,
      name: p.name,
      sku: p.sku || '',
      unitPrice: Number(p.cost) || Number(p.price),
      taxRate: getProductTaxRate(p.id),
    };
    setItems(updated);
  };

  const addItem = () => setItems([...items, emptyLine()]);
  const removeItem = (i: number) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };
  const updateItem = (i: number, field: keyof LineItem, value: any) => {
    const updated = [...items];
    (updated[i] as any)[field] = value;
    setItems(updated);
  };

  const calcLine = (item: LineItem) => {
    const sub = round2(item.quantity * item.unitPrice);
    const taxable = round2(sub - item.discountAmount);
    const tax = round2((taxable * item.taxRate) / 100);
    return { sub, taxable, tax, total: round2(taxable + tax) };
  };

  const subtotal = round2(items.reduce((s, it) => s + calcLine(it).total, 0));
  const totalTax = round2(items.reduce((s, it) => s + calcLine(it).tax, 0));
  const total = round2(subtotal - discountAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !branchId || !invoiceNumber || items.every((it) => !it.productId)) {
      setMsg({ ok: false, text: t.fillRequired || 'Please fill in all required fields' });
      return;
    }
    try {
      setSaving(true);
      const payload = {
        supplierId, branchId, invoiceNumber, invoiceDate,
        dueDate: dueDate || undefined,
        discountAmount,
        notes: notes || undefined,
        items: items.filter((it) => it.productId).map((it) => ({
          productId: it.productId,
          name: it.name,
          sku: it.sku || undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountAmount: it.discountAmount,
          taxRate: it.taxRate,
        })),
      };

      if (isEdit && id) {
        await api.put(`/purchases/${id}`, payload);
        setMsg({ ok: true, text: t.saveSuccess || 'Updated successfully' });
      } else {
        await api.post('/purchases', payload);
        setMsg({ ok: true, text: t.saveSuccess || 'Created successfully' });
      }
      setTimeout(() => navigate('/dashboard/purchases'), 1000);
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.saveFailed || 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-cyan-500 animate-spin" /></div>;
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
        <button onClick={() => navigate('/dashboard/purchases')} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-7 h-7 text-cyan-600" />
          {isEdit ? (t.editPurchase || 'Edit Purchase Invoice') : (t.newPurchase || 'New Purchase Invoice')}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h3 className="font-extrabold text-slate-900 text-sm">{t.invoiceDetails || 'Invoice Details'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.supplier || 'Supplier'} *</label>
              <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500">
                <option value="">{t.selectSupplier || 'Select supplier...'}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{localizedName(s.name, s.nameAr ?? undefined)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.branch || 'Branch'} *</label>
              <select required value={branchId} onChange={(e) => setBranchId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500">
                <option value="">{t.selectBranch || 'Select branch...'}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.invoiceNumber || 'Invoice #'} *</label>
              <input type="text" required value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} disabled={isEdit}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.date || 'Date'} *</label>
              <input type="date" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.dueDate || 'Due Date'}</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.discount || 'Discount'}</label>
              <input type="number" step="0.01" min="0" value={discountAmount} onChange={(e) => setDiscountAmount(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-600" />
              {t.items || 'Items'}
            </h3>
            <button type="button" onClick={addItem}
              className="flex items-center gap-1 px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg text-xs font-bold transition-colors">
              <Plus className="w-3.5 h-3.5" />
              {t.addItem || 'Add Item'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500 w-[250px]">{t.product || 'Product'}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500 w-20">{t.qtyCol || 'Qty'}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500 w-28">{t.unitPrice || 'Unit Price'}</th>
                  <th className="px-4 py-2.5 text-start text-xs font-bold text-slate-500 w-24">{t.discount || 'Discount'}</th>
                  <th className="px-4 py-2.5 text-end text-xs font-bold text-slate-500 w-28">{t.tax || 'Tax'}</th>
                  <th className="px-4 py-2.5 text-end text-xs font-bold text-slate-500 w-28">{t.totalColValue || 'Total'}</th>
                  <th className="px-2 py-2.5 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item, i) => {
                  const line = calcLine(item);
                  return (
                    <tr key={i} className="hover:bg-slate-50/40">
                      <td className="px-3 py-2">
                        <select required value={item.productId} onChange={(e) => onProductSelect(i, e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-cyan-500">
                          <option value="">{t.selectProduct || 'Select product...'}</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{localizedName(p.name, p.nameAr ?? undefined)} {p.sku ? `(${p.sku})` : ''}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0.001" step="0.001" value={item.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-cyan-500" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-end focus:outline-none focus:border-cyan-500" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.01" value={item.discountAmount} onChange={(e) => updateItem(i, 'discountAmount', Number(e.target.value))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-end focus:outline-none focus:border-cyan-500" />
                      </td>
                      <td className="px-3 py-2 text-xs text-end text-slate-600 font-mono">{line.tax.toFixed(2)}</td>
                      <td className="px-3 py-2 text-xs text-end font-bold text-slate-900 font-mono">{line.total.toFixed(2)}</td>
                      <td className="px-2 py-2">
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(i)} className="p-1 rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notes & Totals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label className="block text-xs font-bold text-slate-700 mb-1">{t.notes || 'Notes'}</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 resize-none" />
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between text-sm"><span className="text-slate-500">{t.subtotal || 'Subtotal'}</span><span className="font-bold">{subtotal.toFixed(2)} {t.currency}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">{t.vat || 'VAT'}</span><span className="font-bold">{totalTax.toFixed(2)} {t.currency}</span></div>
            {discountAmount > 0 && <div className="flex justify-between text-sm"><span className="text-rose-500">{t.discount || 'Discount'}</span><span className="font-bold text-rose-600">-{discountAmount.toFixed(2)} {t.currency}</span></div>}
            <div className="border-t border-slate-200 pt-3 flex justify-between">
              <span className="font-extrabold text-slate-900">{t.totalColValue || 'Total'}</span>
              <span className="font-extrabold text-lg text-cyan-600">{total.toFixed(2)} {t.currency}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate('/dashboard/purchases')} className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            {t.cancel || 'Cancel'}
          </button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isEdit ? (t.update || 'Update') : (t.create || 'Create')}
          </button>
        </div>
      </form>
    </div>
  );
};
