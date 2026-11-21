/**
 * Seedbarer Zufallsgenerator (mulberry32) und Hilfsfunktionen.
 * Gleicher Seed ergibt immer dieselbe Folge, damit jede Aufgabe exakt
 * wieder erzeugt werden kann.
 */
export interface Rng {
  /** Gleichverteilte Zahl in [0, 1). */
  next(): number;
  /** Ganze Zahl in [min, max] (beide inklusive). */
  int(min: number, max: number): number;
  /** Zufälliges Element. */
  pick<T>(arr: readonly T[]): T;
  /** Gewichtete Auswahl. */
  weighted<T>(entries: readonly (readonly [T, number])[]): T;
  /** true mit Wahrscheinlichkeit p. */
  chance(p: number): boolean;
  /** Neue, gemischte Kopie. */
  shuffle<T>(arr: readonly T[]): T[];
  /** +1 oder -1. */
  sign(): 1 | -1;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed);
  const rng: Rng = {
    next,
    int(min, max) {
      if (max < min) throw new Error(`int: max < min (${min}, ${max})`);
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(arr) {
      if (arr.length === 0) throw new Error('pick: leeres Array');
      return arr[Math.floor(next() * arr.length)];
    },
    weighted(entries) {
      const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
      if (total <= 0) throw new Error('weighted: Gesamtgewicht 0');
      let r = next() * total;
      for (const [v, w] of entries) {
        r -= Math.max(0, w);
        if (r < 0) return v;
      }
      return entries[entries.length - 1][0];
    },
    chance(p) {
      return next() < p;
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    sign() {
      return next() < 0.5 ? 1 : -1;
    },
  };
  return rng;
}

/** Neuer Seed (32 Bit). Nutzt crypto, falls vorhanden. */
export function randomSeed(): number {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0];
  }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/** Leitet aus einem Seed und einem Versuchszähler einen neuen Seed ab. */
export function deriveSeed(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
