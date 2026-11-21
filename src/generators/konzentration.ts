/**
 * Konzentration (Modul 6.14): Durchstreichtest, Symbol-Zahl-Kodierung,
 * Rechenkette. Block-Aufgaben mit fester Bearbeitungszeit.
 */
import { createRng, type Rng } from '../core/rng';
import type { Generator, Item } from '../core/types';
import { baseValidate, type AnswerValue } from './common';

const data = (a: unknown): Record<string, unknown> | null => {
  const v = a as AnswerValue;
  return v && v.type === 'block' ? v.data : null;
};
const clampLevel = (l: number) => Math.max(1, Math.min(10, Math.round(l)));

function block<P, C>(
  moduleId: string,
  seed: number,
  level: number,
  tags: string[],
  prompt: P,
  correct: C,
  explanation: string,
): Item<P, C> {
  return {
    id: `${moduleId}-${seed}-${level}`,
    moduleId,
    generatorId: moduleId,
    generatorVersion: 1,
    seed,
    level,
    tags,
    prompt,
    correct,
    correctLabel: '',
    explanation,
    timeLimitMs: 3_600_000,
    answerKind: 'block',
  };
}

// ---------- Durchstreichtest ----------

export type Letter = 'b' | 'd' | 'p' | 'q';
export interface Glyph {
  l: Letter;
  top: number; // Striche oben 0 bis 2
  bottom: number; // Striche unten 0 bis 2
}
export interface DsPrompt {
  rows: Glyph[][];
  target: { l: Letter; strokes: number };
  rowMs: number;
}
export type DsItem = Item<DsPrompt, null>;

export const isTarget = (g: Glyph, t: { l: Letter; strokes: number }) =>
  g.l === t.l && g.top + g.bottom === t.strokes;

function splitStrokes(rng: Rng, n: number): [number, number] {
  const opts: [number, number][] = [];
  for (let a = 0; a <= 2; a++) for (let b = 0; b <= 2; b++) if (a + b === n) opts.push([a, b]);
  return rng.pick(opts);
}

export interface DsMarks {
  /** markierte Positionen je Zeile */
  marks: number[][];
}

/** Kennwerte nach dem Prinzip bekannter Durchstreichtests. */
export function dsScore(p: DsPrompt, marks: number[][]) {
  let processed = 0;
  let omissions = 0;
  let confusions = 0;
  let hits = 0;
  const perRow: number[] = [];
  p.rows.forEach((row, r) => {
    const m = new Set(marks[r] ?? []);
    const last = m.size ? Math.max(...m) : -1;
    const done = last + 1; // bearbeitet bis zur letzten Markierung
    perRow.push(done);
    processed += done;
    for (let i = 0; i < done; i++) {
      const t = isTarget(row[i], p.target);
      if (t && m.has(i)) hits++;
      else if (t) omissions++;
      else if (m.has(i)) confusions++;
    }
  });
  const errors = omissions + confusions;
  return {
    processed,
    hits,
    omissions,
    confusions,
    kl: hits - confusions,
    fehlerProzent: processed ? Math.round((errors / processed) * 1000) / 10 : 0,
    schwankung: perRow.length ? Math.max(...perRow) - Math.min(...perRow) : 0,
    perRow,
  };
}

export const durchstreichenGenerator: Generator<DsPrompt, null> = {
  id: 'durchstreichen',
  version: 1,
  generate(seed, level) {
    const rng = createRng(seed);
    const lvl = clampLevel(level);
    const target = { l: rng.pick(['d', 'b', 'p', 'q'] as Letter[]), strokes: rng.pick([2, 2, 3]) };
    const similarLetter: Record<Letter, Letter[]> = {
      d: ['b', 'p'],
      b: ['d', 'q'],
      p: ['q', 'd'],
      q: ['p', 'b'],
    };
    const rows: Glyph[][] = [];
    for (let r = 0; r < 14; r++) {
      const row: Glyph[] = [];
      for (let i = 0; i < 40; i++) {
        const x = rng.next();
        let g: Glyph;
        if (x < 0.42) {
          const [top, bottom] = splitStrokes(rng, target.strokes);
          g = { l: target.l, top, bottom };
        } else if (x < 0.72) {
          // gleicher Buchstabe, falsche Strichzahl
          const n = rng.pick([1, 2, 3, 4].filter((k) => k !== target.strokes));
          const [top, bottom] = splitStrokes(rng, n);
          g = { l: target.l, top, bottom };
        } else {
          // ähnlicher Buchstabe, richtige Strichzahl (Verwechslungsgefahr)
          const [top, bottom] = splitStrokes(rng, rng.chance(0.7) ? target.strokes : rng.int(1, 4));
          g = { l: rng.pick(similarLetter[target.l]), top, bottom };
        }
        row.push(g);
      }
      rows.push(row);
    }
    const rowMs = lvl <= 3 ? 20_000 : lvl <= 7 ? 15_000 : 12_000;
    return block(
      'durchstreichen',
      seed,
      lvl,
      ['ko.durchstreichen'],
      { rows, target, rowMs },
      null,
      `Ziel: „${target.l}“ mit genau ${target.strokes} Strichen (oben und unten zusammen). ${rowMs / 1000} s pro Zeile. Geschafft bei höchstens 10 % Fehlern.`,
    );
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    const p = item.prompt;
    if (p.rows.length !== 14 || p.rows.some((r) => r.length !== 40))
      errs.push('Raster nicht 14 × 40');
    if (p.rows.flat().some((g) => g.top + g.bottom < 1 || g.top + g.bottom > 4))
      errs.push('Strichzahl außerhalb 1 bis 4');
    const targets = p.rows.flat().filter((g) => isTarget(g, p.target)).length;
    if (targets < 150) errs.push('zu wenige Ziele');
    return errs;
  },
  check(item, answer) {
    const d = data(answer);
    if (!d) return false;
    const sc = dsScore(item.prompt, (d.marks as number[][]) ?? []);
    return sc.processed > 0 && sc.fehlerProzent <= 10;
  },
  fingerprint: (item) => JSON.stringify(item.prompt.rows[0]) + JSON.stringify(item.prompt.target),
  promptText: (item) =>
    `Durchstreichen: ${item.prompt.target.l} mit ${item.prompt.target.strokes} Strichen`,
};

