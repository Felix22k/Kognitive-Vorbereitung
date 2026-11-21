import type { Item } from '../core/types';
import type { Rng } from '../core/rng';

/** Antwort, wie sie von der Oberfläche kommt. */
export type AnswerValue =
  | { type: 'text'; raw: string }
  | { type: 'choice'; index: number }
  | { type: 'multi'; indices: number[] };

/** Linear zwischen zwei Werten je nach Stufe (1 bis 10) interpolieren, auf 1 s gerundet. */
export function timeForLevel(level: number, minS: number, maxS: number): number {
  const t = minS + ((Math.max(1, Math.min(10, level)) - 1) * (maxS - minS)) / 9;
  return Math.round(t) * 1000;
}

export function baseValidate(item: Item): string[] {
  const errs: string[] = [];
  if (!Number.isInteger(item.level) || item.level < 1 || item.level > 10)
    errs.push(`Stufe außerhalb 1 bis 10: ${item.level}`);
  if (!item.tags.length) errs.push('keine Regel-Tags');
  if (!item.explanation) errs.push('keine Erklärung');
  if (!(item.timeLimitMs > 0)) errs.push('kein Zeitlimit');
  return errs;
}

/** Mischt Optionen und liefert den neuen Index der richtigen Option. */
export function shuffleOptions<T>(
  rng: Rng,
  correct: T,
  wrong: T[],
): { options: T[]; index: number } {
  const all = rng.shuffle([correct, ...wrong]);
  return { options: all, index: all.indexOf(correct) };
}

export const LETTERS = 'ABCDEFGH';
