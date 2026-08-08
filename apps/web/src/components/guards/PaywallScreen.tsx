import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useLanguageStore } from '../../stores/languageStore';
import { useAuthStore } from '../../stores/authStore';
import { useBillingStore, type CheckoutInfo } from '../../stores/billingStore';
import { api, apiLogout } from '../../lib/api';
import { CheckoutModal } from '../billing/CheckoutModal';
import { Lock, CreditCard, LogOut, Loader2, RefreshCw } from 'lucide-react';

export const PaywallScreen: React.FC = () => {
  const { t } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const data = useBillingStore((s) => s.data);
  const refresh = useBillingStore((s) => s.refresh);
  const [renewing, setRenewing] = useState(false);
  const [error, setError] = useState('');
  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);

  const trialExpired = data?.status === 'TRIAL';
  const message = trialExpired ? t.paywallTrialEnded : t.paywallPastDue;
  const isOwner = user?.role === 'OWNER';

  const renew = async () => {
    setRenewing(true);
    setError('');
    try {
      // Payment-driven flow: Checkout → Payment Provider → Webhook → ACTIVE.
      const res = await api.post('/billing/checkout', {});
      setCheckout(res.data.data as CheckoutInfo);
    } catch {
      setError(t.renewFailed);
    } finally {
      setRenewing(false);
    }
  };

  const handleProcessed = async () => {
    setCheckout(null);
    await refresh();
  };

  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/60 p-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-5">
          <Lock className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900 mb-2">{t.paywallTitle}</h1>
        <p className="text-xs text-slate-500 font-semibold mb-1">{t.paywallDesc}</p>
        <p className="text-xs text-amber-600 font-bold mb-6">{message}</p>

        {data ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 mb-6 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">{t.currentPlanLabel}</span>
            <span className="text-xs font-extrabold text-slate-900">{data.planName}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mb-6">
            <Loader2 className="w-4 h-4 animate-spin" /> {t.planLoading}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs font-medium">
            {error}
          </div>
        )}

        <div className="space-y-2.5">
          {isOwner && (
            <button
              onClick={renew}
              disabled={renewing}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/25 hover:from-amber-600 hover:to-orange-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {renewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {renewing ? t.renewing : t.renewNow}
            </button>
          )}
          <Link
            to="/dashboard/settings"
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 hover:from-cyan-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2 text-sm"
          >
            <CreditCard className="w-4 h-4" />
            {t.paywallGoBilling}
          </Link>
          <button
            onClick={() => {
              apiLogout();
              navigate('/login');
            }}
            className="w-full py-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center justify-center gap-2 text-xs font-bold"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t.paywallLogout}
          </button>
        </div>
      </div>

      <CheckoutModal checkout={checkout} onClose={() => setCheckout(null)} onProcessed={handleProcessed} />
    </div>
  );
};
