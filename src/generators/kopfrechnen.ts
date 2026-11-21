/**
 * Generator Kopfrechnen (Modul 6.1).
 * Aufgabenarten (Tags): kr.add, kr.sub, kr.mul, kr.div, kr.klammer,
 * kr.prozent, kr.bruch, kr.wurzel, kr.flaeche, kr.dezimal.
 */
import { createRng, type Rng } from '../core/rng';
import {
  add,
  eq,
  formatRational,
  gcd,
  isFiniteDecimal,
  lcm,
  mul,
  parseAnswer,
  rat,
  sub,
  toNumber,
  type Rational,
} from '../core/rational';
import type { Generator, Item } from '../core/types';
import { baseValidate, timeForLevel, type AnswerValue } from './common';
import { bin, evalText, evaluate, num, paren, render, steps, type Expr } from './expr';
import * as T from './kopfrechnen-tipps';

export interface KrPrompt {
  /** Rechnung oder Aufgabentext. */
  text: string;
  /** Zusatz, z. B. "Fläche in cm²". */
  hint?: string;
  /** Auswahlantworten (für den Auswahlmodus). */
  options: string[];
  correctIndex: number;
  /** Ergebnis als Bruch erwartet. */
  fraction: boolean;
  /** Rechenweg (kurz). */
  steps: string[];
  /** So geht's im Kopf: Strategien und Fallen. */
  tips: string[];
}

export interface KrCorrect {
  n: number;
  d: number;
  requireReducedFraction: boolean;
}

interface Task {
  text: string;
  hint?: string;
  value: Rational;
  tags: string[];
  explanation: string[];
  tips: string[];
  /** Term, falls die Aufgabe ein Rechenterm ist. */
  expr?: Expr;
  /** Ergebnis bei Strich vor Punkt (für den Fallen-Hinweis). */
  invertedLabel?: string | null;
  wrongs: Rational[];
  fraction?: boolean;
  requireReducedFraction?: boolean;
}

const r = (n: number, d = 1) => rat(n, d);

// ---------- Hilfen ----------

function exprTask(e: Expr, tags: string[], extraWrongs: Rational[] = [], fraction = false): Task {
  const text = render(e);
  const value = evaluate(e);
  const wrongs = [...extraWrongs];
  let invertedLabel: string | null = null;
  try {
    const inv = evalText(text, true);
    if (!eq(inv, value)) {
      wrongs.unshift(inv); // Strich vor Punkt gerechnet
      // Für den Fallen-Hinweis nur glatte Werte zeigen
      if (isFiniteDecimal(inv, 2) || (fraction && inv.d <= 100))
        invertedLabel = formatRational(inv, fraction);
    }
  } catch {
    /* ignorieren */
  }
  const st = steps(e);
  const finalLabel = formatRational(value, fraction);
  if (st.length && st[st.length - 1] !== finalLabel) st.push(finalLabel);
  return {
    text,
    value,
    tags,
    explanation: st.length ? [`${text} = ${st.join(' = ')}`] : [text],
    tips: [],
    expr: e,
    invertedLabel,
    wrongs,
    fraction,
  };
}

/** Tipp für die schwierigste Teilrechnung eines Terms (Multiplikation). */
function subTips(e: Expr): string[] {
  const out: string[] = [];
  const walk = (x: Expr) => {
    if (x.k === 'num') return;
    walk(x.l);
    walk(x.r);
    if (x.op !== '*' || out.length) return;
    let lv: Rational;
    let rv: Rational;
    try {
      lv = evaluate(x.l);
      rv = evaluate(x.r);
    } catch {
      return;
    }
    if (lv.d === 1 && rv.d === 1) {
      const a = Math.abs(lv.n);
      const b = Math.abs(rv.n);
      if (Math.max(a, b) >= 11 && Math.min(a, b) >= 3) {
        const tm = T.tipsMul(a, b);
        out.push(`Teilrechnung ${a} × ${b}: ${tm[tm.length - 1]}`);
      }
    } else if (lv.d > 1 && rv.d > 1) {
      const tb = T.tipsBruchMul(lv, rv);
      if (tb.length > 1)
        out.push(
          `Teilrechnung ${formatRational(lv, true)} × ${formatRational(rv, true)}: ${tb[1]}`,
        );
    }
  };
  walk(e);
  return out;
}

