import { useEffect, useRef, useState } from 'react';
import {
  SYMBOLE,
  szValue,
  type DsItem,
  type Glyph,
  type RkItem,
  type SzItem,
} from '../../generators/konzentration';
import { TimeBar, fmtSec, useCountdown, useKeys, type BlockProps } from './common';

/** Buchstabe mit Strichen oben und unten (eigene Darstellung, keine Kopie eines geschützten Tests). */
export function GlyphSvg({ g, marked, cursor }: { g: Glyph; marked?: boolean; cursor?: boolean }) {
  const strokes = (n: number, y: number) =>
    Array.from({ length: n }, (_, i) => {
      const x = n === 1 ? 12 : 8 + i * 8;
      return (
        <line key={`${y}-${i}`} x1={x} y1={y} x2={x} y2={y + 6} stroke="#111" strokeWidth={1.8} />
      );
    });
  return (
    <svg viewBox="0 0 24 44" width={20} height={37} aria-hidden>
      {cursor && (
        <rect
          x={0.5}
          y={0.5}
          width={23}
          height={43}
          fill="none"
          stroke="#2a6f97"
          strokeWidth={1.5}
          rx={3}
        />
      )}
      {strokes(g.top, 3)}
      <text
        x={12}
        y={29}
        textAnchor="middle"
        fontSize={18}
        fontFamily="Georgia, 'Times New Roman', serif"
        fill="#111"
      >
        {g.l}
      </text>
      {strokes(g.bottom, 34)}
      {marked && <line x1={2} y1={40} x2={22} y2={4} stroke="#c2410c" strokeWidth={2.2} />}
    </svg>
  );
}

/** Durchstreichtest: eine Zeile nach der anderen, feste Zeit pro Zeile. */
export function DurchstreichenBlock({ item, onDone }: BlockProps<DsItem>) {
  const p = item.prompt;
  const [row, setRow] = useState(-1);
  const [marks, setMarks] = useState<number[][]>(p.rows.map(() => []));
  const [cursor, setCursor] = useState(0);
  const marksRef = useRef(marks);
  marksRef.current = marks;
  const start = useRef(performance.now());

  useEffect(() => {
    if (row < 0) {
      const t = setTimeout(() => setRow(0), 1500);
      return () => clearTimeout(t);
    }
  }, [row]);
  const next = () => {
    setCursor(0);
    if (row + 1 >= p.rows.length)
      onDone({ marks: marksRef.current }, Math.round(performance.now() - start.current));
    else setRow(row + 1);
  };
  const toggle = (i: number) =>
    setMarks((m) =>
      m.map((r, k) => (k !== row ? r : r.includes(i) ? r.filter((x) => x !== i) : [...r, i])),
    );
  useKeys((e) => {
    if (row < 0) return;
    if (e.key === 'ArrowRight') setCursor((c) => Math.min(39, c + 1));
    else if (e.key === 'ArrowLeft') setCursor((c) => Math.max(0, c - 1));
    else if (e.key === ' ') {
      e.preventDefault();
      toggle(cursor);
      setCursor((c) => Math.min(39, c + 1));
    }
  });

  const target = p.target;
  return (
    <div className="block-wide">
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="ink">
          Markiere jedes{' '}
          <strong>
            „{target.l}“ mit genau {target.strokes} Strichen
          </strong>{' '}
          (oben und unten zusammen).
        </span>
        <span className="spacer" />
        <span className="muted-ink small">
          Zeile {Math.max(1, row + 1)} von {p.rows.length}
        </span>
      </div>
      {row < 0 ? (
        <div className="span-digit">Achtung …</div>
      ) : (
        <RowView
          key={row}
          glyphs={p.rows[row]}
          marks={marks[row]}
          cursor={cursor}
          onToggle={toggle}
          onEnd={next}
          total={p.rowMs}
        />
      )}
      <div className="muted-ink small" style={{ marginTop: 8 }}>
        Klicken oder Pfeiltasten und Leertaste. Nach {p.rowMs / 1000} s springt die Zeile
        automatisch weiter.
      </div>
    </div>
  );
}

