/**
 * Generator Figurale Matrizen (Modul 6.4).
 * Tags: mx.konstant, mx.progression, mx.vert3, mx.addSub, mx.xor
 * sowie je Merkmal, z. B. mx.xor.linien oder mx.progression.anzahl.
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
  popcount,
  renderKey,
  setAttr,
  visibleAttrs,
  type AttrRef,
  type Layer,
  type Panel,
  type ShapeName,
} from './figuren/model';
import {
  RULE_COMPLEXITY,
  generateGrid,
  predict,
  rulesForKind,
  type Domain,
  type Orientation,
  type RuleId,
  type RuleParams,
  type Val,
} from './figuren/matrixRules';

export interface MxRuleInfo {
  attr: string;
  rule: RuleId;
  orientation: Orientation;
  text: string;
}

export interface MxPrompt {
  /** 9 Felder, null an der Lücke */
  cells: (Panel | null)[];
  missing: number;
  options: Panel[];
  correctIndex: number;
  rules: MxRuleInfo[];
  constants: string[];
  solution: Panel;
}

export type MxItem = Item<MxPrompt, number>;

export const GENERATOR_ID = 'matrizen';
export const GENERATOR_VERSION = 1;

interface LevelConfig {
  nRules: number;
  maxComplexity: number;
  twoLayers: number;
  colChance: number;
  otherMissing: number;
  options: 6 | 8;
  needHard: boolean;
}

function config(level: number, rng: Rng): LevelConfig {
  const t: Record<number, Omit<LevelConfig, 'nRules'> & { n: [number, number] }> = {
    1: {
      n: [1, 1],
      maxComplexity: 2,
      twoLayers: 0,
      colChance: 0,
      otherMissing: 0,
      options: 6,
      needHard: false,
    },
    2: {
      n: [1, 1],
      maxComplexity: 3,
      twoLayers: 0,
      colChance: 0,
      otherMissing: 0,
      options: 6,
      needHard: false,
    },
    3: {
      n: [2, 2],
      maxComplexity: 3,
      twoLayers: 0,
      colChance: 0,
      otherMissing: 0,
      options: 6,
      needHard: false,
    },
    4: {
      n: [2, 2],
      maxComplexity: 3,
      twoLayers: 0,
      colChance: 0,
      otherMissing: 0,
      options: 6,
      needHard: false,
    },
    5: {
      n: [2, 3],
      maxComplexity: 4,
      twoLayers: 0,
      colChance: 0,
      otherMissing: 0,
      options: 6,
      needHard: false,
    },
    6: {
      n: [3, 3],
      maxComplexity: 4,
      twoLayers: 0.4,
      colChance: 0,
      otherMissing: 0,
      options: 8,
      needHard: false,
    },
    7: {
      n: [3, 3],
      maxComplexity: 5,
      twoLayers: 0.5,
      colChance: 0.3,
      otherMissing: 0,
      options: 8,
      needHard: false,
    },
    8: {
      n: [3, 4],
      maxComplexity: 5,
      twoLayers: 0.7,
      colChance: 0.3,
      otherMissing: 0.5,
      options: 8,
      needHard: false,
    },
    9: {
      n: [4, 4],
      maxComplexity: 5,
      twoLayers: 0.8,
      colChance: 0.3,
      otherMissing: 0.5,
      options: 8,
      needHard: true,
    },
    10: {
      n: [4, 4],
      maxComplexity: 5,
      twoLayers: 1,
      colChance: 0.4,
      otherMissing: 0.5,
      options: 8,
      needHard: true,
    },
  };
  const c = t[level];
  return { ...c, nRules: rng.int(c.n[0], c.n[1]) };
}

// ---------- Grundfeld ----------

