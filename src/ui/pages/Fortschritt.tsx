import { useState } from 'react';
import { db } from '../../db/db';
import { useLive } from '../hooks';
import { MODULES, MODULE_BY_ID, isAvailable, tagName } from '../../modules/catalog';
import { completed, dayStats, tagStats } from '../../core/progress';
import { LineChart } from '../components/LineChart';
import { attemptsToCsv, downloadFile, exportAll } from '../../db/exportImport';

const pct = (x: number) => Math.round(x * 100) + ' %';
const stamp = () => new Date().toISOString().slice(0, 10);

export function Fortschritt() {
  const sessions = useLive(() => db.sessions.toArray(), [], []);
  const attempts = useLive(() => db.attempts.toArray(), [], []);
  const reports = useLive(() => db.reports.toArray(), [], []);
  const [moduleId, setModuleId] = useState<string>('alle');
  const [onlyTest, setOnlyTest] = useState(false);

  const mods = MODULES.filter((m) => isAvailable(m) || attempts.some((a) => a.moduleId === m.id));
  const done = sessions
    .filter(completed)
    .filter((s) => !onlyTest || s.mode !== 'lernen')
    .sort((a, b) => (a.endedAt! < b.endedAt! ? -1 : 1));
  const selMods = moduleId === 'alle' ? mods.map((m) => m.id) : [moduleId];
  const filteredAttempts = attempts.filter(
    (a) => selMods.includes(a.moduleId) && (!onlyTest || a.mode !== 'lernen'),
  );
  const tags = tagStats(filteredAttempts);
  const days = dayStats(filteredAttempts).slice(0, 14);

  return (
    <div className="page">
      <div className="row">
        <h1 style={{ margin: 0 }}>Fortschritt</h1>
        <span className="spacer" />
        <button
          className="btn small"
          onClick={async () =>
            downloadFile(
              `pfv-trainer-${stamp()}.json`,
              JSON.stringify(await exportAll(), null, 1),
              'application/json',
            )
          }
        >
          Export JSON
        </button>
        <button
          className="btn small"
          onClick={() =>
            downloadFile(
              `pfv-antworten-${stamp()}.csv`,
              '﻿' + attemptsToCsv(attempts),
              'text/csv;charset=utf-8',
            )
          }
        >
          Export CSV
        </button>
      </div>

      <div className="row section" style={{ marginTop: 18 }}>
        <label className="field" style={{ margin: 0 }}>
          <span>Modul</span>
          <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            <option value="alle">Alle Module</option>
            {mods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check" style={{ margin: '18px 0 0' }}>
          <input
            type="checkbox"
            checked={onlyTest}
            onChange={(e) => setOnlyTest(e.target.checked)}
          />
          nur Testmodus
        </label>
      </div>

      {selMods.map((id) => {
        const list = done.filter((s) => s.summary[id]);
        if (moduleId === 'alle' && list.length === 0) return null;
        const pts = (f: (s: (typeof list)[number]) => number) =>
          list.map((s) => ({ x: new Date(s.endedAt!).getTime(), y: f(s) }));
        const maxMs = Math.max(10, ...list.map((s) => Math.ceil(s.summary[id].medianMs / 1000)));
        return (
          <section key={id} className="section card">
            <h2>{MODULE_BY_ID[id]?.name ?? id}</h2>
            {list.length === 0 ? (
              <p className="muted">Noch keine abgeschlossenen Durchgänge.</p>
            ) : (
              <div className="grid cols-3">
                <div>
                  <div className="muted small">Niveau</div>
                  <LineChart points={pts((s) => s.summary[id].niveau)} />
                </div>
                <div>
                  <div className="muted small">Trefferquote</div>
                  <LineChart points={pts((s) => s.summary[id].trefferquote)} color="#2E9E5B" />
                </div>
                <div>
                  <div className="muted small">Median-Zeit pro Aufgabe</div>
                  <LineChart
                    points={pts((s) => Math.round(s.summary[id].medianMs / 100) / 10)}
                    yMax={maxMs}
                    yLabel=" s"
                    color="#9fd3ff"
                  />
                </div>
              </div>
            )}
            {list.length > 0 && (
              <div style={{ overflowX: 'auto', marginTop: 10 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th>Modus</th>
                      <th className="num">Aufgaben</th>
                      <th className="num">Niveau</th>
                      <th className="num">Treffer</th>
                      <th className="num">Median</th>
                      <th className="num">Endstufe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list
                      .slice(-10)
                      .reverse()
                      .map((s) => {
                        const sum = s.summary[id];
                        return (
                          <tr key={s.id}>
                            <td>
                              {new Date(s.endedAt!).toLocaleString('de-DE', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </td>
                            <td>
                              {s.mode === 'lernen' ? 'Lernen' : 'Test'}
                              {s.belastet ? ' · belastet' : ''}
                            </td>
                            <td className="num tnum">{sum.anzahl}</td>
                            <td className="num tnum">{sum.niveau} %</td>
                            <td className="num tnum">{sum.trefferquote} %</td>
                            <td className="num tnum">
                              {(sum.medianMs / 1000).toLocaleString('de-DE', {
                                maximumFractionDigits: 1,
                              })}{' '}
                              s
                            </td>
                            <td className="num tnum">{sum.endLevel}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}

      <section className="section">
        <h2>Fehlerprotokoll nach Regel</h2>
        <p className="muted small">
          Die schwächsten Regeln stehen oben. „Schwächen üben“ folgt in Meilenstein 7.
        </p>
        {tags.length === 0 ? (
          <p className="muted">Noch keine Antworten.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Regel</th>
                  <th>Tag</th>
                  <th className="num">Aufgaben</th>
                  <th className="num">Fehler</th>
                  <th className="num">Fehlerquote</th>
                </tr>
              </thead>
              <tbody>
                {tags.map((t) => (
                  <tr key={t.tag}>
                    <td>{tagName(t.tag)}</td>
                    <td className="muted small">{t.tag}</td>
                    <td className="num tnum">{t.n}</td>
                    <td className="num tnum">{t.errors}</td>
                    <td
                      className="num tnum"
                      style={{ color: t.rate >= 0.5 ? '#ff7a74' : undefined }}
                    >
                      {pct(t.rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>Fehler pro Tag</h2>
        {days.length === 0 ? (
          <p className="muted">Noch keine Antworten.</p>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Tag</th>
                  <th className="num">Aufgaben</th>
                  <th className="num">Fehler</th>
                  <th className="num">Fehlerquote</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.day}>
                    <td>
                      {new Date(d.day + 'T12:00').toLocaleDateString('de-DE', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </td>
                    <td className="num tnum">{d.n}</td>
                    <td className="num tnum">{d.errors}</td>
                    <td className="num tnum">{pct(d.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="section">
        <h2>Ausgeruht gegen belastet</h2>
        <p className="muted">Der Vergleich kommt mit dem Belastungsmodus in Meilenstein 7.</p>
      </section>

      <section className="section">
        <div className="row">
          <h2 style={{ margin: 0 }}>Gemeldete Aufgaben ({reports.length})</h2>
          <span className="spacer" />
          {reports.length > 0 && (
            <button
              className="btn small"
              onClick={() =>
                downloadFile(
                  `pfv-meldungen-${stamp()}.json`,
                  JSON.stringify(reports, null, 1),
                  'application/json',
                )
              }
            >
              Meldungen exportieren
            </button>
          )}
        </div>
        {reports.length > 0 && (
          <div className="card" style={{ padding: 0, overflowX: 'auto', marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Modul</th>
                  <th>Aufgabe</th>
                  <th>Generator</th>
                  <th className="num">Seed</th>
                  <th className="num">Stufe</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.timestamp).toLocaleDateString('de-DE')}</td>
                    <td>{MODULE_BY_ID[r.moduleId]?.name ?? r.moduleId}</td>
                    <td>{r.promptText}</td>
                    <td className="small muted">
                      {r.generatorId} v{r.generatorVersion}
                    </td>
                    <td className="num tnum small">{r.seed}</td>
                    <td className="num tnum">{r.level}</td>
                    <td>
                      <button className="linklike" onClick={() => void db.reports.delete(r.id)}>
                        entfernen
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
