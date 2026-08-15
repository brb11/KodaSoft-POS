import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useLanguageStore, translate } from '../../stores/languageStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useBillingStore } from '../../stores/billingStore';
import { useNotificationsStore } from '../../stores/notificationsStore';
import { apiLogout } from '../../lib/api';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { NotificationBell } from './NotificationBell';
import {
  Package,
  FolderTree,
  Warehouse,
  BarChart3,
  Users,
  Building2,
  Settings,
  LogOut,
  Store,
  Contact,
  HandCoins,
  ShieldCheck,
  AlertTriangle,
  X,
  Menu
} from 'lucide-react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { t } = useLanguageStore();
  const trackInventory = useSettingsStore((s) => s.settings?.trackInventory);
  const loadSettings = useSettingsStore((s) => s.load);
  const billingData = useBillingStore((s) => s.data);
  const refreshBilling = useBillingStore((s) => s.refresh);
  const resetNotifications = useNotificationsStore((s) => s.reset);

  useEffect(() => {
    if (trackInventory === undefined) loadSettings();
  }, [trackInventory, loadSettings]);

  useEffect(() => {
    if (!billingData) refreshBilling();
  }, [billingData, refreshBilling]);

  // Mobile sidebar drawer state
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // Dismissible "plan expiring soon" banner (7-day window), keyed to the current
  // period end so it reappears after renewal with a new date.
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return localStorage.getItem('casheer:expiry-banner-dismissed');
    } catch {
      return null;
    }
  });

  const periodEnd = billingData?.periodEnd ?? null;
  const status = billingData?.status ?? null;
  const daysLeft = periodEnd
    ? Math.ceil((new Date(periodEnd).getTime() - Date.now()) / 86400000)
    : Infinity;
  const showExpiryBanner =
    !!periodEnd &&
    (status === 'TRIAL' || status === 'ACTIVE') &&
    daysLeft <= 7 &&
    dismissed !== periodEnd;
  const expiryDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const isTrialBanner = status === 'TRIAL';

  const dismissBanner = () => {
    try {
      localStorage.setItem('casheer:expiry-banner-dismissed', periodEnd ?? '');
    } catch {
      // Ignore storage errors (private mode etc.).
    }
    setDismissed(periodEnd);
  };

  const navItems = [
    { label: t.posTerminal, path: '/pos', icon: Store },
    { label: t.reports, path: '/dashboard/reports', icon: BarChart3 },
    { label: t.products, path: '/dashboard/products', icon: Package },
    { label: t.categories, path: '/dashboard/categories', icon: FolderTree },
    ...(trackInventory !== false ? [{ label: t.inventoryStock, path: '/dashboard/inventory', icon: Warehouse }] : []),
    { label: t.customers, path: '/dashboard/customers', icon: Contact },
    { label: t.customerAccounts, path: '/dashboard/accounts', icon: HandCoins },
    { label: t.staffUsers, path: '/dashboard/users', icon: Users },
    { label: t.branches, path: '/dashboard/branches', icon: Building2 },
    { label: t.zatcaNav, path: '/dashboard/zatca', icon: ShieldCheck },
    { label: t.settingsTitle, path: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-800 flex">
      {/* Mobile Sidebar Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-64 shrink-0 bg-white border-r border-slate-200/80 flex flex-col justify-between shadow-sm ${
          mobileNavOpen
            ? 'fixed inset-y-0 ltr:left-0 rtl:right-0 z-40 md:static md:z-auto'
            : 'hidden md:flex'
        }`}
      >
        <div>
          {/* Logo Branding */}
          <div className="p-6 border-b border-slate-200/80 flex items-center gap-3">
            <img
              src={`${import.meta.env.BASE_URL}logo_transparent.png`}
              alt="KodaSoft Logo"
              className="w-10 h-10 object-contain drop-shadow-sm"
            />
            <div className="flex-1">
              <h1 className="font-extrabold text-sm tracking-tight text-slate-900">
                KodaSoft-<span className="text-cyan-500">POS</span>
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                {t.kodaSoftAdmin}
              </p>
            </div>
            <button
              onClick={() => setMobileNavOpen(false)}
              className="md:hidden p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              title={t.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-200/80">
          <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center font-black text-xs">
                {user?.name?.[0] || 'U'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.name}</p>
                <p className="text-[10px] text-cyan-600 uppercase font-extrabold">
                  {user?.role === 'OWNER' ? t.ownerRole : user?.role === 'MANAGER' ? t.managerRole : t.cashierRole}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                resetNotifications();
                apiLogout();
                navigate('/login');
              }}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
              title={t.logout}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
              title={t.menu}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-extrabold text-slate-500 tracking-wider truncate">{t.enterprisePosHeader}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <LanguageSwitcher />
          </div>
        </header>
        {showExpiryBanner && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200/80 px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <span className="shrink-0 w-9 h-9 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="w-4.5 h-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-amber-900">
                  {isTrialBanner ? t.bannerTrialExpiringTitle : t.bannerPlanExpiringTitle}
                </p>
                <p className="text-[11px] font-medium text-amber-700 truncate">
                  {translate(isTrialBanner ? t.bannerTrialExpiringDesc : t.bannerPlanExpiringDesc, { date: expiryDate })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/dashboard/settings')}
                className="text-[11px] font-extrabold bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl transition-colors shadow-sm"
              >
                {t.bannerRenew}
              </button>
              <button
                onClick={dismissBanner}
                className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-100 rounded-xl transition-colors"
                title={t.bannerDismiss}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <div className="p-4 sm:p-6 lg:p-8 flex-1">{children}</div>
      </main>
    </div>
  );
};
