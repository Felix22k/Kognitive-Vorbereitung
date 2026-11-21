import { randomSeed } from '../core/rng';
import { median, niveau, trefferquote } from '../core/stats';
import type { Attempt, Generator, Item, ModuleSummary } from '../core/types';

export const RECENT_LIMIT = 500;

/**
 * Erzeugt eine neue Aufgabe, die sich nicht mit den zuletzt gezeigten
 * Aufgaben (Fingerabdruck) wiederholt.
 */
export function pickUniqueItem(
  gen: Generator,
  level: number,
  recent: Iterable<string>,
  opts?: Record<string, unknown>,
  seedSource: () => number = randomSeed,
): Item {
  const seen = recent instanceof Set ? (recent as Set<string>) : new Set(recent);
  let item: Item | null = null;
  for (let i = 0; i < 60; i++) {
    item = gen.generate(seedSource(), level, opts);
    if (!seen.has(gen.fingerprint(item))) return item;
  }
  return item as Item; // Raum erschöpft: Wiederholung in Kauf nehmen
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
