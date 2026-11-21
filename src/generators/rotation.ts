/**
 * Mentale Rotation 3D (Modul 6.10).
 * Format A (mr.gleichSpiegel): zwei Figuren, rechts gedreht, gleich oder gespiegelt.
 * Format B (mr.vierOptionen): Zielfigur, 4 Optionen, genau 2 richtig.
 * Figuren nach Shepard und Metzler: 8 bis 10 Würfel als Kette mit 3 bis 4 Armen.
 */
import { createRng, type Rng } from '../core/rng';
import type { Generator, Item } from '../core/types';
import { baseValidate, timeForLevel, type AnswerValue } from './common';
import {
  CUBE_ROTATIONS,
  DEFAULT_VIEW,
  canonical,
  faces,
  isChiral,
  key,
  mirror,
  mul,
  rotX,
  rotY,
  viewAxisRotation,
  visibility,
  type Mat3,
  type V3,
} from './raum/voxel';

export type AxisType = 'ebene' | 'tiefe' | 'kombiniert';

export interface Figure {
  points: V3[];
  rot: Mat3;
  /** Licht mitdrehen (Drehung in der Bildebene soll wie eine reine Bilddrehung aussehen) */
  lightDeg?: number;
}

export interface MrPrompt {
  left: Figure;
  right: Figure;
  mirrored: boolean;
  angle: number;
  axis: AxisType;
}

export interface Mr4Prompt {
  target: Figure;
  options: Figure[];
  /** Art der Optionen: richtig, gespiegelt, baulich anders */
  kinds: ('richtig' | 'gespiegelt' | 'anders')[];
  correct: number[];
  angle: number;
  axis: AxisType;
}

const DIRS6: V3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

const AXIS_NAME: Record<AxisType, string> = {
  ebene: 'in der Bildebene',
  tiefe: 'in die Tiefe',
  kombiniert: 'um zwei Achsen',
};

// ---------- Figuren ----------

/** Zufällige Würfelkette mit 3 bis 4 Armen, alle drei Achsen kommen vor, chiral. */
export function shepardMetzler(rng: Rng, nCubes: number): V3[] | null {
  const arms = rng.int(3, 4);
  // Armlängen (Anzahl neuer Würfel je Arm) summieren sich auf nCubes − 1
  const lens: number[] = new Array(arms).fill(2);
  let rest = nCubes - 1 - 2 * arms;
  if (rest < 0) return null;
  while (rest-- > 0) lens[rng.int(0, arms - 1)]++;
  const axesUsed = new Set<number>();
  const pts: V3[] = [[0, 0, 0]];
  const occ = new Set([key([0, 0, 0])]);
  let prevAxis = -1;
  for (const len of lens) {
    const axis = rng.pick([0, 1, 2].filter((a) => a !== prevAxis));
    const sign = rng.sign();
    const d: V3 = [0, 0, 0];
    d[axis] = sign;
    for (let i = 0; i < len; i++) {
      const last = pts[pts.length - 1];
      const n: V3 = [last[0] + d[0], last[1] + d[1], last[2] + d[2]];
      if (occ.has(key(n))) return null;
      // keine Berührung mit anderen als dem Vorgänger (sonst entstehen Klumpen)
      const touches = DIRS6.some(
        (e) =>
          key([n[0] + e[0], n[1] + e[1], n[2] + e[2]]) !== key(last) &&
          occ.has(key([n[0] + e[0], n[1] + e[1], n[2] + e[2]])),
      );
      if (touches) return null;
      pts.push(n);
      occ.add(key(n));
    }
    axesUsed.add(axis);
    prevAxis = axis;
  }
  if (axesUsed.size < 3) return null;
  if (!isChiral(pts)) return null;
  return pts;
}

