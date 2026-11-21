/**
 * Matrix-Regeln nach Carpenter, Just und Shell (1990):
 * konstant in der Zeile, Progression, Verteilung von drei Werten,
 * Addition/Subtraktion, Verteilung von zwei Werten (XOR).
 * Jede Regel kann ein 3 × 3 Raster für ein Merkmal erzeugen (generate)
 * und ein Raster mit einer Lücke vorhersagen (predict).
 */
import type { Rng } from '../../core/rng';
import { popcount, type AttrKind } from './model';

export type RuleId = 'konstant' | 'progression' | 'vert3' | 'addSub' | 'xor';
export type Orientation = 'zeile' | 'spalte';
export type Val = number | string;
export type Grid = (Val | null)[];

export const RULE_ORDER: RuleId[] = ['konstant', 'progression', 'vert3', 'addSub', 'xor'];
export const RULE_COMPLEXITY: Record<RuleId, number> = {
  konstant: 1,
  progression: 2,
  vert3: 3,
  addSub: 4,
  xor: 5,
};

export function rulesForKind(kind: AttrKind): RuleId[] {
  switch (kind) {
    case 'cat':
      return ['konstant', 'vert3'];
    case 'ord':
    case 'cyc':
      return ['konstant', 'progression', 'vert3'];
    case 'num':
      return ['konstant', 'progression', 'vert3', 'addSub'];
    case 'set':
      return ['konstant', 'vert3', 'addSub', 'xor'];
  }
}

export interface Domain {
  kind: AttrKind;
  values: Val[];
}

/** Zeilen (oder Spalten) als Index-Tripel. */
export function lines(o: Orientation): number[][] {
  return o === 'zeile'
    ? [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
      ]
    : [
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
      ];
}

function fromLines(o: Orientation, l: Val[][]): Val[] {
  const g: Val[] = new Array(9);
  lines(o).forEach((idx, li) => idx.forEach((cell, j) => (g[cell] = l[li][j])));
  return g;
}

export interface RuleParams {
  /** Schrittweite (Progression), Variante (addSub: 'add' | 'sub') */
  step?: number;
  variant?: 'add' | 'sub';
}

function distinctValues(rng: Rng, values: Val[], n: number): Val[] | null {
  if (values.length < n) return null;
  return rng.shuffle(values).slice(0, n);
}

function randomSet(rng: Rng, minBits = 1, maxBits = 4): number {
  for (;;) {
    let s = 0;
    for (let i = 0; i < 8; i++) if (rng.chance(0.35)) s |= 1 << i;
    const c = popcount(s);
    if (c >= minBits && c <= maxBits) return s;
  }
}

/**
 * Erzeugt die 9 Werte eines Merkmals. Liefert null, wenn die Regel mit
 * diesem Wertebereich nicht umsetzbar ist (Aufrufer versucht es erneut).
 */
