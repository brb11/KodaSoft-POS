import React, { useEffect, useRef, useState } from 'react';
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';
import { useLanguageStore } from '../../../stores/languageStore';
import { Camera, X, Loader2, RefreshCw } from 'lucide-react';

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
  const [runId, setRunId] = useState(0);
  return (
    <CameraScanView
      key={runId}
      onScan={onScan}
      onClose={onClose}
      onRetry={() => setRunId((n) => n + 1)}
    />
  );
};

const CameraScanView: React.FC<Props & { onRetry: () => void }> = ({ onScan, onClose, onRetry }) => {
  const { t } = useLanguageStore();
  const [state, setState] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorText, setErrorText] = useState('');
  // Live frame counter: it proves the scan loop is running. If it never moves,
  // the camera stream isn't being processed.
  const [frames, setFrames] = useState(0);
  const [showNoScanHint, setShowNoScanHint] = useState(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const lastCodeRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const framesRef = useRef(0);
  const errorCountRef = useRef(0);

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
            // Ask for a decent resolution up front: tiny, far-away barcodes
            // fail to decode on low-res preview streams. "ideal" falls back
            // to the camera's native resolution if 720p isn't supported.
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
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
            // Fired for every frame that did not contain a readable barcode.
            framesRef.current += 1;
            errorCountRef.current += 1;
            if (errorCountRef.current <= 3 || errorCountRef.current % 50 === 0) {
              console.warn('[BarcodeCamera] frame not decoded', errorCountRef.current);
            }
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

  // Sync the frame counter to the UI once per second instead of per frame.
  useEffect(() => {
    if (state !== 'scanning') return;
    const iv = setInterval(() => setFrames(framesRef.current), 1000);
    return () => clearInterval(iv);
  }, [state]);

  // If nothing has been scanned after a few seconds, show a hint.
  useEffect(() => {
    if (state !== 'scanning') return;
    const to = setTimeout(() => setShowNoScanHint(true), 8000);
    return () => clearTimeout(to);
  }, [state]);

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
              <button
                onClick={onRetry}
                className="mt-3 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t.retry}
              </button>
            </div>
          )}
          {state === 'scanning' && showNoScanHint && (
            <div className="absolute inset-x-0 bottom-0 bg-amber-500/90 text-white text-[11px] font-semibold px-3 py-2 text-center">
              {t.noBarcodeDetected}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400 flex-1">{t.barcodeScannerHint}</p>
          {state === 'scanning' && (
            <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap">
              {t.scanFrameLabel}
              {frames}
            </span>
          )}
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
