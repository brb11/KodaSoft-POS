import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore, localizedName } from '../../stores/languageStore';
import { BarcodeCameraModal } from '../pos/components/BarcodeCameraModal';
import {
  Plus, Search, Edit2, Trash2, Package, Upload, Download,
  Loader2, AlertTriangle, CheckCircle2, ScanBarcode, Boxes,
  CheckCircle, XCircle, ArrowUp, ArrowDown,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  nameAr?: string;
}

interface InventoryRecord {
  id: string;
  branchId: string;
  quantity: number;
  lowStockThreshold: number;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  cost: number;
  type: string;
  isActive: boolean;
  unit?: string | null;
  category?: Category;
  categoryId?: string;
  inventory?: InventoryRecord[];
  units?: ProductUnitRow[];
}

interface ProductUnitRow {
  id: string;
  name: string;
  barcode?: string | null;
  factor: number;
  price: number;
  cost: number;
}

interface UnitFormRow {
  id?: string;
  name: string;
  barcode: string;
  factor: string;
  price: string;
  cost: string;
}

const emptyUnitRow = (): UnitFormRow => ({ name: '', barcode: '', factor: '', price: '', cost: '' });

// ── helper ──────────────────────────────────────────────────────────────────
function totalStock(product: Product): number {
  return (product.inventory || []).reduce((s, i) => s + Number(i.quantity), 0);
}

function stockForBranch(product: Product, branchId: string): number | null {
  if (!product.inventory) return null;
  const rec = product.inventory.find((i) => i.branchId === branchId);
  return rec ? Number(rec.quantity) : 0;
}