function digits(rng: Rng, n: number): number {
  return rng.int(10 ** (n - 1), 10 ** n - 1);
}

// ---------- Aufgabenarten ----------

function addTask(rng: Rng, da: number, db: number): Task {
  const a = digits(rng, da);
  const b = digits(rng, db);
  const t = exprTask(bin('+', num(a), num(b)), ['kr.add'], [r(a + b + 10), r(a + b - 10)]);
  t.tips = T.tipsAdd(a, b);
  return t;
}

function subTask(rng: Rng, da: number, db: number, allowNeg = false): Task {
  let a = digits(rng, da);
  let b = digits(rng, db);
  if (!allowNeg && b > a) [a, b] = [b, a];
  if (a === b) a += rng.int(1, 9);
  const t = exprTask(
    bin('-', num(a), num(b)),
    ['kr.sub'],
    [r(b - a), r(a - b + 10), r(a - b - 10)],
  );
  t.tips = a > b ? T.tipsSub(a, b) : [];
  return t;
}

function mulTask(rng: Rng, maxA: number, maxB: number, minA = 2, minB = 2): Task {
  const a = rng.int(minA, maxA);
  const b = rng.int(minB, maxB);
  const t = exprTask(
    bin('*', num(a), num(b)),
    ['kr.mul'],
    [r(a * b + a), r(a * b - b), r(a * b * 10)],
  );
  t.tips = T.tipsMul(a, b);
  return t;
}

function divTask(rng: Rng, maxQ: number, maxB: number): Task {
  const b = rng.int(2, maxB);
  const q = rng.int(2, maxQ);
  const t = exprTask(bin(':', num(q * b), num(b)), ['kr.div'], [r(q + 1), r(q - 1), r(q * 10)]);
  t.tips = T.tipsDiv(q * b, b);
  return t;
}

function klammerTask(rng: Rng, level: number): Task {
  const s = () => rng.int(2, 12);
  const m = () => rng.int(2, 25);
  const forms: (() => Expr)[] = [
    () => bin('+', num(m()), bin('*', num(s()), num(s()))),
    () => bin('-', bin('*', num(s()), num(s())), num(m())),
    () => bin('*', paren(bin('+', num(m()), num(s()))), num(s())),
  ];
  if (level >= 6) {
    forms.push(
      () => bin('-', bin('*', paren(bin('+', num(s()), num(s()))), num(s())), num(m())),
      () => bin('+', bin('*', num(s()), num(s())), bin(':', num(s() * 6), num(6))),
      () => bin('-', bin('*', num(s()), num(s())), bin('*', num(s()), num(rng.int(2, 6)))),
    );
  }
  if (level >= 7) {
    forms.push(
      () => bin('+', bin('*', num(s()), paren(bin('-', num(m() + 12), num(s())))), num(m())),
      () => bin('*', paren(bin('+', num(s()), num(s()))), paren(bin('-', num(m() + 12), num(s())))),
      () => bin('+', bin('-', num(m() + 20), bin('*', num(s()), num(s()))), num(m())),
    );
  }
  const t = exprTask(rng.pick(forms)(), ['kr.klammer']);
  t.tips = [...T.tipsOrder(t.invertedLabel ?? null, false), ...subTips(t.expr!)];
  return t;
}

const PROZENTE_LEICHT = [10, 20, 25, 50];
const PROZENTE = [5, 10, 15, 20, 25, 30, 40, 60, 75, 12, 35, 80];

function prozentTask(rng: Rng, level: number): Task {
  const ps = level <= 4 ? PROZENTE_LEICHT : PROZENTE;
  for (;;) {
    const p = rng.pick(ps);
    const step = level <= 4 ? 20 : rng.pick([10, 20, 40, 50]);
    const g = step * rng.int(2, level <= 4 ? 10 : 30);
    const w = r(p * g, 100);
    if (!isFiniteDecimal(w, level >= 7 ? 1 : 0)) continue;
    const wv = toNumber(w);
    return {
      text: `${p} % von ${formatRational(r(g))}`,
      value: w,
      tags: ['kr.prozent'],
      explanation: [
        `${p} % von ${formatRational(r(g))} = ${formatRational(r(g))} × ${p} : 100 = ${formatRational(w)}`,
      ],
      tips: T.tipsProzent(p, g),
      wrongs: [r(wv * 10), r(g - wv), r(wv + g / 10), r(wv * 10, 100)],
    };
  }
}