/** Baulich ähnliche Figur: der letzte Würfel sitzt an einer anderen Stelle. */
export function structuralVariant(rng: Rng, pts: V3[]): V3[] | null {
  const base = canonical(pts);
  const mir = canonical(mirror(pts));
  const ends = rng.shuffle([0, pts.length - 1]);
  for (const endIdx of ends) {
    const rest = pts.filter((_, i) => i !== endIdx);
    const anchor = endIdx === 0 ? pts[1] : pts[pts.length - 2];
    const occ = new Set(rest.map(key));
    const old = pts[endIdx];
    for (const d of rng.shuffle([
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ] as V3[])) {
      const n: V3 = [anchor[0] + d[0], anchor[1] + d[1], anchor[2] + d[2]];
      if (occ.has(key(n)) || key(n) === key(old)) continue;
      const v = endIdx === 0 ? [n, ...rest] : [...rest, n];
      const c = canonical(v);
      if (c !== base && c !== mir) return v;
    }
  }
  return null;
}

// ---------- Sichtbarkeit ----------

/** Jeder Würfel muss ausreichend sichtbar sein. */
export function wellVisible(points: V3[], rot: Mat3, minPixels: number): boolean {
  const fs = faces(points, rot, DEFAULT_VIEW);
  const vis = visibility(fs, 56);
  for (let i = 0; i < points.length; i++) if ((vis.perCube.get(i) ?? 0) < minPixels) return false;
  return true;
}

/** Zufällige Ausgangslage: beliebige Würfeldrehung plus kleine Neigung. */
function startOrientation(rng: Rng): Mat3 {
  const r = rng.pick(CUBE_ROTATIONS);
  return mul(mul(rotY(rng.int(-20, 20)), rotX(rng.int(-15, 15))), r);
}

interface LevelSpec {
  axis: AxisType;
  angles: number[];
  cubes: number;
  minPixels: number;
}

function spec(level: number, rng: Rng): LevelSpec {
  const upTo = (max: number) => [30, 60, 90, 120, 150, 180].filter((a) => a <= max);
  switch (level) {
    case 1:
      return { axis: 'ebene', angles: upTo(60), cubes: 8, minPixels: 14 };
    case 2:
      return { axis: 'ebene', angles: upTo(120), cubes: 8, minPixels: 14 };
    case 3:
      return { axis: 'ebene', angles: upTo(180), cubes: 8, minPixels: 12 };
    case 4:
      return { axis: 'tiefe', angles: upTo(90), cubes: 8, minPixels: 12 };
    case 5:
      return { axis: 'tiefe', angles: upTo(150), cubes: 9, minPixels: 10 };
    case 6:
      return { axis: rng.pick(['tiefe', 'ebene']), angles: upTo(180), cubes: 9, minPixels: 10 };
    case 7:
      return {
        axis: rng.pick(['tiefe', 'kombiniert']),
        angles: upTo(180).slice(1),
        cubes: 9,
        minPixels: 8,
      };
    case 8:
      return { axis: 'kombiniert', angles: upTo(180).slice(1), cubes: 10, minPixels: 6 };
    case 9:
      return { axis: 'kombiniert', angles: upTo(180).slice(2), cubes: 10, minPixels: 5 };
    default:
      return { axis: 'kombiniert', angles: upTo(180).slice(3), cubes: 10, minPixels: 4 };
  }
}

function deltaRotation(rng: Rng, axis: AxisType, angle: number): { m: Mat3; lightDeg: number } {
  const sgn = rng.sign();
  if (axis === 'ebene')
    return { m: viewAxisRotation(DEFAULT_VIEW, 'z', sgn * angle), lightDeg: sgn * angle };
  if (axis === 'tiefe')
    return {
      m: viewAxisRotation(DEFAULT_VIEW, rng.chance(0.7) ? 'y' : 'x', sgn * angle),
      lightDeg: 0,
    };
  // kombiniert: Hauptdrehung um die senkrechte Achse, dazu Neigung
  const tilt = rng.pick([30, 60, 90]) * rng.sign();
  return {
    m: mul(
      viewAxisRotation(DEFAULT_VIEW, 'x', tilt),
      viewAxisRotation(DEFAULT_VIEW, 'y', sgn * angle),
    ),
    lightDeg: 0,
  };
}

// ---------- Format A ----------

export const GENERATOR_ID_A = 'rotation';
export const GENERATOR_ID_B = 'rotation4';
export const GENERATOR_VERSION = 1;

export type MrItem = Item<MrPrompt, number>;
export type Mr4Item = Item<Mr4Prompt, number[]>;

