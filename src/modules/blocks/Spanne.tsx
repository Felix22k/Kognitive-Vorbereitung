import { useEffect, useRef, useState } from 'react';
import { BLOCKS, type BsItem, type ZsItem } from '../../generators/gedaechtnis';
import { TimeBar, useCountdown, useKeys, type BlockProps } from './common';

/** Zahlenspanne: Ziffern im Sekundentakt, danach eintippen. */
export function ZahlenspanneBlock({ item, onDone }: BlockProps<ZsItem>) {
  const p = item.prompt;
  const [step, setStep] = useState(-1); // -1 Achtung, 0..n-1 Ziffer, n Eingabe
  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState('');
  const answerStart = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const answering = step >= p.digits.length;

  useEffect(() => {
    if (answering) {
      answerStart.current = performance.now();
      inputRef.current?.focus();
      return;
    }
    const t1 = setTimeout(() => setVisible(true), step < 0 ? 0 : 0);
    const t2 = setTimeout(() => setVisible(false), step < 0 ? 900 : p.onMs);
    const t3 = setTimeout(() => setStep((s) => s + 1), step < 0 ? 1200 : p.onMs + p.offMs);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, [step, answering, p.onMs, p.offMs]);

  const finish = () => onDone({ input }, Math.round(performance.now() - answerStart.current));
  const left = useCountdown(p.answerMs, finish, answering);

  return (
    <div className="block-center">
      <div className="block-hint">
        {p.direction === 'vor' ? 'Vorwärts' : 'Rückwärts'} · {p.digits.length} Ziffern
      </div>
      {!answering ? (
        <div className="span-digit" aria-live="polite">
          {step < 0 ? (visible ? 'Achtung' : '') : visible ? p.digits[step] : ''}
        </div>
      ) : (
        <form
          className="answer-area"
          onSubmit={(e) => {
            e.preventDefault();
            finish();
          }}
        >
          <TimeBar left={left} total={p.answerMs} />
          <label className="block-hint">
            {p.direction === 'vor'
              ? 'Ziffern in der gezeigten Reihenfolge'
              : 'Ziffern rückwärts (die letzte zuerst)'}
          </label>
          <input
            ref={inputRef}
            className="answer-input"
            inputMode="numeric"
            autoComplete="off"
            aria-label="Ziffernfolge"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/[^\d]/g, ''))}
          />
          <button className="btn primary" type="submit">
            Bestätigen <kbd className="on-accent">Enter</kbd>
          </button>
        </form>
      )}
    </div>
  );
}

export function BlockBoard({
  lit,
  clicks,
  onClick,
  showNumbers,
  cursor,
}: {
  lit: number | null;
  clicks: number[];
  onClick?: (i: number) => void;
  showNumbers: boolean;
  cursor?: number | null;
}) {
  return (
    <div className="corsi" role="group" aria-label="Felder">
      {BLOCKS.map(([x, y], i) => {
        const order = clicks.indexOf(i);
        return (
          <button
            key={i}
            type="button"
            className={
              'corsi-block' +
              (lit === i ? ' lit' : '') +
              (order >= 0 ? ' picked' : '') +
              (cursor === i ? ' cursor' : '')
            }
            style={{ left: `${x}%`, top: `${y}%` }}
            onClick={() => onClick?.(i)}
            disabled={!onClick}
            aria-label={`Feld ${i + 1}`}
          >
            {showNumbers && <span className="corsi-num">{i + 1}</span>}
            {order >= 0 && <span className="corsi-order">{order + 1}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Blockspanne: Felder leuchten nacheinander auf, danach anklicken. */
export function BlockspanneBlock({ item, onDone }: BlockProps<BsItem>) {
  const p = item.prompt;
  const [step, setStep] = useState(-1);
  const [lit, setLit] = useState<number | null>(null);
  const [clicks, setClicks] = useState<number[]>([]);
  const answerStart = useRef(0);
  const answering = step >= p.seq.length;
  const doneRef = useRef(false);

  useEffect(() => {
    if (answering) {
      answerStart.current = performance.now();
      return;
    }
    if (step < 0) {
      const t = setTimeout(() => setStep(0), 1200);
      return () => clearTimeout(t);
    }
    setLit(p.seq[step]);
    const t1 = setTimeout(() => setLit(null), p.onMs);
    const t2 = setTimeout(() => setStep((s) => s + 1), p.onMs + p.offMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [step, answering, p.seq, p.onMs, p.offMs]);

  const finish = (c: number[]) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone({ clicks: c }, Math.round(performance.now() - answerStart.current));
  };
  const left = useCountdown(p.answerMs, () => finish(clicks), answering);
  const pick = (i: number) => {
    if (!answering || clicks.includes(i)) return;
    const c = [...clicks, i];
    setClicks(c);
    if (c.length === p.seq.length) setTimeout(() => finish(c), 250);
  };
  useKeys((e) => {
    if (!answering) return;
    if (/^[1-9]$/.test(e.key)) pick(Number(e.key) - 1);
    else if (e.key === 'Backspace') setClicks((c) => c.slice(0, -1));
  }, answering);

  return (
    <div className="block-center">
      <div className="block-hint">
        {answering
          ? `${p.direction === 'vor' ? 'In der gezeigten Reihenfolge' : 'Rückwärts (das letzte zuerst)'} anklicken oder Tasten 1 bis 9 · Rücktaste nimmt zurück`
          : step < 0
            ? 'Achtung …'
            : 'Merken'}
      </div>
      {answering && <TimeBar left={left} total={p.answerMs} />}
      <BlockBoard
        lit={lit}
        clicks={clicks}
        onClick={answering ? pick : undefined}
        showNumbers={answering}
      />
      {answering && (
        <div className="muted-ink small">
          {clicks.length} von {p.seq.length}
        </div>
      )}
    </div>
  );
}
