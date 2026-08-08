import React, { useState } from 'react';
import { CreditCard, X, Loader2, CheckCircle2, ShieldCheck, ExternalLink } from 'lucide-react';
import { useLanguageStore } from '../../stores/languageStore';
import { useBillingStore, type CheckoutInfo } from '../../stores/billingStore';
import { api } from '../../lib/api';

interface Props {
  checkout: CheckoutInfo | null;
  onClose: () => void;
  onProcessed: () => void;
}

export const CheckoutModal: React.FC<Props> = ({ checkout, onClose, onProcessed }) => {
  const { t, language } = useLanguageStore();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!checkout) return null;
  const payment = checkout.payment;

  const formatMoney = (n: number) =>
    new Intl.NumberFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      style: 'currency',
      currency: payment.currency,
    }).format(n);

  const approve = async () => {
    if (processing || done) return;
    setProcessing(true);
    setError('');
    try {
      await api.post(`/billing/checkout/${payment.id}/sandbox/approve`);
      await useBillingStore.getState().refresh();
      setDone(true);
      setTimeout(onProcessed, 1200);
    } catch (e: any) {
      setError(e.response?.data?.message || t.checkoutFailed);
    } finally {
      setProcessing(false);
    }
  };

  const decline = async () => {
    if (processing || done) return;
    setProcessing(true);
    setError('');
    try {
      await api.post(`/billing/checkout/${payment.id}/sandbox/decline`);
      setError(t.checkoutCancelled);
    } catch (e: any) {
      setError(e.response?.data?.message || t.checkoutFailed);
    } finally {
      setProcessing(false);
    }
  };

  const openHosted = () => {
    if (payment.checkoutUrl) window.open(payment.checkoutUrl, '_blank', 'noopener');
  };

  const row = (label: string, value: string) => (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <span className="text-xs font-extrabold text-slate-800">{value}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <CreditCard className="w-4 h-4" />
            </span>
            {t.checkoutTitle}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-xs font-semibold text-slate-500">{t.checkoutDesc}</p>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 divide-y divide-slate-200/70 px-4">
            {row(t.checkoutPlanLabel, payment.planName)}
            {row(t.checkoutAmount, formatMoney(payment.amount))}
            {row(t.checkoutProvider, payment.provider)}
            <div className="flex items-center justify-between py-2">
              <span className="text-xs font-bold text-slate-500">{t.checkoutMode}</span>
              {payment.sandbox ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-extrabold uppercase">
                  {t.checkoutSandboxBadge}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold uppercase">
                  Live
                </span>
              )}
            </div>
          </div>

          {error && (
            <div className={`p-3 rounded-xl text-xs font-medium border ${done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {done ? t.checkoutSuccess : error}
            </div>
          )}

          {payment.sandbox ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-extrabold text-amber-800">{t.checkoutSandboxBadge}</span>
              </div>
              <p className="text-xs font-medium text-amber-700 leading-relaxed">{t.checkoutSandboxNote}</p>
            </div>
          ) : null}

          {!payment.sandbox && payment.checkoutUrl ? (
            <button
              onClick={openHosted}
              disabled={processing || done}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 text-sm"
            >
              <ExternalLink className="w-4 h-4" />
              {t.checkoutStarting}
            </button>
          ) : null}
        </div>

        {payment.sandbox && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              onClick={decline}
              disabled={processing || done}
              className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {t.checkoutDecline}
            </button>
            <button
              onClick={approve}
              disabled={processing || done}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition-all"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : done ? <CheckCircle2 className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
              {processing ? t.checkoutProcessing : done ? t.checkoutSuccess : t.checkoutApprove}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
