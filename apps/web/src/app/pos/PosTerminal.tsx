import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { useSyncStore } from '../../stores/syncStore';
import { useLanguageStore, translate, localizedName } from '../../stores/languageStore';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import { api } from '../../lib/api';
import { ReceiptContent } from './components/ReceiptContent';
import { OrderHistoryModal } from './components/OrderHistoryModal';
import { CustomerModal } from './components/CustomerModal';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Smartphone,
  Landmark,
  LogOut,
  User,
  Coffee,
  LayoutDashboard,
  CheckCircle2,
  WifiOff,
  CloudOff,
  History
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  nameAr?: string;
  price: number;
  sku?: string;
  barcode?: string;
  taxRate?: any;
  category?: { name: string; nameAr?: string };
}

interface Category {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
}

export const PosTerminal: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  
  // Printing state
  const receiptRef = useRef<HTMLDivElement>(null);
  const [lastOrderDetails, setLastOrderDetails] = useState({
    orderNumber: '',
    paymentMethod: '',
    amountPaid: 0,
  });

  const [activeShift, setActiveShift] = useState<any>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftAmount, setShiftAmount] = useState('');
  const [shiftAction, setShiftAction] = useState<'OPEN'|'CLOSE'>('OPEN');
  const [resolvedBranchId, setResolvedBranchId] = useState<string | null>(useAuthStore.getState().user?.branchId || null);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: 'Receipt',
    onAfterPrint: () => {
      setOrderSuccess(false);
      clearCart();
    }
  });

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { isOnline, pendingOrders } = useSyncStore();
  const { t } = useLanguageStore();

  const {
    items,
    customer,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getSubtotal,
    getDiscountAmount,
    getTaxAmount,
    getTotal,
  } = useCartStore();

  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetchData();
    checkActiveShift();
    resolveBranch();
  }, [user]);

  // Resolve the active branch automatically instead of falling back to a
  // hard-coded placeholder that breaks order creation.
  const resolveBranch = async () => {
    if (user?.branchId) {
      setResolvedBranchId(user.branchId);
      return;
    }
    try {
      const res = await api.get('/branches');
      const branches = res.data.data || [];
      const active = branches.find((b: any) => b.isActive) || branches[0];
      setResolvedBranchId(active?.id || null);
    } catch (err) {
      console.error('Failed to resolve branch:', err);
    }
  };

  const checkActiveShift = async () => {
    if (!user) return;
    try {
      const res = await api.get('/shifts/active');
      const shift = res.data.data;
      setActiveShift(shift);
      if (!shift) {
        setShiftAction('OPEN');
        setShowShiftModal(true);
      }
    } catch (err) {
      console.error('Failed to check shift:', err);
    }
  };

  const handleShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (shiftAction === 'OPEN') {
        const res = await api.post('/shifts/open', { openingCash: Number(shiftAmount) });
        setActiveShift(res.data.data);
      } else {
        await api.post(`/shifts/${activeShift.id}/close`, { closingCash: Number(shiftAmount) });
        setActiveShift(null);
        setShiftAction('OPEN');
        setShiftAmount('');
      }
      setShowShiftModal(false);
    } catch (err: any) {
      alert(err.response?.data?.message || t.failedToProcessShift);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, setRes] = await Promise.all([
        api.get('/products?isActive=true&limit=1000'),
        api.get('/categories'),
        api.get('/settings').catch(() => ({ data: { data: null } })) // Fallback safe
      ]);
      setProducts(
        (prodRes.data.data.items || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          nameAr: p.nameAr,
          price: Number(p.price),
          sku: p.sku,
          barcode: p.barcode,
          category: p.category,
          taxRate: p.taxRate ? Number(p.taxRate.rate) : undefined,
        }))
      );
      setCategories(catRes.data.data || []);
      if (setRes.data.data) {
        setSettings(setRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = !selectedCategory || p.category?.name === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.includes(searchQuery) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCheckout = async (paymentMethod: 'CASH' | 'CARD' | 'MADA' | 'VISA' | 'MASTERCARD' | 'APPLE_PAY' | 'STC_PAY' | 'BANK_TRANSFER') => {
    if (items.length === 0) return;

    const branchId = resolvedBranchId || user?.branchId;
    if (!branchId) {
      alert(t.noBranchAssigned);
      return;
    }

    setProcessingOrder(true);

    // Client-generated idempotency key so offline replays and retries after a
    // lost response never create duplicate orders on the server.
    const idempotencyKey = crypto.randomUUID();

    const payload = {
      branchId,
      shiftId: activeShift?.id,
      customerId: customer?.id || undefined,
      idempotencyKey,
      subtotal: getSubtotal(),
      discountAmount: getDiscountAmount(),
      taxAmount: getTaxAmount(),
      total: getTotal(),
      paidAmount: getTotal(),
      items: items.map((i) => ({
        productId: i.productId,
        name: localizedName(i.name, i.nameAr),
        quantity: i.quantity,
        unitPrice: i.price,
        subtotal: i.price * i.quantity,
      })),
      payments: [
        {
          method: paymentMethod,
          amount: getTotal(),
        },
      ],
    };

    try {
      if (!isOnline) {
        // Enqueue offline order
        useSyncStore.getState().addPendingOrder(payload);
        const randomNum = Math.floor(Math.random() * 9000) + 1000;
        setLastOrderDetails({
          orderNumber: `OFFLINE-${randomNum}`,
          paymentMethod,
          amountPaid: getTotal(),
        });
        setOrderSuccess(true);
        setTimeout(() => handlePrint(), 500);
      } else {
        // Online order: the server recomputes prices and returns authoritative totals
        const res = await api.post('/orders', payload);
        const order = res.data.data;
        setLastOrderDetails({
          orderNumber: order.orderNumber,
          paymentMethod,
          amountPaid: Number(order.total),
        });
        setOrderSuccess(true);
        setTimeout(() => handlePrint(), 500);
      }
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const status = err?.response?.status;
      if (code === 'INSUFFICIENT_STOCK') {
        alert(t.insufficientStock);
        return;
      }
      // Only fall back to the offline queue for network / server errors,
      // never for validation failures (4xx).
      if (!status || status >= 500) {
        useSyncStore.getState().addPendingOrder(payload);
        const randomNum = Math.floor(Math.random() * 9000) + 1000;
        setLastOrderDetails({ orderNumber: `SYNC-${randomNum}`, paymentMethod, amountPaid: getTotal() });
        setOrderSuccess(true);
        setTimeout(() => handlePrint(), 500);
      } else {
        alert(err?.response?.data?.message || t.orderFailed);
      }
    } finally {
      setProcessingOrder(false);
    }
  };

  return (
    <div className="h-screen bg-slate-100 text-slate-800 flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/80 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <img
            src="/logo_transparent.png"
            alt="KodaSoft Logo"
            className="w-10 h-10 object-contain drop-shadow-sm"
          />
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-slate-900 flex items-center gap-1.5">
              KodaSoft-<span className="text-cyan-500">POS</span>
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
              {t.kodaSoftSoftware}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          {!isOnline && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold animate-pulse">
              <CloudOff className="w-3.5 h-3.5" />
              {translate(t.offlinePending, { count: pendingOrders.length })}
            </div>
          )}
          <Link
            to="/dashboard/products"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
          >
            <LayoutDashboard className="w-4 h-4 text-cyan-600" />
            {t.adminDashboard}
          </Link>

          <button
            onClick={() => setShowOrderHistory(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 shadow-sm"
          >
            <History className="w-4 h-4 text-cyan-600" />
            {t.orderHistory}
          </button>

          {activeShift && (
            <button
              onClick={() => {
                setShiftAction('CLOSE');
                setShowShiftModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition border border-slate-700 shadow-sm"
            >
              {t.endShift}
            </button>
          )}

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-sm">
            <User className="w-3.5 h-3.5 text-cyan-600" />
            <span className="font-bold text-slate-800">{user?.name || t.cashier}</span>
            <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold">
              {user?.role || 'CASHIER'}
            </span>
          </div>

          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
            title={t.logout}
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Section: Catalog Grid */}
        <div className="flex-1 flex flex-col p-5 overflow-hidden">
          {/* Search Bar */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute ltr:left-3.5 rtl:right-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-2xl ltr:pl-10 ltr:pr-4 rtl:pr-10 rtl:pl-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:border-cyan-500 placeholder-slate-400 shadow-sm transition-all"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-3 mb-2 no-scrollbar">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === null
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.allItems}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.name)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === c.name
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {localizedName(c.name, c.nameAr)}
              </button>
            ))}
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 ltr:pr-1 rtl:pl-1">
            {loading ? (
              <div className="col-span-full flex items-center justify-center text-slate-400 text-xs">
                {t.loading}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center text-slate-400 my-12">
                <Coffee className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
                <p className="text-xs font-medium">{t.noProducts}</p>
              </div>
            ) : (
              filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => addItem(p)}
                  className="bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-cyan-400/80 rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all hover:-translate-y-0.5 group shadow-sm hover:shadow-md"
                >
                  <div>
                    <span className="font-bold text-sm text-slate-800 group-hover:text-cyan-600 transition-colors line-clamp-1">
                      {localizedName(p.name, p.nameAr)}
                    </span>
                    {p.sku && (
                      <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                        {t.skuPrefix} {p.sku}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-base font-extrabold text-cyan-600">
                      {t.currency} {(Number(p.price) * (1 + Number(p.taxRate?.rate ?? 15) / 100)).toFixed(2)}
                    </span>
                    <span className="w-7 h-7 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-white transition-all shadow-sm">
                      <Plus className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Section: Active Cart */}
        <div className="w-96 bg-white flex flex-col ltr:border-l rtl:border-r border-slate-200/80 shadow-lg">
          {/* Cart Header */}
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-cyan-600" />
              <h2 className="font-extrabold text-sm text-slate-900">{t.currentOrder}</h2>
            </div>
            {items.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" /> {t.clear}
              </button>
            )}
          </div>

          {/* Customer Selector Bar */}
          <div
            onClick={() => setShowCustomerModal(true)}
            className="mx-4 mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition-colors shadow-xs"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <User className="w-4 h-4 text-cyan-600 shrink-0" />
              <div className="truncate text-xs">
                <span className="font-extrabold text-slate-800">
                  {customer ? customer.name : t.walkInCustomer}
                </span>
                {customer?.phone && <span className="text-[10px] text-slate-500 block font-mono">{customer.phone}</span>}
              </div>
            </div>
            <span className="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-200">
              {t.selectCustomer}
            </span>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {orderSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs text-center font-bold flex items-center justify-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-4 h-4" /> {t.orderCompleted}
              </div>
            )}

            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <ShoppingCart className="w-10 h-10 mb-2 stroke-1 text-slate-300" />
                <p className="text-xs font-medium">{t.cartEmpty}</p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.productId}
                  className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between shadow-sm"
                >
                  <div className="flex-1 ltr:pr-2 rtl:pl-2">
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">
                      {localizedName(item.name, item.nameAr)}
                    </h4>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {t.currency} {item.price.toFixed(2)} × {item.quantity}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center shadow-xs"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-extrabold w-4 text-center text-slate-800">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center shadow-xs"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Totals & Checkout Buttons */}
          <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 space-y-3">
            <div className="space-y-1.5 text-xs text-slate-500 font-medium">
              <div className="flex justify-between">
                <span>{t.subtotal}</span>
                <span className="text-slate-700 font-semibold">{t.currency} {getSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t.vat}</span>
                <span className="text-slate-700 font-semibold">{t.currency} {getTaxAmount().toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm text-slate-900 pt-2 border-t border-slate-200">
                <span>{t.totalAmount}</span>
                <span className="text-cyan-600">{t.currency} {getTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                disabled={items.length === 0 || processingOrder}
                onClick={() => handleCheckout('CASH')}
                className="py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-sm"
              >
                <Banknote className="w-4 h-4 text-emerald-600" />
                {t.payCash}
              </button>
              <button
                disabled={items.length === 0 || processingOrder}
                onClick={() => handleCheckout('CARD')}
                className="py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-sm"
              >
                <CreditCard className="w-4 h-4 text-blue-600" />
                {t.payCard}
              </button>
              <button
                disabled={items.length === 0 || processingOrder}
                onClick={() => handleCheckout('MADA')}
                className="py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-sm"
              >
                <CreditCard className="w-4 h-4 text-teal-600" />
                {t.payMada}
              </button>
              <button
                disabled={items.length === 0 || processingOrder}
                onClick={() => handleCheckout('VISA')}
                className="py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-sm"
              >
                <CreditCard className="w-4 h-4 text-indigo-600" />
                {t.payVisa}
              </button>
              <button
                disabled={items.length === 0 || processingOrder}
                onClick={() => handleCheckout('MASTERCARD')}
                className="py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-sm"
              >
                <CreditCard className="w-4 h-4 text-orange-600" />
                {t.payMastercard}
              </button>
              <button
                disabled={items.length === 0 || processingOrder}
                onClick={() => handleCheckout('APPLE_PAY')}
                className="py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-sm"
              >
                <CreditCard className="w-4 h-4 text-slate-700" />
                {t.payApplePay}
              </button>
              <button
                disabled={items.length === 0 || processingOrder}
                onClick={() => handleCheckout('STC_PAY')}
                className="py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-sm"
              >
                <Smartphone className="w-4 h-4 text-violet-600" />
                {t.payStcPay}
              </button>
              <button
                disabled={items.length === 0 || processingOrder}
                onClick={() => handleCheckout('BANK_TRANSFER')}
                className="py-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-sm"
              >
                <Landmark className="w-4 h-4 text-amber-600" />
                {t.payBankTransfer}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Order History Modal */}
      <OrderHistoryModal
        open={showOrderHistory}
        onClose={() => setShowOrderHistory(false)}
        branchId={resolvedBranchId}
      />

      {/* Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-xl font-bold mb-2">
              {shiftAction === 'OPEN' ? t.openShift : t.endShift}
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              {shiftAction === 'OPEN' 
               ? t.openingCashDesc
               : t.closingCashDesc}
            </p>
            
            <form onSubmit={handleShiftSubmit} className="space-y-4">
               <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {shiftAction === 'OPEN' ? t.openingCashAmount : t.closingCashAmount}
                  </label>
                  <div className="relative">
                    <span className="absolute ltr:left-4 rtl:right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{t.currency}</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      required 
                      autoFocus
                      value={shiftAmount} 
                      onChange={e => setShiftAmount(e.target.value)} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl ltr:pl-8 ltr:pr-4 rtl:pr-8 rtl:pl-4 py-3 text-lg font-bold" 
                    />
                  </div>
               </div>
               
               <div className="flex gap-2 pt-2">
                 {shiftAction === 'CLOSE' && (
                    <button type="button" onClick={() => setShowShiftModal(false)} className="flex-1 py-3 border rounded-xl font-bold text-slate-600 bg-white hover:bg-slate-50 text-sm">
                      {t.cancel}
                    </button>
                 )}
                 <button type="submit" className="flex-1 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors text-sm">
                   {shiftAction === 'OPEN' ? t.openShift : t.confirmCloseShift}
                 </button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Receipt Component for Printing */}
      <div style={{ display: 'none' }}>
        <ReceiptContent
          ref={receiptRef}
          orderNumber={lastOrderDetails.orderNumber}
          cashierName={user?.name || t.cashier}
          paymentMethod={lastOrderDetails.paymentMethod}
          amountPaid={lastOrderDetails.amountPaid}
          storeSettings={settings}
        />
      </div>

      {/* Customer Modal */}
      <CustomerModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
      />
    </div>
  );
};