export function generateA(seed: number, level: number): MrItem {
  const rng = createRng(seed);
  const lvl = Math.max(1, Math.min(10, Math.round(level)));
  for (let attempt = 0; attempt < 300; attempt++) {
    const sp = spec(lvl, rng);
    const pts = shepardMetzler(rng, sp.cubes);
    if (!pts) continue;
    const mirrored = rng.chance(0.5);
    const angle = rng.pick(sp.angles);
    const r0 = startOrientation(rng);
    if (!wellVisible(pts, r0, sp.minPixels)) continue;
    const delta = deltaRotation(rng, sp.axis, angle);
    const rRight = mul(delta.m, r0);
    const rightPts = mirrored ? mirror(pts) : pts;
    if (!wellVisible(rightPts, rRight, sp.minPixels)) continue;
    const prompt: MrPrompt = {
      left: { points: pts, rot: r0 },
      right: { points: rightPts, rot: rRight, lightDeg: delta.lightDeg },
      mirrored,
      angle,
      axis: sp.axis,
    };
    const correct = mirrored ? 1 : 0;
    return {
      id: `${GENERATOR_ID_A}-${seed}-${lvl}`,
      moduleId: 'rotation',
      generatorId: GENERATOR_ID_A,
      generatorVersion: GENERATOR_VERSION,
      seed,
      level: lvl,
      tags: ['mr.gleichSpiegel', `mr.achse.${sp.axis}`],
      prompt,
      correct,
      correctLabel: mirrored ? 'gespiegelt' : 'gleich',
      explanation: [
        `Die rechte Figur ist um ${angle}° ${AXIS_NAME[sp.axis]} gedreht${mirrored ? ' und gespiegelt' : ''}.`,
        mirrored
          ? 'Keine Drehung bringt beide Figuren zur Deckung: Die Abknickungen gehen an einer Stelle in die Gegenrichtung.'
          : 'Dreht man die linke Figur entsprechend, liegen beide genau übereinander.',
      ].join('\n'),
      timeLimitMs: timeForLevel(lvl, 7, 4),
      answerKind: 'choice',
    };
  }
  throw new Error(`Rotation A: keine Aufgabe für Stufe ${lvl}`);
}

// ---------- Format B ----------

