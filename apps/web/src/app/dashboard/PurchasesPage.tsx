import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useLanguageStore, localizedName } from '../../stores/languageStore';
import { useAuthStore } from '../../stores/authStore';
import {
  ShoppingCart, Plus, Search, Loader2, Eye, XCircle, CheckCircle2,
  Filter, FileText, Calendar, Building2, X
} from 'lucide-react';

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  total: number | string;
  paidAmount: number | string;
  status: string;
  supplier: { id: string; name: string; nameAr?: string | null };
  branch: { id: string; name: string };
  items: any[];
  payments: any[];
}

interface Supplier { id: string; name: string; nameAr?: string | null; }
interface Branch { id: string; name: string; }

export const PurchasesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setbranches] = useState<Branch[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { t } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const canCreate = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const fetchDropdowns = async () => {
    try {
      const [supRes, branchRes] = await Promise.all([
        api.get('/suppliers?limit=200'),
        api.get('/branches'),
      ]);
      setSuppliers(supRes.data.data.items || []);
      setbranches(branchRes.data.data || []);
    } catch (err) {
      console.error('Failed to load filter data:', err);
    }
  };

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 200 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (supplierFilter) params.supplierId = supplierFilter;
      if (branchFilter) params.branchId = branchFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await api.get('/purchases', { params });
      setInvoices(res.data.data.items || []);
    } catch (err) {
      console.error('Failed to load purchase invoices:', err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, supplierFilter, branchFilter, dateFrom, dateTo]);

  useEffect(() => { fetchDropdowns(); }, []);
  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  useEffect(() => {
    if (!msg) return;
    const timer = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [msg]);

  const hasActiveFilters = search || statusFilter || supplierFilter || branchFilter || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setSupplierFilter('');
    setBranchFilter('');
    setDateFrom('');
    setDateTo('');
  };

  const statusColor = (status: string) => {
    if (status === 'CONFIRMED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'CANCELLED') return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  const totalValue = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paidAmount), 0);

  return (
    <div className="space-y-6">
      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold ${msg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-cyan-600" />
            {t.purchaseInvoices || 'Purchase Invoices'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t.purchasesDesc || 'Manage supplier purchase invoices'}</p>
        </div>
        {canCreate && (
          <button onClick={() => navigate('/dashboard/purchases/new')} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all active:scale-95">
            <Plus className="w-4 h-4" />
            {t.newPurchase || 'New Purchase'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          {t.filters || 'Filters'}
          {hasActiveFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-rose-500 hover:text-rose-600 transition-colors">
              <X className="w-3 h-3" />
              {t.clearFilters || 'Clear'}
            </button>
          )}
        </div>

        {/* Row 1: Search + Status */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder={t.searchPlaceholder || 'Search invoices...'} value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full ltr:pl-10 rtl:pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-500" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500">
            <option value="">{t.allStatuses || 'All Statuses'}</option>
            <option value="DRAFT">{t.draft || 'Draft'}</option>
            <option value="CONFIRMED">{t.confirmed || 'Confirmed'}</option>
            <option value="CANCELLED">{t.cancelled || 'Cancelled'}</option>
          </select>
        </div>

        {/* Row 2: Supplier + Branch */}
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500">
            <option value="">{t.allSuppliers || 'All Suppliers'}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{localizedName(s.name, s.nameAr ?? undefined)}</option>
            ))}
          </select>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500">
            <option value="">{t.allBranches || 'All Branches'}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Row 3: Date range */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              placeholder={t.fromDate || 'From'}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              placeholder={t.toDate || 'To'}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-bold text-slate-500 mb-1">{t.totalInvoices || 'Total Invoices'}</div>
          <p className="text-xl font-extrabold text-slate-900">{invoices.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-bold text-slate-500 mb-1">{t.totalPurchases || 'Total Value'}</div>
          <p className="text-xl font-extrabold text-slate-900">{totalValue.toFixed(2)} {t.currency}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-bold text-slate-500 mb-1">{t.totalPaid || 'Total Paid'}</div>
          <p className="text-xl font-extrabold text-emerald-600">{totalPaid.toFixed(2)} {t.currency}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-bold">{t.noData || 'No purchase invoices found'}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.invoiceNumber || 'Invoice #'}</th>
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.supplier || 'Supplier'}</th>
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.branch || 'Branch'}</th>
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.date || 'Date'}</th>
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.items || 'Items'}</th>
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.totalColValue || 'Total'}</th>
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.paidAmount || 'Paid'}</th>
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.status || 'Status'}</th>
                  <th className="px-4 py-3 text-end font-bold text-slate-600 text-xs">{t.actionsLabel || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900 font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-800">{localizedName(inv.supplier?.name, inv.supplier?.nameAr ?? undefined)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{inv.branch?.name}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.items.length}</td>
                    <td className="px-4 py-3 font-extrabold text-slate-900">{Number(inv.total).toFixed(2)}</td>
                    <td className="px-4 py-3 text-slate-600">{Number(inv.paidAmount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-bold border ${statusColor(inv.status)}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <button onClick={() => navigate(`/dashboard/purchases/${inv.id}`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-cyan-600 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
