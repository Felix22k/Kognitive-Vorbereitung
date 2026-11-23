import { describe, expect, it } from 'vitest';
import type { Generator, Item } from '../core/types';
import { kopfrechnenGenerator } from './kopfrechnen';
import { zahlenreihenGenerator, checkUnique } from './zahlenreihen';
import { matrizenGenerator } from './matrizen';
import { figurenreihenGenerator } from './figurenreihen';
import { renderKey } from './figuren/model';
import { rotationGenerator, rotation4Generator } from './rotation';
import { wuerfelGenerator, NETS, fold, isPossible, knownOf } from './wuerfel';
import { wuerfelZaehlenGenerator, toPoints, contactCount } from './wuerfelZaehlen';
import { canonical, isChiral, mirror } from './raum/voxel';
import { choiceInfo } from '../modules/views';
import {
  blockspanneGenerator,
  faktenGenerator,
  nbackGenerator,
  wegeGenerator,
  zahlenspanneGenerator,
  type NbItem,
} from './gedaechtnis';
import {
  durchstreichenGenerator,
  dsScore,
  isTarget,
  rechenketteGenerator,
  symbolZahlGenerator,
  type DsItem,
} from './konzentration';

import {
  determinationGenerator,
  stroopGenerator,
  vigilanzGenerator,
  wahlreaktionGenerator,
  type VgItem,
} from './reaktion';

/** Bestmögliche Antwort einer Block-Aufgabe (für die Prüfung der Auswertung). */
function perfectBlock(item: Item): Record<string, unknown> {
  switch (item.moduleId) {
    case 'zahlenspanne':
      return { input: item.correct };
    case 'blockspanne':
    case 'wege':
      return { clicks: item.correct };
    case 'nback':
      return { responses: (item as NbItem).prompt.targets };
    case 'fakten':
      return { answers: item.correct };
    case 'durchstreichen': {
      const p = (item as DsItem).prompt;
      return {
        marks: p.rows.map((row) =>
          row
            .map((g, i) => (isTarget(g, p.target) ? i : -1))
            .filter((i) => i >= 0)
            .concat(39),
        ),
      };
    }
    case 'determination':
      return {
        events: Array.from({ length: 20 }, (_, k) => ({
          stim: k % 7,
          shownAt: k * 1000,
          durMs: 1000,
          result: 'richtig',
          rtMs: 500,
        })),
      };
    case 'vigilanz': {
      const vp = (item as VgItem).prompt;
      return {
        signals: vp.signals.map((st) => ({ step: st, t: st * vp.tickMs, hit: true, rtMs: 400 })),
        falseAlarms: [],
      };
    }
    default:
      return {
        results: Array.from({ length: 20 }, (_, t) => ({ correct: true, t: t * 1000, rtMs: 900 })),
      };
  }
}
import { RULE_BY_ID, RULES } from './zahlenreihen/rules';
import { begriffeGenerator, rechtschreibungGenerator, wortanalogienGenerator } from './sprache';
import { technikGenerator } from './technik';
import { textaufgabenGenerator } from './textaufgaben';
import { pickUniqueItem } from '../session/engine';
import { deriveSeed } from '../core/rng';

const N = 2000;
const GENS: [string, Generator][] = [
  ['Kopfrechnen', kopfrechnenGenerator as Generator],
  ['Zahlenreihen', zahlenreihenGenerator as Generator],
  ['Figurale Matrizen', matrizenGenerator as Generator],
  ['Figurenreihen', figurenreihenGenerator as Generator],
  ['Mentale Rotation A', rotationGenerator as Generator],
  ['Mentale Rotation B', rotation4Generator as Generator],
  ['Würfel drehen', wuerfelGenerator as Generator],
  ['Würfel zählen', wuerfelZaehlenGenerator as Generator],
  ['Zahlenspanne', zahlenspanneGenerator as Generator],
  ['Blockspanne', blockspanneGenerator as Generator],
  ['n-back', nbackGenerator as Generator],
  ['Fakten merken', faktenGenerator as Generator],
  ['Wege merken', wegeGenerator as Generator],
  ['Durchstreichtest', durchstreichenGenerator as Generator],
  ['Symbol-Zahl-Kodierung', symbolZahlGenerator as Generator],
  ['Rechenkette', rechenketteGenerator as Generator],
  ['Wahlreaktion', wahlreaktionGenerator as Generator],
  ['Determination', determinationGenerator as Generator],
  ['Farb-Wort-Interferenz', stroopGenerator as Generator],
  ['Vigilanz', vigilanzGenerator as Generator],
  ['Textaufgaben', textaufgabenGenerator as Generator],
  ['Wortanalogien', wortanalogienGenerator as Generator],
  ['Begriffe vergleichen', begriffeGenerator as Generator],
  ['Rechtschreibung', rechtschreibungGenerator as Generator],
  ['Technisches Verständnis', technikGenerator as Generator],
];