export function generateGrid(
  rng: Rng,
  rule: RuleId,
  d: Domain,
  o: Orientation,
  level: number,
): { grid: Val[]; params: RuleParams } | null {
  if (rule === 'konstant') {
    if (d.kind === 'set') {
      const sets = new Set<number>();
      while (sets.size < 3) sets.add(randomSet(rng, 1, 4));
      const v = [...sets];
      return {
        grid: fromLines(
          o,
          v.map((x) => [x, x, x]),
        ),
        params: {},
      };
    }
    const v = distinctValues(rng, d.values, 3);
    if (!v) return null;
    return {
      grid: fromLines(
        o,
        v.map((x) => [x, x, x]),
      ),
      params: {},
    };
  }
  if (rule === 'vert3') {
    let v: Val[] | null;
    if (d.kind === 'set') {
      const sets = new Set<number>();
      while (sets.size < 3) sets.add(randomSet(rng, 1, 4));
      v = [...sets];
    } else v = distinctValues(rng, d.values, 3);
    if (!v) return null;
    // Lateinisches Quadrat: jede Zeile und jede Spalte enthält alle drei Werte
    const shifts = rng.shuffle([0, 1, 2]);
    const dir = rng.chance(0.5) ? 1 : 2;
    const l = shifts.map((s) => [0, 1, 2].map((j) => v![(s + dir * j) % 3]));
    return { grid: fromLines(o, l), params: {} };
  }
  if (rule === 'progression') {
    const n = d.values.length;
    if (d.kind === 'cyc') {
      const steps = n === 8 ? [1, 2, 3, -1, -2] : [1, 3, -1];
      const step = rng.pick(steps);
      const starts = distinctValues(rng, d.values, 3) as number[];
      const l = starts.map((s) => [0, 1, 2].map((j) => (((s + step * j) % n) + n) % n));
      return { grid: fromLines(o, l), params: { step } };
    }
    // ord und num: linear, im Wertebereich bleiben
    const nums = d.values as number[];
    const lo = Math.min(...nums);
    const hi = Math.max(...nums);
    const steps = d.kind === 'num' && level >= 6 ? [1, 2, -1, -2] : [1, -1];
    const step = rng.pick(steps);
    const minStart = step > 0 ? lo : lo - 2 * step;
    const maxStart = step > 0 ? hi - 2 * step : hi;
    if (maxStart < minStart) return null;
    const possible: number[] = [];
    for (let s = minStart; s <= maxStart; s++) possible.push(s);
    const starts =
      possible.length >= 3
        ? rng.shuffle(possible).slice(0, 3)
        : [0, 1, 2].map(() => rng.pick(possible));
    const l = starts.map((s) => [s, s + step, s + 2 * step]);
    return { grid: fromLines(o, l), params: { step } };
  }
  if (rule === 'addSub') {
    const variant: 'add' | 'sub' = rng.chance(0.5) ? 'add' : 'sub';
    if (d.kind === 'num') {
      const rows: number[][] = [];
      const seen = new Set<string>();
      for (let tries = 0; rows.length < 3 && tries < 200; tries++) {
        const a = rng.int(1, 8);
        const b = rng.int(1, 8);
        const c = variant === 'add' ? a + b : a - b;
        if (c < 1 || c > 9 || a === b) continue;
        const k = `${a},${b}`;
        if (seen.has(k)) continue;
        seen.add(k);
        rows.push([a, b, c]);
      }
      if (rows.length < 3) return null;
      return { grid: fromLines(o, rows), params: { variant } };
    }
    if (d.kind === 'set') {
      const rows: number[][] = [];
      for (let tries = 0; rows.length < 3 && tries < 200; tries++) {
        const a = randomSet(rng, 1, 3);
        const b = randomSet(rng, 1, 3);
        if (variant === 'add') {
          if (a & b) continue;
          rows.push([a, b, a | b]);
        } else {
          // a enthält b vollständig, Ergebnis nicht leer
          const big = a | b;
          if (big === b || popcount(big) > 5) continue;
          rows.push([big, b, big & ~b]);
        }
      }
      if (rows.length < 3) return null;
      return { grid: fromLines(o, rows), params: { variant } };
    }
    return null;
  }
  // xor
  if (d.kind !== 'set') return null;
  const rows: number[][] = [];
  for (let tries = 0; rows.length < 3 && tries < 300; tries++) {
    const a = randomSet(rng, 2, 4);
    const b = randomSet(rng, 2, 4);
    // Überschneidung nötig, sonst wäre XOR nicht von Addition zu unterscheiden
    if (!(a & b) || a === b || (a ^ b) === 0) continue;
    rows.push([a, b, a ^ b]);
  }
  if (rows.length < 3) return null;
  return { grid: fromLines(o, rows), params: {} };
}

// ---------- Vorhersage für die Eindeutigkeitsprüfung ----------

