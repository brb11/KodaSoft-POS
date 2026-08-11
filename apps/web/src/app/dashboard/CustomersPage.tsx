import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore, translate } from '../../stores/languageStore';
import { Contact, Plus, Edit2, Trash2, Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  creditLimit?: number | null;
  creditBalance?: number | string;
  createdAt: string;
}

export const CustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { t } = useLanguageStore();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    creditLimit: '',
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async (term?: string) => {
    try {
      setLoading(true);
      const res = await api.get('/customers', { params: { search: term || undefined, limit: 100 } });
      setCustomers(res.data.data.items || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '', email: '', address: '', notes: '', creditLimit: '' });
    setShowModal(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      notes: c.notes || '',
      creditLimit: c.creditLimit != null ? String(c.creditLimit) : '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        phone: formData.phone || undefined,
        email: formData.email || undefined,
        address: formData.address || undefined,
        notes: formData.notes || undefined,
        creditLimit: formData.creditLimit ? Number(formData.creditLimit) : null,
      };
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, payload);
      } else {
        await api.post('/customers', payload);
      }
      setShowModal(false);
      fetchCustomers(search || undefined);
    } catch (err: any) {
      alert(err.response?.data?.message || t.failedSaveCustomer);
    }
  };

  const handleDelete = async () => {
    if (!deletingCustomer) return;
    setDeleting(true);
    setMsg(null);
    try {
      await api.delete(`/customers/${deletingCustomer.id}`);
      setMsg({ ok: true, text: t.deleteCustomerSuccess });
      setDeletingCustomer(null);
      fetchCustomers(search || undefined);
    } catch (err: any) {
      setMsg({ ok: false, text: err?.response?.data?.message || t.deleteCustomerFailed });
      setDeletingCustomer(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
              <Contact className="w-5 h-5" />
            </div>
            {t.customersTitle}
          </h1>
          <p className="text-slate-500 text-xs mt-1 ml-[52px]">{t.customersDesc}</p>
        </div>
        <button onClick={openCreateModal}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg hover:from-cyan-600 transition-all">
          <Plus className="w-4 h-4" /> {t.addCustomer}
        </button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            fetchCustomers(e.target.value || undefined);
          }}
          placeholder={t.searchCustomers}
          className="w-full md:w-96 bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-xs min-w-[640px]">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold">
            <tr>
              <th className="px-6 py-4">{t.customerName}</th>
              <th className="px-6 py-4">{t.customerPhone}</th>
              <th className="px-6 py-4">{t.customerEmail}</th>
              <th className="px-6 py-4">{t.customerAddress}</th>
              <th className="px-6 py-4 text-right">{t.debtBalance}</th>
              <th className="px-6 py-4 text-right">{t.creditLimitCol}</th>
              <th className="px-6 py-4 text-right">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">{t.loadingCustomers}</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-8 text-center text-slate-400">{t.noCustomers}</td></tr>
            ) : (
              customers.map((c) => {
                const balance = Number(c.creditBalance ?? 0);
                return (
                <tr key={c.id} className="hover:bg-slate-50/80">
                  <td className="px-6 py-4 font-bold text-slate-900">{c.name}</td>
                  <td className="px-6 py-4 text-slate-500" dir="ltr">{c.phone || '-'}</td>
                  <td className="px-6 py-4 text-slate-500" dir="ltr">{c.email || '-'}</td>
                  <td className="px-6 py-4 text-slate-500">{c.address || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    {balance > 0 ? (
                      <span className="font-extrabold text-rose-600">{t.currency} {balance.toFixed(2)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-500">
                    {c.creditLimit != null ? `${t.currency} ${Number(c.creditLimit).toFixed(2)}` : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button onClick={() => openEditModal(c)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { setMsg(null); setDeletingCustomer(c); }} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition" title={t.deleteCustomer}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">{editingCustomer ? t.editCustomer : t.createCustomer}</h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.customerName}</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.customerPhone}</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2" dir="ltr" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.customerEmail}</label>
                  <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2" dir="ltr" />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.creditLimit}</label>
                <input type="number" min="0" step="0.01" value={formData.creditLimit} onChange={e => setFormData({ ...formData, creditLimit: e.target.value })} placeholder="0.00" className="w-full bg-slate-50 border rounded-xl px-3 py-2" dir="ltr" />
                <p className="text-[10px] text-slate-400 mt-1">{t.creditLimitCol} — {t.customerAccountsDesc}</p>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.customerAddress}</label>
                <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">{t.customerNotes}</label>
                <textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl font-bold">{t.cancel}</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold">{t.saveCustomer}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingCustomer && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">{t.confirmDeleteCustomer}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {translate(t.confirmDeleteCustomerMsg, { name: deletingCustomer.name })}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeletingCustomer(null)} disabled={deleting}
                className="px-4 py-2 border rounded-xl font-bold text-slate-700 disabled:opacity-50">{t.cancel}</button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />} {t.deleteCustomer}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
