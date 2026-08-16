import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiLogout } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { useLanguageStore } from '../../stores/languageStore';
import { LanguageSwitcher } from '../../components/common/LanguageSwitcher';
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Store,
  Users,
  X,
} from 'lucide-react';
import { SaasOverview } from './SaasOverview';
import { SaasTenants, type TenantFilters } from './SaasTenants';
import { SaasTenantDetail } from './SaasTenantDetail';
import { SaasUsers } from './SaasUsers';
import { SaasPayments } from './SaasPayments';

type View = 'overview' | 'tenants' | 'tenantDetail' | 'users' | 'payments';

export const SaasConsole: React.FC = () => {
  const [view, setView] = useState<View>('overview');
  const [detailId, setDetailId] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [tenantFilters, setTenantFilters] = useState<Partial<TenantFilters>>({});
  const [tenantNonce, setTenantNonce] = useState(0);

  const user = useAuthStore((s) => s.user);
  const { t } = useLanguageStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    apiLogout();
    navigate('/login');
  };

  const openDetail = (tenantId: string) => {
    setDetailId(tenantId);
    setView('tenantDetail');
    setMobileNavOpen(false);
  };

  const openTenants = (filters?: Partial<TenantFilters>) => {
    setTenantFilters(filters ?? {});
    setTenantNonce((n) => n + 1);
    setView('tenants');
    setMobileNavOpen(false);
  };

  const navTo = (next: View) => {
    if (next === 'tenants') {
      openTenants();
      return;
    }
    setView(next);
    setMobileNavOpen(false);
  };

  const navItems = [
    { key: 'overview' as View, label: t.saasOverview, icon: LayoutDashboard },
    { key: 'tenants' as View, label: t.saasTenants, icon: Building2 },
    { key: 'users' as View, label: t.saasUsersNav, icon: Users },
    { key: 'payments' as View, label: t.saasPayments, icon: CreditCard },
  ];

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-800 flex">
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-64 bg-slate-900 text-white flex flex-col justify-between overflow-y-auto shadow-xl ${
          mobileNavOpen
            ? 'fixed inset-y-0 ltr:left-0 rtl:right-0 z-40 md:static md:z-auto'
            : 'hidden md:flex'
        }`}
      >
        <div>
          <div className="p-6 border-b border-white/10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h1 className="font-extrabold text-sm tracking-tight">
                KodaSoft-<span className="text-cyan-400">POS</span>
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{t.saasConsole}</p>
            </div>
            <button
              onClick={() => setMobileNavOpen(false)}
              className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title={t.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => navTo(item.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                    view === item.key ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" /> {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-black text-xs">
                {user?.name?.[0] || 'S'}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold truncate">{user?.name}</p>
                <p className="text-[10px] text-cyan-400 uppercase font-extrabold">SUPER ADMIN</p>
              </div>
            </div>
            <button onClick={handleLogout} className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-xl transition-colors" title={t.saasLogout}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
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
            <span className="text-xs font-extrabold text-slate-500 tracking-wider truncate">{t.saasConsole}</span>
            {view === 'tenantDetail' && detailId && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-cyan-600">
                <Store className="w-3.5 h-3.5" /> {t.saasDetail}
              </span>
            )}
          </div>
          <LanguageSwitcher />
        </header>

        <div className="p-4 sm:p-6 lg:p-8 flex-1">
          {view === 'overview' && (
            <SaasOverview onOpenTenants={openTenants} onOpenUsers={() => navTo('users')} onOpenTenantDetail={openDetail} />
          )}
          {view === 'tenants' && <SaasTenants key={tenantNonce} onOpenDetail={openDetail} initialFilters={tenantFilters} />}
          {view === 'tenantDetail' && detailId && <SaasTenantDetail tenantId={detailId} onBack={() => navTo('tenants')} />}
          {view === 'users' && <SaasUsers onOpenDetail={openDetail} />}
          {view === 'payments' && <SaasPayments />}
        </div>
      </main>
    </div>
  );
};