function basePanel(rng: Rng, level: number, cfg: LevelConfig): Panel {
  const form = (shapes: ShapeName[]): Layer => ({
    kind: 'form',
    shape: rng.pick(shapes),
    size: rng.int(0, 2),
    fill: rng.int(0, 3),
    rot: rng.int(0, 7),
    line: rng.chance(0.75) ? 0 : 1,
  });
  const punkte = (): Layer => ({
    kind: 'punkte',
    shape: rng.pick(SMALL_SHAPES),
    count: rng.chance(0.3) ? 1 : rng.int(2, 5),
    fill: rng.int(0, 2),
    pos: rng.int(0, 8),
  });
  const linien = (): Layer => {
    let s = 0;
    while (popcount(s) < 2) s |= 1 << rng.int(0, 7);
    return { kind: 'linien', set: s };
  };
  const two = rng.chance(cfg.twoLayers);
  if (two) {
    if (rng.chance(0.5)) {
      const outer = form(OUTER_SHAPES) as Extract<Layer, { kind: 'form' }>;
      outer.size = 2;
      outer.fill = 0;
      outer.rot = 0;
      return { layers: [outer, punkte()] };
    }
    return { layers: [linien(), punkte()] };
  }
  const r = rng.next();
  // Einzelne Linien-Ebene hat nur ein Merkmal: nur dort, wo eine Regel genügt
  if (cfg.needHard) return { layers: [punkte()] };
  if (level >= 6 && cfg.nRules === 1 && r < 0.25) return { layers: [linien()] };
  if (r < 0.6) return { layers: [form(rng.chance(0.5) ? ROTATABLE : ALL_SHAPES)] };
  return { layers: [punkte()] };
}

function domainFor(p: Panel, a: AttrRef, rotActive: boolean): Domain {
  const info = attrInfo(p, a);
  const layer = p.layers[a.layer];
  if (info.kind === 'cat' && a.key === 'shape' && layer.kind === 'form') {
    if (p.layers.length > 1) return { kind: 'cat', values: OUTER_SHAPES };
    if (rotActive || ROTATABLE.includes(layer.shape)) return { kind: 'cat', values: ROTATABLE };
  }
  return { kind: info.kind, values: info.values };
}

// ---------- Erklärungstexte ----------

const dirText = (o: Orientation) =>
  o === 'zeile' ? 'von links nach rechts' : 'von oben nach unten';
const lineWord = (o: Orientation) => (o === 'zeile' ? 'Zeile' : 'Spalte');

function ruleText(
  p: Panel,
  a: AttrRef,
  rule: RuleId,
  o: Orientation,
  params: RuleParams,
  grid: Val[],
): string {
  const info = attrInfo(p, a);
  const fmt = (v: Val) => info.format(v);
  const firstLine = o === 'zeile' ? [grid[0], grid[1], grid[2]] : [grid[0], grid[3], grid[6]];
  const f1 = o === 'zeile' ? 'Feld 1' : 'oben';
  const f2 = o === 'zeile' ? 'Feld 2' : 'Mitte';
  const f3 = o === 'zeile' ? 'Feld 3' : 'unten';
  switch (rule) {
    case 'konstant': {
      const vals = o === 'zeile' ? [grid[0], grid[3], grid[6]] : [grid[0], grid[1], grid[2]];
      return `${info.name}: in jeder ${lineWord(o)} gleich (${vals.map(fmt).join(', ')}).`;
    }
    case 'vert3':
      return `${info.name}: jede ${lineWord(o)} enthält ${firstLine.map(fmt).join(', ')}, jeweils genau einmal.`;
    case 'progression': {
      const s = params.step ?? 1;
      if (a.key === 'rot')
        return `${info.name}: pro Feld um ${Math.abs(s) * 45}° ${s > 0 ? 'im' : 'gegen den'} Uhrzeigersinn weiter (${dirText(o)}).`;
      if (a.key === 'pos')
        return `${info.name}: der Punkt wandert pro Feld ${Math.abs(s)} ${Math.abs(s) === 1 ? 'Platz' : 'Plätze'} ${s > 0 ? 'weiter' : 'zurück'} (Lesereihenfolge, ${dirText(o)}).`;
      if (a.key === 'fill')
        return `${info.name}: wird pro Feld ${s > 0 ? 'dunkler' : 'heller'} (${firstLine.map(fmt).join(' → ')}).`;
      if (a.key === 'size')
        return `${info.name}: wird pro Feld ${s > 0 ? 'größer' : 'kleiner'} (${dirText(o)}).`;
      return `${info.name}: ${s > 0 ? '+' : '−'}${Math.abs(s)} pro Feld (${dirText(o)}).`;
    }
    case 'addSub':
      if (info.kind === 'set')
        return params.variant === 'add'
          ? `${info.name}: ${f3} enthält alle Linien aus ${f1} und ${f2} zusammen (Addition).`
          : `${info.name}: ${f3} = Linien aus ${f1} ohne die Linien aus ${f2} (Subtraktion).`;
      return params.variant === 'add'
        ? `${info.name}: ${f3} = ${f1} + ${f2}.`
        : `${info.name}: ${f3} = ${f1} − ${f2}.`;
    case 'xor':
      return `${info.name}: ${f3} enthält nur die Linien, die in genau einem der Felder ${f1} und ${f2} vorkommen. Gemeinsame Linien fallen weg (XOR).`;
  }
}

