import { useEffect, useRef, useState } from 'react';
import { vigScore, type VgEvent, type VgItem } from '../../generators/reaktion';
import { useKeys, type BlockProps } from './common';

const MARKS = 100;

/**
 * Vigilanz-Uhr: Ein Lichtpunkt springt pro Takt eine Position weiter,
 * selten zwei (Signal). Leertaste innerhalb des Antwortfensters = Treffer.
 * Der Takt ist an requestAnimationFrame gekoppelt; die Abweichung jedes
 * Taktes vom Soll wird gemessen und mitgespeichert.
 */
export function VigilanzBlock({ item, onDone }: BlockProps<VgItem>) {
  const p = item.prompt;
  const feedback = p.preset === 'einstieg';
  const [pos, setPos] = useState(0);
  const [started, setStarted] = useState(false);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const t0 = useRef(0);
  const step = useRef(0);
  const posRef = useRef(0);
  const signalSet = useRef(new Set(p.signals));
  const signals = useRef<VgEvent[]>([]);
  const falseAlarms = useRef<number[]>([]);
  const devs = useRef<number[]>([]);
  const finished = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!started) return;
    let raf = 0;
    const loop = (ts: number) => {
      if (!t0.current) t0.current = ts;
      const elapsed = ts - t0.current;
      if (elapsed >= p.durationMs) {
        if (!finished.current) {
          finished.current = true;
          const d = devs.current;
          const mean = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
          onDone({
            signals: signals.current,
            falseAlarms: falseAlarms.current,
            ticks: d.length,
            meanDeviationMs: Math.round(mean * 10) / 10,
            maxDeviationMs: Math.round(Math.max(0, ...d)),
          });
        }
        return;
      }
      const k = Math.floor(elapsed / p.tickMs);
      if (k > step.current) {
        // bei verpassten Frames nur den jüngsten Takt zeichnen
        for (let s = step.current + 1; s <= k; s++) {
          const isSignal = signalSet.current.has(s);
          posRef.current = (posRef.current + (isSignal ? 2 : 1)) % MARKS;
          if (isSignal) signals.current.push({ step: s, t: elapsed, hit: false, rtMs: null });
        }
        devs.current.push(elapsed - k * p.tickMs);
        step.current = k;
        setPos(posRef.current);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  useKeys((e) => {
    if (e.key !== ' ' || !started) return;
    e.preventDefault();
    const now = performance.now() - t0.current;
    const pending = [...signals.current].reverse().find((s) => !s.hit && now - s.t <= p.windowMs);
    if (pending) {
      pending.hit = true;
      pending.rtMs = Math.round(now - pending.t);
      if (feedback) setFlash('ok');
    } else {
      falseAlarms.current.push(now);
      if (feedback) setFlash('bad');
    }
    if (feedback) setTimeout(() => setFlash(null), 300);
  }, started);

  const R = 160;
  return (
    <div className="vig-overlay">
      <svg viewBox="-200 -200 400 400" className="vig-clock" aria-label="Vigilanz-Uhr">
        {Array.from({ length: MARKS }, (_, i) => {
          const a = (i / MARKS) * 2 * Math.PI - Math.PI / 2;
          return (
            <circle key={i} cx={R * Math.cos(a)} cy={R * Math.sin(a)} r={2.2} fill="#3a3a3a" />
          );
        })}
        {(() => {
          const a = (pos / MARKS) * 2 * Math.PI - Math.PI / 2;
          return <circle cx={R * Math.cos(a)} cy={R * Math.sin(a)} r={6} fill="#f5f5f5" />;
        })()}
        {flash && (
          <circle
            cx={0}
            cy={0}
            r={R + 18}
            fill="none"
            stroke={flash === 'ok' ? '#16a34a' : '#dc2626'}
            strokeWidth={4}
          />
        )}
      </svg>
      <div className="vig-hint">
        {started
          ? 'Leertaste beim Doppelsprung · Abbrechen mit Esc'
          : 'Gleich startet die Uhr. Leertaste, sobald der Punkt zwei Positionen auf einmal springt.'}
      </div>
    </div>
  );
}

/** Auswertung: Kennwerte je Drittel und Verlauf über die Zeit, letztes Drittel hervorgehoben. */
export function VigilanzResult({ item, data }: { item: VgItem; data: Record<string, unknown> }) {
  const p = item.prompt;
  const sigs = (data.signals as VgEvent[]) ?? [];
  const fas = (data.falseAlarms as number[]) ?? [];
  const sc = vigScore(p, sigs, fas);
  const W = 600;
  const H = 110;
  const x = (t: number) => 30 + (t / p.durationMs) * (W - 40);
  const maxRt = p.windowMs;
  const sec = (ms: number | null) =>
    ms === null ? '–' : (ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' s';
  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>Drittel</th>
            <th className="num">Signale</th>
            <th className="num">Treffer</th>
            <th className="num">Auslassungen</th>
            <th className="num">Fehlalarme</th>
            <th className="num">Median-Zeit</th>
          </tr>
        </thead>
        <tbody>
          {sc.parts.map((t, i) => (
            <tr key={i} style={i === 2 ? { fontWeight: 600 } : undefined}>
              <td>{i + 1}.</td>
              <td className="num">{t.signale}</td>
              <td className="num">{t.treffer}</td>
              <td className="num">{t.auslassungen}</td>
              <td className="num">{t.fehlalarme}</td>
              <td className="num">{sec(t.medianMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ maxWidth: W, marginTop: 10 }}
        role="img"
        aria-label="Verlauf"
      >
        <rect
          x={x((p.durationMs * 2) / 3)}
          y={0}
          width={x(p.durationMs) - x((p.durationMs * 2) / 3)}
          height={H - 18}
          fill="var(--card-2)"
        />
        <line x1={30} x2={W - 10} y1={H - 18} y2={H - 18} stroke="var(--line)" />
        {sigs.map((s, i) => (
          <circle
            key={i}
            cx={x(s.t)}
            cy={s.hit ? H - 18 - ((s.rtMs ?? 0) / maxRt) * (H - 30) - 4 : H - 24}
            r={4}
            fill={s.hit ? 'var(--ok)' : 'var(--bad)'}
          >
            <title>{s.hit ? `Treffer nach ${s.rtMs} ms` : 'Auslassung'}</title>
          </circle>
        ))}
        {fas.map((t, i) => (
          <line
            key={'f' + i}
            x1={x(t)}
            x2={x(t)}
            y1={H - 16}
            y2={H - 6}
            stroke="var(--bad)"
            strokeWidth={2}
          />
        ))}
        <text x={30} y={H - 2} fontSize={10} fill="var(--muted)">
          0
        </text>
        <text x={W - 10} y={H - 2} fontSize={10} fill="var(--muted)" textAnchor="end">
          {p.durationMs / 60000} min
        </text>
        <text
          x={x((p.durationMs * 5) / 6)}
          y={12}
          fontSize={10}
          fill="var(--muted)"
          textAnchor="middle"
        >
          letztes Drittel
        </text>
      </svg>
      <p className="small muted" style={{ marginTop: 6 }}>
        Grün: Treffer (je höher, desto langsamer). Rot unten: Auslassung. Rote Striche: Fehlalarme.
        Taktgenauigkeit: mittlere Abweichung {String(data.meanDeviationMs ?? '–')} ms über{' '}
        {String(data.ticks ?? 0)} Takte.
      </p>
    </div>
  );
}