export function generateB(seed: number, level: number): Mr4Item {
  const rng = createRng(seed);
  const lvl = Math.max(1, Math.min(10, Math.round(level)));
  for (let attempt = 0; attempt < 300; attempt++) {
    const sp = spec(lvl, rng);
    const pts = shepardMetzler(rng, sp.cubes);
    if (!pts) continue;
    const variant = structuralVariant(rng, pts);
    if (!variant) continue;
    const r0 = startOrientation(rng);
    if (!wellVisible(pts, r0, sp.minPixels)) continue;
    // Falsche Optionen: unten eher gespiegelt + baulich anders, oben öfter zwei ähnliche
    const wrongKinds: ('gespiegelt' | 'anders')[] =
      lvl >= 8 && rng.chance(0.5)
        ? [rng.pick(['gespiegelt', 'anders'] as const), 'anders']
        : ['gespiegelt', 'anders'];
    const kinds = rng.shuffle(['richtig', 'richtig', ...wrongKinds] as (
      | 'richtig'
      | 'gespiegelt'
      | 'anders'
    )[]);
    const options: Figure[] = [];
    let ok = true;
    const usedAngles: number[] = [];
    const seenRot = new Set<string>();
    for (const k of kinds) {
      let placed = false;
      for (let t = 0; t < 12 && !placed; t++) {
        const angle = rng.pick(sp.angles);
        const delta = deltaRotation(rng, sp.axis, angle);
        const rot = mul(delta.m, r0);
        const rk = rot.map((x) => x.toFixed(2)).join(',');
        if (seenRot.has(rk)) continue;
        let p = pts;
        if (k === 'gespiegelt') p = mirror(pts);
        if (k === 'anders') p = rng.chance(0.5) || lvl < 5 ? variant : mirror(variant);
        if (!wellVisible(p, rot, sp.minPixels)) continue;
        seenRot.add(rk);
        usedAngles.push(angle);
        options.push({ points: p, rot, lightDeg: delta.lightDeg });
        placed = true;
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    // gespiegelte Variante der baulich anderen Figur darf nicht zufällig gleich der Zielfigur sein
    const tc = canonical(pts);
    const correct = kinds.map((k, i) => (k === 'richtig' ? i : -1)).filter((i) => i >= 0);
    if (options.some((o, i) => !correct.includes(i) && canonical(o.points) === tc)) continue;
    const prompt: Mr4Prompt = {
      target: { points: pts, rot: r0 },
      options,
      kinds,
      correct,
      angle: Math.max(...usedAngles),
      axis: sp.axis,
    };
    return {
      id: `${GENERATOR_ID_B}-${seed}-${lvl}`,
      moduleId: 'rotation4',
      generatorId: GENERATOR_ID_B,
      generatorVersion: GENERATOR_VERSION,
      seed,
      level: lvl,
      tags: ['mr.vierOptionen', `mr.achse.${sp.axis}`],
      prompt,
      correct,
      correctLabel: correct.map((i) => 'ABCD'[i]).join(' und '),
      explanation: kinds
        .map(
          (k, i) =>
            `${'ABCD'[i]}: ${k === 'richtig' ? 'richtig, nur gedreht' : k === 'gespiegelt' ? 'gespiegelt' : 'baulich anders (ein Würfel an anderer Stelle)'}`,
        )
        .join('\n'),
      timeLimitMs: timeForLevel(lvl, 30, 60),
      answerKind: 'choice',
    };
  }
  throw new Error(`Rotation B: keine Aufgabe für Stufe ${lvl}`);
}

const figKey = (f: Figure) => canonical(f.points) + '|' + f.rot.map((x) => x.toFixed(3)).join(',');

export const rotationGenerator: Generator<MrPrompt, number> = {
  id: GENERATOR_ID_A,
  version: GENERATOR_VERSION,
  generate: generateA,
  validate(item) {
    const errs = baseValidate(item as Item);
    const p = item.prompt;
    if (p.left.points.length < 8 || p.left.points.length > 10)
      errs.push('Würfelzahl außerhalb 8 bis 10');
    if (!isChiral(p.left.points)) errs.push('Figur nicht chiral');
    const same = canonical(p.left.points) === canonical(p.right.points);
    if (same === p.mirrored) errs.push('Lösung passt nicht zur Figur');
    if (item.correct !== (p.mirrored ? 1 : 0)) errs.push('falscher Lösungsindex');
    return errs;
  },
  check(item, answer) {
    const a = answer as AnswerValue;
    return a.type === 'choice' && a.index === item.correct;
  },
  fingerprint(item) {
    return figKey(item.prompt.left) + '#' + figKey(item.prompt.right);
  },
  promptText(item) {
    return `Rotation ${item.prompt.angle}° ${AXIS_NAME[item.prompt.axis]}`;
  },
};

export const rotation4Generator: Generator<Mr4Prompt, number[]> = {
  id: GENERATOR_ID_B,
  version: GENERATOR_VERSION,
  generate: generateB,
  validate(item) {
    const errs = baseValidate(item as Item);
    const p = item.prompt;
    if (p.options.length !== 4) errs.push('nicht 4 Optionen');
    if (p.correct.length !== 2) errs.push('nicht genau 2 richtig');
    const tc = canonical(p.target.points);
    p.options.forEach((o, i) => {
      const same = canonical(o.points) === tc;
      if (same !== p.correct.includes(i)) errs.push(`Option ${'ABCD'[i]} falsch eingestuft`);
    });
    if (new Set(p.options.map(figKey)).size !== 4) errs.push('Optionen gleich');
    return errs;
  },
  check(item, answer) {
    const a = answer as AnswerValue;
    if (a.type !== 'multi') return false;
    const s = [...a.indices].sort((x, y) => x - y);
    return s.length === 2 && s[0] === item.correct[0] && s[1] === item.correct[1];
  },
  fingerprint(item) {
    return figKey(item.prompt.target) + '#' + item.prompt.options.map(figKey).join('#');
  },
  promptText(item) {
    return `Rotation: zwei aus vier (bis ${item.prompt.angle}° ${AXIS_NAME[item.prompt.axis]})`;
  },
};
