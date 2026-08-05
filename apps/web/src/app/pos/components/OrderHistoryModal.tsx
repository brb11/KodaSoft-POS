import React, { useEffect, useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { X, Search, RefreshCw, ArrowLeftRight, ChevronLeft, ChevronRight, Eye, Printer } from 'lucide-react';
import { api } from '../../../lib/api';
import { useLanguageStore, localizedName, paymentMethodLabel, translate } from '../../../stores/languageStore';
import { ZatcaQr } from './ZatcaQr';

interface OrderItemRow {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  refundedQuantity?: number;
  unitPrice: number;
  discountAmount?: number;
  taxAmount?: number;
  subtotal?: number;
}

interface PaymentRow {
  id: string;
  method: string;
  amount: number;
  reference?: string;
  status: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: 'COMPLETED' | 'VOIDED' | 'REFUNDED' | 'PENDING';
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  total: number;
  paidAmount?: number;
  changeAmount?: number;
  invoiceType?: string;
  notes?: string;
  invoiceUuid?: string;
  invoiceHash?: string;
  createdAt: string;
  cashier?: { name: string } | null;
  customer?: { name: string; phone?: string } | null;
  items: OrderItemRow[];
  payments?: PaymentRow[];
}

interface OrderHistoryModalProps {
  open: boolean;
  onClose: () => void;
  branchId?: string | null;
}

type StatusFilter = 'ALL' | 'COMPLETED' | 'VOIDED' | 'REFUNDED';

function refundedLineAmount(item: OrderItemRow): number {
  const qty = Number(item.quantity);
  const refunded = Number(item.refundedQuantity ?? 0);
  if (qty <= 0 || refunded <= 0) return 0;
  const lineGross = Number(item.subtotal ?? Number(item.unitPrice) * qty) + Number(item.taxAmount ?? 0);
  return lineGross * Math.min(refunded / qty, 1);
}

export const OrderHistoryModal: React.FC<OrderHistoryModalProps> = ({ open, onClose, branchId }) => {
  const { t } = useLanguageStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ order: Order; type: 'refund' | 'void' } | null>(null);
  const [reason, setReason] = useState('');
  const [refundQuantities, setRefundQuantities] = useState<Record<string, number>>({});
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [storeSettings, setStoreSettings] = useState<{ storeName?: string; vatNumber?: string; taxId?: string } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: 'Receipt',
  });

  useEffect(() => {
    if (open) {
      setPage(1);
      setSearch('');
      setStatusFilter('ALL');
      setPendingAction(null);
      setSelectedOrderDetails(null);
      loadOrders(1, '');
      api
        .get('/settings')
        .then((res) => setStoreSettings(res.data.data || null))
        .catch(() => { });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, branchId]);

  const loadOrders = async (targetPage: number, searchTerm: string, status: StatusFilter = statusFilter) => {
    setLoading(true);
    try {
      const res = await api.get('/orders', {
        params: {
          page: targetPage,
          limit: 50,
          branchId: branchId || undefined,
          search: searchTerm || undefined,
          status: status === 'ALL' ? undefined : status,
        },
      });
      setOrders(res.data.data.items || []);
      setTotalPages(res.data.data.totalPages || 1);
      setPage(targetPage);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      loadOrders(1, value);
    }, 400);
  };

  const handleStatusFilter = (status: StatusFilter) => {
    setStatusFilter(status);
    loadOrders(1, search, status);
  };

  const startRefund = (order: Order) => {
    const initialQty: Record<string, number> = {};
    (order.items || []).forEach((item) => {
      const remaining = Number(item.quantity) - Number(item.refundedQuantity ?? 0);
      initialQty[item.id] = remaining;
    });
    setRefundQuantities(initialQty);
    setReason('');
    setPendingAction({ order, type: 'refund' });
  };

  const handleQtyChange = (itemId: string, maxQty: number, val: number) => {
    const qty = Math.max(0, Math.min(maxQty, val));
    setRefundQuantities((prev) => ({ ...prev, [itemId]: qty }));
  };

  const executeAction = async () => {
    if (!pendingAction) return;
    const { order, type } = pendingAction;
    setProcessingId(order.id);
    try {
      if (type === 'refund') {
        const itemsPayload = Object.entries(refundQuantities)
          .filter(([, q]) => q > 0)
          .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));

        if (itemsPayload.length === 0) {
          alert(t.noItemsSelected);
          setProcessingId(null);
          return;
        }

        await api.post(`/orders/${order.id}/refund`, {
          reason: reason.trim() || undefined,
          items: itemsPayload,
        });
        alert(t.refundSuccess);
      } else {
        await api.post(`/orders/${order.id}/void`, { reason: reason.trim() || undefined });
        alert(t.voidSuccess);
      }
      setPendingAction(null);
      setReason('');
      await loadOrders(page, search);
    } catch (err: any) {
      alert(err.response?.data?.message || (type === 'refund' ? t.refundFailed : t.voidFailed));
    } finally {
      setProcessingId(null);
    }
  };

  if (!open) return null;

  const statusBadge = (status: string) => {
    const base = 'px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wide';
    switch (status) {
      case 'COMPLETED':
        return <span className={`${base} bg-emerald-50 text-emerald-700 border border-emerald-200`}>{t.statusCompleted}</span>;
      case 'VOIDED':
        return <span className={`${base} bg-amber-50 text-amber-700 border border-amber-200`}>{t.statusVoided}</span>;
      case 'REFUNDED':
        return <span className={`${base} bg-rose-50 text-rose-600 border border-rose-200`}>{t.statusRefunded}</span>;
      default:
        return <span className={`${base} bg-slate-100 text-slate-500 border border-slate-200`}>{t.statusPending}</span>;
    }
  };

  const statusChips: { key: StatusFilter; label: string }[] = [
    { key: 'ALL', label: t.statusAll },
    { key: 'COMPLETED', label: t.statusCompleted },
    { key: 'REFUNDED', label: t.statusRefunded },
    { key: 'VOIDED', label: t.statusVoided },
  ];

  const hasRefunds = (selectedOrderDetails?.items || []).some((i) => Number(i.refundedQuantity ?? 0) > 0);
  const refundedAmount = (selectedOrderDetails?.items || []).reduce((sum, i) => sum + refundedLineAmount(i), 0);
  const netTotal = Number(selectedOrderDetails?.total ?? 0) - refundedAmount;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60 rounded-t-3xl">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-cyan-600" />
              {t.orderHistory}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.orderHistoryDesc}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-slate-200/80 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute ltr:left-3 rtl:right-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t.searchOrder}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl ltr:pl-9 ltr:pr-3 rtl:pr-9 rtl:pl-3 py-2 text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex gap-1.5">
            {statusChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => handleStatusFilter(chip.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${statusFilter === chip.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center text-slate-400 text-xs py-12">{t.loadingOrders}</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-slate-400 py-12">
              <RefreshCw className="w-8 h-8 mb-2 stroke-1 text-slate-300" />
              <p className="text-xs font-medium">{t.noOrdersFound}</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <th className="text-start pb-2 ltr:pr-3 rtl:pl-3">{t.orderNumber}</th>
                  <th className="text-start pb-2 ltr:pr-3 rtl:pl-3">{t.orderDate}</th>
                  <th className="text-start pb-2 ltr:pr-3 rtl:pl-3">{t.cashierLabel}</th>
                  <th className="text-start pb-2 ltr:pr-3 rtl:pl-3">{t.customerCol}</th>
                  <th className="text-end pb-2 ltr:pr-3 rtl:pl-3">{t.orderTotal}</th>
                  <th className="text-center pb-2 ltr:pr-3 rtl:pl-3">{t.status}</th>
                  <th className="text-end pb-2">{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="py-3 ltr:pr-3 rtl:pl-3 font-mono font-bold text-slate-800">{order.orderNumber}</td>
                    <td className="py-3 ltr:pr-3 rtl:pl-3 text-slate-500">
                      {new Date(order.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 ltr:pr-3 rtl:pl-3 text-slate-600">{order.cashier?.name || '—'}</td>
                    <td className="py-3 ltr:pr-3 rtl:pl-3 text-slate-600">
                      {localizedName(order.customer?.name) || '—'}
                    </td>
                    <td className="py-3 text-end ltr:pr-3 rtl:pl-3 font-extrabold text-slate-800">
                      {t.currency} {Number(order.total).toFixed(2)}
                    </td>
                    <td className="py-3 text-center ltr:pr-3 rtl:pl-3">{statusBadge(order.status)}</td>
                    <td className="py-3 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedOrderDetails(order)}
                          title={t.viewDetails}
                          className="px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-lg font-bold text-[10px] transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {t.viewDetails}
                        </button>
                        {order.status === 'COMPLETED' && (
                          <>
                            <button
                              onClick={() => startRefund(order)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg font-bold text-[10px] transition-colors"
                            >
                              {t.refundOrder}
                            </button>
                            {!order.items?.some((i) => Number(i.refundedQuantity ?? 0) > 0) && (
                              <button
                                onClick={() => {
                                  setReason('');
                                  setPendingAction({ order, type: 'void' });
                                }}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg font-bold text-[10px] transition-colors"
                              >
                                {t.voidOrder}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="px-6 py-3 border-t border-slate-200/80 flex items-center justify-between bg-slate-50/60 rounded-b-3xl">
          <span className="text-[10px] text-slate-400 font-bold">
            {page} / {Math.max(totalPages, 1)}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => loadOrders(page - 1, search)}
              className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => loadOrders(page + 1, search)}
              className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Action Overlay */}
      {pendingAction && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <h4 className="text-base font-extrabold text-slate-900 mb-1">
              {pendingAction.type === 'refund' ? t.confirmRefund : t.confirmVoid}
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              {pendingAction.type === 'refund' ? t.confirmRefundMsg : t.confirmVoidMsg}
            </p>

            {/* Item List for Partial Refund */}
            {pendingAction.type === 'refund' && (
              <div className="mb-4 flex-1 overflow-y-auto max-h-[250px] border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">{t.itemsToRefund}</label>
                {(pendingAction.order.items || []).map((item) => {
                  const remaining = Number(item.quantity) - Number(item.refundedQuantity ?? 0);
                  const qty = refundQuantities[item.id] ?? remaining;
                  return (
                    <div key={item.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{item.name}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {t.price}: {item.unitPrice} | {t.soldCol}: {Number(item.quantity)}
                          {Number(item.refundedQuantity ?? 0) > 0 ? ` | ${t.refundedCol}: ${Number(item.refundedQuantity)}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, remaining, qty - 1)}
                          className="w-6 h-6 rounded-lg bg-slate-100 font-bold text-slate-600 hover:bg-slate-200 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold w-6 text-center">{qty}</span>
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.id, remaining, qty + 1)}
                          className="w-6 h-6 rounded-lg bg-slate-100 font-bold text-slate-600 hover:bg-slate-200 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.refundReason}
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t.refundReasonPlaceholder}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPendingAction(null)}
                className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 bg-white hover:bg-slate-50 text-sm"
              >
                {t.cancel}
              </button>
              <button
                onClick={executeAction}
                disabled={processingId === pendingAction.order.id}
                className={`flex-1 py-3 rounded-xl font-bold text-white text-sm transition-colors disabled:opacity-50 ${pendingAction.type === 'refund' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
              >
                {processingId === pendingAction.order.id ? t.processing : pendingAction.type === 'refund' ? t.confirmRefund : t.confirmVoid}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Invoice Details Overlay */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-slate-50/60 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <h4 className="text-base font-extrabold text-slate-900">{t.invoiceDetails}</h4>
                {statusBadge(selectedOrderDetails.status)}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePrint()}
                  title={t.printReceipt}
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedOrderDetails(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-slate-400 text-[10px] uppercase block">{t.orderNumber}</span>
                  <span className="font-mono font-bold text-slate-800">{selectedOrderDetails.orderNumber}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-slate-400 text-[10px] uppercase block">{t.date}</span>
                  <span className="font-bold text-slate-700">{new Date(selectedOrderDetails.createdAt).toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-slate-400 text-[10px] uppercase block">{t.cashierLabel}</span>
                  <span className="font-bold text-slate-700">{selectedOrderDetails.cashier?.name || '—'}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-slate-400 text-[10px] uppercase block">{t.customerCol}</span>
                  <span className="font-bold text-slate-700">
                    {localizedName(selectedOrderDetails.customer?.name) || '—'}
                    {selectedOrderDetails.customer?.phone ? ` • ${selectedOrderDetails.customer.phone}` : ''}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div>
                <h5 className="text-xs font-extrabold text-slate-700 mb-2 uppercase tracking-wide">{t.itemCol}</h5>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <th className="text-start pb-2 ltr:pr-2 rtl:pl-2">{t.name}</th>
                      <th className="text-center pb-2 ltr:pr-2 rtl:pl-2">{t.qtyCol}</th>
                      {hasRefunds && <th className="text-center pb-2 ltr:pr-2 rtl:pl-2">{t.refundedCol}</th>}
                      <th className="text-end pb-2 ltr:pr-2 rtl:pl-2">{t.price}</th>
                      <th className="text-end pb-2">{t.totalCol}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedOrderDetails.items || []).map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-2.5 ltr:pr-2 rtl:pl-2 font-semibold text-slate-700">{item.name}</td>
                        <td className="py-2.5 text-center text-slate-600">{Number(item.quantity)}</td>
                        {hasRefunds && (
                          <td className="py-2.5 text-center">
                            {Number(item.refundedQuantity ?? 0) > 0 ? (
                              <span className="text-rose-600 font-bold">
                                {Number(item.refundedQuantity)} / {Number(item.quantity)}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        )}
                        <td className="py-2.5 text-end text-slate-600">
                          {t.currency} {Number(item.unitPrice).toFixed(2)}
                        </td>
                        <td className="py-2.5 text-end font-bold text-slate-800">
                          {t.currency} {(Number(item.unitPrice) * Number(item.quantity)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5 text-xs max-w-xs ltr:ml-auto rtl:mr-auto">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.subtotalCol}</span>
                  <span className="font-semibold text-slate-800">{t.currency} {Number(selectedOrderDetails.subtotal ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.discountLabel}</span>
                  <span className="font-semibold text-rose-500">{t.currency} {Number(selectedOrderDetails.discountAmount ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t.vatCol}</span>
                  <span className="font-semibold text-slate-800">{t.currency} {Number(selectedOrderDetails.taxAmount ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-2 border-t border-slate-200">
                  <span>{t.totalColValue}</span>
                  <span className="text-cyan-600">{t.currency} {Number(selectedOrderDetails.total).toFixed(2)}</span>
                </div>
                {refundedAmount > 0 && (
                  <>
                    <div className="flex justify-between pt-1 border-t border-slate-200">
                      <span className="text-rose-500 font-bold">{t.refundedAmount}</span>
                      <span className="font-bold text-rose-500">-{t.currency} {refundedAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-sm text-slate-900">
                      <span>{t.netTotal}</span>
                      <span className="text-emerald-600">{t.currency} {netTotal.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Payments */}
              {(selectedOrderDetails.payments || []).length > 0 && (
                <div>
                  <h5 className="text-xs font-extrabold text-slate-700 mb-2 uppercase tracking-wide">{t.paymentCol}</h5>
                  <div className="space-y-1.5">
                    {(selectedOrderDetails.payments || []).map((p) => (
                      <div key={p.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs">
                        <span className="font-bold text-slate-700">{paymentMethodLabel(p.method)}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-slate-400 text-[10px] uppercase">{p.status}</span>
                          <span className="font-extrabold text-slate-800">{t.currency} {Number(p.amount).toFixed(2)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ZATCA / E-Invoice */}
              <div className="flex items-start justify-between gap-4 bg-emerald-50/50 border border-emerald-200 rounded-xl p-4">
                <div className="text-[10px] text-slate-600 space-y-1">
                  <p className="font-extrabold text-slate-800 uppercase tracking-wide">{t.zatcaInvoice}</p>
                  {selectedOrderDetails.invoiceUuid && (
                    <p className="break-all">
                      <span className="text-slate-400 font-bold">{t.invoiceUuid}: </span>
                      <span className="font-mono">{selectedOrderDetails.invoiceUuid}</span>
                    </p>
                  )}
                  {selectedOrderDetails.invoiceHash && (
                    <p className="break-all">
                      <span className="text-slate-400 font-bold">{t.invoiceHash}: </span>
                      <span className="font-mono">{selectedOrderDetails.invoiceHash}</span>
                    </p>
                  )}
                </div>
                <ZatcaQr
                  sellerName={storeSettings?.storeName || 'KODASOFT'}
                  vatNumber={storeSettings?.vatNumber || storeSettings?.taxId || 'N/A'}
                  timestamp={new Date(selectedOrderDetails.createdAt)}
                  total={Number(selectedOrderDetails.total)}
                  vat={Number(selectedOrderDetails.taxAmount ?? 0)}
                  size={80}
                />
              </div>

              {/* Notes */}
              {selectedOrderDetails.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                  <span className="font-extrabold block mb-0.5">{t.notesLabel}</span>
                  {selectedOrderDetails.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable Receipt */}
      {selectedOrderDetails && (
        <div style={{ display: 'none' }}>
          <div
            ref={receiptRef}
            className="w-[300px] p-4 bg-white text-black font-mono text-sm leading-tight"
            style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
          >
            <div className="text-center mb-3">
              <h1 className="font-bold text-xl uppercase mb-1 tracking-widest">KODASOFT</h1>
              <p className="text-xs">{t.enterprisePos}</p>
              <div className="border-b border-dashed border-gray-400 my-2"></div>
            </div>
            <div className="mb-3 text-xs">
              <div className="flex justify-between"><span>{t.orderNumber}</span><span className="font-bold">{selectedOrderDetails.orderNumber}</span></div>
              <div className="flex justify-between"><span>{t.date}</span><span>{new Date(selectedOrderDetails.createdAt).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>{t.cashierLabel}</span><span>{selectedOrderDetails.cashier?.name || ''}</span></div>
            </div>
            <div className="border-b border-dashed border-gray-400 mb-2"></div>
            <table className="w-full text-xs text-left mb-3">
              <thead>
                <tr className="border-b border-dashed border-gray-400">
                  <th className="py-1">{t.itemCol}</th>
                  <th className="py-1 text-center">{t.qtyCol}</th>
                  <th className="py-1 text-right">{t.totalCol}</th>
                </tr>
              </thead>
              <tbody>
                {(selectedOrderDetails.items || []).map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="py-1 pr-2 max-w-[120px] break-words">{item.name}</td>
                    <td className="py-1 text-center">{Number(item.quantity)}</td>
                    <td className="py-1 text-right">{t.currency} {(Number(item.unitPrice) * Number(item.quantity)).toFixed(2)}</td>
                  </tr>
                ))}
                {hasRefunds &&
                  (selectedOrderDetails.items || [])
                    .filter((item) => Number(item.refundedQuantity ?? 0) > 0)
                    .map((item) => (
                      <tr key={`${item.id}-refunded`} className="align-top text-red-600">
                        <td className="py-0.5 pl-4 pr-2 max-w-[120px] break-words line-through">{item.name}</td>
                        <td className="py-0.5 text-center">-{Number(item.refundedQuantity)}</td>
                        <td className="py-0.5 text-right">-{t.currency} {refundedLineAmount(item).toFixed(2)}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
            <div className="border-b border-dashed border-gray-400 mb-2"></div>
            <div className="space-y-1 text-xs mb-3">
              <div className="flex justify-between"><span>{t.subtotalCol}</span><span>{t.currency} {Number(selectedOrderDetails.subtotal ?? 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t.discountLabel}</span><span>{t.currency} {Number(selectedOrderDetails.discountAmount ?? 0).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>{t.vatCol}</span><span>{t.currency} {Number(selectedOrderDetails.taxAmount ?? 0).toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-gray-300 mt-1">
                <span>{t.totalColValue}</span><span>{t.currency} {Number(selectedOrderDetails.total).toFixed(2)}</span>
              </div>
              {refundedAmount > 0 && (
                <>
                  <div className="flex justify-between text-red-600 font-bold">
                    <span>{t.refundedAmount}</span><span>-{t.currency} {refundedAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>{t.netTotal}</span><span>{t.currency} {netTotal.toFixed(2)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span>{translate(t.paidBy, { method: (selectedOrderDetails.payments || []).map((p) => paymentMethodLabel(p.method)).join(' + ') })}</span><span>{t.currency} {Number(selectedOrderDetails.paidAmount ?? 0).toFixed(2)}</span>
              </div>
            </div>
            <div className="text-center text-xs">
              <p className="font-bold">{t.thankYou}</p>
              <p>{t.keepReceipt}</p>
              <div className="flex justify-center mt-2">
                <ZatcaQr
                  sellerName={storeSettings?.storeName || 'KODASOFT'}
                  vatNumber={storeSettings?.vatNumber || storeSettings?.taxId || 'N/A'}
                  timestamp={new Date(selectedOrderDetails.createdAt)}
                  total={Number(selectedOrderDetails.total)}
                  vat={Number(selectedOrderDetails.taxAmount ?? 0)}
                  size={72}
                />
              </div>
              {selectedOrderDetails.invoiceUuid && (
                <p className="text-[9px] mt-1 break-all font-mono">{t.invoiceUuid}: {selectedOrderDetails.invoiceUuid}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