function prozentRueckTask(rng: Rng): Task {
  for (;;) {
    const p = rng.pick([5, 10, 15, 20, 25, 30, 40, 60, 75, 12, 35, 80, 120, 150]);
    const g = rng.pick([20, 40, 50, 80, 120, 150, 200, 240, 300, 360, 400, 480, 600, 800, 1200]);
    const w = r(p * g, 100);
    if (!isFiniteDecimal(w, 1)) continue;
    const wt = formatRational(w);
    return {
      text: `${wt} sind ${p} % von ?`,
      hint: 'Grundwert gesucht',
      value: r(g),
      tags: ['kr.prozent'],
      explanation: [`Grundwert = ${wt} × 100 : ${p} = ${formatRational(r(g))}`],
      tips: T.tipsProzentRueck(toNumber(w), p),
      wrongs: [mul(w, r(p, 100)), r(g * 10), r(g / 2), r(g + p)],
    };
  }
}

function properFraction(rng: Rng, maxDen: number): Rational {
  const d = rng.int(2, maxDen);
  const n = rng.int(1, d - 1);
  return r(n, d);
}

function bruchTask(rng: Rng, level: number): Task {
  const kinds =
    level >= 8 ? ['kuerzen', 'add', 'sub', 'mul', 'div', 'von'] : ['kuerzen', 'add', 'von'];
  const kind = rng.pick(kinds);
  if (kind === 'kuerzen') {
    const base = properFraction(rng, 12);
    const f = rng.int(2, 9);
    const text = `Kürze ${base.n * f}/${base.d * f}`;
    return {
      text,
      hint: 'vollständig gekürzt, als Bruch',
      value: base,
      tags: ['kr.bruch'],
      explanation: [
        `${base.n * f}/${base.d * f}: Zähler und Nenner durch ${f * gcd(base.n, base.d)} teilen = ${base.n}/${base.d}`,
      ],
      tips: T.tipsKuerzen(base.n * f, base.d * f),
      wrongs: [r(base.n * 2, base.d), r(base.n, base.d * 2), r(base.n + 1, base.d)],
      fraction: true,
      requireReducedFraction: true,
    };
  }
  if (kind === 'von') {
    const fr = properFraction(rng, 10);
    const g = fr.d * rng.int(2, 15);
    const e = bin('*', num(fr, true), num(g));
    const t = exprTask(e, ['kr.bruch'], [r(g / fr.d), r(g - (g * fr.n) / fr.d)]);
    t.text = `${fr.n}/${fr.d} von ${g}`;
    t.explanation = [`${g} : ${fr.d} × ${fr.n} = ${formatRational(t.value)}`];
    t.tips = T.tipsBruchVon(fr.n, fr.d, g);
    return t;
  }
  for (;;) {
    const a = properFraction(rng, level >= 9 ? 12 : 8);
    const b = properFraction(rng, level >= 9 ? 12 : 8);
    if (a.d === b.d && kind === 'add' && rng.chance(0.7)) continue;
    const op = kind === 'add' ? '+' : kind === 'sub' ? '-' : kind === 'mul' ? '*' : ':';
    const e = bin(op, num(a, true), num(b, true));
    const v = evaluate(e);
    if (v.n <= 0 || v.d > 60) continue;
    const wrongs: Rational[] = [];
    if (op === '+') wrongs.push(r(a.n + b.n, a.d + b.d));
    if (op === '-') wrongs.push(r(Math.abs(a.n - b.n) || 1, Math.abs(a.d - b.d) || a.d));
    if (op === ':') wrongs.push(mul(a, b));
    if (op === '*') wrongs.push(r(a.n * b.d, a.d * b.n));
    const t = exprTask(e, ['kr.bruch'], wrongs, true);
    t.tips =
      op === '+' || op === '-'
        ? T.tipsBruchAddSub(a, b, op)
        : op === '*'
          ? T.tipsBruchMul(a, b)
          : T.tipsBruchDiv(a, b);
    if (op === '+' || op === '-') {
      const hn = lcm(a.d, b.d);
      t.explanation = [
        `Hauptnenner ${hn}: ${(a.n * hn) / a.d}/${hn} ${op === '+' ? '+' : '−'} ${(b.n * hn) / b.d}/${hn} = ${formatRational(v, true)}`,
      ];
    } else if (op === ':') {
      t.explanation = [
        `Durch einen Bruch teilen = mit dem Kehrwert malnehmen: ${a.n}/${a.d} × ${b.d}/${b.n} = ${formatRational(v, true)}`,
      ];
    }
    return t;
  }
}

