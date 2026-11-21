/**
 * Würfel drehen (Modul 6.11).
 * wd.drehen: Referenzwürfel mit 3 sichtbaren Flächen, welche Option zeigt
 *            denselben Würfel in anderer Lage? (optional "keine passt")
 * wd.netz:   Faltvorlage, welcher Würfel entsteht daraus?
 * Jede Option wird gegen alle 24 Lagen geprüft: richtig = möglich,
 * falsch = unmöglich.
 */
import { createRng, type Rng } from '../core/rng';
import type { Generator, Item } from '../core/types';
import { baseValidate, timeForLevel, type AnswerValue } from './common';
import { CUBE_ROTATIONS, ID, apply, mul, type Mat3, type V3 } from './raum/voxel';

export type Sym = 'pfeil' | 'F' | 'L' | 'P' | 'R' | 'halb' | 'punkt';
export const SYMBOLS: Sym[] = ['pfeil', 'F', 'L', 'P', 'R', 'halb', 'punkt'];
export const SYM_NAME: Record<Sym, string> = {
  pfeil: 'Pfeil',
  F: 'F',
  L: 'L',
  P: 'P',
  R: 'R',
  halb: 'halb gefüllte Fläche',
  punkt: 'Punkt in der Ecke',
};

export interface CubeFace {
  n: V3;
  up: V3;
  sym: Sym;
}

export type WorldFace = 'top' | 'left' | 'right';
export const WORLD: Record<WorldFace, { n: V3; right: V3; up: V3 }> = {
  top: { n: [0, 1, 0], right: [1, 0, 0], up: [0, 0, -1] },
  left: { n: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] },
  right: { n: [1, 0, 0], right: [0, 0, -1], up: [0, 1, 0] },
};
const WF: WorldFace[] = ['top', 'left', 'right'];

/** Eine Ansicht: je sichtbare Fläche Symbol und Drehung k (k × 90° im Uhrzeigersinn). */
export type View = Record<WorldFace, { sym: Sym; k: number }>;

const eq = (a: V3, b: V3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];
const r = (m: Mat3, v: V3): V3 => apply(m, v).map((x) => Math.round(x)) as V3;

function kOf(up: V3, frame: { right: V3; up: V3 }): number {
  const opts = [frame.up, frame.right, neg(frame.up), neg(frame.right)];
  return opts.findIndex((o) => eq(o, up));
}

export function viewOf(cube: CubeFace[], R: Mat3): View {
  const out = {} as View;
  for (const w of WF) {
    const f = cube.find((c) => eq(r(R, c.n), WORLD[w].n))!;
    out[w] = { sym: f.sym, k: kOf(r(R, f.up), WORLD[w]) };
  }
  return out;
}

export const viewKey = (v: View) => WF.map((w) => `${v[w].sym}${v[w].k}`).join('|');

/** Bekannte Flächen aus einer Ansicht (im Weltkoordinatensystem der Ansicht). */
export function knownFromView(v: View): CubeFace[] {
  return WF.map((w) => {
    const fr = WORLD[w];
    const up = [fr.up, fr.right, neg(fr.up), neg(fr.right)][v[w].k];
    return { n: fr.n, up, sym: v[w].sym };
  });
}

/**
 * Ist die Ansicht mit den bekannten Flächen vereinbar? Unbekannte Flächen
 * dürfen beliebige Symbole tragen, die noch nicht vergeben sind.
 */
