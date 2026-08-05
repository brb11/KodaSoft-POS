import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useLanguageStore } from '../../stores/languageStore';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
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
  ShieldCheck
} from 'lucide-react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { t } = useLanguageStore();

  const navItems = [
    { label: t.posTerminal, path: '/pos', icon: Store },
    { label: t.reports, path: '/dashboard/reports', icon: BarChart3 },
    { label: t.products, path: '/dashboard/products', icon: Package },
    { label: t.categories, path: '/dashboard/categories', icon: FolderTree },
    { label: t.inventoryStock, path: '/dashboard/inventory', icon: Warehouse },
    { label: t.customers, path: '/dashboard/customers', icon: Contact },
    { label: t.customerAccounts, path: '/dashboard/accounts', icon: HandCoins },
    { label: t.staffUsers, path: '/dashboard/users', icon: Users },
    { label: t.branches, path: '/dashboard/branches', icon: Building2 },
    { label: t.zatcaNav, path: '/dashboard/zatca', icon: ShieldCheck },
    { label: t.settingsTitle, path: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between shadow-sm">
        <div>
          {/* Logo Branding */}
          <div className="p-6 border-b border-slate-200/80 flex items-center gap-3">
            <img
              src="/logo_transparent.png"
              alt="KodaSoft Logo"
              className="w-10 h-10 object-contain drop-shadow-sm"
            />
            <div>
              <h1 className="font-extrabold text-sm tracking-tight text-slate-900">
                KodaSoft-<span className="text-cyan-500">POS</span>
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                {t.kodaSoftAdmin}
              </p>
            </div>
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
                  <Icon className="w-4 h-4" />
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
                logout();
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
        <header className="bg-white border-b border-slate-200/80 px-8 py-3.5 flex items-center justify-between shadow-xs">
          <span className="text-xs font-extrabold text-slate-500 tracking-wider">{t.enterprisePosHeader}</span>
          <LanguageSwitcher />
        </header>
        <div className="p-8 flex-1">{children}</div>
      </main>
    </div>
  );
};
