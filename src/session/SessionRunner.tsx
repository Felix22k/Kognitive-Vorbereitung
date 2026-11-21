import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MODULE_BY_ID } from '../modules/catalog';
import { PromptView, SolutionView, choiceOptions } from '../modules/views';
import { getModuleState, getSettings, saveSettings } from '../db/db';
import { testStartLevel, updateStair, type StairState } from '../core/staircase';
import { uid } from '../core/ids';
import type { Attempt, Item, ModuleState, Session, Settings } from '../core/types';
import type { AnswerValue } from '../generators/common';
import { LETTERS } from '../generators/common';
import { pickUniqueItem } from './engine';
import { addReport, finishSession, markIntroSeen, recordAttempt, startSession } from './persist';
import { difficultyLabel } from '../core/progress';

type Phase = 'loading' | 'setup' | 'run' | 'feedback' | 'done';

interface Result {
  item: Item;
  answerLabel: string;
  correct: boolean;
  timedOut: boolean;
  rtMs: number;
}

export interface RunnerProps {
  moduleId: string;
  mode: 'lernen' | 'test';
  onExit: () => void;
  belastet?: boolean;
}

const fmtS = (ms: number) =>
  (ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' s';

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return (
    t.tagName === 'INPUT' ||
    t.tagName === 'TEXTAREA' ||
    t.tagName === 'SELECT' ||
    t.tagName === 'BUTTON' ||
    t.isContentEditable
  );
}

function isTextInput(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement &&
    (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  );
}

