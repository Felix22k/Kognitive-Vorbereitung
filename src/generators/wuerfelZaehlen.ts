/**
 * Würfel zählen (Modul 6.12).
 * wz.zaehlen: Wie viele Würfel sind es? (verdeckte unter sichtbaren zählen mit)
 * wz.kontakt: Wie viele Würfel berühren genau zwei andere mit einer Fläche?
 * Höhenkarte: Würfel schweben nie. Nur Anordnungen, bei denen die Oberseite
 * jeder Säule sichtbar ist, damit die Antwort eindeutig bleibt.
 */
import { createRng } from '../core/rng';
import { parseAnswer } from '../core/rational';
import type { Generator, Item } from '../core/types';
import { baseValidate, timeForLevel, type AnswerValue } from './common';
import { ID, faces, key, mul, rotX, rotY, type V3 } from './raum/voxel';

/**
 * Blick für das Zählen: steiler als bei der Rotation, damit Oberseiten
 * sichtbar bleiben, aber bewusst nicht exakt isometrisch (35,26°), weil dort
 * Höhe und Tiefe verwechselbar wären.
 */
export const COUNT_VIEW = mul(rotX(32), rotY(-38));

export interface WzPrompt {
  question: 'zaehlen' | 'kontakt';
  /** heights[zeile][spalte], Zeile 0 = hinten */
  heights: number[][];
}

export type WzItem = Item<WzPrompt, number>;

export const GENERATOR_ID = 'wuerfelZaehlen';
export const GENERATOR_VERSION = 1;

export function toPoints(h: number[][]): V3[] {
  const pts: V3[] = [];
  h.forEach((row, z) =>
    row.forEach((hh, x) => {
      for (let y = 0; y < hh; y++) pts.push([x, y, z]);
    }),
  );
  return pts;
}

export function contactCount(pts: V3[], exactly: number): number {
  const occ = new Set(pts.map(key));
  let n = 0;
  for (const [x, y, z] of pts) {
    let c = 0;
    for (const [dx, dy, dz] of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ])
      if (occ.has(key([x + dx, y + dy, z + dz]))) c++;
    if (c === exactly) n++;
  }
  return n;
}

function insideQuad(pts: [number, number][], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const cr = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    const sgn = cr > 0 ? 1 : cr < 0 ? -1 : 0;
    if (!sgn) continue;
    if (!sign) sign = sgn;
    else if (sgn !== sign) return false;
  }
  return true;
}

/**
 * Oberseite jeder Säule zu mindestens 45 % sichtbar? Geprüft an 25 Punkten
 * je Oberseite: Liegt dort keine andere Fläche davor?
 */
export function topsVisible(h: number[][]): boolean {
  const pts = toPoints(h);
  const fs = faces(pts, ID, COUNT_VIEW);
  const boxes = fs.map((f) => {
    const xs = f.pts.map((p) => p[0]);
    const ys = f.pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  });
  for (let fi = 0; fi < fs.length; fi++) {
    const f = fs[fi];
    if (f.dir !== 2) continue;
    const [x, y, z] = pts[f.cube];
    if (y !== h[z][x] - 1) continue;
    const [p0, p1, , p3] = f.pts;
    let seen = 0;
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++) {
        const u = 0.1 + 0.2 * i;
        const v = 0.1 + 0.2 * j;
        const px = p0[0] + u * (p1[0] - p0[0]) + v * (p3[0] - p0[0]);
        const py = p0[1] + u * (p1[1] - p0[1]) + v * (p3[1] - p0[1]);
        let covered = false;
        for (let k = fs.length - 1; k > fi; k--) {
          const bb = boxes[k];
          if (px < bb[0] || px > bb[2] || py < bb[1] || py > bb[3]) continue;
          if (insideQuad(fs[k].pts, px, py)) {
            covered = true;
            break;
          }
        }
        if (!covered) seen++;
      }
    if (seen < 12) return false;
  }
  return true;
}

function config(level: number): { n: number; maxH: number; kontakt: number } {
  const t: [number, number, number][] = [
    [3, 2, 0],
    [3, 2, 0],
    [3, 3, 0],
    [4, 2, 0],
    [4, 3, 0],
    [4, 3, 0],
    [4, 4, 0.4],
    [5, 3, 0.4],
    [5, 4, 0.5],
    [5, 4, 0.5],
  ];
  const [n, maxH, kontakt] = t[level - 1];
  return { n, maxH, kontakt };
}

