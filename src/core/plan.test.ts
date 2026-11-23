import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  DEFAULT_WEEK_PLAN,
  daySeed,
  ESTIMATE,
  phaseFor,
  planDay,
  weakTags,
  weekDone,
} from './plan';
import { trainedDayKeys } from './progress';
import { KURZSIM, VOLLSIM, simMinutes } from './simulation';
import { MODULES, MODULE_BY_ID, isAvailable } from '../modules/catalog';
import type { Attempt, Session } from './types';

const ALL = MODULES.filter(isAvailable).map((m) => m.id);

function att(moduleId: string, tag: string, correct: boolean, ts: string, level = 4): Attempt {
  return {
    id: Math.random().toString(36),
    sessionId: 's',
    itemId: 'i',
    moduleId,
    mode: 'lernen',
    generatorId: moduleId,
    generatorVersion: 1,
    seed: 1,
    level,
    tags: [tag],
    answer: null,
    answerLabel: '',
    correctAnswer: null,
    correctLabel: '',
    correct,
    timedOut: false,
    rtMs: 1000,
    timestamp: ts,
    belastet: false,
  };
}

function ses(p: Partial<Session> & { endedAt: string }): Session {
  return {
    id: Math.random().toString(36),
    type: 'modul',
    mode: 'lernen',
    moduleIds: ['kopfrechnen'],
    startedAt: new Date(new Date(p.endedAt).getTime() - 6 * 60000).toISOString(),
    belastet: false,
    summary: {
      kopfrechnen: { niveau: 50, trefferquote: 80, medianMs: 1000, anzahl: 5, endLevel: 5 },
    },
    ...p,
  };
}

describe('Phasen', () => {
  const now = new Date('2026-11-23T10:00:00');
  it('ordnen die Wochen bis zum Test richtig zu', () => {
    expect(phaseFor(null, now).id).toBe('ohne');
    expect(phaseFor('2027-03-01', now).id).toBe('grundlage');
    expect(phaseFor('2027-01-10', now).id).toBe('aufbau');
    expect(phaseFor('2026-12-10', now).id).toBe('peak');
    expect(phaseFor('2026-11-28', now).id).toBe('taper');
    expect(phaseFor('2026-11-25', now).goals.kurzsim).toBe(0); // letzte 3 Tage
    expect(phaseFor('2026-11-01', now).id).toBe('ohne');
  });
  it('Peak verlangt Simulationen und Belastung', () => {
    const g = phaseFor('2026-12-10', now).goals;
    expect(g.vollsim).toBe(1);
    expect(g.kurzsim).toBeGreaterThan(0);
    expect(g.belastung).toBe(1);
  });
});

describe('Tageseinheit', () => {
  const monday = new Date('2026-11-23T10:00:00');
  const base = {
    now: monday,
    minutes: 8,
    restDay: 0,
    weekPlan: DEFAULT_WEEK_PLAN,
    available: ALL,
    attempts: [] as Attempt[],
    lastPlayed: {},
  };

  it('Montag: Kopfrechnen und Zahlenreihen aus dem Plan, dazu ein Fokus-Teil', () => {
    const u = planDay({ ...base, rng: createRng(1) });
    const plan = u.parts.filter((p) => p.reason === 'plan').map((p) => p.moduleId);
    expect(plan).toEqual(['kopfrechnen', 'zahlenreihen']);
    expect(u.parts.filter((p) => p.reason === 'fokus')).toHaveLength(1);
    // Gesamtzeit nahe am Ziel (8 min), höchstens gut ein Drittel darüber
    expect(u.totalSec).toBeGreaterThan(5 * 60);
    expect(u.totalSec).toBeLessThan(11 * 60);
    // etwa 70 % Plan
    const planSec = u.parts.filter((p) => p.reason === 'plan').reduce((s, p) => s + p.estSec, 0);
    expect(planSec / u.totalSec).toBeGreaterThan(0.5);
  });

  it('Fokus geht an schwache Tags (Gewicht 1 + 2 × Fehlerquote)', () => {
    const ts = '2026-11-20T10:00:00.000Z';
    const attempts = [
      ...Array.from({ length: 10 }, (_, i) => att('kopfrechnen', 'kr.prozent', i < 2, ts, 6)),
      ...Array.from({ length: 10 }, () => att('matrizen', 'mx.progression.anzahl', true, ts)),
    ];
    const w = weakTags(attempts, monday, new Set(ALL));
    const pr = w.find((x) => x.tag === 'kr.prozent')!;
    expect(pr.weight).toBeCloseTo(1 + 2 * 0.8);
    expect(pr.level).toBe(6);
    let prozent = 0;
    for (let i = 0; i < 400; i++) {
      const u = planDay({ ...base, attempts, rng: createRng(i + 1) });
      const f = u.parts.find((p) => p.reason === 'fokus')!;
      if (f.tags?.[0] === 'kr.prozent') {
        prozent++;
        expect(f.startLevel).toBe(6);
      }
    }
    // 2,6 : 1 → rund 72 %
    expect(prozent / 400).toBeGreaterThan(0.62);
    expect(prozent / 400).toBeLessThan(0.82);
  });

  it('Alte Versuche (älter als 30 Tage) zählen nicht', () => {
    const attempts = Array.from({ length: 10 }, () =>
      att('kopfrechnen', 'kr.prozent', false, '2026-09-01T10:00:00.000Z'),
    );
    expect(weakTags(attempts, monday, new Set(ALL))).toHaveLength(0);
  });

  it('Lange Blöcke fallen bei 5 Minuten heraus', () => {
    const sat = new Date('2026-11-28T10:00:00');
    const u = planDay({ ...base, now: sat, minutes: 5, rng: createRng(3) });
    for (const p of u.parts)
      if (ESTIMATE[p.moduleId]?.block) expect(p.estSec).toBeLessThanOrEqual(5 * 60 * 1.25);
    expect(u.parts.length).toBeGreaterThan(0);
  });

  it('Ruhetag wird erkannt, jeder Plantag liefert Teile', () => {
    const sun = new Date('2026-11-29T10:00:00');
    expect(planDay({ ...base, now: sun, rng: createRng(1) }).rest).toBe(true);
    for (let d = 23; d <= 29; d++) {
      const u = planDay({ ...base, now: new Date(`2026-11-${d}T10:00:00`), rng: createRng(d) });
      expect(u.parts.length, `Tag ${d}`).toBeGreaterThan(0);
      for (const p of u.parts) expect(MODULE_BY_ID[p.moduleId]?.generator).toBeTruthy();
    }
  });

  it('Tages-Seed ist über den Tag gleich', () => {
    expect(daySeed('2026-11-23')).toBe(daySeed('2026-11-23'));
    expect(daySeed('2026-11-23')).not.toBe(daySeed('2026-11-24'));
  });
});

