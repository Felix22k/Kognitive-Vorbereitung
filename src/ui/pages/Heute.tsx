import { db, getSettings, saveSettings } from '../../db/db';
import { useLive, navigate } from '../hooks';
import { AREAS, MODULES, MODULE_BY_ID, isAvailable, modulesOfArea } from '../../modules/catalog';
import {
  areaStats,
  completed,
  dayKey,
  daysUntil,
  difficultyLabel,
  isoWeek,
  streak,
  weekDays,
  weekOverview,
  type DayInfo,
} from '../../core/progress';
import { AreaIcon, CheckIcon, FlameIcon } from '../components/Icons';
import { DEFAULT_SETTINGS, type AreaId, type Settings } from '../../core/types';

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function DayTile({ d, name }: { d: DayInfo; name: string }) {
  const state = d.done
    ? 'done'
    : d.rest
      ? 'rest'
      : d.isFuture
        ? 'future'
        : d.isToday
          ? 'open'
          : 'past';
  const label = d.done
    ? `${d.n} Aufg.`
    : d.rest
      ? 'Ruhetag'
      : d.isToday
        ? 'heute offen'
        : d.isFuture
          ? ''
          : '–';
  return (
    <div
      className={`day-tile ${state}${d.isToday ? ' today' : ''}`}
      title={
        d.done
          ? `${d.n} Aufgaben, ${d.correct} richtig, ${d.minutes} min`
          : d.rest
            ? 'Ruhetag'
            : undefined
      }
    >
      <span className="dow">{name}</span>
      <span className="date tnum">{d.date.getDate()}</span>
      <span className="mark">{d.done ? <CheckIcon /> : <span className="pip" />}</span>
      <span className="meta">{label}</span>
    </div>
  );
}

