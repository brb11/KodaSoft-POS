import React, { useEffect, useRef, useState } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';
import { useLanguageStore } from '../../../stores/languageStore';
import { Camera, X, Loader2 } from 'lucide-react';

interface Props {
  onScan: (code: string) => void;
  onClose: () => void;
}

// Repeated scans of the same code are ignored for a short window — the library
// reports the same barcode on many frames, and one code usually means one unit.
const DEDUPE_MS = 2000;

// Only the formats this POS deals with. Constraining the decoder makes frames
// decode faster and avoids false positives from unrelated QR codes.
const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.QR_CODE,
];

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
    let startTimer: ReturnType<typeof setTimeout> | null = null;

    // Create the scanner once, not per effect run. React StrictMode mounts,
    // unmounts and remounts this component in dev, and a brand-new Html5Qrcode
    // per mount would grab the camera twice and leave the scanning loop broken.
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode('pos-barcode-reader', {
        // The native BarcodeDetector in desktop Chrome only decodes QR codes —
        // EAN/UPC product barcodes would never be read. Force the bundled ZXing
        // decoder, which handles every format we need.
        verbose: false,
        useBarCodeDetectorIfSupported: false,
        formatsToSupport: SUPPORTED_FORMATS,
      });
    }
    const scanner = scannerRef.current;

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            // A wide, short box instead of a square: product barcodes are
            // horizontal one-dimensional codes, so a wide box lets the user
            // hold the whole code inside it more easily.
            qrbox: (vw: number, vh: number) => ({
              width: Math.floor(vw * 0.92),
              height: Math.max(120, Math.floor(vh * 0.32)),
            }),
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
        if (cancelled) {
          await scanner.stop().catch(() => {});
          return;
        }
        setState('scanning');
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

    // Defer until the first StrictMode mount has run its cleanup, so only the
    // remounted instance ends up talking to the camera.
    startTimer = setTimeout(start, 50);

    return () => {
      cancelled = true;
      if (startTimer) clearTimeout(startTimer);
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s && s.isScanning) {
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
