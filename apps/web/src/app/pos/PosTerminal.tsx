import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { useCartStore } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { useSyncStore } from '../../stores/syncStore';
import { useLanguageStore, translate, localizedName } from '../../stores/languageStore';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import { api, apiLogout } from '../../lib/api';
import { ReceiptContent } from './components/ReceiptContent';
import { OrderHistoryModal } from './components/OrderHistoryModal';
import { CustomerModal } from './components/CustomerModal';
import { DiscountModal } from './components/DiscountModal';
import { PaymentModal, type PaymentInput, type PaymentMethod } from './components/PaymentModal';
import { BarcodeCameraModal } from './components/BarcodeCameraModal';
import { HeldOrdersModal } from './components/HeldOrdersModal';
import { ExpensesModal } from './components/ExpensesModal';
import { ProductCard } from './components/ProductCard';
import { CartItemRow } from './components/CartItemRow';
import { LiveClock } from './components/LiveClock';
import {
  Search,
  ShoppingCart,
  Trash2,
  CreditCard,
  Banknote,
  LogOut,
  User,
  Coffee,
  LayoutDashboard,
  CheckCircle2,
  CloudOff,
  History,
  HandCoins,
  ScanBarcode,
  Pause,
  PauseCircle,
  XCircle,
  BadgePercent,
  Split,
  Flame,
  LayoutGrid,
  List,
  Keyboard,
  X,
  Zap,
  PackageCheck,
  Receipt,
  Building2,
  Sun,
  Cloud,
  CloudRain,
  Wind,
  Box,
  ShoppingBasket,
  Wallet
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
  trackInventory?: boolean;
  inventory?: { branchId: string; quantity: number }[];
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

  // ── Branch name is resolved from user or API ──────────────────────────────
  const [branchName, setBranchName] = useState<string>('');

  // ── Weather (browser Geolocation → OpenMeteo) ────────────────────────────
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);

  const weatherDesc = (code: number) => {
    if (code === 0) return { label: t.weatherSunny, icon: <Sun className="w-3.5 h-3.5 text-amber-500" /> };
    if (code <= 3) return { label: t.weatherCloudy, icon: <Cloud className="w-3.5 h-3.5 text-slate-400" /> };
    if (code <= 67) return { label: t.weatherRainy, icon: <CloudRain className="w-3.5 h-3.5 text-blue-500" /> };
    return { label: t.weatherWindy, icon: <Wind className="w-3.5 h-3.5 text-slate-500" /> };
  };

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weathercode`
          );
          const data = await res.json();
          setWeather({
            temp: Math.round(data.current.temperature_2m),
            code: data.current.weathercode,
          });
        } catch {/* ignore weather errors */}
      },
      () => {/* geolocation denied – no weather shown */}
    );
  }, []);


  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<string | null>(null);
  const [recentlyScannedId, setRecentlyScannedId] = useState<string | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  
  // Printing state
  const receiptRef = useRef<HTMLDivElement>(null);
  const [lastOrderDetails, setLastOrderDetails] = useState({
    orderNumber: '',
    paymentMethod: '',
    amountPaid: 0,
    payments: [] as { method: PaymentMethod; amount: number }[],
  });

  const [activeShift, setActiveShift] = useState<any>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftAmount, setShiftAmount] = useState('');
  const [shiftAction, setShiftAction] = useState<'OPEN'|'CLOSE'>('OPEN');
  const [resolvedBranchId, setResolvedBranchId] = useState<string | null>(useAuthStore.getState().user?.branchId || null);

  // Fetch branch name after resolvedBranchId is available
  useEffect(() => {
    if (!resolvedBranchId) return;
    api.get('/branches').then(res => {
      const branches: any[] = res.data.data || [];
      const found = branches.find((b: any) => b.id === resolvedBranchId);
      if (found) setBranchName(found.name || '');
    }).catch(() => {});
  }, [resolvedBranchId]);

  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [showHeldOrders, setShowHeldOrders] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [showCameraScan, setShowCameraScan] = useState(false);
  const [showCartPanel, setShowCartPanel] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ id: number; ok: boolean; text: string } | null>(null);
  
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanHighlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' && useCartStore.getState().items.length > 0) {
        const ae = document.activeElement as HTMLElement | null;
        const interactive =
          !!ae &&
          (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(ae.tagName) ||
            ae.isContentEditable ||
            !!ae.closest('button, a'));
        if (!interactive) {
          e.preventDefault();
          setShowPaymentModal(true);
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        setShowCustomerModal(true);
      } else if (e.key === 'F4') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F5') {
        e.preventDefault();
        setShowPaymentModal(true);
      } else if (e.key === 'F7') {
        e.preventDefault();
        setShowDiscountModal(true);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setShowOrderHistory(true);
      } else if (e.key === 'F6') {
        e.preventDefault();
        setShowHeldOrders(true);
      } else if (e.key === 'Escape') {
        setShowCatalogModal(false);
        setShowShortcutsHelp(false);
        setShowCameraScan(false);
        setShowPaymentModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: 'Receipt',
    onAfterPrint: () => {
      setOrderSuccess(false);
      clearCart();
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  });

  const user = useAuthStore((s) => s.user);
  const { isOnline, pendingOrders } = useSyncStore();
  const { t } = useLanguageStore();

  const {
    items,
    customer,
    addItem,
    removeItem,
    updateQuantity,
    updatePrice,
    clearCart,
    getSubtotal,
    getDiscountAmount,
    getTaxAmount,
    getTotal,
  } = useCartStore();
  const discount = useCartStore((s) => s.discount);
  const discountType = useCartStore((s) => s.discountType);

  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    fetchData();
    checkActiveShift();
    resolveBranch();
  }, [user]);

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

  const mapProduct = (p: any): Product => ({
    id: p.id,
    name: p.name,
    nameAr: p.nameAr,
    price: Number(p.price),
    sku: p.sku,
    barcode: p.barcode,
    category: p.category,
    taxRate: p.taxRate ? Number(p.taxRate.rate) : undefined,
    trackInventory: p.trackInventory,
    inventory: p.inventory || [],
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, setRes] = await Promise.all([
        api.get('/products?isActive=true&limit=1000'),
        api.get('/categories'),
        api.get('/settings').catch(() => ({ data: { data: null } }))
      ]);
      setProducts((prodRes.data.data.items || []).map(mapProduct));
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

  const refreshStock = async () => {
    try {
      const prodRes = await api.get('/products?isActive=true&limit=1000');
      setProducts((prodRes.data.data.items || []).map(mapProduct));
    } catch (err) {
      console.error('Failed to refresh stock:', err);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = !selectedCategory || p.category?.name === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.includes(searchQuery) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const catalogFiltered = products.filter((p) => {
    const matchesCategory = !catalogCategory || p.category?.name === catalogCategory;
    const q = catalogQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.barcode?.includes(q) ||
      p.sku?.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const inventoryEnabled = settings?.trackInventory !== false;

  const stockFor = (productId: string, product?: Product): number | null => {
    // If inventory tracking is globally disabled, never block products by stock
    if (!inventoryEnabled) return null;
    const p = product ?? products.find((x) => x.id === productId);
    if (!p || p.trackInventory === false) return null;
    const branchId = resolvedBranchId || user?.branchId;
    const inv = (p.inventory || []).find((i) => i.branchId === branchId);
    return inv ? Number(inv.quantity) : 0;
  };

  const qtyInCart = (productId: string): number => {
    const item = items.find((i) => i.productId === productId);
    return item?.quantity ?? 0;
  };

  const tryAddToCart = (product: Product): boolean => {
    if (!inventoryEnabled) return true;
    const available = stockFor(product.id, product);
    if (available === null) return true;
    if (qtyInCart(product.id) + 1 > available) {
      flashScan(false, translate(t.stockLimitReached, { name: localizedName(product.name, product.nameAr), available: String(available) }));
      return false;
    }
    return true;
  };

  const playBeep = (ok: boolean) => {
    try {
      const Ctx: any = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = ok ? 'square' : 'sawtooth';
      osc.frequency.value = ok ? 1568 : 220;
      const dur = ok ? 0.18 : 0.4;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.start();
      osc.stop(ctx.currentTime + dur);
      osc.onended = () => ctx.close().catch(() => {});
    } catch {
      /* Audio fallback */
    }
  };

  const flashScan = (ok: boolean, text: string) => {
    setScanFeedback({ id: Date.now(), ok, text });
    playBeep(ok);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setScanFeedback(null), 1800);
  };

  const triggerScanHighlight = (productId: string) => {
    setRecentlyScannedId(productId);
    if (scanHighlightTimer.current) clearTimeout(scanHighlightTimer.current);
    scanHighlightTimer.current = setTimeout(() => setRecentlyScannedId(null), 1400);
  };

  const addProductToCart = (p: Product) => {
    if (!tryAddToCart(p)) return;
    addItem({
      id: p.id,
      name: p.name,
      nameAr: p.nameAr,
      price: Number(p.price),
      sku: p.sku,
      taxRate: p.taxRate,
    });
    triggerScanHighlight(p.id);
  };

  const handleScanCode = async (code: string) => {
    try {
      const trimmed = code.trim();
      if (!trimmed) return;

      const local = products.find((p) => p.barcode && p.barcode.trim() === trimmed);
      if (local) {
        addProductToCart(local);
        setSearchQuery('');
        flashScan(true, `${t.scanAdded}: ${localizedName(local.name, local.nameAr)}`);
        return;
      }

      try {
        const res = await api.get(`/products/barcode/${encodeURIComponent(trimmed)}`);
        const p = res.data?.data;
        if (p && p.id) {
          const product: Product = {
            id: p.id,
            name: p.name,
            nameAr: p.nameAr,
            price: Number(p.price),
            sku: p.sku,
            barcode: p.barcode,
            category: p.category,
            taxRate: p.taxRate,
            trackInventory: p.trackInventory,
            inventory: p.inventory || [],
          };
          setProducts((prev) => (prev.some((x) => x.id === product.id) ? prev : [...prev, product]));
          if (!tryAddToCart(product)) return;
          addItem(product);
          triggerScanHighlight(product.id);
          setSearchQuery('');
          flashScan(true, `${t.scanAdded}: ${localizedName(product.name, product.nameAr)}`);
          return;
        }
        flashScan(false, t.barcodeNotFound);
      } catch (err) {
        flashScan(false, t.barcodeNotFound);
      }
    } finally {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  };

  useBarcodeScanner(handleScanCode);

  const handleCheckout = async (payments: PaymentInput[]) => {
    if (items.length === 0 || payments.length === 0) return;

    const paymentMethod: PaymentMethod | 'SPLIT' = payments.length === 1 ? payments[0].method : 'SPLIT';

    const creditTotalAmount = payments
      .filter((p) => p.method === 'STORE_CREDIT')
      .reduce((s, p) => s + p.amount, 0);

    if (creditTotalAmount > 0) {
      if (!customer) {
        alert(t.selectCustomerRequired);
        return;
      }
      if (user?.role !== 'OWNER' && user?.role !== 'MANAGER') {
        alert(t.managerOnly);
        return;
      }
    }

    const branchId = resolvedBranchId || user?.branchId;
    if (!branchId) {
      alert(t.noBranchAssigned);
      return;
    }

    setProcessingOrder(true);
    const idempotencyKey = crypto.randomUUID();
    const paidAmount = Math.round((payments.reduce((s, p) => s + p.amount, 0) + Number.EPSILON) * 100) / 100;

    const payload = {
      branchId,
      shiftId: activeShift?.id,
      customerId: customer?.id || undefined,
      idempotencyKey,
      subtotal: getSubtotal(),
      discountAmount: getDiscountAmount(),
      discountType,
      taxAmount: getTaxAmount(),
      total: getTotal(),
      paidAmount,
      items: items.map((i) => ({
        productId: i.productId,
        name: localizedName(i.name, i.nameAr),
        quantity: i.quantity,
        unitPrice: i.price,
        subtotal: i.price * i.quantity,
      })),
      payments,
    };

    try {
      if (!isOnline) {
        useSyncStore.getState().addPendingOrder(payload);
        const randomNum = Math.floor(Math.random() * 9000) + 1000;
        setLastOrderDetails({
          orderNumber: `OFFLINE-${randomNum}`,
          paymentMethod,
          amountPaid: getTotal(),
          payments,
        });
        setOrderSuccess(true);
        setTimeout(() => handlePrint(), 500);
      } else {
        const res = await api.post('/orders', payload);
        const order = res.data.data;
        setLastOrderDetails({
          orderNumber: order.orderNumber,
          paymentMethod,
          amountPaid: Number(order.total),
          payments,
        });
        setOrderSuccess(true);
        refreshStock();
        setTimeout(() => handlePrint(), 500);
      }
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const status = err?.response?.status;
      if (code === 'INSUFFICIENT_STOCK') {
        alert(t.insufficientStock);
        return;
      }
      if (!status || status >= 500) {
        useSyncStore.getState().addPendingOrder(payload);
        const randomNum = Math.floor(Math.random() * 9000) + 1000;
        setLastOrderDetails({ orderNumber: `SYNC-${randomNum}`, paymentMethod, amountPaid: getTotal(), payments });
        setOrderSuccess(true);
        setTimeout(() => handlePrint(), 500);
      } else {
        alert(err?.response?.data?.message || t.orderFailed);
      }
    } finally {
      setProcessingOrder(false);
    }
  };

  const handleHoldOrder = async () => {
    if (items.length === 0) return;
    if (!isOnline) {
      flashScan(false, t.heldUnavailableOffline);
      return;
    }
    const branchId = resolvedBranchId || user?.branchId;
    if (!branchId) {
      flashScan(false, t.noBranchAssigned);
      return;
    }
    try {
      await api.post('/held-orders', {
        branchId,
        items,
        customer,
        discount,
        discountType,
      });
      clearCart();
      setShowHeldOrders(false);
      flashScan(true, t.orderHeld);
    } catch (err: any) {
      console.error('Failed to hold order:', err);
      flashScan(false, err?.response?.data?.message || t.orderHeldFailed);
    }
  };

  const handleHeldResumed = () => {
    setShowHeldOrders(false);
    flashScan(true, t.orderResumed);
  };

  const openCatalogModal = () => {
    setCatalogQuery('');
    setCatalogCategory(null);
    setShowCatalogModal(true);
  };

  return (
    <div className="h-screen bg-slate-100 text-slate-800 flex flex-col overflow-hidden font-sans select-none antialiased">
      {/* ── Top Header Bar (Light Theme) ────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200/80 px-4 xl:px-6 py-3 flex flex-col xl:flex-row items-center justify-between shadow-sm z-20 shrink-0 gap-3 xl:gap-0 w-full overflow-hidden">
        <div className="flex items-center gap-3 w-full xl:w-auto shrink-0 justify-center xl:justify-start">
          <img
            src={`${import.meta.env.BASE_URL}logo_transparent.png`}
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

        {/* Header Action Tools */}
        <div className="flex items-center justify-start xl:justify-end gap-2 md:gap-3 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0 scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none]">
          {/* Cart toggle (mobile only) */}
          <button
            onClick={() => setShowCartPanel(true)}
            className="md:hidden relative p-2.5 text-slate-600 hover:text-cyan-600 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-sm shrink-0"
            title={t.invoiceDetails}
          >
            <ShoppingCart className="w-5 h-5 text-cyan-600" />
            {items.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-0.5 rounded-full bg-cyan-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>

          {/* Scanner Active Indicator */}
          <div
            className="flex items-center justify-center p-2 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl shadow-xs animate-pulse shrink-0 cursor-help"
            title={t.scannerActive}
          >
            <Zap className="w-5 h-5 text-cyan-600 fill-cyan-500/20" />
          </div>

          <div className="shrink-0">
            <LanguageSwitcher />
          </div>

          {!isOnline && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-bold animate-pulse whitespace-nowrap shrink-0">
              <CloudOff className="w-3.5 h-3.5" />
              {translate(t.offlinePending, { count: pendingOrders.length })}
            </div>
          )}

          <Link
            to="/dashboard/products"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 whitespace-nowrap shrink-0"
          >
            <LayoutDashboard className="w-4 h-4 text-cyan-600" />
            <span className="hidden lg:inline">{t.adminDashboard}</span>
          </Link>

          <button
            onClick={() => setShowOrderHistory(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 shadow-sm whitespace-nowrap shrink-0"
            title={t.orderHistory}
          >
            <History className="w-4 h-4 text-cyan-600" />
            <span className="hidden lg:inline">{t.orderHistory}</span>
          </button>

          <button
            onClick={() => setShowHeldOrders(true)}
            disabled={!isOnline}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 shadow-sm disabled:opacity-40 whitespace-nowrap shrink-0"
            title={!isOnline ? t.heldUnavailableOffline : t.heldOrders}
          >
            <PauseCircle className="w-4 h-4 text-amber-500" />
            <span className="hidden lg:inline">{t.heldOrders}</span>
          </button>

          <button
            onClick={() => setShowExpensesModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-rose-50 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 shadow-sm whitespace-nowrap shrink-0"
            title={t.expensesTitle}
          >
            <Flame className="w-4 h-4 text-rose-500" />
            <span className="hidden lg:inline">{t.expensesTitle}</span>
          </button>

          <button
            onClick={() => setShowShortcutsHelp(true)}
            className="p-2 text-slate-500 hover:text-cyan-600 bg-white hover:bg-slate-50 rounded-xl transition border border-slate-200 shadow-sm shrink-0"
            title={t.keyboardShortcuts}
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {activeShift && (
            <button
              onClick={() => {
                setShiftAction('CLOSE');
                setShowShiftModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 transition border border-slate-700 shadow-sm whitespace-nowrap shrink-0"
            >
              {t.endShift}
            </button>
          )}

          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-sm whitespace-nowrap shrink-0">
            <User className="w-3.5 h-3.5 text-cyan-600" />
            <span className="font-bold text-slate-800 max-w-[100px] truncate">{user?.name || t.cashier}</span>
            <span className="bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-md text-[10px] uppercase font-extrabold">
              {user?.role || 'CASHIER'}
            </span>
          </div>

            <button
              onClick={apiLogout}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
              title={t.logout}
            >
              <LogOut className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* Toast Feedback Notification */}
      {scanFeedback && (
        <div
          key={scanFeedback.id}
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-[75] px-5 py-3 rounded-2xl text-xs font-black shadow-2xl flex items-center gap-2.5 transition-all animate-bounce ${
            scanFeedback.ok
              ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/20'
              : 'bg-rose-600 text-white ring-4 ring-rose-600/20'
          }`}
        >
          {scanFeedback.ok ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {scanFeedback.text}
        </div>
      )}

      {/* ── Main Workstation Content (Large Center: Added Products | Side: Order Details) ── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* 🌟 LARGE MAIN CENTER AREA: Scanned / Added Products (الفاتورة الحالية والمنتجات المضافة) */}
        <div className="flex-1 flex flex-col p-3 sm:p-5 overflow-hidden">
          
          {/* Top Search & Barcode Scanner Hub */}
          <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
                <ScanBarcode className="w-4 h-4 text-cyan-600 animate-pulse" />
                <span>{t.scanPrompt}</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={openCatalogModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-500/20 transition-all active:scale-95"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{t.browseCatalog}</span>
                </button>

                <button
                  onClick={() => setShowCameraScan(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs"
                  title={t.scanBarcode}
                >
                  <ScanBarcode className="w-3.5 h-3.5 text-cyan-600" />
                  <span className="hidden sm:inline">{t.cameraBtn}</span>
                </button>
              </div>
            </div>

            {/* Input Bar */}
            <div className="relative">
              <Search className="absolute ltr:left-4 rtl:right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-600" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t.scanPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    e.preventDefault();
                    handleScanCode(searchQuery);
                  }
                }}
                className="w-full bg-slate-50 border-2 border-slate-200 focus:border-cyan-500 text-slate-900 rounded-2xl ltr:pl-12 ltr:pr-24 rtl:pr-12 rtl:pl-24 py-3.5 text-sm font-bold placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-4 focus:ring-cyan-500/10 transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute ltr:right-3 rtl:left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* LARGE CENTER BODY: Added Bill Products / Search Grid */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm">
            
            {/* Case 1: User is actively typing in search -> show matching products grid */}
            {searchQuery.trim() ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-bold text-slate-600">
                    {translate(t.searchResultsFor, { query: searchQuery, count: filteredProducts.length })}
                  </span>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-1.5 rounded-lg transition ${
                        viewMode === 'grid' ? 'bg-cyan-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-1.5 rounded-lg transition ${
                        viewMode === 'list' ? 'bg-cyan-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div
                  className={`flex-1 overflow-y-auto ${
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5'
                      : 'space-y-2'
                  }`}
                >
                  {filteredProducts.length === 0 ? (
                    <div className="col-span-full h-full flex flex-col items-center justify-center text-slate-400 py-12">
                      <XCircle className="w-10 h-10 mb-2 text-slate-300" />
                      <p className="text-xs font-bold">{translate(t.noSearchResults, { query: searchQuery })}</p>
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        currency={t.currency}
                        stock={stockFor(product.id, product)}
                        onSelect={addProductToCart}
                        viewMode={viewMode}
                        skuPrefixLabel={t.skuPrefix}
                      />
                    ))
                  )}
                </div>
              </div>
            ) : items.length > 0 ? (
              /* Case 2: Cart has items -> Display Added Products in LARGE center area */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-cyan-600" />
                    <h3 className="font-extrabold text-sm text-slate-900">
                      {translate(t.cartItemsTitle, { count: items.length })}
                    </h3>
                  </div>

                  <button
                    onClick={clearCart}
                    className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 font-bold px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> {t.clearInvoice}
                  </button>
                </div>

                {orderSuccess && (
                  <div className="p-3.5 mb-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-700 text-xs text-center font-extrabold flex items-center justify-center gap-2 shadow-xs">
                    <PackageCheck className="w-5 h-5 text-emerald-600" /> {t.orderCompleted}
                  </div>
                )}

                {/* Items List in Center Area */}
                <div className="flex-1 overflow-y-auto space-y-1.5 ltr:pr-1 rtl:pl-1">
                  {items.map((item) => (
                    <CartItemRow
                      key={item.productId}
                      item={item}
                      currency={t.currency}
                      isHighlighted={recentlyScannedId === item.productId}
                      onUpdateQuantity={updateQuantity}
                      onUpdatePrice={updatePrice}
                      onRemoveItem={removeItem}
                      onTryAddMore={() => {
                        const p = products.find((x) => x.id === item.productId);
                        if (!p || tryAddToCart(p)) {
                          updateQuantity(item.productId, item.quantity + 1);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              /* Case 3: Empty Cart & Idle Scanner */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-cyan-50 border-2 border-cyan-200 flex items-center justify-center text-cyan-600 animate-pulse shadow-sm">
                    <ScanBarcode className="w-12 h-12 stroke-[1.5]" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md">
                    <Zap className="w-4 h-4 fill-white" />
                  </div>
                </div>

                <div className="max-w-md space-y-2">
                  <h3 className="text-base font-extrabold text-slate-900">
                    {t.emptyCartTitle}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {t.emptyCartDesc}
                  </p>
                </div>

                {/* Manual Product Catalog Button */}
                <div className="pt-2">
                  <button
                    onClick={openCatalogModal}
                    className="px-6 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-2xl font-extrabold text-xs flex items-center gap-2.5 shadow-md shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <LayoutGrid className="w-4 h-4" />
                    <span>{t.manualCatalogCta}</span>
                  </button>
                </div>

                {/* Shortcuts hint chips */}
                <div className="pt-6 flex flex-wrap items-center justify-center gap-3 text-[11px] text-slate-500">
                  <span className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg font-mono">
                    <b className="text-cyan-600">F4</b> {t.shortcutSearch}
                  </span>
                  <span className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg font-mono">
                    <b className="text-cyan-600">F2</b> {t.shortcutCustomer}
                  </span>
                  <span className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg font-mono">
                    <b className="text-cyan-600">F7</b> {t.shortcutDiscount}
                  </span>
                  <span className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg font-mono">
                    <b className="text-cyan-600">Space</b> {t.shortcutPay}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Order Summary Metrics Row ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 shrink-0">
            {/* Card 5: Grand Total (Filled Blue Box) */}
            <div
              onClick={() => items.length > 0 && setShowPaymentModal(true)}
              className={`col-span-2 sm:col-span-2 lg:col-span-2 bg-blue-600 text-white rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/40 transition cursor-pointer select-none active:scale-[0.98] ${
                items.length === 0 ? 'opacity-55 cursor-not-allowed active:scale-100 shadow-none ring-0' : 'hover:bg-blue-700 hover:shadow-blue-500/40'
              }`}
            >
              <div className="text-start min-w-0">
                <p className="text-[11px] text-white/80 font-extrabold mb-1.5 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 shrink-0" />
                  {t.totalAmount}
                </p>
                <p className="text-2xl xl:text-3xl font-black leading-none tabular-nums truncate">
                  {t.currency} {getTotal().toFixed(2)}
                </p>
              </div>
            </div>

            {/* Card 4: VAT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between shadow-xs">
              <div className="text-start">
                <p className="text-[10px] text-slate-400 font-extrabold mb-1">{t.vatShort}</p>
                <p className="text-[17px] font-black text-blue-600 leading-none tabular-nums">
                  {t.currency} {getTaxAmount().toFixed(2)}
                </p>
              </div>
              <span className="text-lg font-black text-slate-400 leading-none select-none">%</span>
            </div>

            {/* Card 3: Subtotal */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between shadow-xs">
              <div className="text-start">
                <p className="text-[10px] text-slate-400 font-extrabold mb-1">{t.subtotal}</p>
                <p className="text-[17px] font-black text-blue-600 leading-none tabular-nums">
                  {t.currency} {getSubtotal().toFixed(2)}
                </p>
              </div>
              <Receipt className="w-6 h-6 text-slate-400 stroke-[1.5]" />
            </div>

            {/* Card 2: Total Quantity */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between shadow-xs">
              <div className="text-start">
                <p className="text-[10px] text-slate-400 font-extrabold mb-1">{t.totalQuantityLabel}</p>
                <p className="text-[17px] font-black text-blue-600 leading-none tabular-nums">
                  {items.reduce((s, i) => s + i.quantity, 0)}
                </p>
              </div>
              <ShoppingBasket className="w-6 h-6 text-slate-400 stroke-[1.5]" />
            </div>

            {/* Card 1: Items Count */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center justify-between shadow-xs">
              <div className="text-start">
                <p className="text-[10px] text-slate-400 font-extrabold mb-1">{t.itemsCountLabel}</p>
                <p className="text-[17px] font-black text-blue-600 leading-none tabular-nums">{items.length}</p>
              </div>
              <Box className="w-6 h-6 text-slate-400 stroke-[1.5]" />
            </div>
          </div>
        </div>

        {/* Mobile Cart Drawer Backdrop */}
        {showCartPanel && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setShowCartPanel(false)}
          />
        )}

        {/* 🌟 SIDEBAR PANEL (ON THE RIGHT): Details, Totals Summary & Payment Pad */}
        <div
          className={`w-80 md:w-96 bg-white flex flex-col shrink-0 shadow-lg ltr:border-l rtl:border-r border-slate-200/80 ${
            showCartPanel
              ? 'fixed inset-y-0 ltr:right-0 rtl:left-0 z-50'
              : 'hidden'
          } md:static md:flex md:z-auto`}
        >
          
          {/* Header of details sidebar */}
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-cyan-600" />
              <h2 className="font-extrabold text-sm text-slate-900">{t.invoiceDetails}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-cyan-50 text-cyan-700 px-2.5 py-0.5 rounded-full font-bold border border-cyan-200">
                {translate(t.itemsCount, { count: items.length })}
              </span>
              <button
                onClick={() => setShowCartPanel(false)}
                className="md:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title={t.close}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Customer Selection Card */}
          <div
            onClick={() => setShowCustomerModal(true)}
            className="mx-4 mt-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition-colors shadow-xs"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <User className="w-5 h-5 text-cyan-600 shrink-0" />
              <div className="truncate text-xs">
                <span className="font-extrabold text-slate-800 block truncate">
                  {customer ? customer.name : t.walkInCustomer}
                </span>
                {customer?.phone && <span className="text-[10px] text-slate-500 block font-mono">{customer.phone}</span>}
              </div>
            </div>
            <span className="text-[10px] font-bold text-cyan-600 bg-cyan-50 px-2.5 py-1 rounded-xl border border-cyan-200">
              {t.selectCustomer}
            </span>
          </div>

          {/* Quick Cart Summary List preview inside sidebar */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              {t.itemsSummary}
            </h4>
            {items.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-medium">
                {t.noItemsInInvoice}
              </div>
            ) : (
              items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <div className="truncate ltr:pr-2 rtl:pl-2">
                    <span className="font-bold text-slate-800 block truncate">
                      {localizedName(item.name, item.nameAr)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.quantity} × {t.currency} {item.price.toFixed(2)}
                    </span>
                  </div>
                  <span className="font-extrabold text-slate-900 font-mono shrink-0">
                    {t.currency} {(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Cart Totals Breakdown & Checkout Buttons Pad */}
          <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 space-y-4 shrink-0">
            {/* Totals Breakdown */}
            <div className="space-y-2 text-xs font-semibold text-slate-600">
              <div className="flex justify-between items-center">
                <span className="font-bold">{t.subtotal}</span>
                <span className="font-extrabold text-slate-800 tabular-nums">{t.currency} {getSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold">{t.vat}</span>
                <span className="font-extrabold text-slate-800 tabular-nums">{t.currency} {getTaxAmount().toFixed(2)}</span>
              </div>

              {/* Discount Button */}
              <button
                onClick={() => setShowDiscountModal(true)}
                className="w-full flex justify-between items-center py-1.5 px-2.5 rounded-xl hover:bg-slate-200/60 transition-colors text-left border border-slate-200 bg-white text-[11px]"
              >
                <span className="flex items-center gap-1 text-cyan-600 font-bold">
                  <BadgePercent className="w-3.5 h-3.5" />
                  {t.discountLabel}
                </span>
                {getDiscountAmount() > 0 ? (
                  <span className="text-rose-600 font-extrabold">
                    - {t.currency} {getDiscountAmount().toFixed(2)}
                    {discountType === 'percent' ? ` (${discount}%)` : ''}
                  </span>
                ) : (
                  <span className="text-slate-400 font-bold">{t.addDiscountCta}</span>
                )}
              </button>

              <div className="flex justify-between items-baseline pt-2.5 border-t border-slate-200/80">
                <span className="font-black text-sm text-slate-800">{t.totalAmount}</span>
                <span className="text-xl font-black text-blue-600 tabular-nums">{t.currency} {getTotal().toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Actions Pad */}
            <div className="space-y-2.5">
              {/* Row 1: Card - full width, prominent */}
              <button
                disabled={items.length === 0 || processingOrder}
                onClick={() => handleCheckout([{ method: 'CARD', amount: getTotal() }])}
                className="w-full py-3 bg-white hover:bg-blue-50 border-2 border-blue-500 hover:border-blue-600 text-blue-600 font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:scale-100 outline-none"
              >
                <CreditCard className="w-4 h-4 shrink-0" />
                <span>{t.payCard}</span>
              </button>

              {/* Row 2: Cash - full width, prominent */}
              <button
                disabled={items.length === 0 || processingOrder}
                onClick={() => handleCheckout([{ method: 'CASH', amount: getTotal() }])}
                className="w-full py-3 bg-white hover:bg-emerald-50 border-2 border-emerald-500 hover:border-emerald-600 text-emerald-600 font-extrabold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:scale-100 outline-none"
              >
                <Banknote className="w-4 h-4 shrink-0" />
                <span>{t.payCash}</span>
              </button>

              {/* Row 3: On Account + Hold Order - side by side, subtle */}
              <div className="grid grid-cols-2 gap-2.5">
                {user?.role === 'OWNER' || user?.role === 'MANAGER' ? (
                  <button
                    disabled={items.length === 0 || processingOrder || !customer}
                    onClick={() => handleCheckout([{ method: 'STORE_CREDIT', amount: getTotal() }])}
                    className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 shadow-xs"
                  >
                    <HandCoins className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{t.payOnAccount}</span>
                  </button>
                ) : (
                  <div className="w-full py-2.5 flex items-center justify-center text-[10px] text-slate-400 bg-slate-100 border border-slate-200 rounded-2xl">
                    {t.managerOnly}
                  </div>
                )}

                <button
                  onClick={handleHoldOrder}
                  disabled={items.length === 0 || processingOrder || !isOnline}
                  className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 shadow-xs"
                >
                  <Pause className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{t.holdOrder}</span>
                </button>
              </div>

              {/* Row 4: Split / Mixed Payment - opens payment screen */}
              <button
                disabled={items.length === 0 || processingOrder}
                onClick={() => setShowPaymentModal(true)}
                className="w-full py-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white font-extrabold rounded-2xl text-sm flex items-center justify-center gap-2.5 transition-all shadow-md shadow-cyan-600/20 active:scale-[0.99] disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed"
              >
                <Split className="w-5 h-5" />
                <span>{t.paySplit}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Product Catalog Browser Modal (Light Theme) ───────────────────── */}
      {showCatalogModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 z-[80]">
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{t.catalogTitle}</h3>
                  <p className="text-xs text-slate-500">{t.catalogDesc}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* View Mode Toggle */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition ${
                      viewMode === 'grid' ? 'bg-cyan-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition ${
                      viewMode === 'list' ? 'bg-cyan-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => setShowCatalogModal(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Search & Category Filter Toolbar */}
            <div className="p-4 bg-white border-b border-slate-200 space-y-3">
              <div className="relative">
                <Search className="absolute ltr:left-3.5 rtl:right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={t.filterCatalogPlaceholder}
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl ltr:pl-10 ltr:pr-4 rtl:pr-10 rtl:pl-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Category Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  onClick={() => setCatalogCategory(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    catalogCategory === null
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.allItems} ({products.length})
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCatalogCategory(c.name)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      catalogCategory === c.name
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {localizedName(c.name, c.nameAr)}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Grid Area */}
            <div className="flex-1 p-5 overflow-y-auto bg-slate-50/50">
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  {t.loading}
                </div>
              ) : catalogFiltered.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                  <Coffee className="w-10 h-10 mb-2 text-slate-300" />
                  <p className="text-xs font-medium">{t.noProducts}</p>
                </div>
              ) : (
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
                      : 'space-y-2.5'
                  }
                >
                  {catalogFiltered.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      currency={t.currency}
                      stock={stockFor(p.id, p)}
                      onSelect={(product) => {
                        addProductToCart(product);
                        flashScan(true, `${t.scanAdded}: ${localizedName(product.name, product.nameAr)}`);
                      }}
                      viewMode={viewMode}
                      skuPrefixLabel={t.skuPrefix}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Help Modal */}
      {showShortcutsHelp && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-cyan-600" /> {t.keyboardShortcuts}
              </h3>
              <button
                onClick={() => setShowShortcutsHelp(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">{t.shortcutFocusSearch}</span>
                <kbd className="bg-slate-100 px-2 py-0.5 rounded text-cyan-700 font-mono font-bold">F4</kbd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">{t.shortcutAddCustomer}</span>
                <kbd className="bg-slate-100 px-2 py-0.5 rounded text-cyan-700 font-mono font-bold">F2</kbd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">{t.shortcutAddDiscount}</span>
                <kbd className="bg-slate-100 px-2 py-0.5 rounded text-cyan-700 font-mono font-bold">F7</kbd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">{t.shortcutOrderHistory}</span>
                <kbd className="bg-slate-100 px-2 py-0.5 rounded text-cyan-700 font-mono font-bold">F3</kbd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">{t.shortcutHeldOrders}</span>
                <kbd className="bg-slate-100 px-2 py-0.5 rounded text-cyan-700 font-mono font-bold">F6</kbd>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-600">{t.shortcutPayConfirm}</span>
                <kbd className="bg-slate-100 px-2 py-0.5 rounded text-cyan-700 font-mono font-bold">F5</kbd>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-600">{t.shortcutPayNow}</span>
                <kbd className="bg-slate-100 px-2 py-0.5 rounded text-cyan-700 font-mono font-bold">Space</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order History Modal */}
      <OrderHistoryModal
        open={showOrderHistory}
        onClose={() => setShowOrderHistory(false)}
        branchId={resolvedBranchId}
      />

      {/* Held Orders Modal */}
      <HeldOrdersModal
        open={showHeldOrders}
        onClose={() => setShowHeldOrders(false)}
        branchId={resolvedBranchId}
        onResumed={handleHeldResumed}
      />

      {/* Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold mb-2 text-slate-900">
              {shiftAction === 'OPEN' ? t.openShift : t.endShift}
            </h3>
            <p className="text-xs text-slate-500 mb-6">
              {shiftAction === 'OPEN' ? t.openingCashDesc : t.closingCashDesc}
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl ltr:pl-8 ltr:pr-4 rtl:pr-8 rtl:pl-4 py-3 text-lg font-bold text-slate-900 focus:outline-none focus:border-cyan-500" 
                  />
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                {shiftAction === 'CLOSE' && (
                  <button type="button" onClick={() => setShowShiftModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 bg-white hover:bg-slate-50 text-sm">
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
          payments={lastOrderDetails.payments}
          amountPaid={lastOrderDetails.amountPaid}
          storeSettings={settings}
        />
      </div>

      {/* Customer Modal */}
      <CustomerModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
      />

      {/* Discount Modal */}
      <DiscountModal
        open={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
      />

      {/* Split / Mixed Payment Modal */}
      <PaymentModal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        total={getTotal()}
        canUseCredit={user?.role === 'OWNER' || user?.role === 'MANAGER'}
        hasCustomer={!!customer}
        onPay={(payments) => {
          setShowPaymentModal(false);
          handleCheckout(payments);
        }}
      />

      {/* Expenses / Cash Payouts Modal */}
      {showExpensesModal && (
        <ExpensesModal
          open={showExpensesModal}
          onClose={() => setShowExpensesModal(false)}
          branchId={resolvedBranchId || user?.branchId || null}
          activeShift={activeShift}
        />
      )}

      {/* Barcode Camera Scanner */}
      {showCameraScan && (
        <BarcodeCameraModal onScan={handleScanCode} onClose={() => setShowCameraScan(false)} />
      )}



      {/* ── Bottom Status Bar ────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-200/80 px-3 sm:px-6 py-2 flex flex-wrap items-center justify-center sm:justify-between gap-x-4 gap-y-1 text-[11px] text-slate-500 font-medium shadow-sm shrink-0">
        {/* Left: Branch */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-cyan-600" />
            <span className="font-bold text-slate-700 truncate max-w-[120px] sm:max-w-none">{branchName || t.mainBranch}</span>
          </div>
        </div>

        {/* Center: Time + Date */}
        <div className="flex items-center gap-5">
          <LiveClock />
        </div>

        {/* Right: Connection + Weather */}
        <div className="flex items-center gap-4">
          {/* Connection status */}
          {isOnline ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400 animate-pulse" />
              <span className="font-bold text-emerald-600">{t.connected}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="font-bold text-rose-600">{t.disconnected}</span>
            </div>
          )}

          {/* Weather */}
          {weather && (
            <div className="flex items-center gap-1.5">
              {weatherDesc(weather.code).icon}
              <span className="font-bold text-slate-700">{weather.temp}°C</span>
              <span className="text-slate-400 hidden sm:inline">{weatherDesc(weather.code).label}</span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};
