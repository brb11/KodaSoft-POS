import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguageStore } from '../../stores/languageStore';
import { useAuthStore } from '../../stores/authStore';
import { useBillingStore } from '../../stores/billingStore';
import { apiLogout } from '../../lib/api';
import { Lock, LogOut, UserCog, Loader2 } from 'lucide-react';

// Paywall shown when the organization's subscription is inactive (trial ended,
// past due, canceled, or suspended). Store users cannot renew or change plans —
// that is handled exclusively by the platform administrator (Requirements #1/#4).
export const PaywallScreen: React.FC = () => {
  const { t } = useLanguageStore();
  const navigate = useNavigate();
  const data = useBillingStore((s) => s.data);

  const trialExpired = data?.status === 'TRIAL';
  const message = trialExpired ? t.paywallTrialEnded : t.paywallPastDue;

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

        <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 mb-6 flex items-start gap-2.5 text-left">
          <UserCog className="w-4 h-4 text-cyan-600 mt-0.5 shrink-0" />
          <p className="text-xs font-medium text-cyan-800 leading-relaxed">{t.paywallContactAdmin}</p>
        </div>

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
  );
};