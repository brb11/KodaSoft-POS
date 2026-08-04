import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore, translate } from '../../stores/languageStore';
import { Building2, Plus, Edit2, Trash2, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export const BranchesPage: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [deletingBranch, setDeletingBranch] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { t } = useLanguageStore();

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    isActive: true,
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await api.get('/branches');
      setBranches(res.data.data);
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingBranch(null);
    setFormData({ name: '', address: '', phone: '', isActive: true });
    setShowModal(true);
  };

  const openEditModal = (branch: any) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
      isActive: branch.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        await api.put(`/branches/${editingBranch.id}`, formData);
      } else {
        await api.post('/branches', formData);
      }
      setShowModal(false);
      setMsg(null);
      await fetchBranches();
    } catch (err: any) {
      alert(err.response?.data?.message || t.failedSaveBranch);
    }
  };

  const handleDelete = async () => {
    if (!deletingBranch) return;
    setDeleting(true);
    setMsg(null);
    try {
      await api.delete(`/branches/${deletingBranch.id}`);
      setMsg({ ok: true, text: t.deleteBranchSuccess });
      setDeletingBranch(null);
      await fetchBranches();
    } catch (err: any) {
      setMsg({ ok: false, text: err?.response?.data?.message || t.deleteBranchFailed });
      setDeletingBranch(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
              <Building2 className="w-5 h-5" />
            </div>
            {t.branchesTitle}
          </h1>
          <p className="text-slate-500 text-xs mt-1 ml-[52px]">{t.branchesDesc}</p>
        </div>
        <button onClick={openCreateModal}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg hover:from-cyan-600 transition-all">
          <Plus className="w-4 h-4" /> {t.addBranch}
        </button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-8 text-center text-slate-400">{t.loadingBranches}</div>
        ) : (
          branches.map(b => (
            <div key={b.id} className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                 <h3 className="font-extrabold text-lg text-slate-900 line-clamp-1">{b.name}</h3>
                 <span className={`px-2 py-1 rounded text-[10px] font-bold ${b.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                   {b.isActive ? t.active : t.inactive}
                 </span>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                 <p><span className="font-bold text-slate-700">{t.locationLabel}</span> {b.address || 'N/A'}</p>
                 <p><span className="font-bold text-slate-700">{t.contactLabel}</span> {b.phone || 'N/A'}</p>
              </div>
              <div className="pt-3 border-t flex justify-between items-center text-xs text-slate-500">
                 <div>
                    <span className="font-bold text-slate-800">{b._count.users}</span> {t.staff} · <span className="font-bold text-slate-800">{b._count.orders}</span> {t.orders}
                 </div>
                 <div className="flex items-center gap-1.5">
                   <button onClick={() => openEditModal(b)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">
                      <Edit2 className="w-3.5 h-3.5" />
                   </button>
                   <button onClick={() => { setMsg(null); setDeletingBranch(b); }} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                      <Trash2 className="w-3.5 h-3.5" />
                   </button>
                 </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">{editingBranch ? t.editBranch : t.newBranch}</h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
               <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.branchName}</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
               </div>
               <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.addressLocation}</label>
                  <input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
               </div>
               <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.contact}</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
               </div>
               <div className="flex justify-end gap-2 pt-4">
                 <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl font-bold">{t.cancel}</button>
                 <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold">{t.save}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {deletingBranch && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">{t.confirmDeleteBranch}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {translate(t.confirmDeleteBranchMsg, { name: deletingBranch.name })}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeletingBranch(null)} disabled={deleting}
                className="px-4 py-2 border rounded-xl font-bold text-slate-700 disabled:opacity-50">{t.cancel}</button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />} {t.deleteBranch}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
