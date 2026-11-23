import { useEffect, useRef, useState } from 'react';
import { db, getSettings } from '../../db/db';
import { navigate, useLive } from '../hooks';
import { MODULE_BY_ID } from '../../modules/catalog';
import { KURZSIM, VOLLSIM, simMinutes, type SimDef } from '../../core/simulation';
import { uid } from '../../core/ids';
import { playTone, unlockAudio } from '../../core/audio';
import type { Attempt, Item, Session, Settings } from '../../core/types';
import { SessionRunner } from '../../session/SessionRunner';
import { markGroupDone } from '../../session/persist';
import { VigilanzResult } from '../../modules/blocks/Vigilanz';
import type { VgItem } from '../../generators/reaktion';

export const SIMS: Record<string, SimDef> = { kurz: KURZSIM, voll: VOLLSIM };

type Step =
  | { kind: 'start' }
  | { kind: 'intro'; block: number }
  | { kind: 'run'; block: number; part: number }
  | { kind: 'pause'; block: number; until: number }
  | { kind: 'report' };

function Countdown({ until, onEnd }: { until: number; onEnd: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, until - now);
  useEffect(() => {
    if (left <= 0) onEnd();
  }, [left, onEnd]);
  const s = Math.ceil(left / 1000);
  return (
    <div className="countdown-big tnum">
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </div>
  );
}