function predictLine(
  rule: RuleId,
  kind: AttrKind,
  mod: number,
  full: Val[][],
  part: (Val | null)[],
): Val[] {
  const j = part.indexOf(null);
  const known = part.filter((x): x is Val => x !== null);
  switch (rule) {
    case 'konstant': {
      if (!full.every((l) => l[0] === l[1] && l[1] === l[2])) return [];
      if (known[0] !== known[1]) return [];
      return [known[0]];
    }
    case 'vert3': {
      const key = (l: Val[]) => [...l].map(String).sort().join('|');
      if (!full.every((l) => new Set(l).size === 3)) return [];
      const k0 = key(full[0]);
      if (!full.every((l) => key(l) === k0)) return [];
      const set = full[0];
      const rest = set.filter((v) => !known.includes(v));
      return rest.length === 1 && known[0] !== known[1] ? [rest[0]] : [];
    }
    case 'progression': {
      if (kind !== 'ord' && kind !== 'cyc' && kind !== 'num') return [];
      const n = full as number[][];
      const norm = (x: number) => (kind === 'cyc' ? ((x % mod) + mod) % mod : x);
      const step = norm(n[0][1] - n[0][0]);
      if (step === 0) return [];
      for (const l of n) if (norm(l[1] - l[0]) !== step || norm(l[2] - l[1]) !== step) return [];
      const p = part as (number | null)[];
      const kIdx = p.findIndex((x) => x !== null);
      const kVal = p[kIdx] as number;
      // Prüfen, dass die zwei bekannten Werte zur Schrittweite passen
      const other = p.findIndex((x, i) => x !== null && i !== kIdx);
      if (norm((p[other] as number) - kVal) !== norm(step * (other - kIdx))) return [];
      const v = norm(kVal + step * (j - kIdx));
      if (kind === 'ord' && (v < 0 || v >= mod)) return [];
      if (kind === 'num' && (v < 1 || v > 9)) return [];
      return [v];
    }
    case 'addSub': {
      if (kind === 'num') {
        const n = full as number[][];
        const p = part as (number | null)[];
        const out: number[] = [];
        if (n.every((l) => l[2] === l[0] + l[1])) {
          const v = j === 2 ? p[0]! + p[1]! : j === 0 ? p[2]! - p[1]! : p[2]! - p[0]!;
          out.push(v);
        }
        if (n.every((l) => l[2] === l[0] - l[1])) {
          const v = j === 2 ? p[0]! - p[1]! : j === 0 ? p[2]! + p[1]! : p[0]! - p[2]!;
          out.push(v);
        }
        return out.filter((v) => v >= 1 && v <= 9);
      }
      if (kind === 'set') {
        const n = full as number[][];
        const p = part as (number | null)[];
        const out: number[] = [];
        if (n.every((l) => (l[0] & l[1]) === 0 && l[2] === (l[0] | l[1]))) {
          if (j === 2) out.push(p[0]! | p[1]!);
          else {
            const other = j === 0 ? p[1]! : p[0]!;
            if ((other & p[2]!) === other) out.push(p[2]! & ~other);
          }
        }
        if (n.every((l) => (l[1] & l[0]) === l[1] && l[2] === (l[0] & ~l[1]))) {
          if (j === 2) out.push(p[0]! & ~p[1]!);
          else if (j === 0) out.push(p[2]! | p[1]!);
          else out.push(p[0]! & ~p[2]!);
        }
        return out;
      }
      return [];
    }
    case 'xor': {
      if (kind !== 'set') return [];
      const n = full as number[][];
      if (!n.every((l) => l[2] === (l[0] ^ l[1]))) return [];
      // a XOR b = c gilt in jede Richtung: die Lücke ist das XOR der beiden bekannten
      return [(known[0] as number) ^ (known[1] as number)];
    }
  }
}

/** Alle Vorhersagen einer Regel in einer Richtung für die Lücke. */
export function predict(
  rule: RuleId,
  kind: AttrKind,
  mod: number,
  grid: Grid,
  o: Orientation,
): Val[] {
  const ls = lines(o).map((idx) => idx.map((i) => grid[i]));
  const partIdx = ls.findIndex((l) => l.includes(null));
  const full = ls.filter((_, i) => i !== partIdx) as Val[][];
  return predictLine(rule, kind, mod, full, ls[partIdx]);
}
