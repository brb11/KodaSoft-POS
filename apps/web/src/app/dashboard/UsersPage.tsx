import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore, translate } from '../../stores/languageStore';
import { useAuthStore } from '../../stores/authStore';
import { Users, Plus, Edit2, Trash2, Building2, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deletingUser, setDeletingUser] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const currentUser = useAuthStore((s) => s.user);
  const { t } = useLanguageStore();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    pin: '',
    role: 'CASHIER',
    branchId: '',
    isActive: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usrRes, brRes] = await Promise.all([
        api.get('/users'),
        api.get('/branches')
      ]);
      setUsers(usrRes.data.data);
      setBranches(brRes.data.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', password: '', pin: '', role: 'CASHIER', branchId: branches[0]?.id || '', isActive: true });
    setShowModal(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      pin: '',
      role: user.role,
      branchId: user.branch?.id || '',
      isActive: user.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, formData);
      } else {
        await api.post('/users', formData);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || t.failedSaveUser);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    setMsg(null);
    try {
      await api.delete(`/users/${deletingUser.id}`);
      setMsg({ ok: true, text: t.deleteUserSuccess });
      setDeletingUser(null);
      fetchData();
    } catch (err: any) {
      setMsg({ ok: false, text: err?.response?.data?.message || t.deleteUserFailed });
      setDeletingUser(null);
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
              <Users className="w-5 h-5" />
            </div>
            {t.usersTitle}
          </h1>
          <p className="text-slate-500 text-xs mt-1 ml-[52px]">{t.usersDesc}</p>
        </div>
        <button onClick={openCreateModal}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg hover:from-cyan-600 transition-all">
          <Plus className="w-4 h-4" /> {t.addUser}
        </button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold border ${msg.ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {msg.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold">
            <tr>
              <th className="px-6 py-4">{t.name}</th>
              <th className="px-6 py-4">{t.emailAddress}</th>
              <th className="px-6 py-4">{t.role}</th>
              <th className="px-6 py-4">{t.branch}</th>
              <th className="px-6 py-4">{t.status}</th>
              <th className="px-6 py-4 text-right">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
             {loading ? (
               <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">{t.loadingUsers}</td></tr>
             ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-4 font-bold text-slate-900">{u.name}</td>
                    <td className="px-6 py-4 text-slate-500">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded border text-[10px] font-extrabold ${u.role === 'OWNER' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                        {u.role === 'OWNER' ? t.ownerRole : u.role === 'MANAGER' ? t.managerRole : t.cashierRole}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {u.branch?.name ? <span className="flex items-center gap-1"><Building2 className="w-3 h-3"/> {u.branch.name}</span> : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {u.isActive ? t.active : t.inactive}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="inline-flex items-center gap-1.5">
                         <button onClick={() => openEditModal(u)} className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition">
                           <Edit2 className="w-3.5 h-3.5" />
                         </button>
                         <button onClick={() => { setMsg(null); setDeletingUser(u); }} disabled={u.id === currentUser?.id}
                           className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition disabled:opacity-40 disabled:cursor-not-allowed" title={t.deleteUser}>
                           <Trash2 className="w-3.5 h-3.5" />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))
             )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">{editingUser ? t.editUser : t.createUser}</h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
               <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.fullName}</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
               </div>
               <div>
                  <label className="block font-bold text-slate-700 mb-1">{t.email}</label>
                  <input type="email" required disabled={!!editingUser} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2 disabled:opacity-50" />
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{t.role}</label>
                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2">
                       <option value="CASHIER">{t.cashierRole}</option>
                       <option value="MANAGER">{t.managerRole}</option>
                       <option value="OWNER">{t.ownerRole}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{t.branch}</label>
                    <select value={formData.branchId} onChange={e => setFormData({ ...formData, branchId: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2">
                       {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{editingUser ? t.newPasswordOptional : t.password}</label>
                    <input type="password" required={!editingUser} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">{editingUser ? t.newPinOptional : t.loginPin}</label>
                    <input type="password" maxLength={4} minLength={4} value={formData.pin} onChange={e => setFormData({ ...formData, pin: e.target.value })} className="w-full bg-slate-50 border rounded-xl px-3 py-2" />
                  </div>
               </div>
               <div className="flex justify-end gap-2 pt-4">
                 <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl font-bold">{t.cancel}</button>
                 <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold">{t.saveUser}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">{t.confirmDeleteUser}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {translate(t.confirmDeleteUserMsg, { name: deletingUser.name })}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDeletingUser(null)} disabled={deleting}
                className="px-4 py-2 border rounded-xl font-bold text-slate-700 disabled:opacity-50">{t.cancel}</button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50">
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />} {t.deleteUser}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
