import { useRef, useState } from 'react';
import { getSettings, saveSettings } from '../../db/db';
import { useLive } from '../hooks';
import { DEFAULT_SETTINGS, type Settings } from '../../core/types';
import { MODULES, MODULE_BY_ID, isAvailable } from '../../modules/catalog';
import { DEFAULT_WEEK_PLAN, ESTIMATE } from '../../core/plan';
import {
  deleteAll,
  downloadFile,
  exportAll,
  importAll,
  validateExport,
} from '../../db/exportImport';

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

export function Einstellungen() {
  const settings = useLive<Settings | null>(getSettings, [], null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  if (!settings) return <div className="page muted">Lädt …</div>;
  const set = (patch: Partial<Settings>) => void saveSettings(patch);

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <h1>Einstellungen</h1>

      <section className="card section" style={{ marginTop: 0 }}>
        <h2>Darstellung</h2>
        <label className="field" style={{ marginBottom: 0 }}>
          <span>Farbschema</span>
          <select
            value={settings.theme}
            onChange={(e) => set({ theme: e.target.value as Settings['theme'] })}
          >
            <option value="system">Wie das Betriebssystem</option>
            <option value="hell">Hell</option>
            <option value="dunkel">Dunkel</option>
          </select>
        </label>
        <label className="check" style={{ marginTop: 14, marginBottom: 0 }}>
          <input
            type="checkbox"
            checked={settings.devTools}
            onChange={(e) => set({ devTools: e.target.checked })}
          />
          Entwicklerwerkzeuge (Debug-Seite mit Beispielaufgaben und Lösungen)
        </label>
      </section>

      <section className="card section">
        <h2>Training</h2>
        <label className="field">
          <span>Testtermin</span>
          <input
            type="date"
            value={settings.testDate ?? ''}
            onChange={(e) => set({ testDate: e.target.value || null })}
          />
        </label>
        <label className="field">
          <span>Tägliche Dauer</span>
          <select
            value={settings.dailyMinutes}
            onChange={(e) =>
              set({ dailyMinutes: Number(e.target.value) as Settings['dailyMinutes'] })
            }
          >
            <option value={5}>5 Minuten</option>
            <option value={8}>8 Minuten</option>
            <option value={10}>10 Minuten</option>
          </select>
        </label>
        <label className="field">
          <span>Ruhetag</span>
          <select
            value={settings.restDay}
            onChange={(e) => set({ restDay: Number(e.target.value) })}
          >
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <option key={d} value={d}>
                {WEEKDAYS[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.timeLimitInLearning}
            onChange={(e) => set({ timeLimitInLearning: e.target.checked })}
          />
          Zeitlimit auch im Lernmodus
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.kopfrechnenAuswahlImTest}
            onChange={(e) => set({ kopfrechnenAuswahlImTest: e.target.checked })}
          />
          Kopfrechnen im Testmodus mit 4 Auswahlantworten
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.sound}
            onChange={(e) => set({ sound: e.target.checked })}
          />
          Ton an (wird ab den Reaktionstests genutzt)
        </label>
      </section>

      <WeekPlanEditor settings={settings} />
      <KeyMapEditor settings={settings} />

      <section className="card section">
        <h2>Daten</h2>
        <p className="muted small">
          Alles wird nur lokal in diesem Browser gespeichert. Der Browser-Speicher kann verloren
          gehen, daher regelmäßig exportieren.
        </p>
        <div className="row">
          <button
            className="btn"
            onClick={async () => {
              downloadFile(
                `pfv-trainer-${new Date().toISOString().slice(0, 10)}.json`,
                JSON.stringify(await exportAll(), null, 1),
                'application/json',
              );
              setMsg('Export erstellt.');
            }}
          >
            Daten exportieren
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Daten importieren
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const data = JSON.parse(await f.text());
                const errs = validateExport(data);
                if (errs.length) {
                  setMsg('Import abgelehnt: ' + errs.join(' '));
                  return;
                }
                if (
                  !window.confirm(
                    'Import ersetzt alle vorhandenen Daten in diesem Browser. Fortfahren?',
                  )
                )
                  return;
                await importAll(data);
                setMsg(
                  `Import abgeschlossen: ${data.data.attempts.length} Antworten, ${data.data.sessions.length} Durchgänge.`,
                );
              } catch (err) {
                setMsg(
                  'Import fehlgeschlagen: ' + (err instanceof Error ? err.message : String(err)),
                );
              }
            }}
          />
          <span className="spacer" />
          <button
            className="btn danger"
            onClick={async () => {
              if (
                !window.confirm(
                  'Wirklich ALLE Daten löschen? Das lässt sich nicht rückgängig machen.',
                )
              )
                return;
              const typed = window.prompt('Zur Bestätigung LÖSCHEN eintippen:');
              if (typed?.trim().toUpperCase() !== 'LÖSCHEN') {
                setMsg('Löschen abgebrochen.');
                return;
              }
              await deleteAll();
              setMsg('Alle Daten gelöscht.');
            }}
          >
            Alle Daten löschen
          </button>
        </div>
        {msg && (
          <p className="small" role="status" style={{ marginTop: 12, marginBottom: 0 }}>
            {msg}
          </p>
        )}
      </section>
    </div>
  );
}

