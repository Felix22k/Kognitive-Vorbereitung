import { useEffect, useRef, useState } from 'react';
import { db, getSettings } from '../../db/db';
import { navigate } from '../hooks';
import { MODULES, MODULE_BY_ID, isAvailable, tagName } from '../../modules/catalog';
import { daySeed, planDay, WEEKDAY_NAMES, type DayUnit } from '../../core/plan';
import { dayKey } from '../../core/progress';
import { createRng, randomSeed } from '../../core/rng';
import { uid } from '../../core/ids';
import type { ModuleState, Session } from '../../core/types';
import { SessionRunner } from '../../session/SessionRunner';
import { markGroupDone } from '../../session/persist';

const fmtMin = (sec: number) => `${Math.max(1, Math.round(sec / 60))} min`;

/** Kurzbeschreibung eines Teils, z. B. „Kopfrechnen: 8 Aufgaben“. */
export function partText(p: DayUnit['parts'][number]): string {
  const m = MODULE_BY_ID[p.moduleId];
  const what = p.count === 1 && p.estSec >= 60 ? '1 Durchgang' : `${p.count} Aufgaben`;
  const focus = p.reason === 'fokus' && p.tags?.length ? ` (Fokus ${tagName(p.tags[0])})` : '';
  return `${m?.name ?? p.moduleId}: ${what}${focus}`;
}

/** Zusammenstellung für heute aus Datenbank und Einstellungen. */
export async function loadDayUnit(seed = daySeed(dayKey(new Date()))): Promise<{
  unit: DayUnit;
  states: Record<string, ModuleState>;
}> {
  const settings = await getSettings();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [attempts, states] = await Promise.all([
    db.attempts.where('timestamp').aboveOrEqual(since).toArray(),
    db.moduleStates.toArray(),
  ]);
  const st = Object.fromEntries(states.map((s) => [s.moduleId, s]));
  const unit = planDay({
    now: new Date(),
    minutes: settings.dailyMinutes,
    restDay: settings.restDay,
    weekPlan: settings.weekPlan,
    available: MODULES.filter(isAvailable).map((m) => m.id),
    attempts,
    lastPlayed: Object.fromEntries(states.map((s) => [s.moduleId, s.lastPlayed])),
    rng: createRng(seed),
  });
  return { unit, states: st };
}

export function Tageseinheit() {
  const [data, setData] = useState<{ unit: DayUnit; states: Record<string, ModuleState> }>();
  const [idx, setIdx] = useState(-1);
  const [doneParts, setDoneParts] = useState<Session[]>([]);
  const groupId = useRef(uid('g-'));
  const seed = useRef(daySeed(dayKey(new Date())));

  useEffect(() => {
    void loadDayUnit(seed.current).then(setData);
  }, []);

  if (!data) return <div className="page muted">Lädt …</div>;
  const { unit, states } = data;
  const parts = unit.parts;

  // ---------- laufender Teil ----------
  if (idx >= 0 && idx < parts.length) {
    const p = parts[idx];
    return (
      <SessionRunner
        key={idx}
        moduleId={p.moduleId}
        mode="lernen"
        onExit={() => navigate('heute')}
        embed={{
          sessionType: 'tag',
          count: p.count,
          tags: p.tags,
          startLevel: p.tags ? p.startLevel : undefined,
          groupId: groupId.current,
          autoStart: !!states[p.moduleId]?.introSeen,
          label: `Tageseinheit ${idx + 1}/${parts.length}`,
          onDone: (s) => {
            setDoneParts((d) => [...d, s]);
            if (idx === parts.length - 1) void markGroupDone(s.id);
            setIdx(idx + 1);
          },
        }}
      />
    );
  }

  // ---------- Abschluss ----------
  if (idx >= parts.length) {
    return (
      <div className="page" style={{ maxWidth: 820 }}>
        <h1>Tageseinheit erledigt</h1>
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Teil</th>
                <th className="num">Aufgaben</th>
                <th className="num">Treffer</th>
                <th className="num">Stufe danach</th>
              </tr>
            </thead>
            <tbody>
              {doneParts.map((s, i) => {
                const [m, sum] = Object.entries(s.summary)[0] ?? [];
                return (
                  <tr key={s.id}>
                    <td>
                      {MODULE_BY_ID[m ?? '']?.name ?? m}
                      {parts[i]?.reason === 'fokus' && <span className="pill accent"> Fokus</span>}
                    </td>
                    <td className="num tnum">{sum?.anzahl ?? 0}</td>
                    <td className="num tnum">{sum?.trefferquote ?? 0} %</td>
                    <td className="num tnum">{sum?.endLevel ?? '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="row section">
          <button className="btn primary" onClick={() => navigate('heute')} autoFocus>
            Zurück zu Heute
          </button>
          <button className="btn" onClick={() => navigate('fortschritt')}>
            Fortschritt ansehen
          </button>
        </div>
      </div>
    );
  }

  // ---------- Übersicht ----------
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <button className="linklike" onClick={() => navigate('heute')}>
        ← zurück
      </button>
      <h1 style={{ marginTop: 12 }}>Tageseinheit · {WEEKDAY_NAMES[unit.weekday]}</h1>
      {unit.rest && (
        <p className="notice">
          Heute ist dein Ruhetag. Erholung gehört zum Training. Wenn du trotzdem üben willst, ist
          hier eine kurze Einheit.
        </p>
      )}
      <p className="muted">
        Etwa {fmtMin(unit.totalSec)} im Lernmodus mit Rückmeldung. Rund 70 % kommen aus dem
        Wochenplan, 30 % zielen auf deine schwächsten Regeln der letzten 30 Tage.
      </p>
      <div className="card" style={{ padding: 0 }}>
        <ul className="list" style={{ padding: '4px 16px' }}>
          {parts.map((p, i) => (
            <li key={i}>
              <span className="tnum muted" style={{ width: 22 }}>
                {i + 1}.
              </span>
              <div style={{ flex: 1 }}>
                <div>{partText(p)}</div>
                <div className="muted small">
                  {p.reason === 'plan'
                    ? 'Wochenplan'
                    : unit.focusTag
                      ? `Fokus: ${Math.round(unit.focusTag.rate * 100)} % Fehler in den letzten 30 Tagen`
                      : 'Fokus: lange nicht geübt'}
                  {' · '}ca. {fmtMin(p.estSec)}
                  {!states[p.moduleId]?.introSeen && ' · mit Anleitung'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {parts.length === 0 && (
        <p className="muted">
          Für heute ist nichts geplant. Passe den Wochenplan in den Einstellungen an.
        </p>
      )}
      <div className="row section">
        <button
          className="btn primary"
          disabled={!parts.length}
          onClick={() => setIdx(0)}
          autoFocus
        >
          Starten
        </button>
        <button
          className="btn"
          onClick={() => {
            seed.current = randomSeed();
            void loadDayUnit(seed.current).then(setData);
          }}
        >
          Fokus neu wählen
        </button>
        <a className="linklike" href="#/einstellungen">
          Wochenplan ändern
        </a>
      </div>
    </div>
  );
}
