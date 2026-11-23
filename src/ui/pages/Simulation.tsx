import { db, getSettings, saveSettings } from '../../db/db';
import { navigate, useLive } from '../hooks';
import { KURZSIM, VOLLSIM, simMinutes } from '../../core/simulation';
import type { Session, Settings } from '../../core/types';

/** Abgeschlossene Simulationen (je Gruppe der früheste Teil). */
function simGroups(sessions: Session[]) {
  const map = new Map<string, Session[]>();
  for (const s of sessions)
    if ((s.type === 'kurzsim' || s.type === 'vollsim') && s.groupId)
      map.set(s.groupId, [...(map.get(s.groupId) ?? []), s]);
  return [...map.entries()]
    .map(([groupId, list]) => ({
      groupId,
      type: list[0].type,
      startedAt: list.map((s) => s.startedAt).sort()[0],
      complete: list.some((s) => s.groupDone),
      parts: list.length,
    }))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
}

export function Simulation() {
  const settings = useLive<Settings | null>(getSettings, [], null);
  const sessions = useLive(() => db.sessions.toArray(), [], [] as Session[]);
  const groups = simGroups(sessions);
  return (
    <div className="page">
      <h1>Simulation</h1>
      <p className="muted">
        Längere Durchgänge unter Testbedingungen: Testmodus, Zeitlimit, keine Rückmeldung. Vor jedem
        Block steht eine Anleitungsseite.
      </p>
      <div className="grid cols-2">
        <div className="card sim-card">
          <h2>Kurzsimulation</h2>
          <p className="muted small">
            {simMinutes(KURZSIM)} min ohne Pause:{' '}
            {KURZSIM.blocks.map((b) => `${b.name} ${b.minutes}`).join(', ')} min.
          </p>
          <button className="btn primary" onClick={() => navigate('sim/kurz')}>
            Starten
          </button>
        </div>
        <div className="card sim-card">
          <h2>Vollsimulation</h2>
          <p className="muted small">
            9 Blöcke, {simMinutes(VOLLSIM)} min Aufgabenzeit (etwa 2,5 Stunden), am Ende 30 min
            Vigilanz.
          </p>
          {settings && (
            <label className="field" style={{ marginBottom: 10 }}>
              <span>Pausen zwischen den Blöcken</span>
              <select
                value={settings.simPause}
                onChange={(e) =>
                  void saveSettings({ simPause: e.target.value as Settings['simPause'] })
                }
              >
                <option value="5">5 Minuten</option>
                <option value="ernstfall">keine („Ernstfall“)</option>
              </select>
            </label>
          )}
          <button className="btn primary" onClick={() => navigate('sim/voll')}>
            Starten
          </button>
        </div>
        <div className="card sim-card">
          <h2>Vigilanz einzeln</h2>
          <p className="muted small">
            5 bis 45 min Vigilanz-Uhr mit Auswertung je Drittel. Dauer, Takt und Signalhäufigkeit
            wählst du auf dem Startbildschirm.
          </p>
          <button className="btn" onClick={() => navigate('modul/vigilanz/test')}>
            Öffnen
          </button>
        </div>
        <div className="card sim-card">
          <h2>Belastungsmodus</h2>
          <p className="muted small">
            Aufgaben direkt nach körperlicher Belastung: geführte Intervalle in der App, eigene
            Belastung oder im Wechsel. Vergleich ausgeruht gegen belastet im Fortschritt.
          </p>
          <button className="btn" onClick={() => navigate('belastung')}>
            Öffnen
          </button>
        </div>
      </div>

      <section className="section">
        <h2>Bisherige Simulationen</h2>
        {groups.length === 0 ? (
          <p className="muted">Noch keine.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Art</th>
                  <th>Stand</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.groupId}>
                    <td>
                      {new Date(g.startedAt).toLocaleString('de-DE', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td>{g.type === 'vollsim' ? 'Vollsimulation' : 'Kurzsimulation'}</td>
                    <td>{g.complete ? 'vollständig' : `abgebrochen (${g.parts} Teile)`}</td>
                    <td>
                      <button
                        className="linklike"
                        onClick={() => navigate(`sim/bericht/${g.groupId}`)}
                      >
                        Bericht
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
