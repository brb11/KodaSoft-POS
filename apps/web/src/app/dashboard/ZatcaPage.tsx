import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useLanguageStore } from '../../stores/languageStore';
import type { Translations } from '../../stores/languageStore';
import {
  ShieldCheck,
  KeyRound,
  FileCheck2,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Send,
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  ExternalLink,
  FileText,
  QrCode,
} from 'lucide-react';

type ZatcaMode = 'sandbox' | 'production';

interface ZatcaCertInfo {
  subject: string;
  validFrom: string;
  validTo: string;
}

interface ComplianceCheckResult {
  name: string;
  kind: 'simplified' | 'standard';
  documentType: 'simplified' | 'tax' | 'credit' | 'debit';
  status: 'PASS' | 'ERROR';
  response?: { error?: string };
}

interface ZatcaCredentialSummary {
  id: string;
  mode: ZatcaMode;
  enabled: boolean;
  hasKeyPair: boolean;
  csrPem: string | null;
  hasSelfSignedCert: boolean;
  hasComplianceCsid: boolean;
  complianceRequestId: string | null;
  complianceSerialNumber: string | null;
  complianceCert: ZatcaCertInfo | null;
  complianceChecksStatus: 'PASS' | 'FAIL' | null;
  complianceChecksResults: ComplianceCheckResult[] | null;
  complianceChecksAt: string | null;
  hasProductionCsid: boolean;
  productionRequestId: string | null;
  productionSerialNumber: string | null;
  productionCert: ZatcaCertInfo | null;
  lastInvoiceHash: string | null;
  lastInvoiceNumber: string | null;
}

interface ZatcaStatus {
  enabled: boolean;
  activeMode: ZatcaMode | null;
  credentials: ZatcaCredentialSummary[];
  counts: { submitted: number; cleared: number; reported: number; failed: number };
}

interface ZatcaSubmission {
  id: string;
  orderId: string | null;
  invoiceUuid: string;
  invoiceNumber: string;
  invoiceType: string;
  invoiceHash: string;
  invoiceSignature: string;
  status: string;
  attemptCount: number;
  submittedAt: string;
  clearedAt: string | null;
}

const STATUS_LABEL_KEYS: Record<string, keyof Translations> = {
  SIGNED: 'statusSigned',
  SUBMITTED: 'statusSubmitted',
  CLEARED: 'statusCleared',
  REPORTED: 'statusReported',
  FAILED: 'statusFailed',
};