export function SimRunner({ simId }: { simId: string }) {
  const def = SIMS[simId];
  const [step, setStep] = useState<Step>({ kind: 'start' });
  const [settings, setSettings] = useState<Settings | null>(null);
  const groupId = useRef(uid('g-'));

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  if (!def) return <div className="page">Unbekannte Simulation.</div>;
  if (!settings) return <div className="page muted">Lädt …</div>;
  const pauseOn = def.id === 'vollsim' && settings.simPause === '5';

  const nextAfterBlock = (block: number) => {
    if (block >= def.blocks.length - 1) setStep({ kind: 'report' });
    else if (pauseOn) setStep({ kind: 'pause', block: block + 1, until: Date.now() + 5 * 60000 });
    else setStep({ kind: 'intro', block: block + 1 });
  };

  if (step.kind === 'run') {
    const block = def.blocks[step.block];
    const part = block.parts[step.part];
    const lastPart = step.part === block.parts.length - 1;
    return (
      <SessionRunner
        key={`${step.block}-${step.part}`}
        moduleId={part.moduleId}
        mode="test"
        onExit={() => navigate('simulation')}
        embed={{
          sessionType: def.id,
          count: part.count,
          timeBudgetMs: part.minutes ? part.minutes * 60000 : undefined,
          opts: part.opts,
          autoStart: true,
          groupId: groupId.current,
          block: block.id,
          label: `${def.name} · Block ${step.block + 1}/${def.blocks.length}`,
          onDone: (s) => {
            if (lastPart && step.block === def.blocks.length - 1) void markGroupDone(s.id);
            if (!lastPart) setStep({ kind: 'run', block: step.block, part: step.part + 1 });
            else nextAfterBlock(step.block);
          },
        }}
      />
    );
  }

  if (step.kind === 'report')
    return (
      <div className="page">
        <h1>{def.name}: Bericht</h1>
        <SimReport groupId={groupId.current} />
        <div className="row section">
          <button className="btn primary" onClick={() => navigate('simulation')} autoFocus>
            Zurück
          </button>
        </div>
      </div>
    );

  if (step.kind === 'pause')
    return (
      <div className="page" style={{ maxWidth: 640, textAlign: 'center' }}>
        <h1>Pause</h1>
        <p className="muted">
          Nächster Block: {def.blocks[step.block].name}. Aufstehen, trinken, Augen entspannen.
        </p>
        <Countdown
          until={step.until}
          onEnd={() => {
            playTone(880, 300);
            setStep({ kind: 'intro', block: step.block });
          }}
        />
        <button className="btn" onClick={() => setStep({ kind: 'intro', block: step.block })}>
          Pause beenden
        </button>
      </div>
    );

  if (step.kind === 'intro') {
    const block = def.blocks[step.block];
    return (
      <div className="page" style={{ maxWidth: 760 }}>
        <div className="eyebrow">
          {def.name} · Block {step.block + 1} von {def.blocks.length}
        </div>
        <h1>{block.name}</h1>
        <div className="card stack">
          <p style={{ margin: 0 }}>{block.intro}</p>
          <ul className="small muted" style={{ margin: 0 }}>
            {block.parts.map((p, i) => (
              <li key={i}>
                {MODULE_BY_ID[p.moduleId]?.name}:{' '}
                {p.minutes
                  ? `${p.minutes} Minuten`
                  : p.count === 1
                    ? 'ein Durchgang'
                    : `${p.count} Aufgaben`}
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ margin: 0 }}>
            Testmodus: Zeitlimit je Aufgabe, keine Rückmeldung, kein Zurück.
          </p>
        </div>
        <div className="row section">
          <button
            className="btn primary"
            autoFocus
            onClick={() => {
              unlockAudio();
              setStep({ kind: 'run', block: step.block, part: 0 });
            }}
          >
            Block starten <kbd className="on-accent">Enter</kbd>
          </button>
          <button
            className="linklike"
            onClick={() => {
              if (window.confirm('Simulation abbrechen? Erledigte Blöcke bleiben gespeichert.'))
                navigate('simulation');
            }}
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  // Start
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <button className="linklike" onClick={() => navigate('simulation')}>
        ← zurück
      </button>
      <h1 style={{ marginTop: 12 }}>{def.name}</h1>
      <p className="muted">
        Gesamt etwa {simMinutes(def)} Minuten reine Aufgabenzeit
        {def.id === 'vollsim'
          ? pauseOn
            ? ', dazu 5 Minuten Pause zwischen den Blöcken.'
            : ', ohne Pausen („Ernstfall“).'
          : ', ohne Pause.'}{' '}
        Vor jedem Block kommt eine Anleitungsseite. Ruhige Umgebung, Ton an, Handy weg.
      </p>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Block</th>
              <th>Inhalt</th>
              <th className="num">Minuten</th>
            </tr>
          </thead>
          <tbody>
            {def.blocks.map((b, i) => (
              <tr key={b.id}>
                <td>
                  {i + 1}. {b.name}
                </td>
                <td className="small muted">
                  {b.parts.map((p) => MODULE_BY_ID[p.moduleId]?.name).join(', ')}
                </td>
                <td className="num tnum">{b.minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row section">
        <button
          className="btn primary"
          autoFocus
          onClick={() => setStep({ kind: 'intro', block: 0 })}
        >
          Simulation beginnen
        </button>
      </div>
    </div>
  );
}

/** Bericht einer Simulation (auch später aus dem Fortschritt aufrufbar). */
export function SimReport({ groupId }: { groupId: string }) {
  const sessions = useLive(
    () => db.sessions.filter((s) => s.groupId === groupId).toArray(),
    [groupId],
    [] as Session[],
  );
  const allSims = useLive(
    () =>
      db.sessions
        .filter((s) => (s.type === 'kurzsim' || s.type === 'vollsim') && !!s.endedAt)
        .toArray(),
    [],
    [] as Session[],
  );
  const vig = useLive<Attempt[]>(
    () =>
      db.attempts
        .where('sessionId')
        .anyOf(sessions.map((s) => s.id))
        .filter((a) => a.moduleId === 'vigilanz')
        .toArray(),
    [sessions.map((s) => s.id).join()],
    [],
  );
  if (!sessions.length) return <p className="muted">Lädt …</p>;
  const type = sessions[0].type;
  const def = type === 'vollsim' ? VOLLSIM : KURZSIM;
  const started = sessions.map((s) => s.startedAt).sort()[0];
  // Vorherige vollständige Simulation gleichen Typs zum Vergleich
  const prevGroups = new Map<string, Session[]>();
  for (const s of allSims)
    if (s.type === type && s.groupId && s.groupId !== groupId && s.startedAt < started)
      prevGroups.set(s.groupId, [...(prevGroups.get(s.groupId) ?? []), s]);
  const prev = [...prevGroups.values()]
    .filter((g) => g.some((s) => s.groupDone))
    .sort((a, b) => (a[0].startedAt < b[0].startedAt ? 1 : -1))[0];
  const prevNiveau = (m: string) => prev?.find((s) => s.summary[m])?.summary[m]?.niveau;

  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>
        {new Date(started).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
        {prev
          ? ` · Vergleich mit ${new Date(prev[0].startedAt).toLocaleDateString('de-DE')}`
          : ' · erste vollständige Simulation dieser Art'}
        {!sessions.some((s) => s.groupDone) && ' · nicht vollständig'}
      </p>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Block</th>
              <th>Modul</th>
              <th className="num">Aufgaben</th>
              <th className="num">Niveau</th>
              <th className="num">Treffer</th>
              <th className="num">Median</th>
              <th className="num">Vergleich</th>
            </tr>
          </thead>
          <tbody>
            {def.blocks.flatMap((b, bi) =>
              b.parts.map((p, pi) => {
                const s = sessions.find((x) => x.block === b.id && x.summary[p.moduleId]);
                const sum = s?.summary[p.moduleId];
                const pv = prevNiveau(p.moduleId);
                const delta = sum && pv !== undefined ? sum.niveau - pv : null;
                return (
                  <tr key={b.id + pi}>
                    <td>{pi === 0 ? `${bi + 1}. ${b.name}` : ''}</td>
                    <td>{MODULE_BY_ID[p.moduleId]?.name}</td>
                    <td className="num tnum">{sum?.anzahl ?? '–'}</td>
                    <td className="num tnum">{sum ? `${sum.niveau} %` : '–'}</td>
                    <td className="num tnum">{sum ? `${sum.trefferquote} %` : '–'}</td>
                    <td className="num tnum">
                      {sum
                        ? (sum.medianMs / 1000).toLocaleString('de-DE', {
                            maximumFractionDigits: 1,
                          }) + ' s'
                        : '–'}
                    </td>
                    <td
                      className="num tnum"
                      style={{
                        color: delta === null ? undefined : delta >= 0 ? 'var(--ok)' : 'var(--bad)',
                      }}
                    >
                      {delta === null ? '–' : `${delta >= 0 ? '+' : ''}${delta}`}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        Niveau = mittlere Stufe der zweiten Hälfte × 10. Bei Block-Aufgaben (Determination,
        Durchstreichen, Fakten, Vigilanz) bedeutet Treffer 100 %, dass der Block geschafft ist;
        Details stehen im Fortschritt. Vergleich = Niveau-Unterschied zur letzten vollständigen
        Simulation gleicher Art.
      </p>
      {vig.map((a) => {
        const part = def.blocks.flatMap((b) => b.parts).find((p) => p.moduleId === 'vigilanz');
        const gen = MODULE_BY_ID.vigilanz.generator!;
        const item = gen.generate(a.seed, a.level, part?.opts) as Item as VgItem;
        const data = (a.answer as { data?: Record<string, unknown> } | null)?.data;
        return data ? (
          <div key={a.id} className="card">
            <h2>Vigilanz-Verlauf</h2>
            <VigilanzResult item={item} data={data} />
          </div>
        ) : null;
      })}
    </div>
  );
}
