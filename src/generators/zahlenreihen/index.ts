/**
 * Generator Zahlenreihen (Modul 6.3): 7 sichtbare Glieder, eines gesucht.
 * Jede erzeugte Reihe durchläuft die Eindeutigkeitsprüfung.
 */
import { createRng } from '../../core/rng';
import { parseAnswer, rat, eq, formatNumber } from '../../core/rational';
import type { Generator, Item } from '../../core/types';
import { baseValidate, timeForLevel, type AnswerValue } from '../common';
import { LEN, RULES, RULE_BY_ID, type Rule, type Seq } from './rules';

export interface ZrPrompt {
  /** Reihe mit null an der gesuchten Stelle. */
  terms: Seq;
  missingIndex: number;
  ruleId: string;
  /** Nur für die Erklärung nach dem Antworten. */
  solution: { full: number[]; showDiff2: boolean; ruleText: string };
}

export type ZrItem = Item<ZrPrompt, number>;

export const GENERATOR_ID = 'zahlenreihen';
export const GENERATOR_VERSION = 1;

function poolFor(level: number): [string, number][] {
  switch (level) {
    case 1:
      return [
        ['arith', 3],
        ['geom', 1],
      ];
    case 2:
      return [
        ['arith', 2],
        ['geom', 1.5],
      ];
    case 3:
      return [
        ['diff2', 2],
        ['wechsel', 2],
        ['potenz', 1.5],
        ['arith', 0.5],
      ];
    case 4:
      return [
        ['diff2', 1.5],
        ['wechsel', 2],
        ['potenz', 1],
        ['prim', 1],
        ['geom', 0.5],
      ];
    case 5:
    case 6:
      return [
        ['zweiReihen', 2],
        ['diffGeom', 1.5],
        ['fibonacci', 1.5],
        ['steigFaktor', 1.5],
        ['wechsel', 0.5],
        ['diff2', 0.5],
      ];
    case 7:
      return [
        ['mulAdd', 2],
        ['zyklus3', 2],
        ['wechsel', 1],
        ['diff2', 1],
        ['zweiReihen', 1],
        ['arith', 0.5],
      ];
    case 8:
      return [
        ['mulAdd', 2],
        ['zyklus3', 2],
        ['zweiReihen', 1],
        ['fibonacci', 1],
        ['diffGeom', 1],
        ['steigFaktor', 1],
      ];
    case 9:
      return [
        ['zweiReihenKombi', 2],
        ['diffZweiReihen', 2],
        ['mulAdd', 1],
        ['zyklus3', 1],
      ];
    default:
      return [
        ['zweiReihenKombi', 2],
        ['diffZweiReihen', 2],
        ['zyklus3', 1],
      ];
  }
}

const middleChance = (level: number) =>
  level >= 9 ? 0.5 : level === 8 ? 0.4 : level === 7 ? 0.3 : 0;

export function withinLimits(seq: number[], level: number): boolean {
  if (level <= 6) return seq.every((x) => x >= 0 && x <= 999);
  return seq.every((x) => Math.abs(x) <= 5000);
}

export interface UniqueResult {
  ok: boolean;
  reason?: string;
}

/**
 * Eindeutigkeitsprüfung: Jede Regel der Bibliothek mit gleicher oder
 * geringerer Komplexität wird an die sichtbaren Glieder angepasst.
 * - Liefert eine Regel einen anderen Wert für die Lücke: mehrdeutig.
 * - Erklärt eine einfachere Regel die Reihe vollständig: Aufgabe wäre
 *   leichter als ihr Regel-Tag behauptet, ebenfalls verwerfen.
 * - Die eigene Regel muss den richtigen Wert finden.
 */
export function checkUnique(full: number[], k: number, rule: Rule): UniqueResult {
  const vis: Seq = full.map((x, i) => (i === k ? null : x));
  const answer = full[k];
  const own = rule.fit(vis).map((f) => f[k]);
  if (!own.includes(answer))
    return { ok: false, reason: `eigene Regel ${rule.id} erkennt Reihe nicht` };
  for (const q of RULES) {
    if (q.complexity > rule.complexity) continue;
    const fits = q.fit(vis);
    for (const f of fits) {
      if (f[k] !== answer) return { ok: false, reason: `mehrdeutig: ${q.id} ergibt ${f[k]}` };
    }
    if (fits.length && q.complexity < rule.complexity && !rule.equivalent?.includes(q.id))
      return { ok: false, reason: `zu einfach: ${q.id} erklärt die Reihe` };
  }
  return { ok: true };
}

