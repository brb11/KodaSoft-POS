import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useLanguageStore, translate, localizedName } from '../../stores/languageStore';
import { useAuthStore } from '../../stores/authStore';
import {
  Truck, Plus, Edit2, Trash2, Search, Loader2, X, Phone, Mail, MapPin,
  Building2, Receipt, DollarSign, CheckCircle2, XCircle, Eye
} from 'lucide-react';

interface Supplier {
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
  _count?: { purchaseInvoices: number; supplierPayments: number };
  createdAt: string;
}

export const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { t, language } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const canEdit = user?.role === 'OWNER' || user?.role === 'MANAGER';

  const [formData, setFormData] = useState({
    name: '', nameAr: '', phone: '', email: '', address: '', city: '',
    vatNumber: '', contactPerson: '', notes: '',
  });

  useEffect(() => { fetchSuppliers(); }, []);

  useEffect(() => {
    if (!msg) return;
    const timer = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(timer);
  }, [msg]);

  const fetchSuppliers = async (term?: string) => {
    try {
      setLoading(true);
      const res = await api.get('/suppliers', { params: { search: term || undefined, limit: 200 } });
      setSuppliers(res.data.data.items || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingSupplier(null);
    setFormData({ name: '', nameAr: '', phone: '', email: '', address: '', city: '', vatNumber: '', contactPerson: '', notes: '' });
    setShowModal(true);
  };

  const openEditModal = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData({
      name: s.name, nameAr: s.nameAr || '', phone: s.phone || '', email: s.email || '',
      address: s.address || '', city: s.city || '', vatNumber: s.vatNumber || '',
      contactPerson: s.contactPerson || '', notes: s.notes || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { name: formData.name };
      if (formData.nameAr) payload.nameAr = formData.nameAr;
      if (formData.phone) payload.phone = formData.phone;
      if (formData.email) payload.email = formData.email;
      if (formData.address) payload.address = formData.address;
      if (formData.city) payload.city = formData.city;
      if (formData.vatNumber) payload.vatNumber = formData.vatNumber;
      if (formData.contactPerson) payload.contactPerson = formData.contactPerson;
      if (formData.notes) payload.notes = formData.notes;

      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, payload);
        setMsg({ ok: true, text: t.saveSuccess || 'Saved successfully' });
      } else {
        await api.post('/suppliers', payload);
        setMsg({ ok: true, text: t.saveSuccess || 'Created successfully' });
      }
      setShowModal(false);
      fetchSuppliers();
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.saveFailed || 'Failed to save' });
    }
  };

  const handleDelete = async () => {
    if (!deletingSupplier) return;
    setDeleting(true);
    try {
      await api.delete(`/suppliers/${deletingSupplier.id}`);
      setMsg({ ok: true, text: t.deleteSuccess || 'Deleted successfully' });
      setDeletingSupplier(null);
      fetchSuppliers();
    } catch (err: any) {
      setMsg({ ok: false, text: err.response?.data?.message || t.deleteFailed || 'Failed to delete' });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = suppliers.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.nameAr && s.nameAr.includes(search)) ||
      (s.phone && s.phone.includes(search)) ||
      (s.email && s.email.toLowerCase().includes(q))
    );
  });

  const totalBalance = filtered.reduce((sum, s) => sum + Number(s.balance || 0), 0);

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
            <Truck className="w-7 h-7 text-cyan-600" />
            {t.suppliers || 'Suppliers'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{t.suppliersDesc || 'Manage your suppliers and purchase history'}</p>
        </div>
        {canEdit && (
          <button onClick={openCreateModal} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all active:scale-95">
            <Plus className="w-4 h-4" />
            {t.addSupplier || 'Add Supplier'}
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t.searchPlaceholder || 'Search suppliers...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ltr:pl-10 rtl:pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
          />
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <DollarSign className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-600">{t.totalBalance || 'Total Balance'}:</span>
          <span className="text-sm font-extrabold text-slate-900">{Number(totalBalance).toFixed(2)} {t.currency}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-bold">{t.noData || 'No suppliers found'}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.nameLabel || 'Name'}</th>
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.phoneLabel || 'Phone'}</th>
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.emailLabel || 'Email'}</th>
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.vatNumberLabel || 'VAT No.'}</th>
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.balance || 'Balance'}</th>
                  <th className="px-4 py-3 text-start font-bold text-slate-600 text-xs">{t.invoices || 'Invoices'}</th>
                  <th className="px-4 py-3 text-end font-bold text-slate-600 text-xs">{t.actionsLabel || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{localizedName(supplier.name, supplier.nameAr ?? undefined)}</div>
                      {supplier.contactPerson && <div className="text-[11px] text-slate-400">{supplier.contactPerson}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{supplier.phone || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{supplier.email || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{supplier.vatNumber || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`font-extrabold ${Number(supplier.balance) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {Number(supplier.balance).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{supplier._count?.purchaseInvoices ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/dashboard/suppliers/${supplier.id}`)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-cyan-600 transition-colors" title={t.viewDetails || 'View'}>
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <>
                            <button onClick={() => openEditModal(supplier)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-amber-600 transition-colors" title={t.editLabel || 'Edit'}>
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeletingSupplier(supplier)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-rose-600 transition-colors" title={t.deleteLabel || 'Delete'}>
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingSupplier ? (t.editSupplier || 'Edit Supplier') : (t.addSupplier || 'Add Supplier')}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.nameLabel || 'Name'} *</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.nameArabic || 'Arabic Name'}</label>
                  <input type="text" value={formData.nameAr} onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" dir="rtl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.phoneLabel || 'Phone'}</label>
                  <input type="text" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.emailLabel || 'Email'}</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.vatNumberLabel || 'VAT Number'}</label>
                  <input type="text" value={formData.vatNumber} onChange={(e) => setFormData({ ...formData, vatNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t.contactPerson || 'Contact Person'}</label>
                  <input type="text" value={formData.contactPerson} onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.addressLabel || 'Address'}</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.notes || 'Notes'}</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-cyan-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                  {t.cancel || 'Cancel'}
                </button>
                <button type="submit" className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all">
                  {editingSupplier ? (t.update || 'Update') : (t.create || 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSupplier && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-rose-600" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">{t.confirmDelete || 'Confirm Delete'}</h3>
            <p className="text-sm text-slate-500 mb-6">
              {translate(t.deleteSupplierConfirm || 'Are you sure you want to delete "{name}"?', { name: localizedName(deletingSupplier.name, deletingSupplier.nameAr ?? undefined) })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeletingSupplier(null)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50">
                {t.cancel || 'Cancel'}
              </button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (t.delete || 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
