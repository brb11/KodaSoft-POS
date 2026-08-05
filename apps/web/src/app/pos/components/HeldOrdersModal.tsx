import React, { useEffect, useState } from 'react';
import { X, PauseCircle, Play, Trash2, Loader2, ShoppingBag } from 'lucide-react';
import { api } from '../../../lib/api';
import { useLanguageStore, translate, localizedName } from '../../../stores/languageStore';
import { useCartStore } from '../../../stores/cartStore';

interface HeldItem {
  productId: string;
  variantId?: string;
  name: string;
  nameAr?: string;
  price: number;
  quantity: number;
  sku?: string;
  taxRate?: number;
}

interface HeldCustomer {
  id: string;
  name: string;
  phone?: string | null;
}

interface HeldOrder {
  id: string;
  items: HeldItem[];
  customer: HeldCustomer | null;
  itemCount: number;
  total: number;
  discount: number;
  discountType: 'percent' | 'fixed';
  createdAt: string;
}

interface HeldOrdersModalProps {
  open: boolean;
  onClose: () => void;
  branchId?: string | null;
  onResumed?: (order: HeldOrder) => void;
}

export const HeldOrdersModal: React.FC<HeldOrdersModalProps> = ({ open, onClose, branchId, onResumed }) => {
  const { t } = useLanguageStore();
  const [orders, setOrders] = useState<HeldOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: 'resume' | 'delete'; order: HeldOrder } | null>(null);

  useEffect(() => {
    if (open) {
      setConfirm(null);
      loadHeld();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, branchId]);

  const loadHeld = async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await api.get('/held-orders', {
        params: { branchId: branchId || undefined },
      });
      setOrders(res.data.data || []);
    } catch (err) {
      console.error('Failed to load held orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const runResume = async (order: HeldOrder) => {
    setBusyId(order.id);
    try {
      useCartStore.getState().restoreCart({
        items: order.items || [],
        customer: order.customer || null,
        discount: Number(order.discount || 0),
        discountType: order.discountType === 'fixed' ? 'fixed' : 'percent',
      });
      await api.delete(`/held-orders/${order.id}`);
      setConfirm(null);
      onResumed?.(order);
      await loadHeld();
    } catch (err: any) {
      alert(err?.response?.data?.message || t.orderHeldFailed);
    } finally {
      setBusyId(null);
    }
  };

  const runDelete = async (order: HeldOrder) => {
    setBusyId(order.id);
    try {
      await api.delete(`/held-orders/${order.id}`);
      setConfirm(null);
      await loadHeld();
    } catch (err: any) {
      alert(err?.response?.data?.message || t.orderHeldFailed);
    } finally {
      setBusyId(null);
    }
  };

  const handleResumeClick = (order: HeldOrder) => {
    const cartNotEmpty = useCartStore.getState().items.length > 0;
    if (cartNotEmpty) {
      setConfirm({ action: 'resume', order });
    } else {
      runResume(order);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[65] backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col relative max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
              <PauseCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t.heldOrders}</h3>
              <p className="text-[11px] text-slate-400">{t.currentOrder}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <ShoppingBag className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
              <p className="text-xs font-medium">{t.heldEmpty}</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {orders.map((order) => {
                const label = order.customer?.name || t.walkInCustomer;
                return (
                  <div
                    key={order.id}
                    className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between gap-2 shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{label}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {translate(t.heldItems, { count: order.itemCount })} · {new Date(order.createdAt).toLocaleString()}
                      </p>
                      {order.items?.length > 0 && (
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                          {order.items.map((i) => localizedName(i.name, i.nameAr)).join('، ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-extrabold text-slate-900">{t.currency} {Number(order.total).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleResumeClick(order)}
                        disabled={busyId === order.id}
                        title={t.resumeOrder}
                        className="w-8 h-8 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-700 flex items-center justify-center shadow-xs transition-colors"
                      >
                        {busyId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setConfirm({ action: 'delete', order })}
                        disabled={busyId === order.id}
                        title={t.delete}
                        className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shadow-xs transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirm panel */}
        {confirm && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center p-6 text-center">
            <p className="text-sm font-bold text-slate-800 mb-1">
              {confirm.action === 'resume' ? t.confirmResumeCart : t.confirmDeleteHeld}
            </p>
            <p className="text-[11px] text-slate-500 mb-5">
              {confirm.order.customer?.name || t.walkInCustomer} · {t.currency} {Number(confirm.order.total).toFixed(2)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => (confirm.action === 'resume' ? runResume(confirm.order) : runDelete(confirm.order))}
                disabled={busyId === confirm.order.id}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors ${
                  confirm.action === 'resume' ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {busyId === confirm.order.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {confirm.action === 'resume' ? t.resumeOrder : t.delete}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