function wurzelTask(rng: Rng): Task {
  if (rng.chance(0.7)) {
    const n = rng.int(4, 30);
    return {
      text: `√${formatRational(r(n * n))}`,
      value: r(n),
      tags: ['kr.wurzel'],
      explanation: [
        `${n} × ${n} = ${formatRational(r(n * n))}, also √${formatRational(r(n * n))} = ${n}`,
      ],
      tips: T.tipsWurzel(n, false),
      wrongs: [r(n + 1), r(n - 1), r(Math.round((n * n) / 2))],
    };
  }
  const n = rng.int(2, 10);
  return {
    text: `∛${formatRational(r(n ** 3))}`,
    value: r(n),
    tags: ['kr.wurzel'],
    explanation: [
      `${n} × ${n} × ${n} = ${formatRational(r(n ** 3))}, also ∛${formatRational(r(n ** 3))} = ${n}`,
    ],
    tips: T.tipsWurzel(n, true),
    wrongs: [r(n + 1), r(n - 1), r(Math.round(n ** 3 / 3))],
  };
}

function flaecheTask(rng: Rng, level: number): Task {
  const shapes =
    level >= 8 ? ['rechteck', 'dreieck', 'trapez', 'kreis'] : ['rechteck', 'dreieck', 'trapez'];
  const shape = rng.pick(shapes);
  const hint = 'Fläche in cm²';
  if (shape === 'rechteck') {
    const a = rng.int(3, 25);
    const b = rng.int(3, 15);
    return {
      text: `Rechteck: a = ${a} cm, b = ${b} cm`,
      hint,
      value: r(a * b),
      tags: ['kr.flaeche'],
      explanation: [`A = a × b = ${a} × ${b} = ${a * b} cm²`],
      tips: T.tipsRechteck(a, b),
      wrongs: [r(2 * (a + b)), r(a * b + a), r(a * b - b)],
    };
  }
  if (shape === 'dreieck') {
    const g = rng.int(3, 24);
    const h = rng.int(3, 16);
    const v = r(g * h, 2);
    return {
      text: `Dreieck: g = ${g} cm, h = ${h} cm`,
      hint,
      value: v,
      tags: ['kr.flaeche'],
      explanation: [`A = g × h : 2 = ${g} × ${h} : 2 = ${formatRational(v)} cm²`],
      tips: T.tipsDreieck(g, h),
      wrongs: [r(g * h), r(g + h), r(g * h, 4)],
    };
  }
  if (shape === 'trapez') {
    const a = rng.int(6, 20);
    const c = rng.int(2, a - 2);
    const h = rng.int(2, 12);
    const v = r((a + c) * h, 2);
    return {
      text: `Trapez: a = ${a} cm, c = ${c} cm, h = ${h} cm`,
      hint,
      value: v,
      tags: ['kr.flaeche'],
      explanation: [`A = (a + c) : 2 × h = (${a} + ${c}) : 2 × ${h} = ${formatRational(v)} cm²`],
      tips: T.tipsTrapez(a, c, h),
      wrongs: [r((a + c) * h), r(a * c), r(a * h)],
    };
  }
  const rad = rng.int(1, 10);
  const v = r(314 * rad * rad, 100);
  return {
    text: `Kreis: r = ${rad} cm (π = 3,14)`,
    hint,
    value: v,
    tags: ['kr.flaeche'],
    explanation: [`A = π × r² = 3,14 × ${rad * rad} = ${formatRational(v)} cm²`],
    tips: T.tipsKreis(rad),
    wrongs: [r(314 * 4 * rad * rad, 100), r(314 * 2 * rad, 100), r(314 * rad * rad, 1000)],
  };
}

function decimal(rng: Rng, maxInt: number, places: 1 | 2): Rational {
  const f = 10 ** places;
  let n = rng.int(1, maxInt * f);
  if (n % 10 === 0) n += rng.int(1, 9);
  return r(n, f);
}

