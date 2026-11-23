import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MODULE_BY_ID } from '../modules/catalog';
import { PromptView, SolutionView, choiceInfo, type ChoiceInfo } from '../modules/views';
import { RotationAngleSummary } from '../modules/raumViews';
import { BlockResultView, BlockView } from '../modules/blocks';
import { unlockAudio } from '../core/audio';
import { db, getModuleState, getSettings, saveSettings } from '../db/db';
import { testStartLevel, updateStair, type StairState } from '../core/staircase';
import { uid } from '../core/ids';
import type { Attempt, Item, ModuleState, Session, SessionType, Settings } from '../core/types';
import type { AnswerValue } from '../generators/common';
import { LETTERS } from '../generators/common';
import { pickUniqueItem } from './engine';
import { addReport, finishSession, markIntroSeen, recordAttempt, startSession } from './persist';
import { difficultyLabel } from '../core/progress';

type Phase = 'loading' | 'setup' | 'run' | 'feedback' | 'done';

export interface Result {
  item: Item;
  answerLabel: string;
  correct: boolean;
  timedOut: boolean;
  rtMs: number;
  answerIndex?: number;
  answerIndices?: number[];
  answer?: AnswerValue | null;
}

/** Einbettung in Tageseinheit, Simulation, Belastungsmodus oder „Schwächen üben“. */
export interface EmbedConfig {
  sessionType: SessionType;
  /** feste Aufgabenzahl */
  count?: number;
  /** Zeitbudget: nach Ablauf endet der Teil mit der laufenden Aufgabe */
  timeBudgetMs?: number;
  /** nur Aufgaben mit mindestens einem dieser Regel-Tags */
  tags?: string[];
  /** Startstufe (z. B. für Tag-Übung) */
  startLevel?: number;
  /** Moduloptionen überschreiben (z. B. Dauer) */
  opts?: Record<string, string>;
  /** Startbildschirm überspringen */
  autoStart?: boolean;
  groupId?: string;
  block?: string;
  sessionExtra?: Partial<Pick<Session, 'puls' | 'muedigkeit' | 'schlafStunden' | 'protokoll'>>;
  /** Kopfzeile, z. B. „Tageseinheit 2 von 3“ */
  label?: string;
  /** statt der Auswertungsseite zurück an den übergeordneten Ablauf */
  onDone?: (session: Session, results: Result[]) => void;
}

