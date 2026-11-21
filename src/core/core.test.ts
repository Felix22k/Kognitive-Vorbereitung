import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed } from './rng';
import { parseAnswer, rat, eq, formatRational, formatNumber } from './rational';
import { updateStair, testStartLevel } from './staircase';
import { median, niveau, trefferquote } from './stats';
import { areaStats, tagStats, weekDays } from './progress';
import type { Session } from './types';

describe('rng', () => {
  it('ist reproduzierbar', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('int bleibt im Bereich', () => {
    const r = createRng(1);
    for (let i = 0; i < 5000; i++) {
      const x = r.int(-3, 7);
      expect(x).toBeGreaterThanOrEqual(-3);
      expect(x).toBeLessThanOrEqual(7);
    }
  });
  it('deriveSeed streut', () => {
    const s = new Set(Array.from({ length: 1000 }, (_, i) => deriveSeed(7, i)));
    expect(s.size).toBe(1000);
  });
});

describe('Antworten lesen', () => {
  it.each([
    ['12', rat(12)],
    ['-7', rat(-7)],
    ['−7', rat(-7)],
    ['3,5', rat(7, 2)],
    ['3.5', rat(7, 2)],
    ['0,25', rat(1, 4)],
    [',5', rat(1, 2)],
    ['3/4', rat(3, 4)],
    ['6/8', rat(3, 4)],
    [' 42 ', rat(42)],
    ['1.500', rat(1500)],
    ['12.000', rat(12000)],
    ['1.5', rat(3, 2)],
  ])('%s', (raw, v) => {
    const p = parseAnswer(raw);
    expect(p).not.toBeNull();
    expect(eq(p!.value, v)).toBe(true);
  });
  it.each(['', 'abc', '3/0', '1,2,3', '--3'])('ungültig: "%s"', (raw) => {
    expect(parseAnswer(raw)).toBeNull();
  });
  it('formatiert deutsch', () => {
    expect(formatRational(rat(7, 2))).toBe('3,5');
    expect(formatRational(rat(1, 3))).toBe('1/3');
    expect(formatRational(rat(-3, 4), true)).toBe('−3/4');
    expect(formatNumber(12345)).toBe('12.345');
    expect(formatNumber(1234)).toBe('1234');
  });
});

describe('Treppenverfahren', () => {
  it('Lernmodus: 2 richtige in Folge +1, falsch −1', () => {
    let s = { level: 3, streak: 0 };
    s = updateStair(s, true, 'lernen');
    expect(s.level).toBe(3);
    s = updateStair(s, true, 'lernen');
    expect(s.level).toBe(4);
    s = updateStair(s, false, 'lernen');
    expect(s).toEqual({ level: 3, streak: 0 });
  });
  it('Testmodus: ±1 pro Antwort, Grenzen 1 und 10', () => {
    expect(updateStair({ level: 10, streak: 0 }, true, 'test').level).toBe(10);
    expect(updateStair({ level: 1, streak: 0 }, false, 'test').level).toBe(1);
    expect(updateStair({ level: 5, streak: 0 }, true, 'test').level).toBe(6);
  });
  it('Teststart auf 4 oder letztes Niveau minus 1', () => {
    expect(testStartLevel(null)).toBe(4);
    expect(testStartLevel(8)).toBe(7);
    expect(testStartLevel(1)).toBe(1);
  });
  it('Lernmodus pendelt sich bei etwa 70 % ein', () => {
    // Simulierter Proband: Trefferwahrscheinlichkeit fällt mit der Stufe
    const r = createRng(3);
    let s = { level: 1, streak: 0 };
    let hits = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const p = 1 / (1 + Math.exp(s.level - 6));
      const ok = r.next() < p;
      if (ok) hits++;
      s = updateStair(s, ok, 'lernen');
    }
    expect(hits / n).toBeGreaterThan(0.62);
    expect(hits / n).toBeLessThan(0.78);
  });
});

describe('Kennwerte', () => {
  it('Median', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
  it('Niveau = Ø Stufe der 2. Hälfte × 10', () => {
    expect(niveau([1, 1, 5, 7])).toBe(60);
    expect(niveau([2, 4, 6])).toBe(50); // 2. Hälfte: 4, 6
  });
  it('Trefferquote', () => {
    expect(trefferquote([true, false, true, true])).toBe(75);
  });
});

describe('Fortschritt', () => {
  const sess = (id: string, endedAt: string, summary: Session['summary']): Session => ({
    id,
    type: 'modul',
    mode: 'test',
    moduleIds: Object.keys(summary),
    startedAt: endedAt,
    endedAt,
    belastet: false,
    summary,
  });
  const sum = (niveau: number) => ({
    niveau,
    trefferquote: 50,
    medianMs: 1000,
    anzahl: 10,
    endLevel: 5,
  });
  it('Bereichswert = Mittel der Modul-Niveaus, Bestwert 30 Tage', () => {
    const now = new Date('2026-11-21T12:00:00');
    const st = areaStats(
      [
        sess('a', '2026-09-01T10:00:00', { kopfrechnen: sum(90) }), // älter als 30 Tage
        sess('b', '2026-11-10T10:00:00', { kopfrechnen: sum(60) }),
        sess('c', '2026-11-11T10:00:00', { zahlenreihen: sum(40) }),
        sess('d', '2026-11-12T10:00:00', { zahlenreihen: sum(80) }),
      ],
      { kopfrechnen: 'sprache', zahlenreihen: 'sprache' },
      now,
    );
    expect(st.sprache.current).toBe(70);
    expect(st.sprache.best30).toBe(70); // 60, 50, 70
    expect(st.sprache.practiced).toBe(2);
  });
  it('Woche beginnt am Montag', () => {
    const d = weekDays(new Date('2026-11-21T12:00:00')); // Samstag
    expect(d[0].getDay()).toBe(1);
    expect(d[6].getDay()).toBe(0);
    expect(d[5].getDate()).toBe(21);
  });
  it('Tags nach Fehlerquote sortiert', () => {
    const base = { mode: 'test' } as const;
    const t = tagStats([
      { ...base, tags: ['x'], correct: true },
      { ...base, tags: ['y'], correct: false },
      { ...base, tags: ['x'], correct: false },
    ] as never);
    expect(t[0].tag).toBe('y');
    expect(t[1].rate).toBe(0.5);
  });
});