// ---------- Eindeutigkeit ----------

/** Prüft jedes sichtbare Merkmal: alle passenden Regeln müssen denselben Wert vorhersagen. */
export function checkMatrix(cells: Panel[], missing: number): string | null {
  const sol = cells[missing];
  const attrs = visibleAttrs(sol).filter((a) =>
    a.key === 'pos' ? cells.every((c) => getAttr(c, { layer: a.layer, key: 'count' }) === 1) : true,
  );
  for (const a of attrs) {
    const info = attrInfo(sol, a);
    const grid = cells.map((c, i) => (i === missing ? null : getAttr(c, a)));
    const preds = new Set<string>();
    for (const rule of rulesForKind(info.kind))
      for (const o of ['zeile', 'spalte'] as const)
        for (const v of predict(rule, info.kind, info.values.length, grid, o)) preds.add(String(v));
    const correct = String(getAttr(sol, a));
    if (!preds.has(correct)) return `${info.name}: keine Regel erklärt die Lösung`;
    if (preds.size > 1) return `${info.name}: mehrdeutig (${[...preds].join(' / ')})`;
  }
  return null;
}

// ---------- Antwortoptionen (ausgewogener Baum) ----------

interface Dim {
  attr: AttrRef;
  /** alternative Werte (1 oder 2) */
  alts: Val[];
}

function altValues(
  rng: Rng,
  sol: Panel,
  a: AttrRef,
  cells: Panel[],
  n: number,
  rotVisible: boolean,
): Val[] {
  const info = attrInfo(sol, a);
  const v = getAttr(sol, a);
  const inGrid = [...new Set(cells.map((c) => getAttr(c, a)))].filter((x) => x !== v);
  let pool: Val[] = [];
  if (info.kind === 'cat') {
    let dom = info.values;
    const layer = sol.layers[a.layer];
    if (a.key === 'shape' && layer.kind === 'form') {
      if (sol.layers.length > 1) dom = OUTER_SHAPES;
      else if (rotVisible) dom = ROTATABLE;
    }
    pool = [
      ...rng.shuffle(inGrid.filter((x) => dom.includes(x))),
      ...rng.shuffle(dom.filter((x) => x !== v)),
    ];
  } else if (info.kind === 'ord' || info.kind === 'num') {
    const nums = info.values as number[];
    const x = v as number;
    const near = rng.shuffle([x - 1, x + 1]).concat(rng.shuffle([x - 2, x + 2]), rng.shuffle(nums));
    pool = [...rng.shuffle(inGrid), ...near].filter((y) => nums.includes(y as number));
  } else if (info.kind === 'cyc') {
    const m = info.values.length;
    const x = v as number;
    pool = [...rng.shuffle([x + 1, x - 1]), ...rng.shuffle([x + 2, x - 2]), x + 4].map(
      (y) => ((y % m) + m) % m,
    );
  }
  const out: Val[] = [];
  for (const p of pool) if (p !== v && !out.includes(p)) out.push(p);
  return out.slice(0, n);
}