// ── component ────────────────────────────────────────────────────────────────
export const ProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showScan, setShowScan] = useState(false);
  const { t } = useLanguageStore();

  // form
  const [formData, setFormData] = useState({
    name: '', categoryId: '', sku: '', barcode: '',
    price: '', cost: '', type: 'retail', stockQty: '', stockBranchId: '',
    baseUnit: '', isActive: true,
  });
  const [unitRows, setUnitRows] = useState<UnitFormRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // import
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── data fetching ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBranches();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products?limit=1000');
      setProducts(res.data.data.items || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
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

  // ── modal helpers ──────────────────────────────────────────────────────────
  const defaultBranchId = () => branches[0]?.id || '';

  const openCreateModal = () => {
    setEditingProduct(null);
    setSaveMsg(null);
    setFormData({
      name: '', categoryId: categories[0]?.id || '',
      sku: '', barcode: '', price: '', cost: '', type: 'retail',
      stockQty: '', stockBranchId: defaultBranchId(), baseUnit: '', isActive: true,
    });
    setUnitRows([]);
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setSaveMsg(null);
    setFormData({
      name: product.name || '',
      categoryId: product.categoryId || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      price: String(product.price || ''),
      cost: String(product.cost || ''),
      type: product.type || 'retail',
      stockQty: '',
      stockBranchId: defaultBranchId(),
      baseUnit: product.unit || '',
      isActive: product.isActive,
    });
    setUnitRows(
      (product.units || []).map((u) => ({
        id: u.id,
        name: u.name,
        barcode: u.barcode || '',
        factor: String(u.factor ?? 1),
        price: String(u.price ?? ''),
        cost: String(u.cost ?? ''),
      })),
    );
    setShowModal(true);
  };

  const updateUnitRow = (index: number, patch: Partial<UnitFormRow>) =>
    setUnitRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  // current stock shown inside inventory section
  const currentStock: number | null = (() => {
    if (!editingProduct || !formData.stockBranchId) return null;
    return stockForBranch(editingProduct, formData.stockBranchId);
  })();

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSaveMsg(null);
    try {
      // Selling units: keep rows with a name; each needs a factor > 0.
      const cleanedUnits = unitRows
        .filter((r) => r.name.trim())
        .map((r) => ({
          name: r.name.trim(),
          barcode: r.barcode.trim() || undefined,
          factor: Number(r.factor) || 1,
          price: Number(r.price),
          cost: Number(r.cost || 0),
        }));
      if (cleanedUnits.some((u) => !(u.factor > 0))) {
        setSaveMsg({ ok: false, text: `❌ ${t.unitFactorPositive}` });
        setSubmitting(false);
        return;
      }
      if (cleanedUnits.some((u) => !(u.price >= 0)) || cleanedUnits.some((u) => !Number.isFinite(u.price))) {
        setSaveMsg({ ok: false, text: `❌ ${t.unitPriceRequired}` });
        setSubmitting(false);
        return;
      }
      if (cleanedUnits.some((u) => !(u.cost >= 0)) || cleanedUnits.some((u) => !Number.isFinite(u.cost))) {
        setSaveMsg({ ok: false, text: `❌ ${t.unitCostRequired}` });
        setSubmitting(false);
        return;
      }

      const payload = {
        name: formData.name,
        categoryId: formData.categoryId || undefined,
        sku: formData.sku || undefined,
        barcode: formData.barcode || undefined,
        unit: formData.baseUnit.trim() ? formData.baseUnit.trim() : editingProduct ? null : undefined,
        price: Number(formData.price),
        cost: Number(formData.cost || 0),
        type: formData.type,
        isActive: formData.isActive,
        units: cleanedUnits,
      };

      let productId = editingProduct?.id;

      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
      } else {
        const res = await api.post('/products', payload);
        productId = res.data.data.id;
      }

      // Inventory adjustment (optional)
      const qty = Number(formData.stockQty);
      const branchId = formData.stockBranchId;
      let invMsg: { ok: boolean; text: string } | null = null;

      if (qty !== 0 && branchId && productId) {
        try {
          await api.post('/inventory/adjustments', {
            items: [{
              productId,
              branchId,
              quantity: qty,
              note: editingProduct
                ? 'تسوية مخزون من إدارة المنتجات'
                : 'مخزون ابتدائي عند إنشاء المنتج',
            }],
          });
          const branchName = branches.find((b) => b.id === branchId)?.name || '';
          invMsg = {
            ok: true,
            text: `✅ تم حفظ المنتج وتسوية المخزون بنجاح (${qty > 0 ? '+' : ''}${qty} وحدة في ${branchName})`,
          };
        } catch (invErr: any) {
          const errTxt = invErr?.response?.data?.message || 'خطأ غير معروف';
          invMsg = {
            ok: false,
            text: `⚠️ تم حفظ المنتج، لكن فشلت تسوية المخزون: ${errTxt}`,
          };
        }
      } else {
        invMsg = { ok: true, text: `✅ تم ${editingProduct ? 'تعديل' : 'إضافة'} المنتج بنجاح` };
      }

      setSaveMsg(invMsg);
      await fetchProducts();

      // Auto-close after 1.8 s if no error
      if (invMsg.ok) {
        setTimeout(() => setShowModal(false), 1800);
      }
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const message =
        code === 'DUPLICATE_BARCODE_IN_PRODUCT'
          ? t.duplicateBarcodeInProduct
          : code === 'BARCODE_EXISTS'
            ? t.barcodeExists
            : code === 'SKU_EXISTS'
              ? t.skuExists
              : err.response?.data?.message;
      setSaveMsg({ ok: false, text: `❌ ${message || t.failedSaveProduct}` });
    } finally {
      setSubmitting(false);
    }
  };

  // ── delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm(t.deactivateProductConfirm)) return;
    try {
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  // ── status toggle ───────────────────────────────────────────────────────────
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const toggleActive = async (p: Product) => {
    setTogglingId(p.id);
    try {
      await api.put(`/products/${p.id}`, { isActive: !p.isActive });
      await fetchProducts();
    } catch (err: any) {
      console.error('Failed to toggle product status:', err);
      alert(err?.response?.data?.message || t.failedSaveProduct);
    } finally {
      setTogglingId(null);
    }
  };

  // ── export / import ────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      const res = await api.get('/products/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setImportMsg({ ok: false, text: t.exportFailed });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const text = await file.text();
      const res = await api.post('/products/import', { csv: text });
      const s = res.data.data;
      const counts = `${s.imported} ${t.importCreated} · ${s.updated} ${t.importUpdated} · ${s.skipped} ${t.importSkipped}`;
      const details = s.errors?.length > 0
        ? ` ${s.errors[0].message}${s.errors.length > 1 ? ` (+${s.errors.length - 1})` : ''}`
        : '';
      setImportMsg({ ok: true, text: counts + details });
      fetchProducts();
    } catch (err: any) {
      setImportMsg({ ok: false, text: err.response?.data?.message || t.importFailed });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search)
  );

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
              <Package className="w-5 h-5" />
            </div>
            {t.productsManagement}
          </h1>
          <p className="text-slate-500 text-xs mt-1 ml-[52px]">{t.productsDesc}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm hover:border-cyan-300 hover:text-cyan-700 transition-all">
            <Download className="w-4 h-4" /> {t.exportProducts}
          </button>
          <label className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm hover:border-cyan-300 hover:text-cyan-700 transition-all cursor-pointer">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {t.importProducts}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} disabled={importing} />
          </label>
          <button onClick={openCreateModal}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 hover:from-cyan-600 hover:to-blue-700 transition-all">
            <Plus className="w-4 h-4" /> {t.addNewProduct}
          </button>
        </div>
      </div>

      {/* Import banner */}
      {importMsg && (
        <div className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs font-semibold ${importMsg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          {importMsg.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{importMsg.text}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
        <input type="text" placeholder={t.filterProducts} value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm transition-all" />
      </div>

      {/* Products Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs min-w-[720px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
            <tr>
              <th className="px-6 py-4">{t.productName}</th>
              <th className="px-6 py-4">{t.categoryCol}</th>
              <th className="px-6 py-4">{t.skuBarcode}</th>
              <th className="px-6 py-4">{t.price}</th>
              <th className="px-6 py-4">{t.cost}</th>
              <th className="px-6 py-4 text-center">
                <span className="flex items-center justify-center gap-1">
                  <Boxes className="w-3.5 h-3.5" /> المخزون
                </span>
              </th>
              <th className="px-6 py-4">{t.status}</th>
              <th className="px-6 py-4 text-right">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400">{t.loading}</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan={8} className="px-6 py-8 text-center text-slate-400">{t.noProductsFoundCreate}</td></tr>
            ) : (
              filteredProducts.map((p) => {
                const stock = totalStock(p);
                const hasInventory = (p.inventory || []).length > 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {p.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-slate-200/80">
                        {localizedName(p.category?.name, p.category?.nameAr) || t.uncategorized}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500">
                      <div>{p.sku || '-'}</div>
                      {p.barcode && <div className="text-[10px] text-slate-400">{p.barcode}</div>}
                    </td>
                    <td className="px-6 py-4 font-extrabold text-cyan-600">{t.currency} {Number(p.price).toFixed(2)}</td>
                    <td className="px-6 py-4 text-slate-500 font-semibold">{t.currency} {Number(p.cost).toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      {!hasInventory ? (
                        <span className="text-slate-400 text-[11px]">—</span>
                      ) : stock <= 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3" /> نفد
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold ${stock <= 5 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                          {stock <= 5 && <AlertTriangle className="w-3 h-3" />}
                          {stock} وحدة
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActive(p)}
                        disabled={togglingId === p.id}
                        title={p.isActive ? t.inactive : t.active}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase cursor-pointer transition-all disabled:opacity-60 ${
                          p.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        {togglingId === p.id && <Loader2 className="w-3 h-3 animate-spin" />}
                        {p.isActive ? t.active : t.inactive}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button onClick={() => openEditModal(p)} className="p-2 bg-slate-100 hover:bg-cyan-50 text-slate-600 hover:text-cyan-700 rounded-xl transition-colors border border-slate-200" title="Edit">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors border border-slate-200" title="Deactivate">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal ──────────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

            {/* Modal Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
              <h3 className="text-lg font-extrabold text-slate-900">
                {editingProduct ? t.editProduct : t.createProduct}
              </h3>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <form id="product-form" onSubmit={handleSubmit} className="space-y-4 text-xs">

                {/* Name */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">{t.productName}</label>
                  <input type="text" required value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 focus:bg-white shadow-sm"
                    placeholder={t.productNamePlaceholder} />
                </div>

                {/* Category & Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">{t.categoryCol}</label>
                    <select value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm">
                      <option value="">{t.selectCategory}</option>
                      {categories.map((c) => (<option key={c.id} value={c.id}>{localizedName(c.name, c.nameAr)}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">{t.typeCol}</label>
                    <select value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm">
                      <option value="retail">{t.retail}</option>
                      <option value="fnb">{t.fnb}</option>
                    </select>
                  </div>
                </div>

                {/* SKU & Barcode */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">{t.sku}</label>
                    <input type="text" value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm"
                      placeholder={t.skuPlaceholder} />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">{t.barcode}</label>
                    <div className="relative">
                      <input type="text" value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl ltr:pr-10 rtl:pl-10 px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm"
                        placeholder={t.barcodePlaceholder} />
                      <button type="button" onClick={() => setShowScan(true)} title={t.scanBarcode}
                        className="absolute ltr:right-2 rtl:left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-cyan-50 text-cyan-600 hover:bg-cyan-100 transition-colors">
                        <ScanBarcode className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <div>
                    <p className="text-xs font-extrabold text-slate-800">{t.status}</p>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      {formData.isActive ? t.active : t.inactive}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.isActive}
                    onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${formData.isActive ? 'bg-gradient-to-r from-cyan-500 to-blue-600' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all ${formData.isActive ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                {/* Price & Cost */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {t.priceLabel}
                      {formData.baseUnit.trim() && (
                        <span className="ms-1 text-[10px] font-semibold text-cyan-600">/ {formData.baseUnit.trim()}</span>
                      )}
                    </label>
                    <input type="number" step="0.01" required value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm"
                      placeholder={t.pricePlaceholder} />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">{t.costLabel}</label>
                    <input type="number" step="0.01" value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm"
                      placeholder={t.costPlaceholder} />
                  </div>
                </div>

                {/* Base unit */}
                <div>
                  <label className="block text-slate-700 font-bold mb-1">{t.baseUnit}</label>
                  <input type="text" list="common-units" value={formData.baseUnit}
                    onChange={(e) => setFormData({ ...formData, baseUnit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm"
                    placeholder={t.baseUnitPlaceholder} />
                  <datalist id="common-units">
                    {['PCS', 'Dozen', 'Carton', 'Pack', 'Tray', 'Box', 'KG', 'Gram', 'Liter', 'Meter'].map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>

                {/* ── Selling Units ──────────────────────────────────────────── */}
                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="bg-gradient-to-r from-violet-50 to-purple-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                    <Package className="w-4 h-4 text-violet-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-[11px] font-extrabold text-violet-800 uppercase tracking-wider">{t.sellingUnits}</p>
                      <p className="text-[10px] text-violet-600 mt-0.5">{t.sellingUnitsHint}</p>
                    </div>
                  </div>
                  <div className="p-3 space-y-2 bg-white">
                    {unitRows.length === 0 && (
                      <p className="text-[11px] text-slate-400 text-center py-1.5">{t.noSellingUnits}</p>
                    )}
                    {unitRows.map((row, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 p-2 space-y-1.5 bg-slate-50/60">
                        <div className="grid grid-cols-[1fr_auto] gap-1.5 items-start">
                          <input type="text" list="common-units" value={row.name}
                            onChange={(e) => updateUnitRow(idx, { name: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 focus:outline-none focus:border-violet-500"
                            placeholder={t.unitNameCol} />
                          <button type="button"
                            onClick={() => setUnitRows((rows) => rows.filter((_, i) => i !== idx))}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title={t.deleteItem}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          <input type="text" value={row.barcode}
                            onChange={(e) => updateUnitRow(idx, { barcode: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 font-mono text-[11px] focus:outline-none focus:border-violet-500"
                            placeholder={t.unitBarcodeCol} />
                          <input type="number" min="0" step="0.001" value={row.factor}
                            onChange={(e) => updateUnitRow(idx, { factor: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 text-center focus:outline-none focus:border-violet-500"
                            placeholder={t.conversionQty} title={t.conversionQty} />
                          <input type="number" min="0" step="0.01" value={row.price}
                            onChange={(e) => updateUnitRow(idx, { price: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 text-center focus:outline-none focus:border-violet-500"
                            placeholder={t.unitPriceCol} title={t.unitPriceCol} />
                          <input type="number" min="0" step="0.01" value={row.cost}
                            onChange={(e) => updateUnitRow(idx, { cost: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-800 text-center focus:outline-none focus:border-violet-500"
                            placeholder={t.unitCostCol} title={t.unitCostCol} />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setUnitRows((rows) => [...rows, emptyUnitRow()])}
                      className="w-full py-2 rounded-xl border border-dashed border-violet-300 text-violet-600 hover:bg-violet-50 font-bold text-[11px] transition-colors flex items-center justify-center gap-1">
                      <Plus className="w-3.5 h-3.5" /> {t.addSellingUnit}
                    </button>
                  </div>
                </div>

                {/* ── Inventory Section ─────────────────────────────────────── */}
                {branches.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    {/* Section header */}
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-cyan-600 shrink-0" />
                      <div>
                        <p className="text-[11px] font-extrabold text-cyan-800 uppercase tracking-wider">
                          {editingProduct ? 'تسوية المخزون' : 'المخزون الابتدائي'}
                          <span className="ml-1.5 text-[9px] font-semibold text-cyan-500 normal-case tracking-normal">(اختياري)</span>
                        </p>
                        <p className="text-[10px] text-cyan-600 mt-0.5">
                          {editingProduct
                            ? 'كمية موجبة تُضاف · كمية سالبة تُخصم · فارغ = بدون تغيير'
                            : 'أدخل الكمية المتوفرة، أو اتركها فارغة لإضافتها لاحقاً'}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 space-y-3 bg-white">
                      {/* Branch selector */}
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">{t.branch}</label>
                        <select
                          value={formData.stockBranchId}
                          onChange={(e) => setFormData({ ...formData, stockBranchId: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm">
                          <option value="">{t.selectBranch}</option>
                          {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
                        </select>
                      </div>

                      {/* Current stock chip (edit mode only) */}
                      {editingProduct && formData.stockBranchId && (
                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                          <span className="text-slate-500 font-semibold">{t.currentStock}</span>
                          <span className={`text-xl font-black tabular-nums ${currentStock === 0 ? 'text-rose-500' : currentStock !== null && currentStock <= 5 ? 'text-amber-500' : 'text-slate-900'}`}>
                            {currentStock ?? '—'}
                            <span className="text-xs font-semibold text-slate-400 ml-1">وحدة</span>
                          </span>
                        </div>
                      )}

                      {/* Quantity input + preview */}
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">
                          {editingProduct ? 'مقدار التغيير' : 'الكمية'}
                        </label>
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            step="1"
                            value={formData.stockQty}
                            onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm"
                            placeholder={editingProduct ? 'مثال: +10 أو -5' : 'مثال: 100'} />
                          {/* Preview new stock (edit) */}
                          {editingProduct && formData.stockQty && currentStock !== null && (
                            <div className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-extrabold ${Number(formData.stockQty) > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                              {Number(formData.stockQty) > 0 ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                              ← {Math.max(0, currentStock + Number(formData.stockQty))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Result message */}
                {saveMsg && (
                  <div className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs font-semibold transition-all ${saveMsg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                    {saveMsg.ok
                      ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                      : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />}
                    <span>{saveMsg.text}</span>
                  </div>
                )}

              </form>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button type="button" onClick={() => setShowModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold border border-slate-200 text-xs">
                {t.cancel}
              </button>
              <button type="submit" form="product-form" disabled={submitting}
                className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 shadow-md disabled:opacity-60 flex items-center gap-2 text-xs transition-all">
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? t.saving : t.saveProduct}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      {showScan && (
        <BarcodeCameraModal
          onScan={(code) => {
            setFormData((prev) => ({ ...prev, barcode: code.trim() }));
            setShowScan(false);
          }}
          onClose={() => setShowScan(false)}
        />
      )}
    </div>
  );
};
