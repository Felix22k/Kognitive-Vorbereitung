/**
 * Generator Figurenreihen (Modul 6.5): 5 Figuren, die 6. ist gesucht.
 * Regeln: Progression (gleichmäßige Veränderung) und Wechsel (zwei Zustände).
 * Tags: fr.progression, fr.wechsel und je Merkmal, z. B. fr.progression.drehung.
 */
import { createRng, type Rng } from '../core/rng';
import type { Generator, Item } from '../core/types';
import { LETTERS, baseValidate, timeForLevel, type AnswerValue } from './common';
import {
  ALL_SHAPES,
  OUTER_SHAPES,
  ROTATABLE,
  SMALL_SHAPES,
  attrId,
  attrInfo,
  clonePanel,
  getAttr,
  renderKey,
  setAttr,
  visibleAttrs,
  type AttrRef,
  type Layer,
  type Panel,
} from './figuren/model';

export type FrRule = 'progression' | 'wechsel';

export interface FrPrompt {
  /** die 5 sichtbaren Figuren */
  seq: Panel[];
  options: Panel[];
  correctIndex: number;
  rules: { attr: string; rule: FrRule; text: string }[];
  constants: string[];
  solution: Panel;
}

export type FrItem = Item<FrPrompt, number>;

export const GENERATOR_ID = 'figurenreihen';
export const GENERATOR_VERSION = 1;
const LEN = 6;

type V = number | string;

function nActive(level: number, rng: Rng): number {
  if (level <= 2) return 1;
  if (level <= 5) return 2;
  if (level <= 8) return rng.int(2, 3);
  return 3;
}

function basePanel(rng: Rng, level: number): Panel {
  const punkte = (): Layer => ({
    kind: 'punkte',
    shape: rng.pick(SMALL_SHAPES),
    count: rng.chance(0.4) ? 1 : rng.int(2, 4),
    fill: rng.int(0, 2),
    pos: rng.int(0, 8),
  });
  if (level >= 7 && rng.chance(level >= 9 ? 0.5 : 0.3)) {
    return {
      layers: [
        { kind: 'form', shape: rng.pick(OUTER_SHAPES), size: 2, fill: 0, rot: 0, line: 0 },
        punkte(),
      ],
    };
  }
  if (rng.chance(0.6))
    return {
      layers: [
        {
          kind: 'form',
          shape: rng.pick(rng.chance(0.6) ? ROTATABLE : ALL_SHAPES),
          size: rng.int(0, 2),
          fill: rng.int(0, 3),
          rot: rng.int(0, 7),
          line: rng.chance(0.8) ? 0 : 1,
        },
      ],
    };
  return { layers: [punkte()] };
}

interface Active {
  attr: AttrRef;
  rule: FrRule;
  values: V[];
  step?: number;
  text: string;
}