function buildOptions(
  rng: Rng,
  sol: Panel,
  cells: Panel[],
  active: AttrRef[],
  count: 6 | 8,
): { options: Panel[]; correctIndex: number } | null {
  const vis = visibleAttrs(sol);
  const rotVisible = vis.some((a) => a.key === 'rot');
  const countVaries =
    new Set(cells.map((c) => c.layers.map((l) => (l.kind === 'punkte' ? l.count : 0)).join()))
      .size > 1;
  const candidates = [
    ...rng.shuffle(active.filter((a) => vis.some((v) => attrId(v) === attrId(a)))),
    ...rng.shuffle(vis.filter((a) => !active.some((x) => attrId(x) === attrId(a)))),
  ].filter((a) => {
    // Anzahl und Position nicht zugleich verändern (Position ist nur bei Anzahl 1 sichtbar)
    if (a.key === 'count' && vis.some((v) => v.key === 'pos')) return false;
    if (a.key === 'pos' && countVaries) return false;
    return true;
  });
  const dims: Dim[] = [];
  const usedBits = new Map<string, number[]>();
  const need = count === 6 ? [2, 1] : [1, 1, 1];
  for (const n of need) {
    let placed = false;
    for (const a of candidates) {
      const info = attrInfo(sol, a);
      if (info.kind === 'set') {
        if (n !== 1) continue;
        const used = usedBits.get(attrId(a)) ?? [];
        const setVal = getAttr(sol, a) as number;
        const lineBits = cells.reduce((acc, c) => acc | (getAttr(c, a) as number), 0);
        const bits = rng
          .shuffle([0, 1, 2, 3, 4, 5, 6, 7])
          .sort((x, y) => ((lineBits >> y) & 1) - ((lineBits >> x) & 1))
          .filter((b) => !used.includes(b));
        if (!bits.length) continue;
        used.push(bits[0]);
        usedBits.set(attrId(a), used);
        dims.push({ attr: a, alts: [setVal ^ (1 << bits[0])] });
        // Bit-Flip-Dimensionen auf demselben Merkmal werden unten verrechnet
        (dims[dims.length - 1] as Dim & { bit?: number }).bit = bits[0];
        placed = true;
        break;
      }
      if (dims.some((d) => attrId(d.attr) === attrId(a))) continue;
      const alts = altValues(rng, sol, a, cells, n, rotVisible);
      if (alts.length < n) continue;
      dims.push({ attr: a, alts });
      placed = true;
      break;
    }
    if (!placed) return null;
  }
  // Kartesisches Produkt
  let combos: Panel[] = [clonePanel(sol)];
  for (const d of dims) {
    const next: Panel[] = [];
    const bit = (d as Dim & { bit?: number }).bit;
    for (const p of combos) {
      next.push(p);
      if (bit !== undefined) {
        const cur = getAttr(p, d.attr) as number;
        next.push(setAttr(p, d.attr, cur ^ (1 << bit)));
      } else for (const v of d.alts) next.push(setAttr(p, d.attr, v));
    }
    combos = next;
  }
  if (combos.length !== count) return null;
  const keys = new Set(combos.map(renderKey));
  if (keys.size !== count) return null;
  // Leere Linienfelder vermeiden (sähen wie „nichts“ aus)
  if (
    combos.some(
      (p) => p.layers.length === 1 && p.layers[0].kind === 'linien' && p.layers[0].set === 0,
    )
  )
    return null;
  const solKey = renderKey(sol);
  const options = rng.shuffle(combos);
  return { options, correctIndex: options.findIndex((p) => renderKey(p) === solKey) };
}

// ---------- Generator ----------

