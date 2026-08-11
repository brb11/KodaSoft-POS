import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore, localizedName } from '../../stores/languageStore';
import { useAuthStore } from '../../stores/authStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { Warehouse, AlertTriangle, CheckCircle, SlidersHorizontal, Loader2, CheckCircle2, XCircle, History, Ban } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  nameAr?: string;
  sku?: string;
  category?: { name: string; nameAr?: string };
  inventory?: {
    id: string;
    branchId: string;
    quantity: number;
    lowStockThreshold: number;
  }[];
}

interface Branch {
  id: string;
  name: string;
}

interface Adjustment {
  id: string;
  productName: string;
  productNameAr?: string;
  sku?: string;
  branchName: string;
  quantity: number;
  note?: string;
  createdByName?: string;
  createdAt: string;
}

export const InventoryPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [branchId, setBranchId] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const user = useAuthStore((s) => s.user);
  const canAdjust = user?.role === 'OWNER' || user?.role === 'MANAGER';
  const { t } = useLanguageStore();
  const trackInventory = useSettingsStore((s) => s.settings?.trackInventory);
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    if (trackInventory === undefined) loadSettings();
  }, [trackInventory, loadSettings]);

  const [form, setForm] = useState({
    productId: '',
    branchId: '',
    type: 'increase' as 'increase' | 'decrease',
    quantity: '',
    note: '',
  });

  useEffect(() => {
    fetchInventory();
    fetchBranches();
    fetchAdjustments();
  }, []);

  useEffect(() => {
    if (!branchId && branches.length > 0) {
      setBranchId(user?.branchId && branches.some((b) => b.id === user.branchId) ? user.branchId : branches[0].id);
    }
  }, [branches, branchId, user?.branchId]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products?limit=100');
      setProducts(res.data.data.items || []);
    } catch (err) {
      console.error('Failed to fetch inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get('/branches');
      setBranches(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch branches:', err);
    }
  };

  const fetchAdjustments = async () => {
    try {
      const res = await api.get('/inventory/adjustments?limit=20');
      setAdjustments(res.data.data.items || []);
    } catch (err) {
      console.error('Failed to fetch adjustments:', err);
    }
  };

  const openModal = () => {
    setForm({ productId: products[0]?.id || '', branchId, type: 'increase', quantity: '', note: '' });
    setShowModal(true);
  };

  const stockFor = (p: Product) => p.inventory?.find((i) => i.branchId === branchId);

  const selectedProduct = products.find((p) => p.id === form.productId);
  const currentStock = selectedProduct ? (stockFor(selectedProduct)?.quantity ?? 0) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(form.quantity);
    if (!form.productId || !form.branchId || !qty || qty <= 0) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const signed = form.type === 'increase' ? qty : -qty;
      await api.post('/inventory/adjustments', {
        items: [{ productId: form.productId, branchId: form.branchId, quantity: signed, note: form.note || undefined }],
      });
      setMsg({ ok: true, text: t.adjustSuccess });
      setShowModal(false);
      await Promise.all([fetchInventory(), fetchAdjustments()]);
    } catch (err: any) {
      setMsg({ ok: false, text: err?.response?.data?.message || t.adjustFailed });
    } finally {
      setSubmitting(false);
    }
  };

  const isLowForBranch = (p: Product) => {
    const inv = stockFor(p);
    if (!inv) return false;
    return inv.quantity <= inv.lowStockThreshold;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
              <Warehouse className="w-5 h-5" />
            </div>
            {t.inventoryTitle}
          </h1>
          <p className="text-slate-500 text-xs mt-1 ml-[52px]">{t.inventoryDesc}</p>
        </div>
        {canAdjust && trackInventory !== false && (
          <button onClick={openModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 shadow-md text-xs">
            <SlidersHorizontal className="w-4 h-4" /> {t.adjustStock}
          </button>
        )}
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}

      {trackInventory === false && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-200 mb-4">
            <Ban className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">{t.inventoryDisabled}</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1.5 max-w-sm">{t.inventoryDisabledDesc}</p>
        </div>
      )}

      {trackInventory !== false && (
        <>
        {/* Branch selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-bold text-slate-700">{t.branch}</label>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm">
          <option value="">{t.selectBranch}</option>
          {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
        </select>
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs min-w-[640px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
            <tr>
              <th className="px-6 py-4">{t.productName}</th>
              <th className="px-6 py-4">{t.sku}</th>
              <th className="px-6 py-4">{t.categoryCol}</th>
              <th className="px-6 py-4">{t.stockQuantity}</th>
              <th className="px-6 py-4">{t.alertThreshold}</th>
              <th className="px-6 py-4">{t.stockStatus}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">{t.loadingInventory}</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">{t.noInventory}</td></tr>
            ) : (
              products.map((p) => {
                const inv = stockFor(p);
                const stock = inv?.quantity ?? 0;
                const threshold = inv?.lowStockThreshold ?? 0;
                const isLow = inv ? stock <= threshold : false;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{localizedName(p.name, p.nameAr)}</td>
                    <td className="px-6 py-4 font-mono text-slate-500">{p.sku || '-'}</td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-slate-200/80">
                        {localizedName(p.category?.name, p.category?.nameAr) || t.uncategorized}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-extrabold text-lg text-slate-900">{stock}</td>
                    <td className="px-6 py-4 text-slate-500 font-semibold">{threshold}</td>
                    <td className="px-6 py-4">
                      {inv && isLow ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3" /> {t.lowStock}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3" /> {t.inStock}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Adjustment History */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-x-auto shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-600" />
          <h2 className="font-extrabold text-slate-900 text-sm">{t.adjustmentHistory}</h2>
          <span className="text-slate-400 text-[10px] font-semibold">{t.adjustmentHistoryDesc}</span>
        </div>
        <table className="w-full text-left text-xs min-w-[640px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
            <tr>
              <th className="px-6 py-3">{t.date}</th>
              <th className="px-6 py-3">{t.productName}</th>
              <th className="px-6 py-3">{t.branch}</th>
              <th className="px-6 py-3">{t.adjustedQuantity}</th>
              <th className="px-6 py-3">{t.notesLabel}</th>
              <th className="px-6 py-3">{t.adjustedBy}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {adjustments.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">{t.noAdjustments}</td></tr>
            ) : (
              adjustments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-3 text-slate-500 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-3 font-bold text-slate-900">
                    {localizedName(a.productName, a.productNameAr)}
                    {a.sku && <span className="ml-2 font-mono text-[10px] text-slate-400">{a.sku}</span>}
                  </td>
                  <td className="px-6 py-3 text-slate-600 font-semibold">{a.branchName}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex items-center font-extrabold rounded-lg px-2 py-0.5 text-[11px] ${a.quantity >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {a.quantity >= 0 ? '+' : ''}{a.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-slate-500">{a.note || '-'}</td>
                  <td className="px-6 py-3 text-slate-500">{a.createdByName || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Adjust Stock Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">{t.adjustStock}</h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">{t.selectProduct}</label>
                <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm">
                  <option value="">{t.selectProduct}</option>
                  {products.map((p) => (<option key={p.id} value={p.id}>{localizedName(p.name, p.nameAr)}{p.sku ? ` (${p.sku})` : ''}</option>))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">{t.branch}</label>
                  <select value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm">
                    <option value="">{t.selectBranch}</option>
                    {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">{t.adjustmentType}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setForm({ ...form, type: 'increase' })}
                      className={`py-2.5 rounded-xl font-bold border transition-colors ${form.type === 'increase' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                      {t.increaseStock}
                    </button>
                    <button type="button" onClick={() => setForm({ ...form, type: 'decrease' })}
                      className={`py-2.5 rounded-xl font-bold border transition-colors ${form.type === 'decrease' ? 'bg-red-50 text-red-700 border-red-300' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                      {t.decreaseStock}
                    </button>
                  </div>
                </div>
              </div>

              {selectedProduct && (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  <span className="text-slate-500 font-semibold">{t.currentStock}</span>
                  <span className="font-extrabold text-lg text-slate-900">{currentStock}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">{t.adjustmentQuantity}</label>
                <input type="number" step="0.001" min="0.001" required value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 focus:bg-white shadow-sm" />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">{t.adjustmentReason}</label>
                <input type="text" maxLength={300} value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 focus:bg-white shadow-sm"
                  placeholder={t.adjustmentReasonPlaceholder} />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold border border-slate-200">
                  {t.cancel}
                </button>
                <button type="submit" disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 shadow-md">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />} {submitting ? t.saving : t.confirmAdjust}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