function makeActive(rng: Rng, p: Panel, a: AttrRef, usedSteps: number[]): Active | null {
  const info = attrInfo(p, a);
  const v0 = getAttr(p, a);
  const name = info.name;
  const canProg = info.kind === 'cyc' || info.kind === 'num';
  if (canProg && (rng.chance(0.75) || info.kind === 'cyc')) {
    if (info.kind === 'cyc') {
      const m = info.values.length;
      const steps = (m === 8 ? [1, 2, 3, -1, -3] : [1, 2, 4, -1, 3]).filter(
        (s) => !usedSteps.includes(Math.abs(s)),
      );
      if (!steps.length) return null;
      const step = rng.pick(steps);
      const values = Array.from(
        { length: LEN },
        (_, i) => ((((v0 as number) + step * i) % m) + m) % m,
      );
      const text =
        a.key === 'rot'
          ? `${name}: pro Schritt ${Math.abs(step) * 45}° ${step > 0 ? 'im' : 'gegen den'} Uhrzeigersinn weiter.`
          : `${name}: der Punkt wandert pro Schritt ${Math.abs(step)} ${Math.abs(step) === 1 ? 'Platz' : 'Plätze'} ${step > 0 ? 'weiter' : 'zurück'} (Lesereihenfolge, nach Feld 9 wieder Feld 1).`;
      return { attr: a, rule: 'progression', values, step, text };
    }
    // Anzahl: ±1 über 6 Glieder im Bereich 1 bis 9
    const step = rng.pick([1, -1]);
    const start = step > 0 ? rng.int(1, 4) : rng.int(6, 9);
    const values = Array.from({ length: LEN }, (_, i) => start + step * i);
    return {
      attr: a,
      rule: 'progression',
      values,
      step,
      text: `${name}: ${step > 0 ? '+1' : '−1'} pro Schritt.`,
    };
  }
  // Wechsel zweier Zustände
  let other: V | undefined;
  if (info.kind === 'cat') {
    let dom = info.values;
    const layer = p.layers[a.layer];
    if (a.key === 'shape' && layer.kind === 'form') {
      if (p.layers.length > 1) dom = OUTER_SHAPES;
      else if (ROTATABLE.includes(layer.shape)) dom = ROTATABLE;
    }
    other = rng.pick(dom.filter((x) => x !== v0));
  } else if (info.kind === 'ord' || info.kind === 'num') {
    other = rng.pick(
      (info.values as number[]).filter((x) => x !== v0 && Math.abs(x - (v0 as number)) <= 2),
    );
  } else return null;
  if (other === undefined) return null;
  const values = Array.from({ length: LEN }, (_, i) => (i % 2 === 0 ? v0 : other!));
  return {
    attr: a,
    rule: 'wechsel',
    values,
    step: 2,
    text: `${name}: ${info.format(v0)} und ${info.format(other)} im Wechsel.`,
  };
}

/** Alle Deutungen der ersten 5 Werte: konstant, Wechsel, Dreierzyklus, gleichmäßige Veränderung. */
export function predictNext(vals: V[], kind: string, mod: number): V[] {
  const out = new Set<string>();
  const res: V[] = [];
  const add = (v: V) => {
    if (!out.has(String(v))) {
      out.add(String(v));
      res.push(v);
    }
  };
  if (vals.every((v) => v === vals[0])) add(vals[0]);
  if (vals[0] === vals[2] && vals[2] === vals[4] && vals[1] === vals[3] && vals[0] !== vals[1])
    add(vals[1]);
  if (vals[0] === vals[3] && vals[1] === vals[4] && new Set(vals.slice(0, 3)).size === 3)
    add(vals[2]);
  if (kind === 'num' || kind === 'ord' || kind === 'cyc') {
    const n = vals as number[];
    const norm = (x: number) => (kind === 'cyc' ? ((x % mod) + mod) % mod : x);
    const d = norm(n[1] - n[0]);
    if (d !== 0 && n.every((x, i) => i === 0 || norm(x - n[i - 1]) === d)) add(norm(n[4] + d));
  }
  return res;
}

export function checkSequence(full: Panel[]): string | null {
  const sol = full[LEN - 1];
  for (const a of visibleAttrs(sol)) {
    if (a.key === 'pos' && full.some((p) => getAttr(p, { layer: a.layer, key: 'count' }) !== 1))
      continue;
    const info = attrInfo(sol, a);
    const vals = full.slice(0, LEN - 1).map((p) => getAttr(p, a));
    const preds = predictNext(vals, info.kind, info.values.length);
    const correct = String(getAttr(sol, a));
    if (!preds.map(String).includes(correct)) return `${info.name}: keine Regel erklärt die Lösung`;
    if (preds.length > 1) return `${info.name}: mehrdeutig`;
  }
  return null;
}