function dezimalTask(rng: Rng, level: number): Task {
  const kind = rng.pick(level >= 8 ? ['add', 'sub', 'mul', 'div'] : ['add', 'sub', 'mul']);
  for (;;) {
    let e: Expr;
    if (kind === 'add')
      e = bin('+', num(decimal(rng, 50, rng.pick([1, 2]))), num(decimal(rng, 50, 1)));
    else if (kind === 'sub') {
      const a = decimal(rng, 80, rng.pick([1, 2]));
      const b = decimal(rng, 40, 1);
      if (toNumber(a) <= toNumber(b)) continue;
      e = bin('-', num(a), num(b));
    } else if (kind === 'mul') {
      e = bin('*', num(r(rng.int(1, 9), 10)), num(rng.int(3, 90)));
      if (level >= 8 && rng.chance(0.5)) e = bin('*', num(decimal(rng, 9, 1)), num(rng.int(2, 12)));
    } else {
      const b = r(rng.int(2, 9), 10);
      const q = rng.int(2, 15);
      e = bin(':', num(mul(b, r(q))), num(b));
    }
    const v = evaluate(e);
    if (!isFiniteDecimal(v, 2)) continue;
    const x = toNumber(v);
    const t = exprTask(e, ['kr.dezimal'], [r(x * 10), r(x / 10)]);
    if (e.k === 'bin' && e.l.k === 'num' && e.r.k === 'num') {
      const [lv, rv] = [e.l.v, e.r.v];
      t.tips =
        e.op === '+' || e.op === '-'
          ? T.tipsDezimalAddSub(lv, rv, e.op)
          : e.op === '*'
            ? T.tipsDezimalMul(lv, rv)
            : T.tipsDezimalDiv(lv, rv);
    }
    return t;
  }
}

/** Mehrschrittige Terme mit Brüchen und Dezimalzahlen (Stufe 9 bis 10). */
function mehrschrittTask(rng: Rng, level: number): Task {
  for (let tries = 0; tries < 200; tries++) {
    const forms: (() => { e: Expr; tags: string[] })[] = [
      () => {
        const a = properFraction(rng, 8);
        const b = properFraction(rng, 8);
        const k = lcm(a.d, b.d) * rng.int(1, 4);
        return {
          e: bin(
            '-',
            bin('*', paren(bin('+', num(a, true), num(b, true))), num(k)),
            num(decimal(rng, 9, 1)),
          ),
          tags: ['kr.klammer', 'kr.bruch', 'kr.dezimal'],
        };
      },
      () => {
        const d = r(rng.pick([1, 2, 3, 5, 15, 25]), 10);
        return {
          e: bin(
            ':',
            bin('*', num(d), paren(bin('-', num(rng.int(20, 60)), num(rng.int(2, 19))))),
            num(rng.pick([2, 4, 5])),
          ),
          tags: ['kr.klammer', 'kr.dezimal'],
        };
      },
      () => {
        const a = properFraction(rng, 6);
        return {
          e: bin(
            '+',
            bin('*', num(a, true), num(a.d * rng.int(2, 12))),
            bin('*', num(decimal(rng, 5, 1)), num(rng.int(2, 9))),
          ),
          tags: ['kr.klammer', 'kr.bruch', 'kr.dezimal'],
        };
      },
      () => {
        const p = rng.pick([10, 20, 25, 50]);
        const g = rng.pick([40, 80, 120, 160, 200]);
        return {
          e: bin(
            '-',
            bin('*', num(r(p, 100), true), num(g)),
            bin(':', num(decimal(rng, 20, 1)), num(rng.pick([2, 4, 5]))),
          ),
          tags: ['kr.klammer', 'kr.bruch', 'kr.dezimal'],
        };
      },
    ];
    if (level >= 10) {
      forms.push(() => {
        const a = properFraction(rng, 6);
        const b = properFraction(rng, 6);
        return {
          e: bin(
            '*',
            paren(bin('-', num(rng.int(2, 6)), num(a, true))),
            paren(bin('+', num(b, true), num(decimal(rng, 3, 1)))),
          ),
          tags: ['kr.klammer', 'kr.bruch', 'kr.dezimal'],
        };
      });
    }
    const { e, tags } = rng.pick(forms)();
    let v: Rational;
    try {
      v = evaluate(e);
    } catch {
      continue;
    }
    if (!isFiniteDecimal(v, 2) || Math.abs(toNumber(v)) > 2000) continue;
    const x = toNumber(v);
    const t = exprTask(e, tags, [r(Math.round(x * 10 * 100), 100), r(x + 1)]);
    t.tips = [...T.tipsOrder(t.invertedLabel ?? null, tags.includes('kr.bruch')), ...subTips(e)];
    return t;
  }
  return klammerTask(rng, 7);
}