function RowView({
  glyphs,
  marks,
  cursor,
  onToggle,
  onEnd,
  total,
}: {
  glyphs: Glyph[];
  marks: number[];
  cursor: number;
  onToggle: (i: number) => void;
  onEnd: () => void;
  total: number;
}) {
  // eigener Countdown je Zeile (Komponente entsteht pro Zeile neu)
  const left = useCountdown(total, onEnd);
  return (
    <div>
      <TimeBar left={left} total={total} />
      <div className="ds-row">
        {glyphs.map((g, i) => (
          <button
            key={i}
            type="button"
            className="ds-glyph"
            onClick={() => onToggle(i)}
            aria-label={`Zeichen ${i + 1}`}
          >
            <GlyphSvg g={g} marked={marks.includes(i)} cursor={cursor === i} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Symbol-Zahl-Kodierung: Schlüsseltabelle, Aufgaben wie ◆ + ▲ = ? */
export function SymbolZahlBlock({ item, onDone }: BlockProps<SzItem>) {
  const p = item.prompt;
  const [i, setI] = useState(0);
  const [input, setInput] = useState('');
  const results = useRef<{ correct: boolean; rtMs: number }[]>([]);
  const shown = useRef(performance.now());
  const start = useRef(performance.now());
  const inputRef = useRef<HTMLInputElement>(null);
  const finish = () =>
    onDone({ results: results.current }, Math.round(performance.now() - start.current));
  const left = useCountdown(p.blockMs, finish);
  useEffect(() => {
    shown.current = performance.now();
    inputRef.current?.focus();
  }, [i]);
  const t = p.tasks[i % p.tasks.length];
  return (
    <div className="block-center">
      <TimeBar left={left} total={p.blockMs} />
      <div className="sz-key" aria-label="Schlüsseltabelle">
        {SYMBOLE.map((s, k) => (
          <div key={k} className="sz-pair">
            <span className="sz-sym">{s}</span>
            <span className="sz-num">{p.mapping[k]}</span>
          </div>
        ))}
      </div>
      <div className="span-digit" style={{ fontSize: '2.6rem' }}>
        {t.syms.map((s, k) => (
          <span key={k}>
            {k > 0 && ` ${t.ops[k - 1]} `}
            {SYMBOLE[s]}
          </span>
        ))}{' '}
        = ?
      </div>
      <form
        className="answer-area"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input) return;
          results.current.push({
            correct: Number(input) === szValue(t, p.mapping),
            rtMs: Math.round(performance.now() - shown.current),
          });
          setInput('');
          setI(i + 1);
        }}
      >
        <input
          ref={inputRef}
          className="answer-input"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Ergebnis"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, ''))}
        />
      </form>
      <div className="muted-ink small">
        {results.current.length} bearbeitet · noch {fmtSec(left)}
      </div>
    </div>
  );
}

/** Rechenkette: fortlaufend benachbarte Zahlen addieren, nur die Einerstelle tippen. */
export function RechenketteBlock({ item, onDone }: BlockProps<RkItem>) {
  const p = item.prompt;
  const [pos, setPos] = useState(0);
  const results = useRef<{ t: number; correct: boolean }[]>([]);
  const start = useRef(performance.now());
  const [flash, setFlash] = useState<null | 'ok' | 'bad'>(null);
  const finish = () =>
    onDone(
      { results: results.current, durationMs: p.durationMs },
      Math.round(performance.now() - start.current),
    );
  const left = useCountdown(p.durationMs, finish);
  useKeys((e) => {
    if (!/^[0-9]$/.test(e.key)) return;
    e.preventDefault();
    const ok = Number(e.key) === (p.digits[pos] + p.digits[pos + 1]) % 10;
    results.current.push({ t: Math.round(performance.now() - start.current), correct: ok });
    setFlash(ok ? 'ok' : 'bad');
    setPos((x) => Math.min(x + 1, p.digits.length - 2));
  });
  useEffect(() => {
    const t = setTimeout(() => setFlash(null), 150);
    return () => clearTimeout(t);
  }, [pos]);
  const view = p.digits.slice(Math.max(0, pos - 4), pos + 8);
  const offset = Math.min(4, pos);
  return (
    <div className="block-center">
      <TimeBar left={left} total={p.durationMs} />
      <div className="block-hint">
        Zwei markierte Zahlen addieren, nur die Einerstelle als Taste eintippen (0 bis 9).
      </div>
      <div className={'rk-row' + (flash ? ' flash-' + flash : '')}>
        {view.map((d, k) => (
          <span
            key={k}
            className={
              'rk-d' + (k === offset || k === offset + 1 ? ' on' : '') + (k < offset ? ' past' : '')
            }
          >
            {d}
          </span>
        ))}
      </div>
      <div className="muted-ink small">
        {results.current.length} bearbeitet · noch {fmtSec(left)}
      </div>
    </div>
  );
}