/** Typische Fehler je Merkmal: nicht weitergerechnet, doppelt weitergerechnet, falscher Zustand. */
function errorValues(rng: Rng, p: Panel, a: AttrRef, act: Active | undefined, seqVals: V[]): V[] {
  const info = attrInfo(p, a);
  const v = getAttr(p, a);
  const out: V[] = [];
  const push = (x: V | undefined) => {
    if (x !== undefined && x !== v && !out.includes(x)) out.push(x);
  };
  if (act?.rule === 'progression') {
    const step = act.step!;
    const last = seqVals[LEN - 2];
    if (info.kind === 'cyc') {
      const m = info.values.length;
      push(last);
      push(((((v as number) + step) % m) + m) % m);
      push(((((v as number) - 2 * step) % m) + m) % m);
    } else {
      push(last);
      const y = (v as number) + step;
      if (y >= 1 && y <= 9) push(y);
      const z = (v as number) - 2 * step;
      if (z >= 1 && z <= 9) push(z);
    }
  } else if (act?.rule === 'wechsel') {
    push(seqVals[LEN - 2]);
  }
  // weitere plausible Werte
  if (info.kind === 'cat') {
    let dom = info.values;
    const layer = p.layers[a.layer];
    if (a.key === 'shape' && layer.kind === 'form') {
      if (p.layers.length > 1) dom = OUTER_SHAPES;
      else if (ROTATABLE.includes(layer.shape)) dom = ROTATABLE;
    }
    for (const x of rng.shuffle(dom)) push(x);
  } else if (info.kind === 'cyc') {
    const m = info.values.length;
    for (const d of rng.shuffle([1, -1, 2, -2])) push(((((v as number) + d) % m) + m) % m);
  } else {
    for (const d of rng.shuffle([1, -1, 2, -2])) {
      const y = (v as number) + d;
      if ((info.values as number[]).includes(y)) push(y);
    }
  }
  return out;
}