export function SessionRunner({ moduleId, mode, onExit, belastet = false }: RunnerProps) {
  const mod = MODULE_BY_ID[moduleId];
  const gen = mod?.generator;

  const [phase, setPhase] = useState<Phase>('loading');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mstate, setMstate] = useState<ModuleState | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [item, setItem] = useState<Item | null>(null);
  const [stair, setStair] = useState<StairState>({ level: 1, streak: 0 });
  const [results, setResults] = useState<Result[]>([]);
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [showIntro, setShowIntro] = useState(false);
  const [showExpl, setShowExpl] = useState(false);
  const [reported, setReported] = useState(false);
  const [finalSession, setFinalSession] = useState<Session | null>(null);
  const [inputError, setInputError] = useState('');

  const shownAt = useRef(0);
  const answered = useRef(false);
  const recent = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  /** Kette der Speichervorgänge, damit die Auswertung erst nach dem letzten Speichern läuft. */
  const pending = useRef<Promise<void>>(Promise.resolve());

  const total = mode === 'lernen' ? (mod?.itemsLernen ?? 10) : (mod?.itemsTest ?? 12);
  const timeLimitOn = mode === 'test' || !!settings?.timeLimitInLearning;
  const useChoice =
    mode === 'test' && moduleId === 'kopfrechnen' && !!settings?.kopfrechnenAuswahlImTest;

  const [loadKey, setLoadKey] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, ms] = await Promise.all([getSettings(), getModuleState(moduleId)]);
      if (!alive) return;
      setSettings(s);
      setMstate(ms);
      setShowIntro(!ms.introSeen);
      recent.current = new Set(ms.recent);
      setPhase('setup');
    })();
    return () => {
      alive = false;
    };
  }, [moduleId, loadKey]);

  const examples = useMemo(() => {
    if (!gen || !mod?.exampleLevels) return [];
    return mod.exampleLevels.map((lvl, i) => gen.generate(1000 + i * 7, lvl));
  }, [gen, mod]);

  const presentNext = useCallback(
    (level: number) => {
      if (!gen) return;
      const it = pickUniqueItem(gen, level, recent.current);
      recent.current.add(gen.fingerprint(it));
      answered.current = false;
      setItem(it);
      setInput('');
      setSelected(null);
      setShowExpl(false);
      setReported(false);
      setInputError('');
      setPhase('run');
    },
    [gen],
  );

  // Zeitpunkt der Darstellung messen (nach dem Zeichnen)
  useEffect(() => {
    if (phase !== 'run' || !item) return;
    const raf = requestAnimationFrame(() => {
      shownAt.current = performance.now();
    });
    inputRef.current?.focus();
    return () => cancelAnimationFrame(raf);
  }, [phase, item]);

  const finish = useCallback(
    async (lvl: number, aborted = false) => {
      if (!session) return;
      await pending.current;
      const done = await finishSession(session, { [moduleId]: lvl }, aborted);
      setFinalSession(done);
      if (!aborted) setPhase('done');
    },
    [session, moduleId],
  );

  const submit = useCallback(
    (answer: AnswerValue | null) => {
      if (!item || !gen || !session || answered.current) return;
      const timedOut = answer === null;
      let answerLabel = '';
      if (answer?.type === 'text') answerLabel = answer.raw.trim();
      if (answer?.type === 'choice') answerLabel = choiceOptions(item)?.options[answer.index] ?? '';
      if (timedOut) answerLabel = '(Zeit abgelaufen)';
      answered.current = true;
      const rtMs = Math.round(performance.now() - shownAt.current);
      const correct = !timedOut && gen.check(item, answer);
      const attempt: Attempt = {
        id: uid('a-'),
        sessionId: session.id,
        itemId: item.id,
        moduleId,
        mode,
        generatorId: item.generatorId,
        generatorVersion: item.generatorVersion,
        seed: item.seed,
        level: item.level,
        tags: item.tags,
        answer,
        answerLabel,
        correctAnswer: item.correct,
        correctLabel: item.correctLabel,
        correct,
        timedOut,
        rtMs,
        timestamp: new Date().toISOString(),
        belastet,
        puls: session.puls,
        muedigkeit: session.muedigkeit,
      };
      const fp = gen.fingerprint(item);
      pending.current = pending.current
        .then(() => recordAttempt(attempt, fp))
        .catch((e) => console.error('Speichern fehlgeschlagen', e));
      const nextStair = updateStair(stair, correct, mode);
      setStair(nextStair);
      const res = [...results, { item, answerLabel, correct, timedOut, rtMs }];
      setResults(res);
      if (mode === 'lernen') {
        setPhase('feedback');
      } else if (res.length >= total) {
        void finish(nextStair.level);
      } else {
        presentNext(nextStair.level);
      }
    },
    [item, gen, session, moduleId, mode, belastet, stair, results, total, finish, presentNext],
  );

  // Zeitlimit
  useEffect(() => {
    if (phase !== 'run' || !item || !timeLimitOn) return;
    const t = window.setTimeout(() => submit(null), item.timeLimitMs);
    return () => window.clearTimeout(t);
  }, [phase, item, timeLimitOn, submit]);

  const start = useCallback(async () => {
    if (!mstate || !gen) return;
    await markIntroSeen(moduleId);
    const s = await startSession({ type: 'modul', mode, moduleIds: [moduleId], belastet });
    setSession(s);
    const lvl = mode === 'test' ? testStartLevel(mstate.levelTest) : mstate.levelLernen;
    setStair({ level: lvl, streak: 0 });
    setResults([]);
    setFinalSession(null);
    const it = pickUniqueItem(gen, lvl, recent.current);
    recent.current.add(gen.fingerprint(it));
    answered.current = false;
    setItem(it);
    setInput('');
    setSelected(null);
    setShowExpl(false);
    setReported(false);
    setPhase('run');
  }, [mstate, gen, moduleId, mode, belastet]);

  const continueAfterFeedback = useCallback(() => {
    if (results.length >= total) void finish(stair.level);
    else presentNext(stair.level);
  }, [results.length, total, finish, stair.level, presentNext]);

  const abort = useCallback(async () => {
    if (phase === 'run' || phase === 'feedback') {
      if (
        !window.confirm(
          'Durchgang abbrechen? Bisherige Antworten bleiben gespeichert, zählen aber nicht für die Bestwerte.',
        )
      )
        return;
      if (results.length > 0) await finish(stair.level, true);
    }
    onExit();
  }, [phase, results.length, finish, stair.level, onExit]);

  const submitText = useCallback(() => {
    if (!input.trim()) return;
    if (!/^[\s\d.,/−–-]+$/.test(input)) {
      setInputError('Bitte nur Zahlen, Komma, Punkt oder / eingeben.');
      return;
    }
    submit({ type: 'text', raw: input });
  }, [input, submit]);

  // Tastatur
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        void abort();
        return;
      }
      if (phase === 'setup' && e.key === 'Enter' && !isTypingTarget(e.target)) {
        e.preventDefault();
        void start();
        return;
      }
      if (phase === 'run' && useChoice && item) {
        const opts = choiceOptions(item);
        if (!opts) return;
        const k = e.key.toUpperCase();
        let idx = -1;
        if (/^[1-8]$/.test(k)) idx = parseInt(k, 10) - 1;
        else if (LETTERS.includes(k) && k.length === 1) idx = LETTERS.indexOf(k);
        if (idx >= 0 && idx < opts.options.length) {
          e.preventDefault();
          setSelected(idx);
          return;
        }
        if (e.key === 'Enter' && selected !== null && !isTypingTarget(e.target)) {
          e.preventDefault();
          submit({ type: 'choice', index: selected });
        }
        return;
      }
      if (phase === 'feedback') {
        if (e.key === 'Enter' && !isTypingTarget(e.target)) {
          e.preventDefault();
          continueAfterFeedback();
        } else if (e.key.toLowerCase() === 'e' && !isTextInput(e.target)) {
          setShowExpl((x) => !x);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, useChoice, item, selected, submit, start, abort, continueAfterFeedback]);

  if (!mod || !gen) {
    return (
      <div className="page">
        <p>Dieses Modul gibt es noch nicht.</p>
        <button className="btn" onClick={onExit}>
          Zurück
        </button>
      </div>
    );
  }

  if (phase === 'loading' || !settings || !mstate) return <div className="page muted">Lädt …</div>;

  const modeName = mode === 'lernen' ? 'Lernmodus' : 'Testmodus';

  // ---------- Startbildschirm ----------
  if (phase === 'setup') {
    const startLevel = mode === 'test' ? testStartLevel(mstate.levelTest) : mstate.levelLernen;
    return (
      <div className="page" style={{ maxWidth: 860 }}>
        <button className="linklike" onClick={onExit}>
          ← zurück
        </button>
        <h1 style={{ marginTop: 12 }}>
          {mod.name} <span className="muted">· {modeName}</span>
        </h1>
        <p className="muted">{mod.description}</p>

        <div className="card stack">
          <div className="row">
            <span className="pill">{total} Aufgaben</span>
            <span className="pill">
              Start auf Stufe {startLevel} ({difficultyLabel(startLevel)})
            </span>
            <span className="pill">Zeit pro Aufgabe {mod.timeText}</span>
          </div>
          {mode === 'lernen' ? (
            <p className="small muted" style={{ margin: 0 }}>
              Nach jeder Antwort siehst du sofort, ob sie stimmt, und kannst die Erklärung
              aufklappen. Zwei richtige Antworten in Folge heben die Stufe, eine falsche senkt sie.
            </p>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              Wie im echten adaptiven Test: Zeitlimit pro Aufgabe, kein Feedback, kein Zurück. Jede
              richtige Antwort hebt die Stufe, jede falsche oder abgelaufene senkt sie. Die
              Auswertung kommt am Ende.
            </p>
          )}
          {mode === 'lernen' && (
            <label className="check">
              <input
                type="checkbox"
                checked={settings.timeLimitInLearning}
                onChange={async (e) =>
                  setSettings(await saveSettings({ timeLimitInLearning: e.target.checked }))
                }
              />
              Zeitlimit auch im Lernmodus
            </label>
          )}
          {mode === 'test' && moduleId === 'kopfrechnen' && (
            <label className="check">
              <input
                type="checkbox"
                checked={settings.kopfrechnenAuswahlImTest}
                onChange={async (e) =>
                  setSettings(await saveSettings({ kopfrechnenAuswahlImTest: e.target.checked }))
                }
              />
              4 Auswahlantworten statt Eingabefeld
            </label>
          )}
        </div>

        <div className="section">
          {showIntro ? (
            <div className="card stack">
              <div className="row">
                <h2 style={{ margin: 0 }}>Anleitung</h2>
                <span className="spacer" />
                {mstate.introSeen && (
                  <button className="linklike" onClick={() => setShowIntro(false)}>
                    ausblenden
                  </button>
                )}
              </div>
              <p style={{ margin: 0 }}>{mod.instructions}</p>
              {examples.map((ex, i) => (
                <div key={i} className="stack">
                  <h3 style={{ margin: 0 }}>Beispiel {i + 1}</h3>
                  <div className="paper" style={{ minHeight: 0, padding: 22 }}>
                    <PromptView item={ex} />
                  </div>
                  <div className="explanation">
                    <strong>Lösung: {ex.correctLabel}</strong>
                    <div style={{ marginTop: 6 }}>
                      <SolutionView item={ex} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button className="linklike" onClick={() => setShowIntro(true)}>
              Anleitung und Beispiele anzeigen
            </button>
          )}
        </div>

        <div className="row section">
          <button className="btn primary" onClick={() => void start()} autoFocus>
            Starten <kbd style={{ color: '#fff', borderColor: 'rgba(255,255,255,.5)' }}>Enter</kbd>
          </button>
          <span className="muted small">
            Abbrechen jederzeit mit <kbd>Esc</kbd>
          </span>
        </div>
      </div>
    );
  }

  // ---------- Auswertung ----------
  if (phase === 'done' && finalSession) {
    const sum = finalSession.summary[moduleId];
    return (
      <div className="page">
        <h1>
          {mod.name} <span className="muted">· Auswertung {modeName}</span>
        </h1>
        {sum && (
          <div className="stat-row">
            <div className="stat">
              <div className="v">{sum.niveau} %</div>
              <div className="l">Niveau (Ø Stufe 2. Hälfte × 10)</div>
            </div>
            <div className="stat">
              <div className="v">{sum.trefferquote} %</div>
              <div className="l">Trefferquote</div>
            </div>
            <div className="stat">
              <div className="v">{fmtS(sum.medianMs)}</div>
              <div className="l">Median-Zeit pro Aufgabe</div>
            </div>
            <div className="stat">
              <div className="v">{sum.endLevel}</div>
              <div className="l">Stufe für das nächste Mal</div>
            </div>
          </div>
        )}
        <ReviewTable results={results} />
        <div className="row section">
          <button
            className="btn primary"
            onClick={() => {
              setPhase('loading');
              setLoadKey((k) => k + 1);
            }}
            autoFocus
          >
            Nochmal
          </button>
          <button className="btn" onClick={onExit}>
            Zurück
          </button>
        </div>
      </div>
    );
  }

  if (!item) return null;

  // ---------- Aufgabe ----------
  const opts = useChoice ? choiceOptions(item) : null;
  const last = results[results.length - 1];
  const number = phase === 'feedback' ? results.length : results.length + 1;

  return (
    <div className="task-shell">
      <div className="task-top">
        <strong>{mod.name}</strong>
        <span className="muted hide-mobile">{modeName}</span>
        <span className="muted tnum hide-mobile">
          Aufgabe {number} von {total}
        </span>
        <span className="muted tnum only-mobile">
          {number}/{total}
        </span>
        <span className="muted tnum">Stufe {item.level}</span>
        <span className="spacer" />
        <button
          className="linklike hide-mobile"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen?.();
          }}
        >
          Vollbild
        </button>
        <button className="linklike" onClick={() => void abort()}>
          Abbrechen<span className="hide-mobile"> (Esc)</span>
        </button>
      </div>
      <div className="timebar">
        {timeLimitOn && phase === 'run' && (
          <div
            key={item.id + results.length}
            style={{ animation: `timebar ${item.timeLimitMs}ms linear forwards`, width: '100%' }}
          />
        )}
      </div>
      <div className="task-main">
        <div className="paper">
          <PromptView item={item} />
        </div>

        {phase === 'run' && (
          <div className="answer-area">
            {opts ? (
              <>
                <div className="options" role="radiogroup" aria-label="Antworten">
                  {opts.options.map((o, i) => (
                    <button
                      key={i}
                      role="radio"
                      aria-checked={selected === i}
                      className={'option' + (selected === i ? ' selected' : '')}
                      onClick={() => setSelected(i)}
                      onDoubleClick={() => submit({ type: 'choice', index: i })}
                    >
                      <span className="key">{LETTERS[i]}</span>
                      {o}
                    </button>
                  ))}
                </div>
                <button
                  className="btn primary"
                  disabled={selected === null}
                  onClick={() => selected !== null && submit({ type: 'choice', index: selected })}
                >
                  Bestätigen <kbd style={{ color: '#fff' }}>Enter</kbd>
                </button>
              </>
            ) : (
              <form
                className="answer-area"
                style={{ marginTop: 0 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  submitText();
                }}
              >
                <input
                  ref={inputRef}
                  className="answer-input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label="Antwort"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setInputError('');
                  }}
                />
                {inputError && (
                  <span className="small" style={{ color: '#ff7a74' }}>
                    {inputError}
                  </span>
                )}
                <button className="btn primary" type="submit" disabled={!input.trim()}>
                  Bestätigen <kbd style={{ color: '#fff' }}>Enter</kbd>
                </button>
              </form>
            )}
            <ReportLink item={item} reported={reported} onReported={() => setReported(true)} />
          </div>
        )}

        {phase === 'feedback' && last && (
          <div className={'feedback ' + (last.correct ? 'ok' : 'bad')}>
            <div className="row">
              <span className={'verdict ' + (last.correct ? 'ok' : 'bad')}>
                {last.correct ? 'Richtig' : last.timedOut ? 'Zeit abgelaufen' : 'Falsch'}
              </span>
              {!last.correct && (
                <span>
                  Deine Antwort: <strong>{last.timedOut ? '—' : last.answerLabel}</strong> ·
                  Richtig: <strong>{item.correctLabel}</strong>
                </span>
              )}
              <span className="spacer" />
              <span className="muted small tnum">{fmtS(last.rtMs)}</span>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={continueAfterFeedback} autoFocus>
                {results.length >= total ? 'Zur Auswertung' : 'Weiter'}{' '}
                <kbd style={{ color: '#fff' }}>Enter</kbd>
              </button>
              <button
                className="btn ghost"
                onClick={() => setShowExpl((x) => !x)}
                aria-expanded={showExpl}
              >
                Erklärung {showExpl ? 'ausblenden' : 'anzeigen'} <kbd>E</kbd>
              </button>
              <span className="spacer" />
              <ReportLink item={item} reported={reported} onReported={() => setReported(true)} />
            </div>
            {showExpl && (
              <div className="explanation">
                <SolutionView item={item} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportLink({
  item,
  reported,
  onReported,
}: {
  item: Item;
  reported: boolean;
  onReported: () => void;
}) {
  const gen = MODULE_BY_ID[item.moduleId]?.generator;
  if (reported) return <span className="small muted">Gemeldet, danke.</span>;
  return (
    <button
      className="linklike"
      onClick={async () => {
        await addReport({
          moduleId: item.moduleId,
          generatorId: item.generatorId,
          generatorVersion: item.generatorVersion,
          seed: item.seed,
          level: item.level,
          promptText: gen ? gen.promptText(item) : '',
        });
        onReported();
      }}
    >
      Aufgabe fehlerhaft?
    </button>
  );
}

function ReviewTable({ results }: { results: Result[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="section card" style={{ padding: 0, overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Aufgabe</th>
            <th>Deine Antwort</th>
            <th>Lösung</th>
            <th className="num">Stufe</th>
            <th className="num">Zeit</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => {
            const gen = MODULE_BY_ID[r.item.moduleId]?.generator;
            return [
              <tr key={i}>
                <td className="tnum">{i + 1}</td>
                <td>{gen?.promptText(r.item)}</td>
                <td style={{ color: r.correct ? '#57c486' : '#ff7a74' }}>
                  {r.correct ? '✓ ' : '✗ '}
                  {r.timedOut ? 'Zeit abgelaufen' : r.answerLabel}
                </td>
                <td>{r.item.correctLabel}</td>
                <td className="num tnum">{r.item.level}</td>
                <td className="num tnum">{fmtS(r.rtMs)}</td>
                <td>
                  <button
                    className="linklike"
                    onClick={() => setOpen(open === i ? null : i)}
                    aria-expanded={open === i}
                  >
                    Erklärung
                  </button>
                </td>
              </tr>,
              open === i && (
                <tr key={i + '-x'}>
                  <td></td>
                  <td colSpan={6}>
                    <div className="explanation" style={{ marginTop: 0 }}>
                      <SolutionView item={r.item} />
                    </div>
                  </td>
                </tr>
              ),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