/**
 * Generatoren mit begrenztem Aufgabenraum (Wortbanken, feste Sammlungen,
 * glatte Zahlen): Hier gilt „keine Wiederholung“, solange mindestens die
 * Hälfte des Aufgabenraums der Stufe noch nicht gezeigt wurde (höchstens 500).
 */
const LIMITED = new Set(['wortanalogien', 'rechtschreibung', 'textaufgaben', 'technik']);

function spaceSize(gen: Generator, level: number): number {
  const fps = new Set<string>();
  for (let i = 0; i < 6000; i++)
    fps.add(gen.fingerprint(gen.generate(deriveSeed(level * 31, i), level)));
  return fps.size;
}

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
          // Die richtige Lösung wird als richtig erkannt, bei Auswahl genau eine Option
          if (item.answerKind === 'block') {
            expect(gen.check(item, { type: 'block', data: perfectBlock(item) })).toBe(true);
            expect(gen.check(item, { type: 'block', data: {} })).toBe(false);
          } else if (Array.isArray(item.correct)) {
            const c = item.correct as number[];
            expect(gen.check(item, { type: 'multi', indices: c })).toBe(true);
            // jede andere Zweierauswahl ist falsch
            for (let x = 0; x < 4; x++)
              for (let y = x + 1; y < 4; y++)
                if (!(x === c[0] && y === c[1]))
                  expect(gen.check(item, { type: 'multi', indices: [x, y] })).toBe(false);
          } else if (item.answerKind === 'choice') {
            const n = choiceInfo(item)!.count;
            const right = Array.from({ length: n }, (_, k) => k).filter((k) =>
              gen.check(item, { type: 'choice', index: k }),
            );
            expect(right.length).toBe(1);
          } else
            expect(
              gen.check(item, { type: 'text', raw: item.correctLabel.replace(/\./g, '') }),
            ).toBe(true);
        }
        expect(maxMs).toBeLessThan(50);
        expect(tags.size).toBeGreaterThan(0);
      });
    }

    it('innerhalb von 500 Aufgaben keine Wiederholung (je Stufe)', () => {
      for (let level = 1; level <= 10; level++) {
        const recent = new Set<string>();
        let s = level;
        const n = LIMITED.has(gen.id) ? Math.min(500, Math.floor(spaceSize(gen, level) / 2)) : 500;
        if (LIMITED.has(gen.id))
          expect(n, `Aufgabenraum Stufe ${level}`).toBeGreaterThanOrEqual(25);
        for (let i = 0; i < n; i++) {
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

describe('Figurale Matrizen: Aufbau', () => {
  it('Stufenmerkmale: Optionenzahl, Regelanzahl, schwere Regeln, Spalten, andere Lücke', () => {
    const seen = { spalte: false, otherMissing: false, xor: false, addSub: false };
    for (let level = 1; level <= 10; level++)
      for (let i = 0; i < 300; i++) {
        const it = matrizenGenerator.generate(deriveSeed(level * 13, i), level);
        const p = it.prompt;
        expect(p.options.length).toBe(level <= 5 ? 6 : 8);
        if (level === 1) expect(p.rules.length).toBe(1);
        if (level >= 9) {
          expect(p.rules.length).toBe(4);
          expect(p.rules.some((r) => r.rule === 'xor' || r.rule === 'addSub')).toBe(true);
        }
        if (level <= 6) expect(p.rules.every((r) => r.orientation === 'zeile')).toBe(true);
        if (level <= 7) expect(p.missing).toBe(8);
        if (p.rules.some((r) => r.orientation === 'spalte')) seen.spalte = true;
        if (p.missing !== 8) seen.otherMissing = true;
        if (p.rules.some((r) => r.rule === 'xor')) seen.xor = true;
        if (p.rules.some((r) => r.rule === 'addSub')) seen.addSub = true;
        expect(renderKey(p.options[p.correctIndex])).toBe(renderKey(p.solution));
      }
    expect(seen).toEqual({ spalte: true, otherMissing: true, xor: true, addSub: true });
  });
});

describe('Räumliches Denken: Spezialprüfungen', () => {
  it('Rotation: Figuren chiral, gespiegelt nur bei Spiegelung, 8 bis 10 Würfel', () => {
    for (let level = 1; level <= 10; level++)
      for (let i = 0; i < 100; i++) {
        const it = rotationGenerator.generate(deriveSeed(level * 3, i), level);
        const p = it.prompt;
        expect(isChiral(p.left.points)).toBe(true);
        expect(canonical(p.left.points) === canonical(p.right.points)).toBe(!p.mirrored);
        expect(p.left.points.length).toBeGreaterThanOrEqual(8);
      }
  });
  it('Rotation B: zwei richtig, Ablenker gespiegelt oder baulich anders', () => {
    for (let level = 1; level <= 10; level++)
      for (let i = 0; i < 100; i++) {
        const it = rotation4Generator.generate(deriveSeed(level * 5, i), level);
        const p = it.prompt;
        const tc = canonical(p.target.points);
        const mc = canonical(mirror(p.target.points));
        p.options.forEach((o, k) => {
          const c = canonical(o.points);
          if (p.kinds[k] === 'richtig') expect(c).toBe(tc);
          else if (p.kinds[k] === 'gespiegelt') expect(c).toBe(mc);
          else {
            expect(c).not.toBe(tc);
            expect(c).not.toBe(mc);
          }
        });
      }
  });
  it('Würfelnetze: genau 11 Grundformen', () => {
    // Normalform unter Drehen und Spiegeln in der Ebene
    const forms = new Set(
      NETS.map((cells) => {
        const variants: string[] = [];
        let cur = cells.map(([c, r]) => [c, r]);
        for (let m = 0; m < 2; m++) {
          for (let rot = 0; rot < 4; rot++) {
            cur = cur.map(([c, r]) => [r, -c]);
            const mc = Math.min(...cur.map((x) => x[0]));
            const mr = Math.min(...cur.map((x) => x[1]));
            variants.push(
              cur
                .map(([c, r]) => [c - mc, r - mr].join(','))
                .sort()
                .join(';'),
            );
          }
          cur = cur.map(([c, r]) => [-c, r]);
        }
        return variants.sort()[0];
      }),
    );
    expect(forms.size).toBe(11);
    for (const n of NETS) expect(fold(n)).not.toBeNull();
  });
  it('Würfel drehen: richtige Option möglich, jede falsche unmöglich', () => {
    for (let level = 1; level <= 10; level++)
      for (let i = 0; i < 200; i++) {
        const it = wuerfelGenerator.generate(deriveSeed(level * 7, i), level);
        const { known, complete } = knownOf(it.prompt);
        it.prompt.options.forEach((o, k) => {
          expect(isPossible(o, known, complete)).toBe(k === it.prompt.correctIndex);
        });
      }
  });
  it('Würfel zählen: Antwort stimmt, keine Säule schwebt', () => {
    for (let level = 1; level <= 10; level++)
      for (let i = 0; i < 100; i++) {
        const it = wuerfelZaehlenGenerator.generate(deriveSeed(level * 9, i), level);
        const pts = toPoints(it.prompt.heights);
        expect(it.correct).toBe(
          it.prompt.question === 'zaehlen' ? pts.length : contactCount(pts, 2),
        );
      }
  });
});

describe('Rotation in der Bildebene', () => {
  it('rechtes Bild = linkes Bild, um den Winkel gedreht (inklusive Schattierung)', async () => {
    const { faces, DEFAULT_VIEW } = await import('./raum/voxel');
    let checked = 0;
    for (let i = 0; i < 300 && checked < 60; i++) {
      const it = rotationGenerator.generate(deriveSeed(4242, i), 2);
      const p = it.prompt;
      if (p.mirrored || p.axis !== 'ebene') continue;
      checked++;
      const L = faces(p.left.points, p.left.rot, DEFAULT_VIEW, p.left.lightDeg ?? 0);
      const R = faces(p.right.points, p.right.rot, DEFAULT_VIEW, p.right.lightDeg ?? 0);
      const deg = p.right.lightDeg ?? 0;
      const a = (deg * Math.PI) / 180;
      const sig = (fs: typeof L, rotate: boolean) =>
        fs
          .map((f) => {
            let x = f.pts.reduce((s, q) => s + q[0], 0) / 4;
            let y = -f.pts.reduce((s, q) => s + q[1], 0) / 4; // Bild → Blickkoordinaten
            if (rotate)
              [x, y] = [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
            return `${x.toFixed(2)},${y.toFixed(2)},${f.shade}`;
          })
          .sort()
          .join(';');
      expect(sig(R, false)).toBe(sig(L, true));
    }
    expect(checked).toBeGreaterThan(20);
  });
});

describe('Konzentration: Durchstreichtest-Kennwerte', () => {
  it('KL, Auslassungen, Verwechslungen, Schwankung', () => {
    const T = { l: 'd' as const, top: 1, bottom: 1 }; // Ziel: d mit 2 Strichen
    const N = { l: 'd' as const, top: 1, bottom: 0 }; // d mit 1 Strich
    const B = { l: 'b' as const, top: 1, bottom: 1 }; // b mit 2 Strichen
    const p = {
      target: { l: 'd' as const, strokes: 2 },
      rowMs: 15000,
      rows: [
        [T, N, T, B, T, N], // Ziele bei 0, 2, 4
        [B, T, T, N, N, T], // Ziele bei 1, 2, 5
      ],
    };
    // Zeile 1: 0 und 4 markiert, 2 ausgelassen, 3 (b) fälschlich markiert → bearbeitet bis 4
    // Zeile 2: 1 markiert, bearbeitet bis 1
    const sc = dsScore(p, [[0, 3, 4], [1]]);
    expect(sc.processed).toBe(5 + 2);
    expect(sc.hits).toBe(3);
    expect(sc.omissions).toBe(1);
    expect(sc.confusions).toBe(1);
    expect(sc.kl).toBe(2);
    expect(sc.schwankung).toBe(3);
  });
});

describe('Vigilanz: Signalhäufigkeit', () => {
  it('Original-nah: rund 10 bis 12 Signale in 30 min bei 1 s Takt, mindestens 20 Schritte Abstand', () => {
    const counts: number[] = [];
    for (let i = 0; i < 200; i++) {
      const it = vigilanzGenerator.generate(deriveSeed(99, i), 5, {
        haeufigkeit: 'original',
        dauer: '30',
        takt: '1000',
      });
      counts.push(it.prompt.signals.length);
      it.prompt.signals.forEach((x, k, a) => k && expect(x - a[k - 1]).toBeGreaterThanOrEqual(20));
    }
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    expect(mean).toBeGreaterThan(9);
    expect(mean).toBeLessThan(13);
  });
});

describe('Gemeldete Aufgaben werden ausgeblendet', () => {
  it('pickUniqueItem überspringt gesperrte Fingerabdrücke', () => {
    // Technik-Sammlung: alle festen Aufgaben einer Stufe bis auf eine sperren
    const gen = technikGenerator as Generator;
    const fps = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const it = gen.generate(deriveSeed(9, i), 2) as Item;
      const fp = gen.fingerprint(it);
      if (fp.startsWith('bank:')) fps.add(fp);
    }
    const blocked = new Set(fps);
    let s = 1;
    for (let i = 0; i < 300; i++) {
      const it = pickUniqueItem(gen, 2, [], undefined, () => (s = deriveSeed(s, i)), blocked);
      expect(blocked.has(gen.fingerprint(it))).toBe(false);
    }
  });
});

describe('Technik: Getriebe', () => {
  it('Zahnradkette, gemeinsame Achse und Blockade werden erkannt', async () => {
    const { solveGears } = await import('./technik');
    const g = (teeth: number, plane = 0) => ({ x: 0, y: 0, r: 10, teeth, label: '', plane });
    const chain = solveGears({
      type: 'zahnrad',
      gears: [g(10), g(20), g(10), g(5, 1), g(20, 1)],
      mesh: [
        [0, 1],
        [1, 2],
        [3, 4],
      ],
      axle: [[2, 3]],
      driver: 0,
      dir: 1,
      target: 4,
    });
    expect(chain.blocked).toBe(false);
    expect(chain.dir).toEqual([1, -1, 1, 1, -1]);
    // 1 U · 10/20 · 20/10 = 1 U auf Rad 2, gleiche Achse: 1 U, dann · 5/20
    expect(chain.speed[4]).toBeCloseTo(0.25);
    const tri = solveGears({
      type: 'zahnrad',
      gears: [g(10), g(10), g(10)],
      mesh: [
        [0, 1],
        [1, 2],
        [0, 2],
      ],
      axle: [],
      driver: 0,
      dir: 1,
      target: 2,
    });
    expect(tri.blocked).toBe(true);
  });
});