export interface RunnerProps {
  moduleId: string;
  mode: 'lernen' | 'test';
  onExit: () => void;
  belastet?: boolean;
  embed?: EmbedConfig;
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

export function SessionRunner({ moduleId, mode, onExit, belastet = false, embed }: RunnerProps) {
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
  const [multiSel, setMultiSel] = useState<number[]>([]);
  const [showIntro, setShowIntro] = useState(false);
  const [showExpl, setShowExpl] = useState(false);
  const [reported, setReported] = useState(false);
  const [finalSession, setFinalSession] = useState<Session | null>(null);
  const [inputError, setInputError] = useState('');

  const shownAt = useRef(0);
  const answered = useRef(false);
  const recent = useRef<Set<string>>(new Set());
  /** gemeldete Aufgaben dieses Moduls (nie wieder zeigen) */
  const blocked = useRef<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  /** Kette der Speichervorgänge, damit die Auswertung erst nach dem letzten Speichern läuft. */
  const pending = useRef<Promise<void>>(Promise.resolve());

  const total =
    embed?.count ??
    (embed?.timeBudgetMs
      ? 999
      : mode === 'lernen'
        ? (mod?.itemsLernen ?? 10)
        : (mod?.itemsTest ?? 12));
  /** Beginn des Zeitbudgets (performance.now) */
  const budgetStart = useRef(0);
  const [nowTick, setNowTick] = useState(0);
  const budgetOver = useCallback(
    () =>
      !!embed?.timeBudgetMs &&
      budgetStart.current > 0 &&
      performance.now() - budgetStart.current >= embed.timeBudgetMs,
    [embed?.timeBudgetMs],
  );
  const accept = useMemo(() => {
    const tags = embed?.tags;
    if (!tags?.length) return undefined;
    return (it: Item) => it.tags.some((t) => tags.includes(t));
  }, [embed?.tags]);
  const timeLimitOn = mode === 'test' || !!settings?.timeLimitInLearning;
  const modOpts = useMemo(() => {
    const o: Record<string, string> = {};
    for (const opt of mod?.options ?? []) o[opt.key] = opt.default;
    return { ...o, ...(settings?.moduleOptions?.[moduleId] ?? {}), ...(embed?.opts ?? {}) };
  }, [mod, settings, moduleId, embed?.opts]);
  const kopfAuswahl =
    mode === 'test' && moduleId === 'kopfrechnen' && !!settings?.kopfrechnenAuswahlImTest;
  const choice: ChoiceInfo | null = useMemo(
    () => (item && (item.answerKind === 'choice' || kopfAuswahl) ? choiceInfo(item) : null),
    [item, kopfAuswahl],
  );

  const [loadKey, setLoadKey] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [s, ms, reps] = await Promise.all([
        getSettings(),
        getModuleState(moduleId),
        db.reports.where('moduleId').equals(moduleId).toArray(),
      ]);
      if (!alive) return;
      blocked.current = new Set(reps.map((r) => r.fingerprint).filter((x): x is string => !!x));
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
      const it = pickUniqueItem(
        gen,
        level,
        recent.current,
        modOpts,
        undefined,
        blocked.current,
        accept,
      );
      recent.current.add(gen.fingerprint(it));
      answered.current = false;
      setItem(it);
      setInput('');
      setSelected(null);
      setMultiSel([]);
      setMultiSel([]);
      setShowExpl(false);
      setReported(false);
      setInputError('');
      setPhase('run');
    },
    [gen, modOpts, accept],
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
    async (lvl: number, aborted = false, res?: Result[]) => {
      if (!session) return;
      await pending.current;
      const done = await finishSession(session, { [moduleId]: lvl }, aborted);
      setFinalSession(done);
      if (aborted) return;
      if (embed?.onDone) embed.onDone(done, res ?? []);
      else setPhase('done');
    },
    [session, moduleId, embed],
  );

  const submit = useCallback(
    (answer: AnswerValue | null) => {
      if (!item || !gen || !session || answered.current) return;
      const timedOut = answer === null;
      let answerLabel = '';
      if (answer?.type === 'text') answerLabel = answer.raw.trim();
      if (answer?.type === 'choice') answerLabel = choiceInfo(item)?.label(answer.index) ?? '';
      if (answer?.type === 'multi')
        answerLabel = [...answer.indices]
          .sort((a, b) => a - b)
          .map((i) => choiceInfo(item)?.label(i) ?? '')
          .join(' und ');
      if (answer?.type === 'block') {
        const d = answer.data;
        if (typeof d.input === 'string') answerLabel = d.input.split('').join(' ') || '–';
        else if (Array.isArray(d.clicks) && d.clicks.every((c) => typeof c === 'number'))
          answerLabel = (d.clicks as number[]).map((c) => c + 1).join(' → ') || '–';
      }
      if (timedOut) answerLabel = '(Zeit abgelaufen)';
      answered.current = true;
      const rtMs =
        answer?.type === 'block' && answer.rtMs !== undefined
          ? answer.rtMs
          : Math.round(performance.now() - shownAt.current);
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
      const nextStair = updateStair(stair, correct, mode, mod?.stair ?? 'standard');
      setStair(nextStair);
      const answerIndex = answer?.type === 'choice' ? answer.index : undefined;
      const answerIndices = answer?.type === 'multi' ? answer.indices : undefined;
      const res = [
        ...results,
        { item, answerLabel, correct, timedOut, rtMs, answerIndex, answerIndices, answer },
      ];
      setResults(res);
      if (mode === 'lernen') {
        setShowExpl(!correct); // bei Fehlern die Erklärung gleich aufklappen
        setPhase('feedback');
      } else if (res.length >= total || budgetOver()) {
        void finish(nextStair.level, false, res);
      } else {
        presentNext(nextStair.level);
      }
    },
    [
      item,
      gen,
      session,
      moduleId,
      mode,
      belastet,
      stair,
      results,
      total,
      finish,
      presentNext,
      mod?.stair,
      budgetOver,
    ],
  );

  // Zeitlimit
  useEffect(() => {
    if (phase !== 'run' || !item || !timeLimitOn || item.answerKind === 'block') return;
    const t = window.setTimeout(() => submit(null), item.timeLimitMs);
    return () => window.clearTimeout(t);
  }, [phase, item, timeLimitOn, submit]);

  const start = useCallback(async () => {
    if (!mstate || !gen) return;
    unlockAudio();
    await markIntroSeen(moduleId);
    const s = await startSession({
      type: embed?.sessionType ?? 'modul',
      mode,
      moduleIds: [moduleId],
      belastet,
      groupId: embed?.groupId,
      block: embed?.block,
      ...(embed?.sessionExtra ?? {}),
    });
    setSession(s);
    budgetStart.current = performance.now();
    const lvl =
      embed?.startLevel ??
      (mode === 'test' ? testStartLevel(mstate.levelTest) : mstate.levelLernen);
    setStair({ level: lvl, streak: 0 });
    setResults([]);
    setFinalSession(null);
    const it = pickUniqueItem(
      gen,
      lvl,
      recent.current,
      modOpts,
      undefined,
      blocked.current,
      accept,
    );
    recent.current.add(gen.fingerprint(it));
    answered.current = false;
    setItem(it);
    setInput('');
    setSelected(null);
    setMultiSel([]);
    setShowExpl(false);
    setReported(false);
    setPhase('run');
  }, [mstate, gen, moduleId, mode, belastet, modOpts, embed, accept]);

  // Eingebettet: Startbildschirm überspringen
  const autoStarted = useRef(false);
  useEffect(() => {
    if (phase === 'setup' && embed?.autoStart && !autoStarted.current) {
      autoStarted.current = true;
      void start();
    }
  }, [phase, embed?.autoStart, start]);

  // Restzeit des Zeitbudgets anzeigen
  useEffect(() => {
    if (!embed?.timeBudgetMs || (phase !== 'run' && phase !== 'feedback')) return;
    const t = window.setInterval(() => setNowTick(performance.now()), 1000);
    return () => window.clearInterval(t);
  }, [embed?.timeBudgetMs, phase]);

  const continueAfterFeedback = useCallback(() => {
    if (results.length >= total || budgetOver()) void finish(stair.level, false, results);
    else presentNext(stair.level);
  }, [results, total, finish, stair.level, presentNext, budgetOver]);

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

  const toggleMulti = useCallback(
    (i: number) => {
      const max = choice?.multi ?? 1;
      setMultiSel((cur) =>
        cur.includes(i)
          ? cur.filter((x) => x !== i)
          : cur.length >= max
            ? [...cur.slice(1), i]
            : [...cur, i],
      );
    },
    [choice],
  );

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
      if (phase === 'run' && choice) {
        const k = e.key.toUpperCase();
        let idx = -1;
        if (choice.keys) idx = choice.keys.indexOf(k);
        else if (/^[1-8]$/.test(k)) idx = parseInt(k, 10) - 1;
        else if (LETTERS.includes(k) && k.length === 1) idx = LETTERS.indexOf(k);
        if (idx >= 0 && idx < choice.count) {
          e.preventDefault();
          if (choice.instant) submit({ type: 'choice', index: idx });
          else if (choice.multi) toggleMulti(idx);
          else setSelected(idx);
          return;
        }
        if (e.key === 'Enter' && !isTypingTarget(e.target)) {
          if (choice.multi && multiSel.length === choice.multi) {
            e.preventDefault();
            submit({ type: 'multi', indices: multiSel });
          } else if (!choice.multi && selected !== null) {
            e.preventDefault();
            submit({ type: 'choice', index: selected });
          }
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
  }, [phase, choice, selected, multiSel, toggleMulti, submit, start, abort, continueAfterFeedback]);

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
    const startLevel =
      embed?.startLevel ??
      (mode === 'test' ? testStartLevel(mstate.levelTest) : mstate.levelLernen);
    return (
      <div className="page" style={{ maxWidth: 860 }}>
        <button className="linklike" onClick={onExit}>
          ← zurück
        </button>
        <h1 style={{ marginTop: 12 }}>
          {mod.name} <span className="muted">· {modeName}</span>
        </h1>
        <p className="muted">{mod.description}</p>
        {embed?.label && <p className="pill accent">{embed.label}</p>}

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
          {(mod.options ?? []).map((opt) => (
            <label key={opt.key} className="field" style={{ marginBottom: 0 }}>
              <span>{opt.label}</span>
              <select
                value={modOpts[opt.key]}
                onChange={async (e) =>
                  setSettings(
                    await saveSettings({
                      moduleOptions: {
                        ...settings.moduleOptions,
                        [moduleId]: { ...modOpts, [opt.key]: e.target.value },
                      },
                    }),
                  )
                }
              >
                {opt.choices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
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
                  <ExampleOptions item={ex} />
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
            Starten <kbd className="on-accent">Enter</kbd>
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
        {moduleId === 'rotation' && <RotationAngleSummary results={results} />}
        {results.length <= 3 &&
          results.some((x) => x.item.answerKind === 'block') &&
          results.map((x, i) => (
            <div key={i} className="section card">
              {results.length > 1 && <h2>Durchgang {i + 1}</h2>}
              <BlockResultView
                item={x.item}
                data={x.answer?.type === 'block' ? x.answer.data : undefined}
              />
            </div>
          ))}
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
  const last = results[results.length - 1];
  const number = phase === 'feedback' ? results.length : results.length + 1;

  return (
    <div className="task-shell">
      <div className="task-top">
        {embed?.label && <span className="muted hide-mobile">{embed.label}</span>}
        <strong className="task-name">{mod.name}</strong>
        <span className="muted hide-mobile">{modeName}</span>
        {embed?.timeBudgetMs ? (
          <span className="muted tnum">
            Aufgabe {number} · noch{' '}
            {Math.max(
              0,
              Math.ceil(
                (embed.timeBudgetMs - ((nowTick || performance.now()) - budgetStart.current)) /
                  60000,
              ),
            )}{' '}
            min
          </span>
        ) : (
          <>
            <span className="muted tnum hide-mobile">
              Aufgabe {number} von {total}
            </span>
            <span className="muted tnum only-mobile">
              {number}/{total}
            </span>
          </>
        )}
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
        {timeLimitOn && phase === 'run' && item.answerKind !== 'block' && (
          <div
            key={item.id + results.length}
            style={{ animation: `timebar ${item.timeLimitMs}ms linear forwards`, width: '100%' }}
          />
        )}
      </div>
      <div className="task-main">
        {item.answerKind === 'block' ? (
          phase === 'run' && (
            <div className="paper block-paper">
              <BlockView
                key={item.id + '-' + results.length}
                item={item}
                mode={mode}
                settings={settings}
                onDone={(data, rt) => submit({ type: 'block', data, rtMs: rt })}
              />
            </div>
          )
        ) : (
          <div className="paper">
            <PromptView item={item} />
          </div>
        )}

        {phase === 'run' && item.answerKind !== 'block' && (
          <div className="answer-area">
            {choice ? (
              <>
                <div
                  className={
                    'options' +
                    (choice.figures ? ' figures' : '') +
                    (choice.large ? ' large' : '') +
                    (choice.list ? ' list' : '')
                  }
                  role="radiogroup"
                  aria-label="Antworten"
                >
                  {Array.from({ length: choice.count }, (_, i) => {
                    const on = choice.multi ? multiSel.includes(i) : selected === i;
                    return (
                      <button
                        key={i}
                        role={choice.multi ? 'checkbox' : 'radio'}
                        aria-checked={on}
                        className={
                          'option' +
                          (choice.figures ? ' figure' : '') +
                          (choice.keys ? ' keyed' : '') +
                          (on ? ' selected' : '')
                        }
                        onClick={() =>
                          choice.instant
                            ? submit({ type: 'choice', index: i })
                            : choice.multi
                              ? toggleMulti(i)
                              : setSelected(i)
                        }
                        onDoubleClick={() =>
                          !choice.multi && !choice.instant && submit({ type: 'choice', index: i })
                        }
                      >
                        <span className="key">{choice.keys ? choice.keys[i] : LETTERS[i]}</span>
                        {choice.render(i)}
                      </button>
                    );
                  })}
                </div>
                {!choice.instant &&
                  (choice.multi ? (
                    <button
                      className="btn primary"
                      disabled={multiSel.length !== choice.multi}
                      onClick={() => submit({ type: 'multi', indices: multiSel })}
                    >
                      {multiSel.length === choice.multi
                        ? 'Bestätigen'
                        : `Noch ${choice.multi - multiSel.length} auswählen`}{' '}
                      <kbd className="on-accent">Enter</kbd>
                    </button>
                  ) : (
                    <button
                      className="btn primary"
                      disabled={selected === null}
                      onClick={() =>
                        selected !== null && submit({ type: 'choice', index: selected })
                      }
                    >
                      Bestätigen <kbd className="on-accent">Enter</kbd>
                    </button>
                  ))}
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
                  <span className="small" style={{ color: 'var(--bad)' }}>
                    {inputError}
                  </span>
                )}
                <button className="btn primary" type="submit" disabled={!input.trim()}>
                  Bestätigen <kbd className="on-accent">Enter</kbd>
                </button>
              </form>
            )}
            <ReportLink item={item} reported={reported} onReported={() => setReported(true)} />
          </div>
        )}

        {phase === 'feedback' && last && choice && (
          <div
            className={
              'options' +
              (choice.figures ? ' figures' : '') +
              (choice.large ? ' large' : '') +
              (choice.list ? ' list' : '')
            }
            style={{ marginTop: 22 }}
            aria-label="Antworten mit Lösung"
          >
            {Array.from({ length: choice.count }, (_, i) => (
              <div
                key={i}
                className={
                  'option' +
                  (choice.figures ? ' figure' : '') +
                  ((choice.correctIndices ?? [choice.correctIndex]).includes(i)
                    ? ' is-correct'
                    : '') +
                  (!last.correct &&
                  (i === last.answerIndex || last.answerIndices?.includes(i)) &&
                  !(choice.correctIndices ?? [choice.correctIndex]).includes(i)
                    ? ' is-wrong'
                    : '')
                }
              >
                <span className="key">{choice.keys ? choice.keys[i] : LETTERS[i]}</span>
                {choice.render(i)}
              </div>
            ))}
          </div>
        )}
        {phase === 'feedback' && last && (
          <div className={'feedback ' + (last.correct ? 'ok' : 'bad')}>
            <div className="row">
              <span className={'verdict ' + (last.correct ? 'ok' : 'bad')}>
                {last.correct ? 'Richtig' : last.timedOut ? 'Zeit abgelaufen' : 'Falsch'}
              </span>
              <span className="spacer" />
              <span className="muted small tnum">{fmtS(last.rtMs)}</span>
            </div>
            {!last.correct && item.correctLabel && (
              <div className="solution-line">
                <div>
                  Richtige Lösung:{' '}
                  <strong
                    className={
                      'solution-value' + (item.correctLabel.length > 14 ? ' solution-text' : '')
                    }
                  >
                    {item.correctLabel}
                  </strong>
                </div>
                <div className="muted small">
                  Deine Antwort: {last.timedOut ? 'keine (Zeit abgelaufen)' : last.answerLabel}
                </div>
              </div>
            )}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={continueAfterFeedback} autoFocus>
                {results.length >= total ? 'Zur Auswertung' : 'Weiter'}{' '}
                <kbd className="on-accent">Enter</kbd>
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
            {(showExpl || item.answerKind === 'block') && (
              <div className="explanation">
                {item.answerKind === 'block' ? (
                  <BlockResultView
                    item={item}
                    data={last.answer?.type === 'block' ? last.answer.data : undefined}
                  />
                ) : (
                  <SolutionView item={item} />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Antwortoptionen eines Beispiels mit markierter Lösung (nur Auswahlaufgaben). */
function ExampleOptions({ item }: { item: Item }) {
  if (item.answerKind !== 'choice') return null;
  const ch = choiceInfo(item);
  if (!ch) return null;
  const right = ch.correctIndices ?? [ch.correctIndex];
  return (
    <div
      className={'options' + (ch.figures ? ' figures' : '') + (ch.large ? ' large' : '')}
      aria-label="Antwortoptionen des Beispiels"
    >
      {Array.from({ length: ch.count }, (_, i) => (
        <div
          key={i}
          className={
            'option' +
            (ch.figures ? ' figure' : '') +
            (ch.keys ? ' keyed' : '') +
            (right.includes(i) ? ' is-correct' : '')
          }
        >
          <span className="key">{ch.keys ? ch.keys[i] : LETTERS[i]}</span>
          {ch.render(i)}
        </div>
      ))}
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
          fingerprint: gen ? gen.fingerprint(item) : undefined,
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
                <td style={{ color: r.correct ? 'var(--ok)' : 'var(--bad)' }}>
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
                      {r.item.answerKind === 'block' ? (
                        <BlockResultView
                          item={r.item}
                          data={r.answer?.type === 'block' ? r.answer.data : undefined}
                        />
                      ) : (
                        <SolutionView item={r.item} />
                      )}
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
