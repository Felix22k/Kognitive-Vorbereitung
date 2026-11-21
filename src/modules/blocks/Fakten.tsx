import { useEffect, useMemo, useRef, useState } from 'react';
import type { FkItem } from '../../generators/gedaechtnis';
import { createRng } from '../../core/rng';
import { TimeBar, fmtSec, useCountdown, useKeys, type BlockProps } from './common';

type Phase = 'memorize' | 'pause' | 'questions';

/** Fakten merken: einprägen, Ablenkung (Kopfrechnen), dann 10 Fragen. */
export function FaktenBlock({ item, onDone }: BlockProps<FkItem>) {
  const p = item.prompt;
  const [phase, setPhase] = useState<Phase>('memorize');
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(p.questions.map(() => null));
  const distraction = useRef({ n: 0, correct: 0 });
  const start = useRef(performance.now());

  const memLeft = useCountdown(p.memorizeMs, () => setPhase('pause'), phase === 'memorize');
  const pauseLeft = useCountdown(p.pauseMs, () => setPhase('questions'), phase === 'pause');

  const commit = (val: number | null) => {
    const a = [...answers];
    a[qi] = val;
    setAnswers(a);
    if (qi + 1 >= p.questions.length)
      onDone(
        { answers: a, distraction: distraction.current },
        Math.round(performance.now() - start.current),
      );
    else setQi(qi + 1);
  };

  if (phase === 'memorize')
    return (
      <div className="block-wide">
        <TimeBar left={memLeft} total={p.memorizeMs} />
        <div className="row" style={{ margin: '8px 0 12px' }}>
          <strong className="ink">{p.title}</strong>
          <span className="spacer" />
          <span className="muted-ink small">Einprägen: noch {fmtSec(memLeft)}</span>
        </div>
        <ul className="fact-list">
          {p.facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
        <button className="btn" onClick={() => setPhase('pause')}>
          Fertig eingeprägt
        </button>
      </div>
    );
  if (phase === 'pause')
    return (
      <div className="block-center">
        <TimeBar left={pauseLeft} total={p.pauseMs} />
        <div className="block-hint">Ablenkung: Kopfrechnen · noch {fmtSec(pauseLeft)}</div>
        <Distraction
          seed={item.seed}
          onAnswer={(ok) => {
            distraction.current.n++;
            if (ok) distraction.current.correct++;
          }}
        />
      </div>
    );
  return (
    <FactQuestion
      key={qi}
      index={qi}
      total={p.questions.length}
      q={p.questions[qi]}
      answerMs={p.answerMs}
      onCommit={commit}
    />
  );
}

function FactQuestion({
  index,
  total,
  q,
  answerMs,
  onCommit,
}: {
  index: number;
  total: number;
  q: FkItem['prompt']['questions'][number];
  answerMs: number;
  onCommit: (v: number | null) => void;
}) {
  const [sel, setSel] = useState<number | null>(null);
  const done = useRef(false);
  const commit = (v: number | null) => {
    if (done.current) return;
    done.current = true;
    onCommit(v);
  };
  const left = useCountdown(answerMs, () => commit(sel));
  useKeys((e) => {
    const k = e.key.toUpperCase();
    const idx = /^[1-4]$/.test(k) ? Number(k) - 1 : k.length === 1 ? 'ABCD'.indexOf(k) : -1;
    if (idx >= 0) setSel(idx);
    else if (e.key === 'Enter' && sel !== null) {
      e.preventDefault();
      commit(sel);
    }
  });
  return (
    <div className="block-wide">
      <TimeBar left={left} total={answerMs} />
      <div className="muted-ink small" style={{ margin: '8px 0' }}>
        Frage {index + 1} von {total}
      </div>
      <div className="fact-q">{q.q}</div>
      <div className="options" style={{ marginTop: 14 }}>
        {q.options.map((o, i) => (
          <button
            key={i}
            className={'option' + (sel === i ? ' selected' : '')}
            onClick={() => setSel(i)}
            onDoubleClick={() => commit(i)}
          >
            <span className="key">{'ABCD'[i]}</span>
            {o}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12, justifyContent: 'center' }}>
        <button className="btn primary" disabled={sel === null} onClick={() => commit(sel)}>
          Bestätigen <kbd className="on-accent">Enter</kbd>
        </button>
        <button className="btn ghost" onClick={() => commit(null)}>
          Weiß ich nicht
        </button>
      </div>
    </div>
  );
}

function Distraction({ seed, onAnswer }: { seed: number; onAnswer: (ok: boolean) => void }) {
  const rng = useMemo(() => createRng(seed ^ 0x5bd1e995), [seed]);
  const make = () => [rng.int(12, 89), rng.int(11, 59), rng.chance(0.5)] as const;
  const [task, setTask] = useState(make);
  const [input, setInput] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), [task]);
  const [a, b, plus] = task;
  const val = plus ? a + b : a - b;
  return (
    <form
      className="answer-area"
      onSubmit={(e) => {
        e.preventDefault();
        if (!input) return;
        onAnswer(Number(input) === val);
        setInput('');
        setTask(make());
      }}
    >
      <div className="span-digit" style={{ fontSize: '2.4rem' }}>
        {a} {plus ? '+' : '−'} {b}
      </div>
      <input
        ref={ref}
        className="answer-input"
        inputMode="numeric"
        value={input}
        aria-label="Ergebnis"
        onChange={(e) => setInput(e.target.value.replace(/[^\d-]/g, ''))}
      />
    </form>
  );
}
