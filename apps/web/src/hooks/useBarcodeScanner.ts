import { useEffect, useRef } from 'react';

// A USB/bluetooth barcode scanner behaves like a keyboard: it "types" the code
// in a very fast burst and then sends Enter. We detect a burst by measuring
// the gap between keystrokes — a sustained run of sub-threshold gaps is a
// scanner; human typing (typically 100ms+ per key) never qualifies, so normal
// keyboard input in search boxes and forms is never interfered with.
const BURST_GAP_MS = 80;          // max gap between two keys to count as one burst
const TERMINATOR_WINDOW_MS = 400; // max delay between last char and Enter
const INACTIVITY_RESET_MS = 1500; // drop the buffer if the burst never ends
const MIN_CODE_LENGTH = 3;

export function useBarcodeScanner(onScan: (code: string) => void): void {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let buffer = '';
    let lastKeyAt = 0;
    let resetTimer: ReturnType<typeof setTimeout> | null = null;

    const clearReset = () => {
      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
    };

    const scheduleReset = () => {
      clearReset();
      resetTimer = setTimeout(() => {
        buffer = '';
      }, INACTIVITY_RESET_MS);
    };

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const now = Date.now();
      const gap = now - lastKeyAt;

      if (e.key === 'Enter') {
        // Only finalize a *fresh* burst. A stray Enter (form submit, search)
        // after slow/manual typing has an empty buffer and is left untouched.
        if (buffer.length >= MIN_CODE_LENGTH && gap < TERMINATOR_WINDOW_MS) {
          e.preventDefault();
          e.stopPropagation();
          const code = buffer;
          buffer = '';
          clearReset();
          onScanRef.current(code);
        } else {
          buffer = '';
        }
        lastKeyAt = now;
        return;
      }

      // Control / non-printable keys break any in-progress burst.
      if (e.key.length !== 1) {
        buffer = '';
        lastKeyAt = now;
        return;
      }

      if (gap === 0) {
        // Very first key: just start observing. Never swallow it.
        buffer = e.key;
        lastKeyAt = now;
        scheduleReset();
        return;
      }

      if (gap > BURST_GAP_MS) {
        // A slow key means a human is typing — abandon the burst entirely so we
        // never mis-detect real input as a scan.
        buffer = '';
        lastKeyAt = now;
        return;
      }

      // Sustained fast keystrokes: accumulate into the scan buffer. We do NOT
      // preventDefault here, so if the search box happens to be focused the
      // characters simply appear there too (harmless — we clear it on a hit).
      buffer += e.key;
      lastKeyAt = now;
      scheduleReset();
    };

    window.addEventListener('keydown', handler, true);
    return () => {
      window.removeEventListener('keydown', handler, true);
      clearReset();
    };
  }, []);
}