// ---------- Symbol-Zahl-Kodierung ----------

export const SYMBOLE = ['◆', '▲', '●', '■', '★', '✚', '⬟', '◐', '✖'];

export interface SzTask {
  syms: number[]; // Index ins Symbolfeld
  ops: ('+' | '−' | '×')[];
}
export interface SzPrompt {
  mapping: number[]; // Ziffer je Symbol
  tasks: SzTask[];
  blockMs: number;
}
export type SzItem = Item<SzPrompt, null>;

export function szValue(task: SzTask, mapping: number[]): number {
  let v = mapping[task.syms[0]];
  task.ops.forEach((op, i) => {
    const x = mapping[task.syms[i + 1]];
    v = op === '+' ? v + x : op === '−' ? v - x : v * x;
  });
  return v;
}

export const symbolZahlGenerator: Generator<SzPrompt, null> = {
  id: 'symbolZahl',
  version: 1,
  generate(seed, level) {
    const rng = createRng(seed);
    const lvl = clampLevel(level);
    const mapping = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const tasks: SzTask[] = [];
    while (tasks.length < 200) {
      const k = lvl <= 2 ? 1 : lvl <= 5 ? 2 : lvl <= 8 ? rng.pick([2, 3]) : 3;
      const syms = Array.from({ length: k }, () => rng.int(0, 8));
      const ops: SzTask['ops'] = Array.from({ length: k - 1 }, () =>
        lvl >= 6
          ? rng.pick(['+', '−', '×'] as const)
          : lvl >= 4
            ? rng.pick(['+', '−'] as const)
            : '+',
      );
      const t = { syms, ops };
      const v = szValue(t, mapping);
      if (v < 0 || v > 99) continue;
      if (tasks.length && JSON.stringify(tasks[tasks.length - 1]) === JSON.stringify(t)) continue;
      tasks.push(t);
    }
    return block(
      'symbolZahl',
      seed,
      lvl,
      ['ko.symbolZahl'],
      { mapping, tasks, blockMs: 120_000 },
      null,
      'Die Schlüsseltabelle ordnet jedem Symbol eine Ziffer zu. Geschafft bei mindestens 85 % richtigen Antworten (mindestens 8 bearbeitet).',
    );
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    if (new Set(item.prompt.mapping).size !== 9) errs.push('Zuordnung nicht eindeutig');
    if (item.prompt.tasks.some((t) => szValue(t, item.prompt.mapping) < 0))
      errs.push('negatives Ergebnis');
    return errs;
  },
  check(_item, answer) {
    const d = data(answer);
    const res = (d?.results as { correct: boolean }[] | undefined) ?? [];
    return res.length >= 8 && res.filter((r) => r.correct).length / res.length >= 0.85;
  },
  fingerprint: (item) =>
    item.prompt.mapping.join('') + JSON.stringify(item.prompt.tasks.slice(0, 5)),
  promptText: () => 'Symbol-Zahl-Kodierung',
};

// ---------- Rechenkette ----------

export interface RkPrompt {
  digits: number[];
  durationMs: number;
}
export type RkItem = Item<RkPrompt, null>;

/** Ergebnisse je 30-Sekunden-Abschnitt (Ermüdungskurve). */
export function rkSegments(
  results: { t: number; correct: boolean }[],
  durationMs: number,
  segMs = 30_000,
) {
  const n = Math.ceil(durationMs / segMs);
  return Array.from({ length: n }, (_, i) => {
    const r = results.filter((x) => x.t >= i * segMs && x.t < (i + 1) * segMs);
    return { from: i * segMs, n: r.length, correct: r.filter((x) => x.correct).length };
  });
}

export const rechenketteGenerator: Generator<RkPrompt, null> = {
  id: 'rechenkette',
  version: 1,
  generate(seed, level) {
    const rng = createRng(seed);
    const lvl = clampLevel(level);
    const digits: number[] = [];
    for (let i = 0; i < 1000; i++) {
      let d: number;
      do d = rng.int(1, 9);
      while (d === digits[i - 1]);
      digits.push(d);
    }
    const durationMs = lvl <= 3 ? 180_000 : lvl <= 7 ? 240_000 : 300_000;
    return block(
      'rechenkette',
      seed,
      lvl,
      ['ko.rechenkette'],
      { digits, durationMs },
      null,
      `Fortlaufend zwei benachbarte Zahlen addieren und nur die Einerstelle eintippen, ${durationMs / 60000} Minuten lang. Geschafft bei mindestens 90 % richtigen Antworten.`,
    );
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    if (item.prompt.digits.some((d, i) => d === item.prompt.digits[i - 1]))
      errs.push('Ziffer doppelt hintereinander');
    return errs;
  },
  check(_item, answer) {
    const d = data(answer);
    const res = (d?.results as { correct: boolean }[] | undefined) ?? [];
    return res.length >= 10 && res.filter((r) => r.correct).length / res.length >= 0.9;
  },
  fingerprint: (item) => item.prompt.digits.slice(0, 40).join(''),
  promptText: (item) => `Rechenkette ${item.prompt.durationMs / 60000} min`,
};