function pickRules(
  rng: Rng,
  base: Panel,
  cfg: LevelConfig,
): { attr: AttrRef; rule: RuleId }[] | null {
  const vis = visibleAttrs(base).filter((a) => a.key !== 'line');
  const options: { attr: AttrRef; rule: RuleId; w: number }[] = [];
  for (const a of vis) {
    const info = attrInfo(base, a);
    for (const rule of rulesForKind(info.kind)) {
      if (RULE_COMPLEXITY[rule] > cfg.maxComplexity) continue;
      // neuere, schwierigere Regeln auf höheren Stufen bevorzugen
      const w = 1 + (RULE_COMPLEXITY[rule] === cfg.maxComplexity ? 1.5 : 0);
      options.push({ attr: a, rule, w });
    }
  }
  const chosen: { attr: AttrRef; rule: RuleId }[] = [];
  for (let i = 0; i < cfg.nRules; i++) {
    const free = options.filter(
      (o) =>
        !chosen.some((c) => attrId(c.attr) === attrId(o.attr)) &&
        !(o.attr.key === 'pos' && chosen.some((c) => c.attr.key === 'count')) &&
        !(o.attr.key === 'count' && chosen.some((c) => c.attr.key === 'pos')),
    );
    if (!free.length) break;
    const pick = rng.weighted(free.map((o) => [o, o.w] as const));
    chosen.push({ attr: pick.attr, rule: pick.rule });
  }
  if (cfg.needHard && !chosen.some((c) => c.rule === 'addSub' || c.rule === 'xor')) {
    const keep = chosen.slice(0, -1);
    const hard = options.filter(
      (o) =>
        (o.rule === 'addSub' || o.rule === 'xor') &&
        !keep.some((c) => attrId(c.attr) === attrId(o.attr)) &&
        !(o.attr.key === 'count' && keep.some((c) => c.attr.key === 'pos')),
    );
    if (!hard.length) return null;
    chosen[chosen.length - 1] = rng.pick(hard);
  }
  return chosen.length === cfg.nRules ? chosen : null;
}

export function generateMatrix(seed: number, level: number): MxItem {
  const rng = createRng(seed);
  const lvl = Math.max(1, Math.min(10, Math.round(level)));
  for (let attempt = 0; attempt < 400; attempt++) {
    const cfg = config(lvl, rng);
    const base = basePanel(rng, lvl, cfg);
    const picked = pickRules(rng, base, cfg);
    if (!picked) continue;
    const rotActive = picked.some((p) => p.attr.key === 'rot');
    if (rotActive) {
      const fl = base.layers[0];
      if (fl.kind === 'form' && !ROTATABLE.includes(fl.shape)) continue;
    }
    if (
      picked.some((p) => p.attr.key === 'count') &&
      base.layers.some((l) => l.kind === 'punkte' && l.count === 1)
    ) {
      // Anzahl variiert: Position spielt dann keine Rolle
    }
    let cells: Panel[] = Array.from({ length: 9 }, () => clonePanel(base));
    const infos: MxRuleInfo[] = [];
    const tags: string[] = [];
    let ok = true;
    for (const p of picked) {
      const o: Orientation = rng.chance(cfg.colChance) ? 'spalte' : 'zeile';
      const dom = domainFor(base, p.attr, rotActive);
      const g = generateGrid(rng, p.rule, dom, o, lvl);
      if (!g) {
        ok = false;
        break;
      }
      cells = cells.map((c, i) => setAttr(c, p.attr, g.grid[i]));
      infos.push({
        attr: attrInfo(base, p.attr).name,
        rule: p.rule,
        orientation: o,
        text: ruleText(base, p.attr, p.rule, o, g.params, g.grid),
      });
      const t = attrInfo(base, p.attr).tag;
      if (!tags.includes(`mx.${p.rule}`)) tags.push(`mx.${p.rule}`);
      tags.push(`mx.${p.rule}.${t}`);
    }
    if (!ok) continue;
    // Variiert die Anzahl, steht eine einzelne Figur immer in der Mitte
    if (
      new Set(cells.map((c) => c.layers.map((l) => (l.kind === 'punkte' ? l.count : 0)).join()))
        .size > 1
    )
      cells = cells.map((c) => ({
        layers: c.layers.map((l) => (l.kind === 'punkte' ? { ...l, pos: 4 } : l)),
      }));
    // Linienfelder dürfen nicht leer sein
    if (cells.some((c) => c.layers.some((l) => l.kind === 'linien' && l.set === 0))) continue;
    // Alle neun Felder verschieden, sonst wirkt die Aufgabe kaputt
    if (new Set(cells.map(renderKey)).size < (lvl <= 2 ? 3 : 6)) continue;
    const missing = rng.chance(cfg.otherMissing) ? rng.pick([0, 1, 2, 3, 4, 5, 6, 7]) : 8;
    if (checkMatrix(cells, missing)) continue;
    const sol = cells[missing];
    const activeRefs = picked.map((p) => p.attr);
    const opt = buildOptions(rng, sol, cells, activeRefs, cfg.options);
    if (!opt) continue;
    const constants = visibleAttrs(sol)
      .filter((a) => !activeRefs.some((x) => attrId(x) === attrId(a)))
      .filter((a) => new Set(cells.map((c) => String(getAttr(c, a)))).size === 1)
      .filter(
        (a) =>
          !(
            a.key === 'pos' && cells.some((c) => getAttr(c, { layer: a.layer, key: 'count' }) !== 1)
          ),
      )
      .map((a) => {
        const info = attrInfo(sol, a);
        return `${info.name}: überall ${info.format(getAttr(sol, a))}`;
      });
    const prompt: MxPrompt = {
      cells: cells.map((c, i) => (i === missing ? null : c)),
      missing,
      options: opt.options,
      correctIndex: opt.correctIndex,
      rules: infos,
      constants,
      solution: sol,
    };
    return {
      id: `${GENERATOR_ID}-${seed}-${lvl}`,
      moduleId: 'matrizen',
      generatorId: GENERATOR_ID,
      generatorVersion: GENERATOR_VERSION,
      seed,
      level: lvl,
      tags,
      prompt,
      correct: opt.correctIndex,
      correctLabel: LETTERS[opt.correctIndex],
      explanation: [...infos.map((r) => r.text), ...constants.map((c) => c + '.')].join('\n'),
      timeLimitMs: timeForLevel(lvl, 45, 90),
      answerKind: 'choice',
    };
  }
  throw new Error(`Matrizen: keine gültige Aufgabe für Stufe ${lvl}`);
}

