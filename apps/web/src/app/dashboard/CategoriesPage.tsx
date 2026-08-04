import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore, localizedName, alternateName } from '../../stores/languageStore';
import { FolderTree, Plus, Edit2, Trash2 } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  sortOrder: number;
}

export const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const { t } = useLanguageStore();

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get('/categories');
      setCategories(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCategory(null);
    setName(''); setNameAr(''); setSortOrder('0');
    setShowModal(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name); setNameAr(cat.nameAr || ''); setSortOrder(String(cat.sortOrder || 0));
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { name, nameAr: nameAr || undefined, sortOrder: Number(sortOrder) };
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, payload);
      } else {
        await api.post('/categories', payload);
      }
      setShowModal(false);
      fetchCategories();
    } catch (err: any) {
      alert(err.response?.data?.message || t.failedSaveCategory);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.deactivateCategoryConfirm)) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (err) {
      console.error('Failed to delete category:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
              <FolderTree className="w-5 h-5" />
            </div>
            {t.categoriesManagement}
          </h1>
          <p className="text-slate-500 text-xs mt-1 ml-[52px]">{t.categoriesDesc}</p>
        </div>
        <button onClick={openCreateModal}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 hover:from-cyan-600 hover:to-blue-700 transition-all">
          <Plus className="w-4 h-4" /> {t.addCategory}
        </button>
      </div>

      {/* Categories Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm max-w-3xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
            <tr>
              <th className="px-6 py-4">{t.sort}</th>
              <th className="px-6 py-4">{t.categoryName}</th>
              <th className="px-6 py-4">{t.slug}</th>
              <th className="px-6 py-4 text-right">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">{t.loadingCategories}</td></tr>
            ) : categories.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400">{t.noCategories}</td></tr>
            ) : (
              categories.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-mono font-extrabold text-cyan-600">{c.sortOrder}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {localizedName(c.name, c.nameAr)}
                    {alternateName(c.name, c.nameAr) && <span className="block text-[11px] text-slate-400 font-normal mt-0.5">{alternateName(c.name, c.nameAr)}</span>}
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-500">{c.slug}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => openEditModal(c)} className="p-2 bg-slate-100 hover:bg-cyan-50 text-slate-600 hover:text-cyan-700 rounded-xl transition-colors border border-slate-200" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="p-2 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors border border-slate-200" title="Deactivate">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-extrabold text-slate-900">
              {editingCategory ? t.editCategory : t.createCategory}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">{t.categoryNameEn}</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm" placeholder={t.categoryNamePlaceholder} />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">{t.categoryNameAr}</label>
                <input type="text" value={nameAr} onChange={(e) => setNameAr(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm" placeholder={t.categoryNameArPlaceholder} />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">{t.sortOrder}</label>
                <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-cyan-500 shadow-sm" placeholder="1" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold border border-slate-200">{t.cancel}</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-white rounded-xl hover:from-cyan-600 hover:to-blue-700 shadow-md">
                  {submitting ? t.saving : t.saveCategory}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
