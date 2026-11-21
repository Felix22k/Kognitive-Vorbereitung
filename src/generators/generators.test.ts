import { describe, expect, it } from 'vitest';
import type { Generator, Item } from '../core/types';
import { kopfrechnenGenerator } from './kopfrechnen';
import { zahlenreihenGenerator, checkUnique } from './zahlenreihen';
import { RULE_BY_ID, RULES } from './zahlenreihen/rules';
import { pickUniqueItem } from '../session/engine';
import { deriveSeed } from '../core/rng';

const N = 2000;
const GENS: [string, Generator][] = [
  ['Kopfrechnen', kopfrechnenGenerator as Generator],
  ['Zahlenreihen', zahlenreihenGenerator as Generator],
];

for (const [name, gen] of GENS) {
  describe(name, () => {
    for (let level = 1; level <= 10; level++) {
      it(`Stufe ${level}: ${N} Aufgaben gültig, reproduzierbar, schnell`, () => {
        let maxMs = 0;
        const tags = new Set<string>();
        for (let i = 0; i < N; i++) {
          const seed = deriveSeed(level * 100_003, i);
          const t0 = performance.now();
          const item = gen.generate(seed, level) as Item;
          maxMs = Math.max(maxMs, performance.now() - t0);
          const errs = gen.validate(item);
          if (errs.length)
            throw new Error(`seed ${seed}: ${errs.join('; ')} – ${gen.promptText(item)}`);
          expect(item.level).toBe(level);
          item.tags.forEach((t) => tags.add(t));
          if (i < 50) {
            const again = gen.generate(seed, level);
            expect(JSON.stringify(again)).toBe(JSON.stringify(item));
          }
          // Die richtige Lösung wird als richtig erkannt
          expect(gen.check(item, { type: 'text', raw: item.correctLabel.replace(/\./g, '') })).toBe(
            true,
          );
        }
        expect(maxMs).toBeLessThan(50);
        expect(tags.size).toBeGreaterThan(0);
      });
    }

    it('innerhalb von 500 Aufgaben keine Wiederholung (je Stufe)', () => {
      for (let level = 1; level <= 10; level++) {
        const recent = new Set<string>();
        let s = level;
        for (let i = 0; i < 500; i++) {
          const item = pickUniqueItem(gen, level, recent, undefined, () => (s = deriveSeed(s, i)));
          const fp = gen.fingerprint(item);
          expect(recent.has(fp), `Wiederholung auf Stufe ${level}: ${fp}`).toBe(false);
          recent.add(fp);
        }
      }
    });
  });
}

describe('Kopfrechnen: Auswahlmodus und Prüfung', () => {
  it('genau eine richtige Option, alle verschieden', () => {
    for (let level = 1; level <= 10; level++)
      for (let i = 0; i < 300; i++) {
        const it = kopfrechnenGenerator.generate(deriveSeed(level, i), level);
        const opts = it.prompt.options;
        expect(new Set(opts).size).toBe(4);
        const right = opts.filter((_, j) =>
          kopfrechnenGenerator.check(it, { type: 'choice', index: j }),
        );
        expect(right.length).toBe(1);
      }
  });
  it('Brüche: gleichwertige Eingabe zählt, beim Kürzen nur vollständig gekürzt', () => {
    let foundKuerzen = false;
    for (let i = 0; i < 400 && !foundKuerzen; i++) {
      const it = kopfrechnenGenerator.generate(deriveSeed(77, i), 7);
      if (!it.prompt.text.startsWith('Kürze')) continue;
      foundKuerzen = true;
      const { n, d } = it.correct;
      expect(kopfrechnenGenerator.check(it, { type: 'text', raw: `${n}/${d}` })).toBe(true);
      expect(kopfrechnenGenerator.check(it, { type: 'text', raw: `${n * 2}/${d * 2}` })).toBe(
        false,
      );
    }
    expect(foundKuerzen).toBe(true);
  });
  it('Komma und Punkt als Dezimaltrenner', () => {
    for (let i = 0; i < 500; i++) {
      const it = kopfrechnenGenerator.generate(deriveSeed(5, i), 6);
      if (it.correct.d === 1) continue;
      const dec = (it.correct.n / it.correct.d).toString();
      expect(kopfrechnenGenerator.check(it, { type: 'text', raw: dec })).toBe(true);
      expect(kopfrechnenGenerator.check(it, { type: 'text', raw: dec.replace('.', ',') })).toBe(
        true,
      );
      return;
    }
  });
});

describe('Zahlenreihen: Eindeutigkeit', () => {
  it('jede Regel wird auf ihren Stufen erzeugt', () => {
    const seen = new Set<string>();
    for (let level = 1; level <= 10; level++)
      for (let i = 0; i < 400; i++)
        seen.add(zahlenreihenGenerator.generate(deriveSeed(level * 7, i), level).prompt.ruleId);
    expect([...seen].sort()).toEqual(RULES.map((r) => r.id).sort());
  });

  it('Regeln passen sich an ihre eigenen Reihen an', () => {
    expect(RULE_BY_ID.arith.fit([2, 5, 8, 11, 14, 17, 20, null])[0][7]).toBe(23);
    expect(RULE_BY_ID.geom.fit([3, 6, 12, 24, 48, 96, 192, null])[0][7]).toBe(384);
    expect(RULE_BY_ID.diff2.fit([1, 2, 4, 7, 11, 16, 22, null])[0][7]).toBe(29);
    expect(RULE_BY_ID.fibonacci.fit([2, 3, 5, 8, 13, 21, 34, null])[0][7]).toBe(55);
    expect(RULE_BY_ID.wechsel.fit([1, 4, 8, 11, 22, 25, 50, null]).map((f) => f[7])).toContain(53);
    expect(RULE_BY_ID.zweiReihen.fit([1, 10, 2, 20, 3, 30, 4, null]).map((f) => f[7])).toContain(
      40,
    );
    expect(RULE_BY_ID.prim.fit([2, 3, 5, 7, 11, 13, 17, null])[0][7]).toBe(19);
    expect(RULE_BY_ID.diffGeom.fit([1, 2, 4, 8, 16, 32, 64, null])[0][7]).toBe(128);
    expect(RULE_BY_ID.mulAdd.fit([1, 3, 7, 15, 31, 63, 127, null])[0][7]).toBe(255);
    expect(RULE_BY_ID.zyklus3.fit([2, 6, 4, 8, 12, 10, 20, null]).map((f) => f[7])).toContain(24);
    // Lücke in der Mitte
    expect(RULE_BY_ID.arith.fit([2, 5, 8, null, 14, 17, 20, 23])[0][3]).toBe(11);
    expect(RULE_BY_ID.fibonacci.fit([2, 3, 5, null, 13, 21, 34, 55])[0][3]).toBe(8);
  });

  it('mehrdeutige Reihe wird verworfen', () => {
    // 1, 2, 4, 8, … ist zugleich geometrisch und "Differenzen verdoppeln sich"
    expect(checkUnique([1, 2, 4, 8, 16, 32, 64, 128], 7, RULE_BY_ID.diffGeom).ok).toBe(false);
    // Arithmetische Reihe als "Wechsel" ausgegeben: zu einfach
    expect(checkUnique([1, 4, 7, 10, 13, 16, 19, 22], 7, RULE_BY_ID.wechsel).ok).toBe(false);
    expect(checkUnique([1, 4, 7, 10, 13, 16, 19, 22], 7, RULE_BY_ID.arith).ok).toBe(true);
  });
});