/** Häufigkeit jedes Merkmalswerts unter den Optionen (für die Ausgewogenheitsprüfung). */
export function optionBalance(options: Panel[]): Map<string, Map<string, number>> {
  const res = new Map<string, Map<string, number>>();
  const add = (k: string, v: string) => {
    const m = res.get(k) ?? new Map<string, number>();
    m.set(v, (m.get(v) ?? 0) + 1);
    res.set(k, m);
  };
  for (const p of options)
    for (const a of visibleAttrs(p)) {
      const v = getAttr(p, a);
      if (attrInfo(p, a).kind === 'set')
        for (let b = 0; b < 8; b++) add(`${attrId(a)}#${b}`, String(((v as number) >> b) & 1));
      else add(attrId(a), String(v));
    }
  return res;
}

export const matrizenGenerator: Generator<MxPrompt, number> = {
  id: GENERATOR_ID,
  version: GENERATOR_VERSION,
  generate: (seed, level) => generateMatrix(seed, level),
  validate(item) {
    const errs = baseValidate(item as Item);
    const p = item.prompt;
    const n = item.level <= 5 ? 6 : 8;
    if (p.options.length !== n) errs.push(`Optionenzahl ${p.options.length} statt ${n}`);
    if (new Set(p.options.map(renderKey)).size !== p.options.length)
      errs.push('Optionen sehen gleich aus');
    if (renderKey(p.options[p.correctIndex]) !== renderKey(p.solution))
      errs.push('richtige Option fehlt');
    const cells = p.cells.map((c, i) => (i === p.missing ? p.solution : (c as Panel)));
    const amb = checkMatrix(cells, p.missing);
    if (amb) errs.push(amb);
    // Ausgewogenheit: jeder Merkmalswert gleich oft
    for (const [k, m] of optionBalance(p.options)) {
      const counts = [...m.values()];
      if (new Set(counts).size > 1) errs.push(`unausgewogen: ${k} ${JSON.stringify([...m])}`);
    }
    return errs;
  },
  check(item, answer) {
    const a = answer as AnswerValue;
    return a.type === 'choice' && a.index === item.prompt.correctIndex;
  },
  fingerprint(item) {
    return item.prompt.cells.map((c) => (c ? renderKey(c) : '?')).join(';');
  },
  promptText(item) {
    return (
      'Matrix: ' + item.prompt.rules.map((r) => `${r.attr} (${RULE_LABEL[r.rule]})`).join(', ')
    );
  },
};

export const RULE_LABEL: Record<RuleId, string> = {
  konstant: 'konstant',
  progression: 'Progression',
  vert3: 'Verteilung von drei Werten',
  addSub: 'Addition/Subtraktion',
  xor: 'XOR',
};