describe('Erledigt und Wochenziele', () => {
  const now = new Date('2026-11-25T10:00:00');
  it('Tag zählt mit Tageseinheit oder mindestens 5 Minuten', () => {
    const keys = trainedDayKeys([
      ses({ endedAt: '2026-11-23T10:00:00.000Z' }), // 6 min
      ses({
        endedAt: '2026-11-24T10:00:00.000Z',
        startedAt: '2026-11-24T09:58:00.000Z',
      }), // 2 min
      ses({
        endedAt: '2026-11-25T08:00:00.000Z',
        startedAt: '2026-11-25T07:59:00.000Z',
        type: 'tag',
        groupDone: true,
      }),
    ]);
    expect(keys.has('2026-11-23')).toBe(true);
    expect(keys.has('2026-11-24')).toBe(false);
    expect(keys.has('2026-11-25')).toBe(true);
  });
  it('Wochenziele zählen Gruppen, nicht Teile', () => {
    const w = weekDone(
      [
        ses({ endedAt: '2026-11-23T10:00:00.000Z', type: 'tag', groupId: 'a' }),
        ses({ endedAt: '2026-11-23T10:05:00.000Z', type: 'tag', groupId: 'a', groupDone: true }),
        ses({
          endedAt: '2026-11-24T10:00:00.000Z',
          type: 'kurzsim',
          groupId: 'b',
          groupDone: true,
        }),
        ses({ endedAt: '2026-11-24T11:00:00.000Z', type: 'kurzsim', groupId: 'c' }), // abgebrochen
        ses({ endedAt: '2026-11-24T12:00:00.000Z', belastet: true, groupId: 'd' }),
        ses({ endedAt: '2026-11-24T12:05:00.000Z', belastet: true, groupId: 'd' }),
        ses({ endedAt: '2026-11-10T10:00:00.000Z', type: 'tag', groupId: 'e', groupDone: true }),
      ],
      now,
    );
    expect(w).toEqual({ tag: 1, kurzsim: 1, vollsim: 0, belastung: 1 });
  });
});

describe('Simulationen', () => {
  it('Kurzsimulation 30 min, Vollsimulation 9 Blöcke um 2,5 h', () => {
    expect(simMinutes(KURZSIM)).toBe(30);
    expect(VOLLSIM.blocks).toHaveLength(9);
    expect(simMinutes(VOLLSIM)).toBeGreaterThanOrEqual(130);
    expect(simMinutes(VOLLSIM)).toBeLessThanOrEqual(160);
  });
  it('alle Teile verweisen auf vorhandene Module, Block-Module mit Anzahl statt Zeit', () => {
    for (const d of [KURZSIM, VOLLSIM])
      for (const b of d.blocks)
        for (const p of b.parts) {
          expect(MODULE_BY_ID[p.moduleId]?.generator, p.moduleId).toBeTruthy();
          if (ESTIMATE[p.moduleId]?.block) expect(p.count, p.moduleId).toBe(1);
          else expect(!!p.minutes || !!p.count, p.moduleId).toBe(true);
          // Optionen erzeugen gültige Aufgaben
          const gen = MODULE_BY_ID[p.moduleId].generator!;
          const it = gen.generate(7, 3, p.opts);
          expect(gen.validate(it), p.moduleId).toEqual([]);
        }
  });
  it('Vigilanz in der Vollsimulation dauert 30 min, Determination in der Kurzsim 3 min', () => {
    const vg = MODULE_BY_ID.vigilanz.generator!;
    const vp = VOLLSIM.blocks.at(-1)!.parts[0];
    const it = vg.generate(1, 5, vp.opts) as { prompt: { durationMs: number } };
    expect(it.prompt.durationMs).toBe(30 * 60000);
    const dg = MODULE_BY_ID.determination.generator!;
    const dp = KURZSIM.blocks.at(-1)!.parts[0];
    const di = dg.generate(1, 5, dp.opts) as { prompt: { durationMs: number } };
    expect(di.prompt.durationMs).toBe(3 * 60000);
  });
});