// ---------- Auswahl nach Stufe ----------

type Builder = (rng: Rng) => Task;

function poolFor(level: number): [Builder, number][] {
  switch (level) {
    case 1:
      return [
        [(g) => addTask(g, 2, 2), 1],
        [(g) => subTask(g, 2, 2), 1],
      ];
    case 2:
      return [
        [(g) => addTask(g, 2, 2), 1],
        [(g) => subTask(g, 2, 2), 1],
        [(g) => mulTask(g, 10, 10), 1],
        [(g) => divTask(g, 10, 10), 1],
      ];
    case 3:
      return [
        [(g) => mulTask(g, 20, 20, 3, 3), 2],
        [(g) => divTask(g, 20, 20), 2],
        [(g) => addTask(g, 2, 2), 0.5],
        [(g) => subTask(g, 2, 2), 0.5],
      ];
    case 4:
      return [
        [(g) => addTask(g, 3, 2), 1],
        [(g) => subTask(g, 3, 2), 1],
        [(g) => mulTask(g, 20, 9, 11, 3), 1],
        [(g) => divTask(g, 25, 12), 1],
        [(g) => prozentTask(g, 4), 1],
        [(g) => klammerTask(g, 4), 1],
      ];
    case 5:
      return [
        [(g) => addTask(g, 3, 3), 1],
        [(g) => subTask(g, 3, 3), 1],
        [(g) => mulTask(g, 99, 99, 11, 11), 1.5],
        [(g) => prozentTask(g, 5), 1.5],
        [(g) => klammerTask(g, 5), 1],
        [(g) => dezimalTask(g, 5), 0.5],
      ];
    case 6:
      return [
        [(g) => klammerTask(g, 6), 1.5],
        [(g) => dezimalTask(g, 6), 1],
        [(g) => prozentTask(g, 6), 1],
        [(g) => mulTask(g, 99, 99, 11, 11), 1],
        [(g) => divTask(g, 99, 9), 1],
        [(g) => flaecheTask(g, 6), 1],
      ];
    case 7:
      return [
        [(g) => bruchTask(g, 7), 1.5],
        [(g) => wurzelTask(g), 1.5],
        [(g) => klammerTask(g, 7), 1.5],
        [(g) => flaecheTask(g, 7), 1],
        [(g) => prozentTask(g, 7), 0.5],
        [(g) => dezimalTask(g, 7), 0.5],
      ];
    case 8:
      return [
        [(g) => bruchTask(g, 8), 1.5],
        [(g) => dezimalTask(g, 8), 1],
        [(g) => flaecheTask(g, 8), 1],
        [(g) => prozentRueckTask(g), 1],
        [(g) => wurzelTask(g), 0.5],
        [(g) => klammerTask(g, 8), 1],
      ];
    case 9:
      return [
        [(g) => mehrschrittTask(g, 9), 2],
        [(g) => prozentRueckTask(g), 1],
        [(g) => bruchTask(g, 9), 1],
        [(g) => flaecheTask(g, 9), 0.5],
        [(g) => dezimalTask(g, 9), 0.5],
      ];
    default:
      return [
        [(g) => mehrschrittTask(g, 10), 3],
        [(g) => prozentRueckTask(g), 1],
        [(g) => bruchTask(g, 10), 1],
      ];
  }
}

// ---------- Optionen ----------

function makeOptions(rng: Rng, t: Task): { options: string[]; correctIndex: number } {
  const fmt = (v: Rational) => formatRational(v, !!t.fraction);
  const v = t.value;
  const correctLabel = fmt(v);
  const seen = new Set([correctLabel]);
  const wrong: string[] = [];
  const candidates: Rational[] = [
    ...t.wrongs,
    mul(v, r(10)),
    mul(v, r(-1)),
    add(v, r(10)),
    sub(v, r(10)),
    add(v, r(1)),
    sub(v, r(1)),
    add(v, r(2)),
    add(v, r(100)),
    mul(v, r(1, 10)),
    mul(v, r(2)),
  ];
  for (const c of candidates) {
    if (wrong.length >= 3) break;
    if (!t.fraction && !isFiniteDecimal(c, 2)) continue;
    if (t.fraction && c.d > 1000) continue;
    if (Math.abs(toNumber(c)) > 1e6) continue;
    const label = fmt(c);
    if (seen.has(label)) continue;
    seen.add(label);
    wrong.push(label);
  }
  const all = rng.shuffle([correctLabel, ...wrong]);
  return { options: all, correctIndex: all.indexOf(correctLabel) };
}

