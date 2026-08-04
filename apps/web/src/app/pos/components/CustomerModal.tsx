import React, { useEffect, useState } from 'react';
import { X, Search, UserPlus, UserCheck, User } from 'lucide-react';
import { api } from '../../../lib/api';
import { useLanguageStore } from '../../../stores/languageStore';
import { useCartStore, type CustomerInfo } from '../../../stores/cartStore';

interface CustomerModalProps {
  open: boolean;
  onClose: () => void;
}

export const CustomerModal: React.FC<CustomerModalProps> = ({ open, onClose }) => {
  const { t } = useLanguageStore();
  const { customer: currentCustomer, setCustomer } = useCartStore();

  const [customers, setCustomers] = useState<CustomerInfo[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // New Customer Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      loadCustomers('');
      setShowAddForm(false);
    }
  }, [open]);

  const loadCustomers = async (searchTerm: string) => {
    setLoading(true);
    try {
      const res = await api.get('/customers', { params: { search: searchTerm || undefined, limit: 30 } });
      setCustomers(res.data.data.items || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearch(val);
    loadCustomers(val);
  };

  const handleSelect = (cust: CustomerInfo | null) => {
    setCustomer(cust);
    onClose();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/customers', { name: name.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined });
      const newCust = res.data.data;
      setCustomer({ id: newCust.id, name: newCust.name, phone: newCust.phone });
      setName('');
      setPhone('');
      setEmail('');
      setShowAddForm(false);
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create customer');
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[75] backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-cyan-600" />
            {t.selectCustomer}
          </h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {showAddForm ? (
          <form onSubmit={handleCreateCustomer} className="p-6 flex flex-col gap-4">
            <h4 className="text-sm font-extrabold text-slate-800">{t.addCustomer}</h4>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.customerName} *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.customerPhone}</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني (اختياري)</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-600 text-xs hover:bg-slate-50"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold text-xs disabled:opacity-50"
              >
                {creating ? t.processing : t.save}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Search & Actions */}
            <div className="p-4 border-b border-slate-200/80 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute ltr:left-3 rtl:right-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم الجوال..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-bold transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                {t.addCustomer}
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {/* Default Walk-in Customer option */}
              <div
                onClick={() => handleSelect(null)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  !currentCustomer ? 'bg-cyan-50/60 border-cyan-300' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">{t.walkInCustomer}</h4>
                  <p className="text-[10px] text-slate-500">بدون تسجيل بيانات العميل</p>
                </div>
                {!currentCustomer && <UserCheck className="w-4 h-4 text-cyan-600" />}
              </div>

              {loading ? (
                <div className="text-center py-8 text-xs text-slate-400">{t.loading}</div>
              ) : (
                customers.map((c) => {
                  const isSelected = currentCustomer?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => handleSelect(c)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected ? 'bg-cyan-50/60 border-cyan-300' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900">{c.name}</h4>
                        {c.phone && <p className="text-[10px] font-mono text-slate-500">{c.phone}</p>}
                      </div>
                      {isSelected && <UserCheck className="w-4 h-4 text-cyan-600" />}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
