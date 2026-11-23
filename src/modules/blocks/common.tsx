import { useEffect, useRef, useState } from 'react';
import type { Settings } from '../../core/types';

export interface BlockProps<I> {
  item: I;
  mode: 'lernen' | 'test';
  settings?: Settings;
  onDone: (data: Record<string, unknown>, rtMs?: number) => void;
}

/** Tastendruck abonnieren (Tastenwiederholung wird ignoriert). */
export function useKeys(handler: (e: KeyboardEvent) => void, active = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const on = (e: KeyboardEvent) => {
      if (e.repeat) return;
      ref.current(e);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [active]);
}

/** Verbleibende Zeit in ms, ruft onEnd genau einmal auf. */
export function useCountdown(ms: number, onEnd: () => void, running = true): number {
  const [left, setLeft] = useState(ms);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    let done = false;
    let raf = 0;
    const tick = () => {
      const l = Math.max(0, ms - (performance.now() - start));
      setLeft(l);
      if (l <= 0 && !done) {
        done = true;
        endRef.current();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ms, running]);
  return left;
}

export function TimeBar({ left, total }: { left: number; total: number }) {
  return (
    <div className="block-timebar" aria-hidden>
      <div style={{ width: `${(left / total) * 100}%` }} />
    </div>
  );
}

export const fmtSec = (ms: number) => `${Math.ceil(ms / 1000)} s`;

export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
