import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useLanguageStore } from '../../stores/languageStore';
import { api } from '../../lib/api';
import { Mail, Lock, Building2, KeyRound, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<'email' | 'pin'>('email');
  const [email, setEmail] = useState('admin@kodasoft.com');
  const [password, setPassword] = useState('admin123');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setAuth = useAuthStore((s) => s.setAuth);
  const { t } = useLanguageStore();
  const navigate = useNavigate();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/login', { email, password });
      const { user, accessToken } = res.data.data;
      setAuth(user, accessToken);
      navigate(user.role === 'SUPER_ADMIN' ? '/saas' : '/pos');
    } catch (err: any) {
      setError(err.response?.data?.message || t.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const branchId = localStorage.getItem('lastBranchId');
    if (!branchId) {
      setError('الرجاء الدخول بالبريد الإلكتروني أولاً لتسجيل هذا الجهاز في الفرع');
      setLoading(false);
      return;
    }

    try {
      const res = await api.post('/auth/pin-login', { pin, branchId });
      const { user, accessToken } = res.data.data;
      setAuth(user, accessToken);
      navigate('/pos');
    } catch (err: any) {
      setError(err.response?.data?.message || t.invalidPin);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />

      {/* Main Glass Card */}
      <div className="w-full max-w-md bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-8 shadow-2xl shadow-slate-200/60 relative z-10">
        {/* Company Logo & Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 bg-slate-50 rounded-2xl mb-3 shadow-inner border border-slate-100">
            <div className="flex items-center gap-3">
              <img
                src="/logo_transparent.png"
                alt="KodaSoft Logo"
                className="w-12 h-12 object-contain drop-shadow-sm"
              />
              <span className="text-2xl font-black tracking-tight text-slate-800">
                KODA<span className="text-cyan-500">SOFT</span>
              </span>
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{t.loginTitle}</h1>
          <p className="text-slate-500 text-xs mt-1">{t.loginSubtitle}</p>
        </div>

        {/* Mode Selector */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 border border-slate-200">
          <button
            type="button"
            onClick={() => setMode('email')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              mode === 'email'
                ? 'bg-white text-cyan-600 shadow-md border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.emailPassword}
          </button>
          <button
            type="button"
            onClick={() => setMode('pin')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
              mode === 'pin'
                ? 'bg-white text-cyan-600 shadow-md border border-slate-200/60'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.quickPin}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {mode === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                  placeholder="admin@kodasoft.com"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:bg-white transition-all shadow-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? t.authenticating : t.signIn}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handlePinSubmit} className="space-y-6 text-center">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-3">{t.enterPin}</label>
              <div className="flex justify-center gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    type="password"
                    maxLength={1}
                    value={pin[i] || ''}
                    onChange={(e) => {
                      const newPin = pin.split('');
                      newPin[i] = e.target.value;
                      setPin(newPin.join(''));
                    }}
                    className="w-12 h-14 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-extrabold text-cyan-600 focus:outline-none focus:border-cyan-500 focus:bg-white shadow-sm transition-all"
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? t.verifyingPin : t.openTerminal}
              <KeyRound className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-slate-500 flex flex-col gap-1.5 font-medium">
          <span>
            {t.newHere}{' '}
            <Link to="/register" className="text-cyan-600 font-bold hover:underline">
              {t.startFreeTrial}
            </Link>
          </span>
          <span className="flex items-center justify-center gap-1.5 text-slate-400">
            <Building2 className="w-3.5 h-3.5" /> {t.poweredBy}
          </span>
        </div>
      </div>
    </div>
  );
};
