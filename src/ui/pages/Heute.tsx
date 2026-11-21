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
  weekDays,
} from '../../core/progress';
import { AreaIcon, CheckIcon } from '../components/Icons';
import { DEFAULT_SETTINGS, type AreaId, type Settings } from '../../core/types';

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function Heute() {
  const sessions = useLive(() => db.sessions.toArray(), [], []);
  const loadedSettings = useLive<Settings | null>(getSettings, [], null);
  const settings = loadedSettings ?? DEFAULT_SETTINGS;

  const now = new Date();
  const moduleArea = Object.fromEntries(MODULES.map((m) => [m.id, m.areaId])) as Record<
    string,
    AreaId
  >;
  const stats = areaStats(sessions, moduleArea, now);
  const doneDays = new Set(sessions.filter(completed).map((s) => dayKey(s.endedAt!)));
  const days = weekDays(now);
  const todayKey = dayKey(now);
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

  const recent = sessions
    .filter(completed)
    .sort((a, b) => (a.endedAt! < b.endedAt! ? 1 : -1))
    .slice(0, 6);

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
          <div className="countdown" title="Tage bis zum Testtermin">
            <span className="v">T−{countdown}</span>
            <span className="muted small">Tage bis zum PFV</span>
          </div>
        ) : (
          loadedSettings &&
          !settings.testDate && (
            <a className="muted small" href="#/einstellungen">
              Testtermin festlegen
            </a>
          )
        )}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="week" aria-label="Wochenübersicht">
          {days.map((d, i) => {
            const k = dayKey(d);
            const rest = d.getDay() === settings.restDay;
            const done = doneDays.has(k);
            return (
              <div key={k} className={'day' + (k === todayKey ? ' today' : '')}>
                <div
                  className={'dot' + (done ? ' done' : rest ? ' rest' : '')}
                  title={done ? 'erledigt' : rest ? 'Ruhetag' : 'offen'}
                >
                  {done && <CheckIcon />}
                </div>
                {DAY_NAMES[i]}
              </div>
            );
          })}
        </div>
      </div>

      <button className="btn big" disabled title="Folgt in Meilenstein 7">
        <span style={{ textAlign: 'left' }}>
          Tageseinheit starten
          <span className="muted small" style={{ display: 'block', fontWeight: 400 }}>
            {settings.dailyMinutes} min · Tageseinheit, Wochenplan und Phasen folgen in Meilenstein
            7. Bis dahin einzelne Module in der Bibliothek üben.
          </span>
        </span>
        <span>→</span>
      </button>

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
            return (
              <button
                key={a.id}
                className={'card area-card' + (focus === a.id ? ' fokus' : '')}
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
                  {st?.practiced ?? 0} von {mods.length} Modulen geübt
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
            Noch keine abgeschlossenen Durchgänge. Starte in der Bibliothek mit einem Modul.
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
