import { useEffect, useRef, useState } from 'react';
import { playTone } from '../../core/audio';
import {
  DT_COLORS,
  DT_NAMES,
  STROOP_COLORS,
  STROOP_KEYS,
  STROOP_NAMES,
  type DtEvent,
  type DtItem,
  type StItem,
  type TrialResult,
  type WrItem,
} from '../../generators/reaktion';
import { TimeBar, fmtSec, useCountdown, useKeys, type BlockProps } from './common';

/** Zeitpunkt des nächsten gezeichneten Frames (Reiz sichtbar). */
function onPaint(cb: (t: number) => void): () => void {
  let r2 = 0;
  const r1 = requestAnimationFrame(() => {
    r2 = requestAnimationFrame((t) => cb(t));
  });
  return () => {
    cancelAnimationFrame(r1);
    cancelAnimationFrame(r2);
  };
}

function Countdown({ onEnd }: { onEnd: () => void }) {
  const left = useCountdown(3000, onEnd);
  return <div className="span-digit">{Math.max(1, Math.ceil(left / 1000))}</div>;
}

const WAHL_KEYS = ['d', 'f', 'j', 'k'];

/** Wahlreaktion: eines von vier Feldern oder Go/No-Go (nur Gelb plus Ton). */
export function WahlBlock({ item, mode, settings, onDone }: BlockProps<WrItem>) {
  const p = item.prompt;
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [active, setActive] = useState(false);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const shownAt = useRef(0);
  const responded = useRef(false);
  const results = useRef<TrialResult[]>([]);
  const sound = settings?.sound !== false;

  const record = (resp: number, rt: number | null) => {
    if (responded.current) return;
    responded.current = true;
    const t = p.trials[i];
    const correct = p.variant === 'wahl' ? resp === t.pos : t.go ? resp === 0 : resp === -1;
    results.current.push({ resp, rtMs: rt, correct });
    if (mode === 'lernen') setFlash(correct ? 'ok' : 'bad');
    setActive(false);
  };

  useEffect(() => {
    if (!started) return;
    if (i >= p.trials.length) {
      onDone({ results: results.current, variant: p.variant });
      return;
    }
    const t = p.trials[i];
    responded.current = false;
    let cancelPaint = () => {};
    const t1 = setTimeout(() => {
      setFlash(null);
      setActive(true);
      if (p.variant === 'gonogo' && t.tone && sound) playTone(1000, 200);
      cancelPaint = onPaint((ts) => (shownAt.current = ts));
    }, t.isiMs);
    const t2 = setTimeout(() => {
      record(-1, null);
      setI((x) => x + 1);
    }, t.isiMs + p.windowMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      cancelPaint();
    };
    // record ändert sich mit i; der Effekt plant pro Durchgang neu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, started]);

  useKeys((e) => {
    if (!active) return;
    const rt = Math.round(performance.now() - shownAt.current);
    if (p.variant === 'wahl') {
      const k = WAHL_KEYS.indexOf(e.key.toLowerCase());
      if (k >= 0) record(k, rt);
    } else if (e.key === ' ') {
      e.preventDefault();
      record(0, rt);
    }
  }, started);

  const t = p.trials[Math.min(i, p.trials.length - 1)];
  return (
    <div className="block-center">
      <div className="block-hint">
        {p.variant === 'wahl'
          ? 'Leuchtet ein Feld, sofort die passende Taste: D, F, J oder K.'
          : 'Nur reagieren (Leertaste), wenn das Feld GELB ist UND ein Ton kommt.'}
      </div>
      {!started ? (
        <Countdown onEnd={() => setStarted(true)} />
      ) : p.variant === 'wahl' ? (
        <div className={'wahl-row' + (flash ? ' flash-' + flash : '')}>
          {WAHL_KEYS.map((k, idx) => (
            <div key={k} className={'wahl-field' + (active && t.pos === idx ? ' on' : '')}>
              <span>{k.toUpperCase()}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className={'gonogo' + (flash ? ' flash-' + flash : '')}>
          <div
            className="gonogo-field"
            style={{ background: active ? (t.yellow ? '#facc15' : '#3b82f6') : '#e5e5e5' }}
          >
            {active && t.tone && !sound && <span className="tone-sign">♪</span>}
          </div>
        </div>
      )}
      <div className="muted-ink small">
        Durchgang {Math.min(i + 1, p.trials.length)} von {p.trials.length}
      </div>
    </div>
  );
}

/** Determinationstest-ähnlich: 5 Farben, 2 Töne, Tempo adaptiv, fest oder nach Antwort. */
export function DeterminationBlock({ item, mode, settings, onDone }: BlockProps<DtItem>) {
  const p = item.prompt;
  const keys = settings?.dtKeys ?? ['a', 's', 'd', 'f', ' ', 'j', 'k'];
  const sound = settings?.sound !== false;
  const [started, setStarted] = useState(false);
  const [showLegend, setShowLegend] = useState(mode === 'lernen');
  const [stim, setStim] = useState<number | null>(null);
  const [idx, setIdx] = useState(0);
  const events = useRef<DtEvent[]>([]);
  const dur = useRef(p.startMs);
  const cur = useRef<{ i: number; shownAt: number; visibleUntil: number; done: boolean } | null>(
    null,
  );
  const t0 = useRef(0);
  const finished = useRef(false);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone({ events: events.current, mode: p.mode, durationMs: p.durationMs });
  };
  const left = useCountdown(p.durationMs, finish, started);

  const adjust = (ok: boolean) => {
    if (p.mode !== 'adaptiv') return;
    dur.current = Math.max(250, Math.min(3000, dur.current * (ok ? 0.95 : 1.1)));
  };

  // Ablauf je Reiz
  useEffect(() => {
    if (!started || finished.current) return;
    if (!t0.current) t0.current = performance.now();
    const s = p.stimuli[idx % p.stimuli.length];
    const d = p.mode === 'reaktion' ? 3000 : dur.current;
    const visible = p.mode === 'reaktion' ? d : d * 0.75;
    setStim(s);
    if (s >= 5 && sound) playTone(s === 5 ? 1000 : 400, Math.min(300, visible));
    let cancelPaint = () => {};
    cur.current = { i: idx, shownAt: performance.now(), visibleUntil: 0, done: false };
    cancelPaint = onPaint((ts) => {
      if (cur.current && cur.current.i === idx) {
        cur.current.shownAt = ts;
        cur.current.visibleUntil = ts + visible;
      }
    });
    const tHide = setTimeout(() => setStim(null), visible);
    const tNext = setTimeout(() => {
      const c = cur.current;
      if (c && c.i === idx && !c.done) {
        c.done = true;
        events.current.push({
          stim: s,
          shownAt: c.shownAt - t0.current,
          durMs: d,
          result: 'ausgelassen',
          rtMs: null,
        });
        adjust(false);
      }
      setIdx((x) => x + 1);
    }, d);
    return () => {
      clearTimeout(tHide);
      clearTimeout(tNext);
      cancelPaint();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, started]);

  useKeys((e) => {
    if (!started) return;
    if (e.key.toLowerCase() === 'l' && !keys.includes('l')) {
      setShowLegend((x) => !x);
      return;
    }
    const k = keys.indexOf(e.key === ' ' ? ' ' : e.key.toLowerCase());
    if (k < 0) return;
    e.preventDefault();
    const c = cur.current;
    if (!c || c.done) return;
    const now = performance.now();
    const s = p.stimuli[c.i % p.stimuli.length];
    const late = now > c.visibleUntil && c.visibleUntil > 0;
    const ok = k === s;
    c.done = true;
    events.current.push({
      stim: s,
      shownAt: c.shownAt - t0.current,
      durMs: p.mode === 'reaktion' ? now - c.shownAt : dur.current,
      result: ok ? (late ? 'verspaetet' : 'richtig') : 'falsch',
      rtMs: Math.round(now - c.shownAt),
    });
    adjust(ok && !late);
    // adaptiv und Reaktion: nächster Reiz sofort nach der Antwort
    if (p.mode !== 'aktion') {
      setStim(null);
      setTimeout(() => setIdx((x) => (x === c.i ? x + 1 : x)), 120);
    }
  }, started);

  const legend = (
    <div className="dt-legend">
      {DT_NAMES.map((n, k) => (
        <span key={k} className="dt-key">
          {k < 5 ? (
            <span className="dt-dot" style={{ background: DT_COLORS[k] }} />
          ) : (
            <span>♪</span>
          )}
          {n}: <kbd>{keys[k] === ' ' ? 'Leer' : keys[k].toUpperCase()}</kbd>
        </span>
      ))}
    </div>
  );
  return (
    <div className="block-center">
      {started && <TimeBar left={left} total={p.durationMs} />}
      {!started ? (
        <>
          {legend}
          <div className="block-hint">Modus: {p.mode}. Gleich geht es los.</div>
          <Countdown onEnd={() => setStarted(true)} />
        </>
      ) : (
        <>
          <div className="dt-stage">
            {stim !== null && stim < 5 && (
              <div className="dt-circle" style={{ background: DT_COLORS[stim] }} />
            )}
            {stim !== null &&
              stim >= 5 &&
              (sound ? (
                <div className="dt-tone-hidden" />
              ) : (
                <div className="dt-tone">♪ {stim === 5 ? 'hoch' : 'tief'}</div>
              ))}
          </div>
          {showLegend && legend}
          <div className="muted-ink small">
            noch {fmtSec(left)} · Legende ein/aus mit <kbd>L</kbd>
          </div>
        </>
      )}
    </div>
  );
}

/** Farb-Wort-Interferenz: Taste für die Schriftfarbe. */
export function StroopBlock({ item, mode, onDone }: BlockProps<StItem>) {
  const p = item.prompt;
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [active, setActive] = useState(false);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const shownAt = useRef(0);
  const done = useRef(false);
  const results = useRef<TrialResult[]>([]);

  const record = (resp: number, rt: number | null) => {
    if (done.current) return;
    done.current = true;
    const correct = resp === p.trials[i].ink;
    results.current.push({ resp, rtMs: rt, correct });
    if (mode === 'lernen') setFlash(correct ? 'ok' : 'bad');
    setActive(false);
    setTimeout(() => setI((x) => x + 1), 0);
  };

  useEffect(() => {
    if (!started) return;
    if (i >= p.trials.length) {
      onDone({ results: results.current });
      return;
    }
    done.current = false;
    let cancel = () => {};
    const t1 = setTimeout(() => {
      setFlash(null);
      setActive(true);
      cancel = onPaint((ts) => (shownAt.current = ts));
    }, 400);
    const t2 = setTimeout(() => record(-1, null), 400 + p.windowMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, started]);

  useKeys((e) => {
    if (!active) return;
    const k = STROOP_KEYS.indexOf(e.key.toLowerCase());
    if (k >= 0) record(k, Math.round(performance.now() - shownAt.current));
  }, started);

  const t = p.trials[Math.min(i, p.trials.length - 1)];
  return (
    <div className="block-center">
      <div className="block-hint">Taste für die SCHRIFTFARBE, nicht für das Wort.</div>
      {!started ? (
        <Countdown onEnd={() => setStarted(true)} />
      ) : (
        <div
          className={'stroop-word' + (flash ? ' flash-' + flash : '')}
          style={{ color: active ? STROOP_COLORS[t.ink] : 'transparent' }}
        >
          {STROOP_NAMES[t.word]}
        </div>
      )}
      <div className="dt-legend">
        {STROOP_NAMES.map((n, k) => (
          <span key={k} className="dt-key">
            <span className="dt-dot" style={{ background: STROOP_COLORS[k] }} />
            {n.toLowerCase()}: <kbd>{STROOP_KEYS[k].toUpperCase()}</kbd>
          </span>
        ))}
      </div>
      <div className="muted-ink small">
        {Math.min(i + 1, p.trials.length)} von {p.trials.length}
      </div>
    </div>
  );
}
