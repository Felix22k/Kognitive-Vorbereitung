import { useRef, useState } from 'react';
import { getSettings, saveSettings } from '../../db/db';
import { useLive } from '../hooks';
import type { Settings } from '../../core/types';
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
        <p className="muted small" style={{ marginBottom: 0 }}>
          Wochenplan und Tastenbelegung folgen mit der Tageseinheit (Meilenstein 7) bzw. den
          Reaktionstests (Meilenstein 5).
        </p>
      </section>

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
