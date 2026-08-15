import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useLanguageStore } from '../../stores/languageStore';
import { api } from '../../lib/api';
import { Store, Mail, Lock, User, Phone, ArrowRight, Building2, Sparkles, Zap, Crown, Check } from 'lucide-react';
import type { BillingCycle } from '../../stores/billingStore';

const SIGNUP_PLANS = [
  { key: 'starter', monthly: 99, yearly: 990, icon: Sparkles },
  { key: 'pro', monthly: 199, yearly: 1990, icon: Zap },
  { key: 'enterprise', monthly: 499, yearly: 4990, icon: Crown },
];

export const RegisterPage: React.FC = () => {
  const [storeName, setStoreName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [branchName, setBranchName] = useState('');
  const [plan, setPlan] = useState('starter');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);
  const { t } = useLanguageStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/signup', {
        storeName,
        ownerName,
        email,
        password,
        phone: phone || undefined,
        branchName: branchName || undefined,
        plan,
        billingCycle,
      });
      const { user, accessToken } = res.data.data;
      setAuth(user, accessToken);
      navigate('/pos');
    } catch (err: any) {
      setError(err.response?.data?.message || t.registerTitle);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-8 shadow-2xl shadow-slate-200/60 relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-4 bg-slate-50 rounded-2xl mb-3 shadow-inner border border-slate-100">
            <div className="flex items-center gap-3">
              <img
                src={`${import.meta.env.BASE_URL}logo_transparent.png`}
                alt="KodaSoft Logo"
                className="w-12 h-12 object-contain drop-shadow-sm"
              />
              <span className="text-2xl font-black tracking-tight text-slate-800">
                KODA<span className="text-cyan-500">SOFT</span>
              </span>
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{t.registerTitle}</h1>
          <p className="text-slate-500 text-xs mt-1">{t.registerSubtitle}</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.storeNameLabel}</label>
            <div className="relative">
              <Store className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                minLength={2}
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all shadow-sm"
                placeholder={t.storeNamePlaceholder}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.ownerNameLabel}</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                required
                minLength={2}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all shadow-sm"
                placeholder={t.ownerNamePlaceholder}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.emailAddress}</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all shadow-sm"
                placeholder="owner@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.password}</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all shadow-sm"
                placeholder="••••••••"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{t.passwordMinHint}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.phoneLabel}</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all shadow-sm"
                  placeholder="+966"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.branchNameLabel}</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all shadow-sm"
                  placeholder={t.branchNamePlaceholder}
                />
              </div>
            </div>
          </div>

          {/* Plan selection */}
          <div className="pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 mb-1">{t.signupPlanTitle}</label>
              <span className="text-[10px] text-emerald-600 font-bold">{t.signupTrialNote}</span>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold mb-2.5">{t.signupPlanDesc}</p>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit mb-3">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                  billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.billingMonthly}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition-all flex items-center gap-1 ${
                  billingCycle === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.billingYearly}
                <span className="px-1 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-extrabold">
                  {t.yearlySaveNote}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {SIGNUP_PLANS.map((p) => {
                const Icon = p.icon;
                const active = plan === p.key;
                return (
                  <button
                    type="button"
                    key={p.key}
                    onClick={() => setPlan(p.key)}
                    className={`relative rounded-xl border p-3 text-center transition-all ${
                      active
                        ? 'border-cyan-500 bg-cyan-50 shadow-md shadow-cyan-500/10'
                        : 'border-slate-200 bg-white hover:border-cyan-300'
                    }`}
                  >
                    {active && (
                      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-cyan-500 text-white flex items-center justify-center">
                        <Check className="w-2.5 h-2.5" strokeWidth={3} />
                      </span>
                    )}
                    <Icon className={`w-4 h-4 mx-auto mb-1 ${p.key === 'enterprise' ? 'text-amber-500' : 'text-cyan-600'}`} />
                    <p className="text-[11px] font-extrabold text-slate-800 truncate">
                      {p.key === 'starter' ? t.saasStarter : p.key === 'pro' ? t.saasPro : t.saasEnterprise}
                    </p>
                    <p className="text-sm font-extrabold text-slate-900">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(billingCycle === 'yearly' ? p.yearly : p.monthly)}
                      <span className="text-[9px] font-bold text-slate-400">
                        {billingCycle === 'yearly' ? ` / ${t.saasPerYear}` : t.saasPerMonth}
                      </span>
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2 text-sm"
          >
            {loading ? t.creatingAccount : t.createAccount}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-500 font-medium">
          {t.haveAccount}{' '}
          <Link to="/login" className="text-cyan-600 font-bold hover:underline">
            {t.signInNow}
          </Link>
        </div>
      </div>
    </div>
  );
};