export function generateZaehlen(seed: number, level: number): WzItem {
  const rng = createRng(seed);
  const lvl = Math.max(1, Math.min(10, Math.round(level)));
  const cfg = config(lvl);
  const question = rng.chance(cfg.kontakt) ? 'kontakt' : 'zaehlen';
  for (let attempt = 0; attempt < 600; attempt++) {
    const n = question === 'kontakt' ? Math.min(cfg.n, 4) : cfg.n;
    // Treppe: hinten links hoch, vorne rechts niedrig, mit Zufall und Lücken,
    // damit die Oberseiten sichtbar bleiben
    const h = Array.from({ length: n }, (_, z) =>
      Array.from({ length: n }, (_, x) => {
        if (rng.chance(0.15)) return 0;
        const stair = cfg.maxH - Math.floor(((x + z) * cfg.maxH) / (2 * n - 1));
        return Math.max(0, Math.min(cfg.maxH, stair + rng.int(-2, 0)));
      }),
    );
    // Eine Säule darf höchstens eine Stufe höher sein als ihre hinteren Nachbarn,
    // sonst verdeckt sie deren Oberseite fast immer (spart Fehlversuche)
    for (let z = 0; z < n; z++)
      for (let x = 0; x < n; x++) {
        const back = [z > 0 ? h[z - 1][x] : null, x > 0 ? h[z][x - 1] : null].filter(
          (v): v is number => v !== null && v > 0,
        );
        // nach 30 Fehlversuchen strenge Treppe (nie höher als hinten): Oberseiten garantiert sichtbar
        if (back.length) h[z][x] = Math.min(h[z][x], Math.min(...back) + (attempt >= 30 ? 0 : 1));
      }
    const pts = toPoints(h);
    if (pts.length < 4 + lvl) continue;
    if (!topsVisible(h)) continue;
    const answer = question === 'kontakt' ? contactCount(pts, 2) : pts.length;
    if (question === 'kontakt' && answer < 1) continue;
    const rowsText = h
      .map(
        (row, z) =>
          `Reihe ${z + 1} (von hinten): ${row.join(' + ')} = ${row.reduce((a, b) => a + b, 0)}`,
      )
      .join('\n');
    const explanation =
      question === 'zaehlen'
        ? `Säulenhöhen Reihe für Reihe:\n${rowsText}\nZusammen ${answer} Würfel.`
        : `${answer} Würfel haben genau zwei Nachbarn, mit denen sie eine ganze Fläche teilen (oben, unten, links, rechts, vorn oder hinten).`;
    return {
      id: `${GENERATOR_ID}-${seed}-${lvl}`,
      moduleId: 'wuerfelZaehlen',
      generatorId: GENERATOR_ID,
      generatorVersion: GENERATOR_VERSION,
      seed,
      level: lvl,
      tags: [question === 'zaehlen' ? 'wz.zaehlen' : 'wz.kontakt'],
      prompt: { question, heights: h },
      correct: answer,
      correctLabel: String(answer),
      explanation,
      timeLimitMs: timeForLevel(lvl, 30, 45),
      answerKind: 'number',
    };
  }
  throw new Error(`Würfel zählen: keine Aufgabe für Stufe ${lvl}`);
}

export const wuerfelZaehlenGenerator: Generator<WzPrompt, number> = {
  id: GENERATOR_ID,
  version: GENERATOR_VERSION,
  generate: generateZaehlen,
  validate(item) {
    const errs = baseValidate(item as Item);
    const p = item.prompt;
    const pts = toPoints(p.heights);
    const expect = p.question === 'zaehlen' ? pts.length : contactCount(pts, 2);
    if (expect !== item.correct) errs.push('Lösung passt nicht');
    if (!topsVisible(p.heights)) errs.push('Oberseite einer Säule verdeckt');
    if (p.heights.flat().some((x) => x < 0 || x > 4)) errs.push('Höhe außerhalb 0 bis 4');
    return errs;
  },
  check(item, answer) {
    const a = answer as AnswerValue;
    if (a.type !== 'text') return false;
    const v = parseAnswer(a.raw);
    return !!v && v.value.d === 1 && v.value.n === item.correct;
  },
  fingerprint(item) {
    return item.prompt.question + JSON.stringify(item.prompt.heights);
  },
  promptText(item) {
    return item.prompt.question === 'zaehlen' ? 'Würfel zählen' : 'Würfel mit genau zwei Nachbarn';
  },
};