const STATUS_COLORS: Record<string, string> = {
  SIGNED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-200',
  CLEARED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REPORTED: 'bg-violet-50 text-violet-700 border-violet-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const ZatcaPage: React.FC = () => {
  const { t, language } = useLanguageStore();
  const [status, setStatus] = useState<ZatcaStatus | null>(null);
  const [submissions, setSubmissions] = useState<ZatcaSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [mode, setMode] = useState<ZatcaMode>('sandbox');
  const [vat, setVat] = useState('');
  const [invoiceType, setInvoiceType] = useState<'SIMPLIFIED' | 'TAX'>('SIMPLIFIED');
  const [csr, setCsr] = useState<string | null>(null);
  const [selfSigned, setSelfSigned] = useState<{ pem: string; serialNumber: string } | null>(null);
  const [complianceOtp, setComplianceOtp] = useState('');
  const [productionOtp, setProductionOtp] = useState('');

  const [generating, setGenerating] = useState(false);
  const [complianceBusy, setComplianceBusy] = useState(false);
  const [checksBusy, setChecksBusy] = useState(false);
  const [productionBusy, setProductionBusy] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [statusRes, subsRes] = await Promise.all([
      api.get('/zatca'),
      api.get('/zatca/submissions', { params: { limit: 100 } }),
    ]);
    setStatus(statusRes.data.data as ZatcaStatus);
    setSubmissions(subsRes.data.data as ZatcaSubmission[]);
  }, []);

  useEffect(() => {
    loadAll()
      .catch((err) => setMsg({ ok: false, text: err.response?.data?.message || t.zatcaFailGeneric }))
      .finally(() => setLoading(false));
    api.get('/settings').then((res) => {
      const data = res.data.data || {};
      if (data.vatNumber) setVat(data.vatNumber);
    });
  }, [loadAll, t]);

  const cred = status?.credentials.find((c) => c.mode === mode) ?? null;

  const fail = (err: any) => err.response?.data?.message || t.zatcaFailGeneric;

  const generate = async () => {
    setGenerating(true);
    setMsg(null);
    try {
      const res = await api.post('/zatca/credentials', { mode, vatNumber: vat, invoiceType });
      const data = res.data.data;
      setCsr(data.csr ?? null);
      setSelfSigned(data.selfSignedCert ?? null);
      await loadAll();
      setMsg({ ok: true, text: t.zatcaDone });
    } catch (err) {
      setMsg({ ok: false, text: fail(err) });
    } finally {
      setGenerating(false);
    }
  };

  const requestCompliance = async () => {
    setComplianceBusy(true);
    setMsg(null);
    try {
      await api.post('/zatca/compliance', { mode, otp: complianceOtp });
      setComplianceOtp('');
      await loadAll();
      setMsg({ ok: true, text: t.zatcaDone });
    } catch (err) {
      setMsg({ ok: false, text: fail(err) });
    } finally {
      setComplianceBusy(false);
    }
  };

  const runComplianceChecks = async () => {
    setChecksBusy(true);
    setMsg(null);
    try {
      const res = await api.post('/zatca/compliance/checks', { mode });
      setStatus(res.data.data as ZatcaStatus);
      setMsg({ ok: true, text: t.zatcaDone });
    } catch (err) {
      setMsg({ ok: false, text: fail(err) });
    } finally {
      setChecksBusy(false);
    }
  };

  const requestProduction = async () => {
    setProductionBusy(true);
    setMsg(null);
    try {
      await api.post('/zatca/production', { otp: productionOtp });
      setProductionOtp('');
      await loadAll();
      setMsg({ ok: true, text: t.zatcaDone });
    } catch (err) {
      setMsg({ ok: false, text: fail(err) });
    } finally {
      setProductionBusy(false);
    }
  };

  const toggle = async () => {
    const next = !(cred?.enabled ?? false);
    setEnabling(true);
    setMsg(null);
    try {
      const res = await api.post('/zatca/enable', { enabled: next, mode });
      setStatus(res.data.data as ZatcaStatus);
      setMsg({ ok: true, text: t.zatcaDone });
    } catch (err) {
      setMsg({ ok: false, text: fail(err) });
    } finally {
      setEnabling(false);
    }
  };

  const revoke = async () => {
    if (!window.confirm(t.zatcaConfirmRevoke)) return;
    setRevoking(true);
    setMsg(null);
    try {
      await api.delete(`/zatca/credentials/${mode}`);
      setCsr(null);
      setSelfSigned(null);
      await loadAll();
      setMsg({ ok: true, text: t.zatcaRevoked });
    } catch (err) {
      setMsg({ ok: false, text: fail(err) });
    } finally {
      setRevoking(false);
    }
  };

  const retry = async (id: string) => {
    setRetryingId(id);
    setMsg(null);
    try {
      await api.post(`/zatca/submissions/${id}/retry`);
      await loadAll();
      setMsg({ ok: true, text: t.zatcaRetrySuccess });
    } catch (err) {
      setMsg({ ok: false, text: fail(err) });
    } finally {
      setRetryingId(null);
    }
  };

  const copy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const formatDate = (d: string | null) =>
    d
      ? new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(d))
      : '—';

  const statusLabel = (s: string) => t[STATUS_LABEL_KEYS[s] ?? 'statusSubmitted'];
  const statusColor = (s: string) => STATUS_COLORS[s] ?? 'bg-slate-50 text-slate-600 border-slate-200';
  const typeLabel = (s: string) => (s === 'TAX' ? t.zatcaInvoiceTypeTax : t.zatcaInvoiceTypeSimplified);
  const checksDocLabel = (r: ComplianceCheckResult) => {
    const kind = r.kind === 'standard' ? t.zatcaChecksKindStandard : t.zatcaChecksKindSimplified;
    const doc = r.documentType === 'credit' ? t.zatcaChecksDocCredit : r.documentType === 'debit' ? t.zatcaChecksDocDebit : t.zatcaChecksDocInvoice;
    return `${kind} ${doc}`;
  };

  const enabled = status?.enabled ?? false;

  const countCards = [
    { label: t.statusSigned, value: status?.counts.submitted ?? 0, color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
    { label: t.statusCleared, value: status?.counts.cleared ?? 0, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { label: t.statusReported, value: status?.counts.reported ?? 0, color: 'text-violet-600 bg-violet-50 border-violet-200' },
    { label: t.statusFailed, value: status?.counts.failed ?? 0, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  ];

  const stepState = (step: 'keys' | 'compliance' | 'checks' | 'production' | 'enable') => {
    if (step === 'keys') return cred?.hasKeyPair ? 'done' : 'todo';
    if (step === 'compliance') return cred?.hasComplianceCsid ? 'done' : cred?.hasKeyPair ? 'current' : 'todo';
    if (step === 'checks') {
      if (cred?.complianceChecksStatus === 'PASS') return 'done';
      return cred?.hasComplianceCsid ? 'current' : 'todo';
    }
    if (step === 'production') {
      if (mode === 'production') return cred?.hasProductionCsid ? 'done' : cred?.hasComplianceCsid ? 'current' : 'todo';
      return 'skip';
    }
    return cred?.enabled ? 'done' : cred?.hasKeyPair ? 'current' : 'todo';
  };

  const StepBadge: React.FC<{ state: 'done' | 'current' | 'todo' | 'skip'; n: string }> = ({ state, n }) => {
    if (state === 'done') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (state === 'current') return <div className="w-5 h-5 rounded-full bg-cyan-500 text-white text-[10px] font-black flex items-center justify-center">{n}</div>;
    return <div className="w-5 h-5 rounded-full border-2 border-slate-200 text-slate-300 text-[10px] font-black flex items-center justify-center">{n}</div>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            {t.zatcaTitle}
          </h1>
          <p className="text-slate-500 text-xs mt-1 ml-[52px]">{t.zatcaDesc}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
            enabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}
        >
          {enabled ? t.zatcaEnabledBadge : t.zatcaDisabledBadge}
        </span>
      </div>

      {/* Counts + active mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {countCards.map((c) => (
          <div key={c.label} className={`rounded-2xl border p-4 ${c.color}`}>
            <p className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">{c.label}</p>
            <p className="text-2xl font-black mt-0.5">{c.value}</p>
          </div>
        ))}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{t.zatcaActiveMode}</p>
          <p className="text-sm font-extrabold text-slate-800 mt-1 flex items-center gap-1.5">
            {enabled ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> {status?.activeMode === 'production' ? t.modeProduction : t.modeSandbox}</>
            ) : (
              <><CircleOff className="w-4 h-4 text-slate-400" /> {t.zatcaDisabledBadge}</>
            )}
          </p>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-xl text-xs font-medium ${msg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
          {msg.text}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t.loading}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
          {/* Onboarding wizard */}
          <div className="xl:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
            {/* Mode toggle */}
            <div>
              <h2 className="text-xs font-extrabold text-slate-900 mb-2">{t.zatcaActiveMode}</h2>
              <div className="grid grid-cols-2 gap-3">
                {(['sandbox', 'production'] as ZatcaMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      mode === m
                        ? 'border-emerald-500 bg-emerald-50/50 shadow-md shadow-emerald-500/10'
                        : 'border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {m === 'sandbox' ? <QrCode className="w-4 h-4 text-emerald-600" /> : <FileCheck2 className="w-4 h-4 text-emerald-600" />}
                      <span className="text-sm font-extrabold text-slate-900">{m === 'sandbox' ? t.modeSandbox : t.modeProduction}</span>
                      {m === status?.activeMode && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold uppercase ml-auto">{t.zatcaEnabledBadge}</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">{t.zatcaModeDesc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 1: Keys */}
            <div className="rounded-2xl border border-slate-200 p-5">
              <div className="flex items-center gap-3 mb-4">
                <StepBadge state={stepState('keys')} n="1" />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-emerald-600" /> {t.zatcaGenerateCredentials}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold">{t.zatcaModeDesc}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.zatcaVatNumber}</label>
                  <input
                    type="text"
                    value={vat}
                    maxLength={15}
                    onChange={(e) => setVat(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="311111111100003"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">{t.zatcaInvoiceTypeLabel}</label>
                  <select
                    value={invoiceType}
                    onChange={(e) => setInvoiceType(e.target.value as 'SIMPLIFIED' | 'TAX')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
                  >
                    <option value="SIMPLIFIED">{t.zatcaInvoiceTypeSimplified}</option>
                    <option value="TAX">{t.zatcaInvoiceTypeTax}</option>
                  </select>
                </div>
              </div>

              <button
                onClick={generate}
                disabled={generating}
                className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : cred?.hasKeyPair ? <RefreshCw className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
                {generating ? t.zatcaGeneratingCredentials : cred?.hasKeyPair ? t.zatcaRegenerateCredentials : t.zatcaGenerateCredentials}
              </button>

              {csr && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{t.zatcaCsrTitle}</p>
                      <button
                        onClick={() => copy('csr', csr)}
                        className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700"
                      >
                        {copied === 'csr' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === 'csr' ? t.zatcaCopied : t.zatcaCopy}
                      </button>
                    </div>
                    <pre className="text-[9px] leading-relaxed text-slate-600 whitespace-pre-wrap break-all max-h-28 overflow-y-auto">{csr}</pre>
                  </div>
                  {selfSigned && (
                    <div className="rounded-xl bg-emerald-50/50 border border-emerald-200 p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">{t.zatcaCertTitle}</p>
                        <button
                          onClick={() => copy('cert', selfSigned.pem)}
                          className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700"
                        >
                          {copied === 'cert' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copied === 'cert' ? t.zatcaCopied : t.zatcaCopy}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-3 text-[10px] font-bold text-emerald-800">
                        <span>{t.zatcaCertSerial}: {selfSigned.serialNumber}</span>
                        <span>{t.zatcaCertExpiry}: {formatDate(new Date(Date.now() + 365 * 86400000).toISOString())}</span>
                      </div>
                      <pre className="text-[9px] leading-relaxed text-emerald-900/70 whitespace-pre-wrap break-all max-h-20 overflow-y-auto mt-1">{selfSigned.pem}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Step 2: Compliance CSID */}
            {cred?.hasKeyPair && (
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <StepBadge state={stepState('compliance')} n="2" />
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">{t.zatcaComplianceTitle}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">{t.zatcaComplianceDesc}</p>
                  </div>
                </div>
                {cred?.hasComplianceCsid ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div className="text-xs text-emerald-800">
                      <p className="font-extrabold">{t.zatcaComplianceTitle} ✓</p>
                      {cred.complianceSerialNumber && (
                        <p className="text-[10px] text-emerald-600 font-semibold">{t.zatcaCertSerial}: {cred.complianceSerialNumber}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={complianceOtp}
                      onChange={(e) => setComplianceOtp(e.target.value)}
                      placeholder={t.zatcaOtpPlaceholder}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
                    />
                    <button
                      onClick={requestCompliance}
                      disabled={complianceBusy || complianceOtp.length === 0}
                      className="px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-md shadow-cyan-500/20 hover:from-cyan-600 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                    >
                      {complianceBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {complianceBusy ? t.zatcaRequestingCompliance : t.zatcaRequestCompliance}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Compliance checks */}
            {cred?.hasComplianceCsid && (
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <StepBadge state={stepState('checks')} n="3" />
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">{t.zatcaChecksTitle}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">{t.zatcaChecksDesc}</p>
                  </div>
                </div>

                {cred.complianceChecksStatus === 'PASS' ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div className="text-xs text-emerald-800">
                      <p className="font-extrabold">{t.zatcaChecksPassed}</p>
                      {cred.complianceChecksAt && (
                        <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                          {t.zatcaChecksAt}: {formatDate(cred.complianceChecksAt)}
                        </p>
                      )}
                    </div>
                  </div>
                ) : cred.complianceChecksStatus === 'FAIL' ? (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                    <div className="text-xs text-rose-800">
                      <p className="font-extrabold">{t.zatcaChecksFailed}</p>
                      {cred.complianceChecksAt && (
                        <p className="text-[10px] text-rose-600 font-semibold mt-0.5">
                          {t.zatcaChecksAt}: {formatDate(cred.complianceChecksAt)}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 font-semibold mb-3">{t.zatcaChecksNotRun}</p>
                )}

                {cred.complianceChecksResults && cred.complianceChecksResults.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {cred.complianceChecksResults.map((r) => (
                      <div key={r.name} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs">
                        <span className="font-bold text-slate-700">{checksDocLabel(r)}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                            r.status === 'PASS'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {r.status === 'PASS' ? t.zatcaChecksPassed : r.status === 'ERROR' ? t.zatcaChecksFailed : t.zatcaChecksNotRun}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={runComplianceChecks}
                  disabled={checksBusy}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold shadow-md shadow-teal-500/20 hover:from-teal-600 hover:to-cyan-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {checksBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
                  {checksBusy ? t.zatcaChecksRunning : t.zatcaChecksRun}
                </button>
              </div>
            )}

            {/* Step 4: Production CSID */}
            {mode === 'production' && cred?.hasComplianceCsid && !cred?.hasProductionCsid && (
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <StepBadge state={stepState('production')} n="4" />
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">{t.zatcaProductionTitle}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">{t.zatcaProductionDesc}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={productionOtp}
                    onChange={(e) => setProductionOtp(e.target.value)}
                    placeholder={t.zatcaOtpPlaceholder}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all shadow-sm"
                  />
                  <button
                    onClick={requestProduction}
                    disabled={productionBusy || productionOtp.length === 0}
                    className="px-5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white font-bold shadow-md shadow-violet-500/20 hover:from-violet-600 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
                  >
                    {productionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {productionBusy ? t.zatcaRequestingProduction : t.zatcaRequestProduction}
                  </button>
                </div>
              </div>
            )}

            {/* Step 5: Enable */}
            {cred?.hasKeyPair && (
              <div className="rounded-2xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <StepBadge state={stepState('enable')} n="5" />
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">{t.zatcaEnableTitle}</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">{t.zatcaEnableDesc}</p>
                  </div>
                </div>
                <button
                  onClick={toggle}
                  disabled={enabling}
                  className={`w-full py-3 rounded-xl font-bold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm ${
                    cred?.enabled
                      ? 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-700'
                  }`}
                >
                  {enabling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : cred?.enabled ? (
                    <CircleOff className="w-4 h-4" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  {enabling
                    ? cred?.enabled
                      ? t.zatcaDisabling
                      : t.zatcaEnabling
                    : cred?.enabled
                    ? t.zatcaDisable
                    : t.zatcaEnable}
                </button>

                <button
                  onClick={revoke}
                  disabled={revoking}
                  className="mt-3 w-full py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all flex items-center justify-center gap-2"
                >
                  {revoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {t.zatcaRevoke}
                </button>
              </div>
            )}

            {!cred && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-amber-800 leading-relaxed">{t.zatcaNotConfigured}</p>
              </div>
            )}
          </div>

          {/* Submissions */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">{t.zatcaSubmissionsTitle}</h2>
                <p className="text-[10px] text-slate-400 font-semibold">{t.zatcaSubmissionsDesc}</p>
              </div>
            </div>
            <div className="mt-2 mb-4 flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{t.zatcaCounts}</span>
              <button onClick={() => loadAll().catch((err) => setMsg({ ok: false, text: fail(err) }))} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50" title={t.refresh}>
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-slate-300">
                <ExternalLink className="w-8 h-8 mb-2" />
                <p className="text-xs font-semibold text-slate-400">{t.zatcaNoSubmissions}</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-0.5">
                {submissions.map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 p-3.5 hover:border-emerald-200 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-extrabold text-slate-800">{s.invoiceNumber}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${statusColor(s.status)}`}>
                        {statusLabel(s.status)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-1 text-[10px] text-slate-400 font-semibold">
                      <span>{typeLabel(s.invoiceType)}</span>
                      <span>{t.zatcaAttemptsCol}: {s.attemptCount}</span>
                    </div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]" title={s.invoiceHash}>{s.invoiceHash}</p>
                      <button onClick={() => copy(`hash-${s.id}`, s.invoiceHash)} className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-emerald-600">
                        {copied === `hash-${s.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === `hash-${s.id}` ? t.zatcaCopied : t.zatcaCopy}
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                      <span>{t.zatcaSubmittedAtCol}: {formatDate(s.submittedAt)}</span>
                      {s.clearedAt && <span>{t.zatcaClearedAtCol}: {formatDate(s.clearedAt)}</span>}
                    </div>
                    {s.status === 'FAILED' && (
                      <button
                        onClick={() => retry(s.id)}
                        disabled={retryingId === s.id}
                        className="mt-2.5 w-full py-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-extrabold hover:bg-rose-100 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {retryingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        {retryingId === s.id ? t.zatcaRetrying : t.zatcaRetry}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
