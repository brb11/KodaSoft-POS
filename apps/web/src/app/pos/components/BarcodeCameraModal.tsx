import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useLanguageStore } from '../../../stores/languageStore';
import { Camera, X, Loader2 } from 'lucide-react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

// Repeated scans of the same code are ignored for a short window — the library
// reports the same barcode on many frames, and one code usually means one unit.
const DEDUPE_MS = 2000;

export const BarcodeCameraModal: React.FC<Props> = ({ onScan, onClose }) => {
  const { t } = useLanguageStore();
  const [state, setState] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorText, setErrorText] = useState('');
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const lastCodeRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let cancelled = false;
    const scanner = new Html5Qrcode('pos-barcode-reader');
    scannerRef.current = scanner;

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (vw: number, vh: number) => {
              const size = Math.max(120, Math.floor(Math.min(vw, vh) * 0.62));
              return { width: size, height: size };
            },
          },
          (decodedText) => {
            const now = Date.now();
            const last = lastCodeRef.current;
            if (decodedText === last.code && now - last.at < DEDUPE_MS) return;
            lastCodeRef.current = { code: decodedText, at: now };
            onScanRef.current(decodedText);
          },
          () => {
            /* frame without a readable barcode yet — ignore */
          }
        );
        if (!cancelled) setState('scanning');
      } catch (err: any) {
        if (cancelled) return;
        const name: string = err?.name || '';
        const denied =
          name.includes('NotAllowedError') ||
          name.includes('Permission') ||
          String(err?.message || '').toLowerCase().includes('permission');
        setErrorText(denied ? t.cameraPermissionDenied : t.cameraUnavailable);
        setState('error');
      }
    };

    start();

    return () => {
      cancelled = true;
      const s = scanner;
      scannerRef.current = null;
      if (s.isScanning) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-200">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t.scanBarcodeTitle}</h3>
              <p className="text-[11px] text-slate-400">{t.cameraScanHint}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square">
          <div id="pos-barcode-reader" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
          {state === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-100 bg-slate-900/60 gap-2">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-xs font-semibold">{t.scanning}</p>
            </div>
          )}
          {state === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-100 bg-slate-900/60 gap-2 px-6 text-center">
              <X className="w-6 h-6 text-rose-400" />
              <p className="text-xs font-semibold">{errorText}</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400 flex-1">{t.barcodeScannerHint}</p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