function diffs(a: number[]): number[] {
  return a.slice(1).map((x, i) => x - a[i]);
}

const signed = (x: number) => (x < 0 ? `−${formatNumber(-x)}` : `+${formatNumber(x)}`);

export function explain(p: ZrPrompt): string {
  const d1 = diffs(p.solution.full);
  const lines = [`Differenzen: ${d1.map(signed).join('  ')}`];
  if (p.solution.showDiff2) lines.push(`2. Differenzen: ${diffs(d1).map(signed).join('  ')}`);
  lines.push(`Regel: ${p.solution.ruleText}`);
  return lines.join('\n');
}

export const zahlenreihenGenerator: Generator<ZrPrompt, number> = {
  id: GENERATOR_ID,
  version: GENERATOR_VERSION,
  generate(seed, level, opts) {
    const rng = createRng(seed);
    const lvl = Math.max(1, Math.min(10, Math.round(level)));
    const forcedTag = opts?.tag as string | undefined;
    let pool = poolFor(lvl);
    if (forcedTag) {
      const matching = RULES.filter((r) => r.tags.includes(forcedTag)).map(
        (r) => [r.id, 1] as [string, number],
      );
      if (matching.length) pool = matching;
    }
    const o = { level: lvl, neg: lvl >= 7, big: lvl >= 4 };
    for (let attempt = 0; attempt < 500; attempt++) {
      const rule = RULE_BY_ID[rng.weighted(pool)];
      const g = rule.generate(rng, o);
      if (g.seq.length !== LEN || !withinLimits(g.seq, lvl)) continue;
      const k = rng.chance(middleChance(lvl)) ? rng.int(2, 5) : LEN - 1;
      if (!checkUnique(g.seq, k, rule).ok) continue;
      const prompt: ZrPrompt = {
        terms: g.seq.map((x, i) => (i === k ? null : x)),
        missingIndex: k,
        ruleId: rule.id,
        solution: { full: g.seq, showDiff2: !!g.showDiff2, ruleText: g.text },
      };
      return {
        id: `${GENERATOR_ID}-${seed}-${lvl}`,
        moduleId: 'zahlenreihen',
        generatorId: GENERATOR_ID,
        generatorVersion: GENERATOR_VERSION,
        seed,
        level: lvl,
        tags: rule.tags,
        prompt,
        correct: g.seq[k],
        correctLabel: formatNumber(g.seq[k]),
        explanation: explain(prompt),
        timeLimitMs: timeForLevel(lvl, 30, 60),
        answerKind: 'number',
      };
    }
    throw new Error(`Zahlenreihen: keine eindeutige Reihe für Stufe ${lvl} gefunden`);
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    const p = item.prompt;
    if (p.terms.length !== LEN) errs.push('falsche Länge');
    if (p.terms.filter((x) => x === null).length !== 1) errs.push('nicht genau eine Lücke');
    if (p.terms[p.missingIndex] !== null) errs.push('Lücke an falscher Stelle');
    if (p.solution.full[p.missingIndex] !== item.correct) errs.push('Lösung passt nicht');
    if (!withinLimits(p.solution.full, item.level)) errs.push('Zahlen außerhalb des Bereichs');
    const rule = RULE_BY_ID[p.ruleId];
    if (!rule) errs.push('unbekannte Regel');
    else {
      const u = checkUnique(p.solution.full, p.missingIndex, rule);
      if (!u.ok) errs.push(u.reason ?? 'nicht eindeutig');
    }
    return errs;
  },
  check(item, answer) {
    const a = answer as AnswerValue;
    if (a.type !== 'text') return false;
    const parsed = parseAnswer(a.raw);
    return !!parsed && eq(parsed.value, rat(item.correct));
  },
  fingerprint(item) {
    return item.prompt.terms.map((x) => (x === null ? '?' : x)).join(',');
  },
  promptText(item) {
    return item.prompt.terms.map((x) => (x === null ? '?' : formatNumber(x))).join(', ');
  },
};
