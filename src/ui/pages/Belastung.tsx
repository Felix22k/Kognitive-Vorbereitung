import { useEffect, useRef, useState } from 'react';
import { navigate } from '../hooks';
import { MODULES, MODULE_BY_ID, isAvailable } from '../../modules/catalog';
import { ESTIMATE } from '../../core/plan';
import { uid } from '../../core/ids';
import { playTone, unlockAudio } from '../../core/audio';
import type { Session } from '../../core/types';
import { SessionRunner } from '../../session/SessionRunner';
import { markGroupDone } from '../../session/persist';

type Protokoll = 'extern' | 'app' | 'wechsel';

const EXERCISES = ['Burpees', 'Strecksprünge', 'Bergsteiger', 'Hampelmann', 'Liegestütze'];

/** Intervalle: Belastung und Erholung in Sekunden */
const APP_INTERVALS = { rounds: 4, work: 40, rest: 20 };
const WECHSEL = { rounds: 3, work: 60 };

interface Interval {
  label: string;
  sec: number;
  work: boolean;
}

function IntervalTimer({ plan: initial, onDone }: { plan: Interval[]; onDone: () => void }) {
  const [plan] = useState(initial);
  const done = useRef(onDone);
  done.current = onDone;
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(plan[0]?.sec ?? 0);
  const end = useRef(Date.now() + (plan[0]?.sec ?? 0) * 1000);
  useEffect(() => {
    playTone(plan[0]?.work ? 880 : 440, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = window.setInterval(() => {
      const ms = end.current - Date.now();
      if (ms <= 0) {
        const next = i + 1;
        if (next >= plan.length) {
          playTone(660, 500);
          window.clearInterval(t);
          done.current();
          return;
        }
        playTone(plan[next].work ? 880 : 440, 300);
        end.current = Date.now() + plan[next].sec * 1000;
        setI(next);
        setLeft(plan[next].sec);
      } else setLeft(Math.ceil(ms / 1000));
    }, 200);
    return () => window.clearInterval(t);
  }, [i, plan]);
  const cur = plan[i];
  if (!cur) return null;
  return (
    <div className={'interval ' + (cur.work ? 'work' : 'rest')}>
      <div className="small muted">
        Intervall {i + 1} von {plan.length}
      </div>
      <div className="interval-label">{cur.label}</div>
      <div className="countdown-big tnum">{left}</div>
      <div className="small muted">
        {plan[i + 1] ? `danach: ${plan[i + 1].label}` : 'danach: Aufgaben'}
      </div>
    </div>
  );
}

export function Belastung() {
  const items = MODULES.filter((m) => isAvailable(m) && !ESTIMATE[m.id]?.block);
  const [step, setStep] = useState<'form' | 'load' | 'puls' | 'run' | 'done'>('form');
  const [moduleId, setModuleId] = useState('kopfrechnen');
  const [protokoll, setProtokoll] = useState<Protokoll>('app');
  const [muedigkeit, setMuedigkeit] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [schlaf, setSchlaf] = useState('7');
  const [puls, setPuls] = useState('');
  const [gesund, setGesund] = useState(false);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState<Session[]>([]);
  const groupId = useRef(uid('g-'));

  const mod = MODULE_BY_ID[moduleId];
  const totalItems = mod?.itemsTest ?? 12;
  const rounds = protokoll === 'wechsel' ? WECHSEL.rounds : 1;
  const perRound = Math.max(3, Math.ceil(totalItems / rounds));

  const loadPlan = (): Interval[] => {
    if (protokoll === 'wechsel')
      return [{ label: EXERCISES[round % EXERCISES.length], sec: WECHSEL.work, work: true }];
    const list: Interval[] = [];
    for (let r = 0; r < APP_INTERVALS.rounds; r++) {
      list.push({ label: EXERCISES[r % EXERCISES.length], sec: APP_INTERVALS.work, work: true });
      if (r < APP_INTERVALS.rounds - 1)
        list.push({ label: 'Pause', sec: APP_INTERVALS.rest, work: false });
    }
    return list;
  };

  if (step === 'run')
    return (
      <SessionRunner
        key={round}
        moduleId={moduleId}
        mode="test"
        belastet
        onExit={() => navigate('simulation')}
        embed={{
          sessionType: 'modul',
          count: protokoll === 'wechsel' ? perRound : undefined,
          autoStart: true,
          groupId: groupId.current,
          label: protokoll === 'wechsel' ? `Belastet · Runde ${round + 1}/${rounds}` : 'Belastet',
          sessionExtra: {
            puls: puls ? Number(puls) : undefined,
            muedigkeit,
            schlafStunden: schlaf ? Number(schlaf.replace(',', '.')) : undefined,
            protokoll,
          },
          onDone: (s) => {
            setDone((d) => [...d, s]);
            if (round + 1 < rounds) {
              setRound(round + 1);
              setStep('load');
            } else {
              void markGroupDone(s.id);
              setStep('done');
            }
          },
        }}
      />
    );

  if (step === 'load')
    return (
      <div className="page" style={{ maxWidth: 640, textAlign: 'center' }}>
        <h1>Belastung</h1>
        {protokoll === 'extern' ? (
          <>
            <p>
              Belaste dich jetzt selbst, zum Beispiel 3 Minuten Burpees, Sprints oder Treppenläufe,
              bis du deutlich außer Atem bist. Danach sofort weiter.
            </p>
            <button className="btn primary" autoFocus onClick={() => setStep('puls')}>
              Belastung beendet
            </button>
          </>
        ) : (
          <IntervalTimer plan={loadPlan()} onDone={() => setStep(round === 0 ? 'puls' : 'run')} />
        )}
        <div className="section">
          <button className="linklike" onClick={() => navigate('simulation')}>
            Abbrechen
          </button>
        </div>
      </div>
    );

  if (step === 'puls')
    return (
      <div className="page" style={{ maxWidth: 560 }}>
        <h1>Puls</h1>
        <p className="muted">
          Optional: Puls jetzt 15 Sekunden zählen und mal 4 nehmen, oder von der Uhr ablesen.
        </p>
        <label className="field">
          <span>Puls (Schläge pro Minute)</span>
          <input
            type="number"
            inputMode="numeric"
            min={40}
            max={230}
            value={puls}
            onChange={(e) => setPuls(e.target.value)}
            autoFocus
          />
        </label>
        <button className="btn primary" onClick={() => setStep('run')}>
          Aufgaben starten
        </button>
      </div>
    );

  if (step === 'done')
    return (
      <div className="page" style={{ maxWidth: 760 }}>
        <h1>Belastungstest erledigt</h1>
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Runde</th>
                <th className="num">Aufgaben</th>
                <th className="num">Treffer</th>
                <th className="num">Median</th>
              </tr>
            </thead>
            <tbody>
              {done.map((s, i) => {
                const sum = s.summary[moduleId];
                return (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td className="num tnum">{sum?.anzahl ?? 0}</td>
                    <td className="num tnum">{sum?.trefferquote ?? 0} %</td>
                    <td className="num tnum">
                      {sum
                        ? (sum.medianMs / 1000).toLocaleString('de-DE', {
                            maximumFractionDigits: 1,
                          }) + ' s'
                        : '–'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Den Vergleich mit ausgeruhten Durchgängen findest du unter Fortschritt → „Ausgeruht gegen
          belastet“.
        </p>
        <div className="row">
          <button className="btn primary" onClick={() => navigate('fortschritt')} autoFocus>
            Zum Vergleich
          </button>
          <button className="btn" onClick={() => navigate('simulation')}>
            Zurück
          </button>
        </div>
      </div>
    );

  // Formular
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <button className="linklike" onClick={() => navigate('simulation')}>
        ← zurück
      </button>
      <h1 style={{ marginTop: 12 }}>Belastungsmodus</h1>
      <div className="notice" role="note">
        <p style={{ margin: 0 }}>
          <strong>Nur wenn du gesund bist.</strong> Bei Schwindel, Brustschmerz, Atemnot oder
          Unwohlsein sofort aufhören. Kein Ersatz für ärztlichen Rat.
        </p>
      </div>
      <div className="card stack section">
        <label className="field">
          <span>Aufgaben (Testmodus)</span>
          <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            {items.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="field">
          <span>Ablauf</span>
          {(
            [
              [
                'app',
                `Geführt in der App: ${APP_INTERVALS.rounds} × ${APP_INTERVALS.work} s Belastung, ${APP_INTERVALS.rest} s Pause, dann ${totalItems} Aufgaben`,
              ],
              ['extern', `Eigene Belastung (z. B. Lauf), dann ${totalItems} Aufgaben`],
              [
                'wechsel',
                `Im Wechsel: ${WECHSEL.rounds} × (${WECHSEL.work} s Belastung, dann ${perRound} Aufgaben)`,
              ],
            ] as const
          ).map(([v, l]) => (
            <label key={v} className="check">
              <input
                type="radio"
                name="protokoll"
                checked={protokoll === v}
                onChange={() => setProtokoll(v)}
              />
              {l}
            </label>
          ))}
        </fieldset>
        <fieldset className="field">
          <span>Müdigkeit vor dem Test (1 = frisch, 5 = sehr müde)</span>
          <div className="row">
            {([1, 2, 3, 4, 5] as const).map((v) => (
              <label key={v} className="check">
                <input
                  type="radio"
                  name="muede"
                  checked={muedigkeit === v}
                  onChange={() => setMuedigkeit(v)}
                />
                {v}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span>Schlaf letzte Nacht (Stunden)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={14}
            step={0.5}
            value={schlaf}
            onChange={(e) => setSchlaf(e.target.value)}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={gesund} onChange={(e) => setGesund(e.target.checked)} />
          Ich bin gesund und belastbar.
        </label>
      </div>
      <div className="row section">
        <button
          className="btn primary"
          disabled={!gesund}
          onClick={() => {
            unlockAudio();
            setRound(0);
            setDone([]);
            setStep('load');
          }}
        >
          Belastung starten
        </button>
      </div>
    </div>
  );
}