/** Wochenplan: je Tag Module der Tageseinheit (70 % der Zeit). */
function WeekPlanEditor({ settings }: { settings: Settings }) {
  const plan = settings.weekPlan;
  const avail = MODULES.filter(isAvailable);
  const update = (day: number, mods: string[]) =>
    void saveSettings({ weekPlan: { ...plan, [String(day)]: mods } });
  return (
    <section className="card section">
      <div className="row">
        <h2 style={{ margin: 0 }}>Wochenplan</h2>
        <span className="spacer" />
        <button
          className="linklike"
          onClick={() => void saveSettings({ weekPlan: DEFAULT_WEEK_PLAN })}
        >
          Standard wiederherstellen
        </button>
      </div>
      <p className="muted small">
        Diese Module füllen rund 70 % der Tageseinheit, der Rest geht an deine schwächsten Regeln.
        Lange Blöcke (zum Beispiel Durchstreichtest) passen nur in längere Einheiten.
      </p>
      <div className="stack">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const mods = plan[String(d)] ?? [];
          return (
            <div key={d} className="plan-row">
              <div className="plan-day">
                {WEEKDAYS[d]}
                {d === settings.restDay && <span className="muted small"> · Ruhetag</span>}
              </div>
              <div className="plan-mods">
                {mods.map((m) => (
                  <span key={m} className="chip">
                    {MODULE_BY_ID[m]?.name ?? m}
                    {ESTIMATE[m]?.block && <span className="muted"> (Block)</span>}
                    <button
                      className="chip-x"
                      aria-label={`${MODULE_BY_ID[m]?.name ?? m} entfernen`}
                      onClick={() =>
                        update(
                          d,
                          mods.filter((x) => x !== m),
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
                <select
                  className="chip-add"
                  value=""
                  aria-label={`Modul für ${WEEKDAYS[d]} hinzufügen`}
                  onChange={(e) => e.target.value && update(d, [...mods, e.target.value])}
                >
                  <option value="">+ Modul</option>
                  {avail
                    .filter((m) => !mods.includes(m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const DT_NAMES = ['Rot', 'Gelb', 'Grün', 'Blau', 'Weiß', 'Hoher Ton', 'Tiefer Ton'];
const keyLabel = (k: string) => (k === ' ' ? 'Leertaste' : k.toUpperCase());

/** Tastenbelegung des Determinationstests: Feld anklicken, dann Taste drücken. */
function KeyMapEditor({ settings }: { settings: Settings }) {
  const [active, setActive] = useState<number | null>(null);
  const keys = settings.dtKeys;
  const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
  return (
    <section className="card section">
      <div className="row">
        <h2 style={{ margin: 0 }}>Tastenbelegung Determinationstest</h2>
        <span className="spacer" />
        <button
          className="linklike"
          onClick={() => void saveSettings({ dtKeys: DEFAULT_SETTINGS.dtKeys })}
        >
          Standard wiederherstellen
        </button>
      </div>
      <p className="muted small">Feld anklicken, dann die gewünschte Taste drücken.</p>
      <div className="keymap">
        {DT_NAMES.map((n, i) => (
          <label key={n} className="keymap-row">
            <span>{n}</span>
            <button
              className={'btn small keycap' + (active === i ? ' selected' : '')}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (active !== i || e.key === 'Tab' || e.key === 'Escape') return;
                e.preventDefault();
                if (e.key.length !== 1) return;
                const next = [...keys];
                next[i] = e.key.toLowerCase();
                void saveSettings({ dtKeys: next });
                setActive(null);
              }}
              onBlur={() => setActive((a) => (a === i ? null : a))}
            >
              {active === i ? 'Taste drücken …' : keyLabel(keys[i])}
            </button>
          </label>
        ))}
      </div>
      {dup.length > 0 && (
        <p className="small" style={{ color: 'var(--bad)' }}>
          Doppelt belegt: {[...new Set(dup)].map(keyLabel).join(', ')}. Jede Taste darf nur einmal
          vorkommen.
        </p>
      )}
    </section>
  );
}
