/**
 * Gemeinsame Bausteine für Auswahlaufgaben mit Textoptionen
 * (Wortanalogien, Begriffe, Rechtschreibung, Technik, Textaufgaben).
 */
import type { Generator, Item } from '../core/types';
import type { Rng } from '../core/rng';
import { baseValidate, type AnswerValue } from './common';

export interface TcPrompt {
  /** Art der Aufgabe, z. B. 'analogie', 'passtNicht', 'wort' */
  kind: string;
  /** Fragezeile über der Aufgabe */
  question: string;
  /** Hauptinhalt (Analogie, Satz, Wortliste, Aufgabentext) */
  stem?: string;
  /** Wörter als Kacheln (z. B. bei Begriffen) */
  words?: string[];
  options: string[];
  correctIndex: number;
  /** Eintrag einer festen Aufgabensammlung (für Meldungen und Ausblenden) */
  bankId?: string;
}

export type TcItem<P extends TcPrompt = TcPrompt> = Item<P, number>;

export function shuffleWithIndex(rng: Rng, correct: string, wrong: string[]) {
  const options = rng.shuffle([correct, ...wrong]);
  return { options, correctIndex: options.indexOf(correct) };
}

/** Prüfungen, die für alle Textauswahl-Aufgaben gelten. */
export function tcValidate(item: Item<TcPrompt, number>): string[] {
  const errs = baseValidate(item as Item);
  const p = item.prompt;
  if (p.options.length < 2) errs.push('zu wenige Optionen');
  if (new Set(p.options).size !== p.options.length) errs.push('doppelte Optionen');
  if (p.correctIndex < 0 || p.correctIndex >= p.options.length) errs.push('Lösung fehlt');
  if (item.correct !== p.correctIndex) errs.push('correct passt nicht zu correctIndex');
  if (p.options[p.correctIndex] !== item.correctLabel) errs.push('correctLabel passt nicht');
  if (p.options.some((o) => !o.trim())) errs.push('leere Option');
  return errs;
}

export function tcCheck(item: Item, answer: unknown): boolean {
  const a = answer as AnswerValue;
  return a?.type === 'choice' && a.index === (item.prompt as TcPrompt).correctIndex;
}

/** Generator-Hülle mit Standard-Prüfung, Fingerabdruck und Kurztext. */
export function tcGenerator<P extends TcPrompt>(
  id: string,
  version: number,
  generate: (seed: number, level: number, opts?: Record<string, unknown>) => TcItem<P>,
  fingerprint: (item: TcItem<P>) => string,
  extraValidate?: (item: TcItem<P>) => string[],
): Generator<P, number> {
  return {
    id,
    version,
    generate,
    validate(item) {
      return [...tcValidate(item), ...(extraValidate ? extraValidate(item) : [])];
    },
    check: tcCheck as Generator<P, number>['check'],
    fingerprint,
    promptText(item) {
      const p = item.prompt;
      return [p.question, p.stem, p.words?.join(', ')].filter(Boolean).join(' | ');
    },
  };
}

/** Wählt Einträge der Stufen [level − spread, level]; ist dort nichts, die nächstgelegenen. */
export function byLevel<T extends { stufe: number }>(list: T[], level: number, spread = 1): T[] {
  const hit = list.filter((e) => e.stufe <= level && e.stufe >= level - spread);
  if (hit.length) return hit;
  for (let d = 1; d <= 9; d++) {
    const near = list.filter((e) => Math.abs(e.stufe - level) <= d);
    if (near.length) return near;
  }
  return list;
}