export function Heute() {
  const sessions = useLive(() => db.sessions.toArray(), [], []);
  const states = useLive(() => db.moduleStates.toArray(), [], []);
  const now = new Date();
  const days = weekDays(now);
  const weekStartIso = days[0].toISOString();
  const weekAttempts = useLive(
    () => db.attempts.where('timestamp').aboveOrEqual(weekStartIso).toArray(),
    [weekStartIso],
    [],
  );
  const loadedSettings = useLive<Settings | null>(getSettings, [], null);
  const settings = loadedSettings ?? DEFAULT_SETTINGS;

  const moduleArea = Object.fromEntries(MODULES.map((m) => [m.id, m.areaId])) as Record<
    string,
    AreaId
  >;
  const stats = areaStats(sessions, moduleArea, now);
  const doneKeys = new Set(sessions.filter(completed).map((s) => dayKey(s.endedAt!)));
  const week = weekOverview(days, sessions, weekAttempts, settings.restDay, now);
  const serie = streak(doneKeys, settings.restDay, now);
  const plannedDays = week.filter((d) => !d.rest).length;
  const trainedDays = week.filter((d) => d.done).length;
  const weekN = week.reduce((s, d) => s + d.n, 0);
  const weekCorrect = week.reduce((s, d) => s + d.correct, 0);
  const weekMin = week.reduce((s, d) => s + d.minutes, 0);
  const countdown = settings.testDate ? daysUntil(settings.testDate, now) : null;

  // FOKUS: schwächster Bereich unter den Bereichen mit verfügbaren Modulen
  const candidates = AREAS.filter((a) => modulesOfArea(a.id).some(isAvailable));
  const focus =
    candidates.length < 2
      ? undefined
      : candidates.reduce<{ id: AreaId; v: number } | null>((best, a) => {
          const v = stats[a.id]?.best30 ?? 0;
          return !best || v < best.v ? { id: a.id, v } : best;
        }, null)?.id;

  // Weiter trainieren: verfügbare Module, Empfehlung = noch nie geübt oder schwächstes Niveau
  const latestNiveau: Record<string, number> = {};
  for (const s of sessions.filter(completed).sort((a, b) => (a.endedAt! < b.endedAt! ? -1 : 1)))
    for (const [m, sum] of Object.entries(s.summary)) latestNiveau[m] = sum.niveau;
  const stateById = Object.fromEntries(states.map((s) => [s.moduleId, s]));
  const available = MODULES.filter(isAvailable)
    .map((m) => ({ m, niveau: latestNiveau[m.id] ?? -1, st: stateById[m.id] }))
    .sort((a, b) => a.niveau - b.niveau);

  const recent = sessions
    .filter(completed)
    .sort((a, b) => (a.endedAt! < b.endedAt! ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="page">
      {loadedSettings && !settings.disclaimerDismissed && (
        <div className="notice" role="note">
          <p>
            <strong>
              Übungsaufgaben zu öffentlich bekannten Aufgabentypen, keine Originalaufgaben.
            </strong>{' '}
            <span className="muted">
              Die App trainiert Formate, Regeln und Tempo. Sie sagt kein Testergebnis voraus.
            </span>
          </p>
          <span className="spacer" />
          <button
            className="btn small"
            onClick={() => void saveSettings({ disclaimerDismissed: true })}
          >
            Verstanden
          </button>
        </div>
      )}

      <div className="row" style={{ alignItems: 'flex-end', marginBottom: 18 }}>
        <div>
          <div className="eyebrow">Lage · KW {isoWeek(now)}</div>
          <h1 style={{ marginBottom: 4 }}>Heute</h1>
          <div className="muted">
            {now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
        <span className="spacer" />
        {countdown !== null && countdown >= 0 ? (
          <div className="countdown-chip" title="Tage bis zum Testtermin">
            <span className="v tnum">T−{countdown}</span>
            <span className="l">Tage bis zum PFV</span>
          </div>
        ) : (
          loadedSettings &&
          !settings.testDate && (
            <a className="btn small" href="#/einstellungen">
              Testtermin festlegen
            </a>
          )
        )}
      </div>

      <div className="hero">
        <section className="card week-card" aria-label="Diese Woche">
          <div className="row" style={{ marginBottom: 14 }}>
            <h2 style={{ margin: 0 }}>Diese Woche</h2>
            <span className="spacer" />
            {serie > 0 && (
              <span className="streak" title="Trainingstage in Folge (Ruhetage zählen nicht)">
                <FlameIcon /> {serie} {serie === 1 ? 'Tag' : 'Tage'} in Folge
              </span>
            )}
          </div>
          <div className="week-grid">
            {week.map((d, i) => (
              <DayTile key={d.key} d={d} name={DAY_NAMES[i]} />
            ))}
          </div>
          <div className="week-progress">
            <div className="bar" aria-hidden>
              <div style={{ width: `${Math.min(100, (trainedDays / plannedDays) * 100)}%` }} />
            </div>
            <span className="muted small tnum">
              {trainedDays} von {plannedDays} Trainingstagen
            </span>
          </div>
        </section>

        <section className="card next-card" aria-label="Weiter trainieren">
          <h2>Weiter trainieren</h2>
          <ul className="list">
            {available.map(({ m, niveau, st }, i) => (
              <li key={m.id}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <strong>{m.name}</strong>
                    {i === 0 && <span className="pill accent">Empfohlen</span>}
                  </div>
                  <div className="muted small">
                    {niveau < 0
                      ? 'noch nicht geübt'
                      : `Niveau ${niveau} % · Stufe ${st?.levelLernen ?? 1}`}
                  </div>
                </div>
                <button
                  className={'btn small' + (i === 0 ? ' primary' : '')}
                  onClick={() => navigate(`modul/${m.id}/lernen`)}
                >
                  Üben
                </button>
                <button className="btn small" onClick={() => navigate(`modul/${m.id}/test`)}>
                  Test
                </button>
              </li>
            ))}
          </ul>
          <p className="muted small" style={{ margin: '10px 0 0' }}>
            Tageseinheit mit {settings.dailyMinutes} min und Wochenplan folgen in Meilenstein 7.
          </p>
        </section>
      </div>

      <div className="stat-row" style={{ marginTop: 14 }}>
        <div className="stat">
          <div className="v">{weekN}</div>
          <div className="l">Aufgaben diese Woche</div>
        </div>
        <div className="stat">
          <div className="v">{weekN ? Math.round((weekCorrect / weekN) * 100) : 0} %</div>
          <div className="l">Trefferquote diese Woche</div>
        </div>
        <div className="stat">
          <div className="v">{weekMin} min</div>
          <div className="l">Trainingszeit diese Woche</div>
        </div>
        <div className="stat">
          <div className="v">{serie}</div>
          <div className="l">Tage in Folge</div>
        </div>
      </div>

      <div className="section">
        <div className="row" style={{ alignItems: 'baseline' }}>
          <h2>Bereiche</h2>
          <span className="muted small">Prozentwert = Bestwert der letzten 30 Tage</span>
        </div>
        <div className="grid cols-2">
          {AREAS.map((a) => {
            const st = stats[a.id];
            const mods = modulesOfArea(a.id);
            const best = st?.best30 ?? 0;
            const trainable = mods.some(isAvailable);
            return (
              <button
                key={a.id}
                className={
                  'card area-card' + (focus === a.id ? ' fokus' : '') + (trainable ? '' : ' locked')
                }
                style={{ textAlign: 'left', cursor: 'pointer' }}
                onClick={() => navigate('bibliothek?bereich=' + a.id)}
              >
                <div className="icon">
                  <AreaIcon icon={a.icon} />
                </div>
                <div className="title">
                  {a.name}
                  {focus === a.id && <span className="tag-fokus">FOKUS</span>}
                </div>
                <div className="pct tnum">{best} %</div>
                <div className="bar" aria-hidden>
                  <div style={{ width: `${best}%` }} />
                </div>
                <div className="sub">
                  {trainable
                    ? `${st?.practiced ?? 0} von ${mods.length} Modulen geübt`
                    : `folgt in Meilenstein ${Math.min(...mods.map((m) => m.milestone))}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="section">
        <h2>Zuletzt</h2>
        {recent.length === 0 ? (
          <p className="muted">
            Noch keine abgeschlossenen Durchgänge. Starte oben bei „Weiter trainieren“.
          </p>
        ) : (
          <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <ul className="list">
              {recent.flatMap((s) =>
                Object.entries(s.summary).map(([m, sum]) => (
                  <li key={s.id + m}>
                    <div style={{ flex: 1 }}>
                      <div>{MODULE_BY_ID[m]?.name ?? m}</div>
                      <div className="muted small">
                        {new Date(s.endedAt!).toLocaleString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {s.mode === 'lernen' ? 'Lernmodus' : 'Testmodus'}
                        {s.belastet ? ' · belastet' : ''}
                      </div>
                    </div>
                    <span className="pill">{difficultyLabel(sum.endLevel)}</span>
                    <span className="tnum" style={{ minWidth: 110, textAlign: 'right' }}>
                      Niveau <strong>{sum.niveau} %</strong>
                    </span>
                    <span className="tnum muted" style={{ minWidth: 70, textAlign: 'right' }}>
                      {sum.trefferquote} % richtig
                    </span>
                  </li>
                )),
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
