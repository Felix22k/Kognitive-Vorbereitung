import { useEffect } from 'react';
import { db } from '../../db/db';
import { useLive, navigate } from '../hooks';
import { AREAS, isAvailable, modulesOfArea } from '../../modules/catalog';
import { AreaIcon } from '../components/Icons';
import { difficultyLabel } from '../../core/progress';

export function Bibliothek() {
  const states = useLive(() => db.moduleStates.toArray(), [], []);
  const byId = Object.fromEntries(states.map((s) => [s.moduleId, s]));

  useEffect(() => {
    const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    const area = q.get('bereich');
    if (area)
      document
        .getElementById('bereich-' + area)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="page">
      <h1>Bibliothek</h1>
      <p className="muted">
        Alle Module nach Bereich. <strong>Üben</strong> = Lernmodus mit sofortigem Feedback und
        Erklärung. <strong>Test</strong> = Zeitlimit, kein Feedback bis zum Ende, adaptiv wie im
        echten Test.
      </p>
      <p className="mobile-note small muted">
        Hinweis: Der echte Test läuft am PC. Am Handy eignen sich vor allem Kopfrechnen,
        Zahlenreihen, Sprache und Gedächtnis.
      </p>
      {AREAS.map((a) => (
        <section key={a.id} id={'bereich-' + a.id} className="section">
          <h2 className="row" style={{ gap: 10 }}>
            <AreaIcon icon={a.icon} /> {a.name}
          </h2>
          <div className="grid cols-2">
            {modulesOfArea(a.id).map((m) => {
              const st = byId[m.id];
              const avail = isAvailable(m);
              const lvl = st?.levelTest ?? st?.levelLernen;
              return (
                <div key={m.id} className={'card module-row' + (avail ? '' : ' disabled')}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.name}</div>
                    <div className="muted small">{m.description}</div>
                    <div className="muted small" style={{ marginTop: 6 }}>
                      {avail ? (
                        st && st.attempts > 0 ? (
                          <>
                            Stufe Lernen {st.levelLernen}
                            {st.levelTest != null && <> · Stufe Test {st.levelTest}</>} (
                            {difficultyLabel(lvl ?? 1)}) · {st.solved} von {st.attempts} gelöst
                          </>
                        ) : (
                          'noch nicht geübt'
                        )
                      ) : (
                        <span className="pill">folgt in Meilenstein {m.milestone}</span>
                      )}
                    </div>
                  </div>
                  {avail && (
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <button className="btn" onClick={() => navigate(`modul/${m.id}/lernen`)}>
                        Üben
                      </button>
                      <button className="btn" onClick={() => navigate(`modul/${m.id}/test`)}>
                        Test
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
