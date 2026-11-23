import { randomSeed } from '../core/rng';
import { median, niveau, trefferquote } from '../core/stats';
import type { Attempt, Generator, Item, ModuleSummary } from '../core/types';

export const RECENT_LIMIT = 500;

/**
 * Erzeugt eine neue Aufgabe, die sich nicht mit den zuletzt gezeigten
 * Aufgaben (Fingerabdruck) wiederholt. Gemeldete Aufgaben (blocked) werden
 * nie gezeigt, solange es Alternativen gibt; Wiederholungen nur, wenn der
 * Aufgabenraum erschöpft ist (feste Sammlungen).
 */
export function pickUniqueItem(
  gen: Generator,
  level: number,
  recent: Iterable<string>,
  opts?: Record<string, unknown>,
  seedSource: () => number = randomSeed,
  blocked?: ReadonlySet<string>,
  /** nur Aufgaben, die diese Bedingung erfüllen (z. B. bestimmte Regel-Tags) */
  accept?: (item: Item) => boolean,
): Item {
  const seen = recent instanceof Set ? (recent as Set<string>) : new Set(recent);
  if (accept) {
    // gezielt suchen, aber höchstens 250 ms; sonst ohne Bedingung weiter
    const t0 = performance.now();
    let fallback: Item | null = null;
    for (let i = 0; i < 600 && performance.now() - t0 < 250; i++) {
      const item = gen.generate(seedSource(), level, opts);
      if (!accept(item)) continue;
      const fp = gen.fingerprint(item);
      if (blocked?.has(fp)) continue;
      if (!seen.has(fp)) return item;
      fallback ??= item;
    }
    if (fallback) return fallback;
  }
  let fallback: Item | null = null;
  let last: Item | null = null;
  for (let i = 0; i < 120; i++) {
    const item = gen.generate(seedSource(), level, opts);
    last = item;
    const fp = gen.fingerprint(item);
    if (blocked?.has(fp)) continue;
    if (!seen.has(fp)) return item;
    fallback ??= item;
    if (i >= 59 && fallback) break;
  }
  return (fallback ?? last) as Item;
}

export function pushRecent(recent: string[], fp: string): string[] {
  const next = recent.filter((x) => x !== fp);
  next.push(fp);
  return next.length > RECENT_LIMIT ? next.slice(next.length - RECENT_LIMIT) : next;
}

export function summarize(
  attempts: Pick<Attempt, 'level' | 'correct' | 'rtMs'>[],
  endLevel: number,
): ModuleSummary {
  return {
    niveau: niveau(attempts.map((a) => a.level)),
    trefferquote: trefferquote(attempts.map((a) => a.correct)),
    medianMs: Math.round(median(attempts.map((a) => a.rtMs))),
    anzahl: attempts.length,
    endLevel,
  };
}