export function isPossible(option: View, known: CubeFace[], complete: boolean): boolean {
  const knownSyms = new Set(known.map((k) => k.sym));
  const syms = WF.map((w) => option[w].sym);
  if (new Set(syms).size !== 3) return false;
  for (const R of CUBE_ROTATIONS) {
    let ok = true;
    for (const w of WF) {
      // welche Fläche des Würfels landet bei Drehung R auf w?
      const f = known.find((c) => eq(r(R, c.n), WORLD[w].n));
      if (f) {
        if (f.sym !== option[w].sym || kOf(r(R, f.up), WORLD[w]) !== option[w].k) {
          ok = false;
          break;
        }
      } else if (complete || knownSyms.has(option[w].sym)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

// ---------- Würfel und Faltnetze ----------

const AXES: V3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

function randomCube(rng: Rng): CubeFace[] {
  const syms = rng.shuffle(SYMBOLS).slice(0, 6);
  return AXES.map((n, i) => {
    const ups = AXES.filter((a) => a[0] * n[0] + a[1] * n[1] + a[2] * n[2] === 0);
    return { n, up: rng.pick(ups), sym: syms[i] };
  });
}

/** Anzahl Vierteldrehungen (um x, y, z), die eine Lage mindestens braucht. */
export const ROT_STEPS: Map<string, number> = (() => {
  const gens: Mat3[] = [];
  for (const g of [
    [1, 0, 0, 0, 0, -1, 0, 1, 0],
    [0, 0, 1, 0, 1, 0, -1, 0, 0],
    [0, -1, 0, 1, 0, 0, 0, 0, 1],
  ]) {
    gens.push(g, mul(mul(g, g), g));
  }
  const dist = new Map<string, number>([[ID.join(), 0]]);
  const q: Mat3[] = [ID];
  while (q.length) {
    const m = q.shift()!;
    for (const g of gens) {
      const n = mul(g, m);
      if (!dist.has(n.join())) {
        dist.set(n.join(), dist.get(m.join())! + 1);
        q.push(n);
      }
    }
  }
  return dist;
})();

export type Cell = [number, number]; // Spalte, Zeile

/** Faltet ein Netz: liefert je Zelle Normale und Rahmen, oder null, wenn kein Würfel entsteht. */
export function fold(cells: Cell[]): { n: V3; right: V3; up: V3 }[] | null {
  const idx = new Map(cells.map((c, i) => [`${c[0]},${c[1]}`, i]));
  const frames: ({ n: V3; right: V3; up: V3 } | null)[] = cells.map(() => null);
  frames[0] = { n: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0] };
  const q = [0];
  while (q.length) {
    const i = q.shift()!;
    const f = frames[i]!;
    const [c, row] = cells[i];
    const moves: [number, number, () => { n: V3; right: V3; up: V3 }][] = [
      [c + 1, row, () => ({ n: f.right, right: neg(f.n), up: f.up })],
      [c - 1, row, () => ({ n: neg(f.right), right: f.n, up: f.up })],
      [c, row - 1, () => ({ n: f.up, right: f.right, up: neg(f.n) })],
      [c, row + 1, () => ({ n: neg(f.up), right: f.right, up: f.n })],
    ];
    for (const [nc, nr, mk] of moves) {
      const j = idx.get(`${nc},${nr}`);
      if (j === undefined || frames[j]) continue;
      frames[j] = mk();
      q.push(j);
    }
  }
  if (frames.some((f) => !f)) return null;
  const normals = new Set(frames.map((f) => f!.n.join()));
  return normals.size === 6 ? (frames as { n: V3; right: V3; up: V3 }[]) : null;
}

/** Alle Würfelnetze (11 Grundformen in allen Lagen), beim Laden einmal berechnet. */
export const NETS: Cell[][] = (() => {
  const norm = (cs: Cell[]): Cell[] => {
    const mc = Math.min(...cs.map((c) => c[0]));
    const mr = Math.min(...cs.map((c) => c[1]));
    return cs
      .map(([c, r2]) => [c - mc, r2 - mr] as Cell)
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  };
  const keyOf = (cs: Cell[]) =>
    norm(cs)
      .map((c) => c.join(','))
      .join(';');
  let level = new Map<string, Cell[]>([['0,0', [[0, 0]]]]);
  for (let size = 1; size < 6; size++) {
    const next = new Map<string, Cell[]>();
    for (const cs of level.values())
      for (const [c, r2] of cs)
        for (const [dc, dr] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const n: Cell = [c + dc, r2 + dr];
          if (cs.some((x) => x[0] === n[0] && x[1] === n[1])) continue;
          const ns = norm([...cs, n]);
          next.set(keyOf(ns), ns);
        }
    level = next;
  }
  return [...level.values()].filter((cs) => fold(cs) !== null);
})();

/** Netze mit einer Viererreihe (1-4-1-Familie) sind leichter. */
export function isEasyNet(cells: Cell[]): boolean {
  for (const row of new Set(cells.map((c) => c[1])))
    if (cells.filter((c) => c[1] === row).length === 4) return true;
  for (const col of new Set(cells.map((c) => c[0])))
    if (cells.filter((c) => c[0] === col).length === 4) return true;
  return false;
}

// ---------- Ablenker ----------

type MutType = 'drehung' | 'tausch' | 'spiegel' | 'stelle';

function mutations(
  rng: Rng,
  v: View,
  known: CubeFace[],
  complete: boolean,
): { view: View; reason: string; type: MutType }[] {
  const out: { view: View; reason: string; type: MutType }[] = [];
  const knownSyms = new Set(known.map((k) => k.sym));
  const isKnown = (w: WorldFace) => complete || knownSyms.has(v[w].sym);
  const clone = (): View => ({ top: { ...v.top }, left: { ...v.left }, right: { ...v.right } });
  for (const w of rng.shuffle(WF)) {
    if (!isKnown(w)) continue;
    for (const d of rng.shuffle([1, 2, 3])) {
      const x = clone();
      x[w].k = (x[w].k + d) % 4;
      out.push({
        view: x,
        reason: `${SYM_NAME[v[w].sym]} ist falsch ausgerichtet`,
        type: 'drehung',
      });
    }
  }
  const pairs: [WorldFace, WorldFace][] = [
    ['top', 'left'],
    ['top', 'right'],
    ['left', 'right'],
  ];
  for (const [a, b] of rng.shuffle(pairs)) {
    if (!isKnown(a) && !isKnown(b)) continue;
    const x = clone();
    [x[a], x[b]] = [x[b], x[a]];
    out.push({
      view: x,
      type: a === 'left' && b === 'right' ? 'spiegel' : 'tausch',
      reason:
        a === 'left' && b === 'right'
          ? 'Anordnung gespiegelt: die Reihenfolge der Flächen um die Ecke stimmt nicht'
          : `${SYM_NAME[v[a].sym]} und ${SYM_NAME[v[b].sym]} sind vertauscht`,
    });
  }
  // eine Fläche zeigen, die dort nicht liegen kann (z. B. gegenüberliegende Flächen gleichzeitig)
  const visibleSyms = new Set(WF.map((w) => v[w].sym));
  for (const w of rng.shuffle(WF)) {
    for (const k of rng.shuffle(known)) {
      if (visibleSyms.has(k.sym)) continue;
      const x = clone();
      x[w] = { sym: k.sym, k: rng.int(0, 3) };
      out.push({
        view: x,
        reason: `${SYM_NAME[k.sym]} kann an dieser Stelle nicht liegen`,
        type: 'stelle',
      });
    }
  }
  return out;
}

// ---------- Generator ----------

export interface WdPrompt {
  format: 'drehen' | 'netz';
  /** drehen: Referenzansicht */
  reference?: View;
  /** netz: Zellen und je Zelle Symbol und Drehung */
  net?: { cells: Cell[]; faces: { sym: Sym; k: number }[] };
  options: View[];
  /** Index der richtigen Option; options.length bedeutet "keine passt" */
  correctIndex: number;
  noneOption: boolean;
  reasons: string[];
  steps?: number;
}

export type WdItem = Item<WdPrompt, number>;

export const GENERATOR_ID = 'wuerfelDrehen';
export const GENERATOR_VERSION = 1;

function stepsFor(level: number): number[] {
  if (level <= 3) return [1];
  if (level <= 6) return [1, 2];
  return [2, 3];
}

export function generateWuerfel(seed: number, level: number): WdItem {
  const rng = createRng(seed);
  const lvl = Math.max(1, Math.min(10, Math.round(level)));
  for (let attempt = 0; attempt < 300; attempt++) {
    const netFormat = lvl >= 3 && rng.chance(lvl >= 6 ? 0.5 : 0.35);
    const noneOption = lvl >= 5;
    const answerNone = noneOption && rng.chance(0.2);
    const cube = randomCube(rng);
    let known: CubeFace[];
    let complete: boolean;
    let reference: View | undefined;
    let net: WdPrompt['net'];
    const R0 = rng.pick(CUBE_ROTATIONS);
    if (netFormat) {
      const pool = NETS.filter((n) => (lvl <= 5 ? isEasyNet(n) : true));
      const cells = rng.pick(pool);
      const frames = fold(cells)!;
      const syms = rng.shuffle(SYMBOLS).slice(0, 6);
      const faces = frames.map((fr, i) => {
        const k = rng.int(0, 3);
        return { sym: syms[i], k, n: fr.n, up: [fr.up, fr.right, neg(fr.up), neg(fr.right)][k] };
      });
      net = { cells, faces: faces.map(({ sym, k }) => ({ sym, k })) };
      known = faces.map(({ n, up, sym }) => ({ n, up, sym }));
      complete = true;
    } else {
      reference = viewOf(cube, R0);
      known = knownFromView(reference);
      complete = false;
    }
    // mögliche Ansichten aus der Referenzlage
    const truth: CubeFace[] = complete
      ? known
      : cube.map((c) => ({ n: r(R0, c.n), up: r(R0, c.up), sym: c.sym }));
    const allowed = stepsFor(lvl);
    const candidates = CUBE_ROTATIONS.filter((R) => {
      const st = ROT_STEPS.get(R.join()) ?? 9;
      if (!complete && !allowed.includes(st)) return false;
      const v = viewOf(truth, R);
      const shared = WF.filter((w) => known.some((k) => k.sym === v[w].sym)).length;
      if (complete) return true;
      return shared >= (lvl <= 4 ? 2 : 1) && viewKey(v) !== viewKey(reference!);
    });
    if (!candidates.length) continue;
    const Rc = rng.pick(candidates);
    const correctView = viewOf(truth, Rc);
    // Ablenker aus Mutationen möglicher Ansichten
    const pool = rng
      .shuffle(CUBE_ROTATIONS)
      .slice(0, 6)
      .map((R) => viewOf(truth, R));
    const seen = new Set([viewKey(correctView), reference ? viewKey(reference) : '']);
    const need = answerNone ? 4 : 3;
    // Kandidaten je Fehlerart sammeln, dann abwechselnd ziehen (vielfältige Ablenker)
    const byType = new Map<MutType, { view: View; reason: string }[]>();
    for (const base of [correctView, ...pool])
      for (const m of mutations(rng, base, known, complete)) {
        const k = viewKey(m.view);
        if (seen.has(k)) continue;
        if (!complete && !WF.some((w) => known.some((kk) => kk.sym === m.view[w].sym))) continue;
        if (isPossible(m.view, known, complete)) continue;
        seen.add(k);
        const list = byType.get(m.type) ?? [];
        list.push(m);
        byType.set(m.type, list);
      }
    const wrong: { view: View; reason: string }[] = [];
    const types = rng.shuffle([...byType.keys()]);
    for (let round = 0; wrong.length < need && round < 10; round++)
      for (const t of types) {
        const list = byType.get(t)!;
        if (round < list.length && wrong.length < need) wrong.push(list[round]);
      }
    if (wrong.length < need) continue;
    let options: View[];
    let reasons: string[];
    let correctIndex: number;
    if (answerNone) {
      options = wrong.map((w) => w.view);
      reasons = wrong.map((w) => w.reason);
      correctIndex = 4;
    } else {
      const all = rng.shuffle([{ view: correctView, reason: 'richtig' }, ...wrong]);
      options = all.map((a) => a.view);
      reasons = all.map((a) => a.reason);
      correctIndex = reasons.indexOf('richtig');
    }
    const steps = ROT_STEPS.get(Rc.join());
    const prompt: WdPrompt = {
      format: netFormat ? 'netz' : 'drehen',
      reference,
      net,
      options,
      correctIndex,
      noneOption,
      reasons,
      steps,
    };
    const letters = 'ABCDE';
    const expl = reasons.map((rs, i) =>
      rs === 'richtig'
        ? `${letters[i]}: richtig${netFormat ? ', so entsteht der Würfel aus der Vorlage' : `, derselbe Würfel nach ${steps} Vierteldrehung${steps === 1 ? '' : 'en'}`}.`
        : `${letters[i]}: falsch, ${rs}.`,
    );
    if (answerNone) expl.push('E: Keine der vier Ansichten ist möglich.');
    return {
      id: `${GENERATOR_ID}-${seed}-${lvl}`,
      moduleId: 'wuerfelDrehen',
      generatorId: GENERATOR_ID,
      generatorVersion: GENERATOR_VERSION,
      seed,
      level: lvl,
      tags: [netFormat ? 'wd.netz' : 'wd.drehen'],
      prompt,
      correct: correctIndex,
      correctLabel: answerNone ? 'E (keine passt)' : letters[correctIndex],
      explanation: expl.join('\n'),
      timeLimitMs: timeForLevel(lvl, 30, 60),
      answerKind: 'choice',
    };
  }
  throw new Error(`Würfel drehen: keine Aufgabe für Stufe ${lvl}`);
}

export function knownOf(p: WdPrompt): { known: CubeFace[]; complete: boolean } {
  if (p.format === 'netz' && p.net) {
    const frames = fold(p.net.cells)!;
    return {
      known: frames.map((fr, i) => ({
        n: fr.n,
        up: [fr.up, fr.right, neg(fr.up), neg(fr.right)][p.net!.faces[i].k],
        sym: p.net!.faces[i].sym,
      })),
      complete: true,
    };
  }
  return { known: knownFromView(p.reference!), complete: false };
}

export const wuerfelGenerator: Generator<WdPrompt, number> = {
  id: GENERATOR_ID,
  version: GENERATOR_VERSION,
  generate: generateWuerfel,
  validate(item) {
    const errs = baseValidate(item as Item);
    const p = item.prompt;
    const { known, complete } = knownOf(p);
    p.options.forEach((o, i) => {
      const possible = isPossible(o, known, complete);
      if (possible !== (i === p.correctIndex))
        errs.push(
          `Option ${'ABCDE'[i]} ${possible ? 'möglich' : 'unmöglich'}, aber anders eingestuft`,
        );
    });
    if (new Set(p.options.map(viewKey)).size !== p.options.length) errs.push('Optionen gleich');
    if (p.reference && p.options.some((o) => viewKey(o) === viewKey(p.reference!)))
      errs.push('Option gleich Referenz');
    return errs;
  },
  check(item, answer) {
    const a = answer as AnswerValue;
    return a.type === 'choice' && a.index === item.correct;
  },
  fingerprint(item) {
    const p = item.prompt;
    return (
      (p.reference ? viewKey(p.reference) : JSON.stringify(p.net)) +
      '#' +
      p.options.map(viewKey).join('#')
    );
  },
  promptText(item) {
    return item.prompt.format === 'netz' ? 'Würfel aus Faltvorlage' : 'Würfel in anderer Lage';
  },
};