export function generateSequence(seed: number, level: number): FrItem {
  const rng = createRng(seed);
  const lvl = Math.max(1, Math.min(10, Math.round(level)));
  for (let attempt = 0; attempt < 400; attempt++) {
    const base = basePanel(rng, lvl);
    const vis = rng.shuffle(visibleAttrs(base).filter((a) => a.key !== 'line' || lvl >= 4));
    const n = nActive(lvl, rng);
    const active: Active[] = [];
    const usedSteps: number[] = [];
    for (const a of vis) {
      if (active.length >= n) break;
      if (a.key === 'pos' && active.some((x) => x.attr.key === 'count')) continue;
      if (a.key === 'count' && active.some((x) => x.attr.key === 'pos')) continue;
      // Auf hohen Stufen unterschiedliche Schrittweiten
      const act = makeActive(rng, base, a, lvl >= 9 ? usedSteps : []);
      if (!act) continue;
      active.push(act);
      usedSteps.push(Math.abs(act.step ?? 0));
    }
    if (active.length < n) continue;
    // Anzahl verändert: Position unsichtbar, darf dann nicht aktiv sein
    if (active.some((x) => x.attr.key === 'count') && active.some((x) => x.attr.key === 'pos'))
      continue;
    let full: Panel[] = Array.from({ length: LEN }, () => clonePanel(base));
    for (const act of active) full = full.map((p, i) => setAttr(p, act.attr, act.values[i]));
    // Variiert die Anzahl, steht eine einzelne Figur immer in der Mitte
    if (
      new Set(full.map((c) => c.layers.map((l) => (l.kind === 'punkte' ? l.count : 0)).join()))
        .size > 1
    )
      full = full.map((c) => ({
        layers: c.layers.map((l) => (l.kind === 'punkte' ? { ...l, pos: 4 } : l)),
      }));
    if (new Set(full.map(renderKey)).size < 2) continue;
    if (checkSequence(full)) continue;
    const sol = full[LEN - 1];

    // Optionen: 2 × 2 ausgewogen plus eine Option mit zwei anderen Fehlern
    const visSol = visibleAttrs(sol);
    const countVaries =
      new Set(full.map((p) => p.layers.map((l) => (l.kind === 'punkte' ? l.count : 0)).join()))
        .size > 1;
    const dimsCand = [
      ...rng.shuffle(active.map((x) => x.attr)),
      ...rng.shuffle(visSol.filter((a) => !active.some((x) => attrId(x.attr) === attrId(a)))),
    ].filter((a) => {
      if (a.key === 'count' && visSol.some((v) => v.key === 'pos')) return false;
      if (a.key === 'pos' && countVaries) return false;
      return visSol.some((v) => attrId(v) === attrId(a));
    });
    const dims: { attr: AttrRef; e: V[] }[] = [];
    for (const a of dimsCand) {
      if (dims.length === 2) break;
      const act = active.find((x) => attrId(x.attr) === attrId(a));
      const e = errorValues(
        rng,
        sol,
        a,
        act,
        full.map((p) => getAttr(p, a)),
      );
      if (e.length >= 2) dims.push({ attr: a, e });
    }
    if (dims.length < 2) continue;
    const [A, B] = dims;
    const cands = [
      sol,
      setAttr(sol, A.attr, A.e[0]),
      setAttr(sol, B.attr, B.e[0]),
      setAttr(setAttr(sol, A.attr, A.e[0]), B.attr, B.e[0]),
      setAttr(setAttr(sol, A.attr, A.e[1]), B.attr, B.e[1]),
    ];
    if (new Set(cands.map(renderKey)).size !== 5) continue;
    const options = rng.shuffle(cands);
    const solKey = renderKey(sol);
    const correctIndex = options.findIndex((p) => renderKey(p) === solKey);

    const tags: string[] = [];
    for (const act of active) {
      if (!tags.includes(`fr.${act.rule}`)) tags.push(`fr.${act.rule}`);
      tags.push(`fr.${act.rule}.${attrInfo(base, act.attr).tag}`);
    }
    const constants = visSol
      .filter((a) => !active.some((x) => attrId(x.attr) === attrId(a)))
      .filter((a) => !(a.key === 'pos' && countVaries))
      .map((a) => `${attrInfo(sol, a).name}: bleibt ${attrInfo(sol, a).format(getAttr(sol, a))}`);
    const prompt: FrPrompt = {
      seq: full.slice(0, LEN - 1),
      options,
      correctIndex,
      rules: active.map((x) => ({ attr: attrInfo(base, x.attr).name, rule: x.rule, text: x.text })),
      constants,
      solution: sol,
    };
    return {
      id: `${GENERATOR_ID}-${seed}-${lvl}`,
      moduleId: 'figurenreihen',
      generatorId: GENERATOR_ID,
      generatorVersion: GENERATOR_VERSION,
      seed,
      level: lvl,
      tags,
      prompt,
      correct: correctIndex,
      correctLabel: LETTERS[correctIndex],
      explanation: [...prompt.rules.map((r) => r.text), ...constants.map((c) => c + '.')].join(
        '\n',
      ),
      timeLimitMs: timeForLevel(lvl, 30, 60),
      answerKind: 'choice',
    };
  }
  throw new Error(`Figurenreihen: keine gültige Aufgabe für Stufe ${lvl}`);
}

export const figurenreihenGenerator: Generator<FrPrompt, number> = {
  id: GENERATOR_ID,
  version: GENERATOR_VERSION,
  generate: (seed, level) => generateSequence(seed, level),
  validate(item) {
    const errs = baseValidate(item as Item);
    const p = item.prompt;
    if (p.seq.length !== LEN - 1) errs.push('falsche Länge');
    if (p.options.length !== 5) errs.push('nicht 5 Optionen');
    if (new Set(p.options.map(renderKey)).size !== p.options.length)
      errs.push('Optionen sehen gleich aus');
    if (renderKey(p.options[p.correctIndex]) !== renderKey(p.solution))
      errs.push('richtige Option fehlt');
    const amb = checkSequence([...p.seq, p.solution]);
    if (amb) errs.push(amb);
    return errs;
  },
  check(item, answer) {
    const a = answer as AnswerValue;
    return a.type === 'choice' && a.index === item.prompt.correctIndex;
  },
  fingerprint(item) {
    return item.prompt.seq.map(renderKey).join(';');
  },
  promptText(item) {
    return (
      'Figurenreihe: ' +
      item.prompt.rules
        .map((r) => `${r.attr} (${r.rule === 'wechsel' ? 'Wechsel' : 'Progression'})`)
        .join(', ')
    );
  },
};