export const GENERATOR_ID = 'kopfrechnen';
export const GENERATOR_VERSION = 2; // v2: Rechenweg und Kopfrechen-Strategien

export type KrItem = Item<KrPrompt, KrCorrect>;

export const kopfrechnenGenerator: Generator<KrPrompt, KrCorrect> = {
  id: GENERATOR_ID,
  version: GENERATOR_VERSION,
  generate(seed, level) {
    const rng = createRng(seed);
    const lvl = Math.max(1, Math.min(10, Math.round(level)));
    let task: Task | null = null;
    for (let i = 0; i < 50 && !task; i++) {
      const t = rng.weighted(poolFor(lvl))(rng);
      const ok =
        (t.fraction || isFiniteDecimal(t.value, 2)) && Math.abs(toNumber(t.value)) < 100_000;
      if (ok) task = t;
    }
    if (!task) throw new Error('Kopfrechnen: keine gültige Aufgabe gefunden');
    const { options, correctIndex } = makeOptions(rng, task);
    const correctLabel = formatRational(task.value, !!task.fraction);
    return {
      id: `${GENERATOR_ID}-${seed}-${lvl}`,
      moduleId: 'kopfrechnen',
      generatorId: GENERATOR_ID,
      generatorVersion: GENERATOR_VERSION,
      seed,
      level: lvl,
      tags: task.tags,
      prompt: {
        text: task.text,
        hint: task.hint,
        options,
        correctIndex,
        fraction: !!task.fraction,
        steps: task.explanation,
        tips: task.tips,
      },
      correct: {
        n: task.value.n,
        d: task.value.d,
        requireReducedFraction: !!task.requireReducedFraction,
      },
      correctLabel,
      explanation: [
        'Rechenweg: ' + task.explanation.join(' '),
        ...(task.tips.length ? ["So geht's im Kopf:", ...task.tips.map((x) => '• ' + x)] : []),
      ].join('\n'),
      timeLimitMs: timeForLevel(lvl, 15, 45),
      answerKind: 'number',
    };
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    const p = item.prompt;
    if (new Set(p.options).size !== p.options.length) errs.push('Optionen nicht verschieden');
    if (p.options.length !== 4) errs.push(`Optionenzahl ${p.options.length} statt 4`);
    if (!p.tips?.length) errs.push('keine Kopfrechen-Tipps');
    if (p.options[p.correctIndex] !== item.correctLabel) errs.push('richtige Option fehlt');
    const v = rat(item.correct.n, item.correct.d);
    if (!p.fraction && !isFiniteDecimal(v, 2))
      errs.push('Ergebnis mit mehr als 2 Nachkommastellen');
    // Die richtige Option muss bei der Prüfung als richtig gelten
    if (
      !this.check(item, {
        type: 'text',
        raw: item.correctLabel.replace('−', '-'),
      } satisfies AnswerValue)
    )
      errs.push('richtige Lösung wird nicht akzeptiert');
    return errs;
  },
  check(item, answer) {
    const a = answer as AnswerValue;
    if (a.type === 'choice') return a.index === item.prompt.correctIndex;
    const parsed = parseAnswer(a.raw);
    if (!parsed) return false;
    const target = rat(item.correct.n, item.correct.d);
    if (!eq(parsed.value, target)) return false;
    if (item.correct.requireReducedFraction && target.d !== 1) {
      // Bruch muss vollständig gekürzt eingegeben werden
      const m = /^\s*-?(\d+)\s*\/\s*(\d+)\s*$/.exec(a.raw);
      if (!m) return false;
      return gcd(parseInt(m[1], 10), parseInt(m[2], 10)) === 1;
    }
    return true;
  },
  fingerprint(item) {
    return item.prompt.text;
  },
  promptText(item) {
    return item.prompt.text + (item.prompt.hint ? ` (${item.prompt.hint})` : '');
  },
};
