/**
 * Technisches Verständnis (Modul 6.6).
 * Erzeugte Aufgaben mit SVG-Grafik: Zahnräder (ab Stufe 6 mit gemeinsamer
 * Achse), Riemen (offen/gekreuzt), Hebel, Flaschenzug, schiefe Ebene.
 * Dazu eine feste Sammlung von Textaufgaben (Strom, Wärme, Auftrieb,
 * Hydraulik, verbundene Gefäße, Schwerpunkt, Kurvenfahrt, Mechanik).
 * Die feste Sammlung ist begrenzt und wiederholt sich.
 */
import { createRng, type Rng } from '../core/rng';
import { formatNumber } from '../core/rational';
import technik from '../data/technik.json';
import { timeForLevel } from './common';
import { shuffleWithIndex, tcGenerator, type TcItem, type TcPrompt } from './textChoice';

/* ---------------- Datenmodell der Grafiken ---------------- */

export interface Gear {
  x: number;
  y: number;
  r: number;
  teeth: number;
  label: string;
  /** Ebene: Räder hinter einer gemeinsamen Achse liegen in Ebene 1 (vorn) */
  plane: number;
}
export interface GearFig {
  type: 'zahnrad';
  gears: Gear[];
  /** Paare von Indizes, die ineinandergreifen */
  mesh: [number, number][];
  /** Paare auf gemeinsamer Achse (fest verbunden) */
  axle: [number, number][];
  driver: number;
  /** Drehsinn des Antriebs: 1 = Uhrzeigersinn, −1 = gegen */
  dir: 1 | -1;
  target: number;
}
export interface BeltFig {
  type: 'riemen';
  pulleys: { x: number; y: number; r: number; label: string }[];
  /** Riemen zwischen Rad i und j, gekreuzt oder offen */
  belts: { a: number; b: number; crossed: boolean }[];
  axle: [number, number][];
  driver: number;
  dir: 1 | -1;
  target: number;
}
export interface LeverFig {
  type: 'hebel';
  /** Gewichte: Position (negativ = links, Einheiten), Wert oder null = gesucht */
  loads: { pos: number; value: number | null }[];
  unit: string;
}
export interface PulleyFig {
  type: 'flaschenzug';
  /** tragende Seilstränge */
  strands: number;
  load: number;
}
export interface RampFig {
  type: 'schiefeEbene';
  length: number;
  height: number;
  load: number;
}
export type TechFig = GearFig | BeltFig | LeverFig | PulleyFig | RampFig;

export interface TePrompt extends TcPrompt {
  figure?: TechFig;
  /** Thema (Tag-Suffix) */
  topic: string;
  /** Fester Eintrag aus der Sammlung */
  fixed?: boolean;
}

export type TeItem = TcItem<TePrompt>;

interface Bank {
  aufgaben: {
    id: string;
    thema: string;
    stufe: number;
    frage: string;
    richtig: string;
    falsch: string[];
    erklaerung: string;
  }[];
}
export const TE_BANK = (technik as Bank).aufgaben;

const f = formatNumber;
const CW = 'im Uhrzeigersinn';
const CCW = 'gegen den Uhrzeigersinn';
const BLOCK = 'gar nicht, das Getriebe blockiert';

/* ---------------- Drehsinn und Drehzahl ---------------- */

/**
 * Drehsinn und Drehzahl aller Räder aus Kopplungen bestimmen.
 * Eingriff: Gegenrichtung, Drehzahl · z1/z2. Achse: gleich.
 * Widerspruch (ungerader Kreis) = blockiert.
 */
export function solveGears(fig: GearFig): { dir: number[]; speed: number[]; blocked: boolean } {
  const n = fig.gears.length;
  const dir = Array<number>(n).fill(0);
  const speed = Array<number>(n).fill(0);
  dir[fig.driver] = fig.dir;
  speed[fig.driver] = 1;
  let blocked = false;
  const queue = [fig.driver];
  while (queue.length) {
    const i = queue.shift()!;
    const links: [number, number, number][] = [];
    for (const [a, b] of fig.mesh) {
      if (a === i) links.push([b, -dir[i], (speed[i] * fig.gears[i].teeth) / fig.gears[b].teeth]);
      if (b === i) links.push([a, -dir[i], (speed[i] * fig.gears[i].teeth) / fig.gears[a].teeth]);
    }
    for (const [a, b] of fig.axle) {
      if (a === i) links.push([b, dir[i], speed[i]]);
      if (b === i) links.push([a, dir[i], speed[i]]);
    }
    for (const [j, d, s] of links) {
      if (!dir[j]) {
        dir[j] = d;
        speed[j] = s;
        queue.push(j);
      } else if (dir[j] !== d) blocked = true;
    }
  }
  return { dir, speed, blocked };
}

export function solveBelts(fig: BeltFig): { dir: number[]; speed: number[] } {
  const n = fig.pulleys.length;
  const dir = Array<number>(n).fill(0);
  const speed = Array<number>(n).fill(0);
  dir[fig.driver] = fig.dir;
  speed[fig.driver] = 1;
  const queue = [fig.driver];
  while (queue.length) {
    const i = queue.shift()!;
    for (const bl of fig.belts) {
      const j = bl.a === i ? bl.b : bl.b === i ? bl.a : -1;
      if (j < 0 || dir[j]) continue;
      dir[j] = bl.crossed ? -dir[i] : dir[i];
      speed[j] = (speed[i] * fig.pulleys[i].r) / fig.pulleys[j].r;
      queue.push(j);
    }
    for (const [a, b] of fig.axle) {
      const j = a === i ? b : b === i ? a : -1;
      if (j < 0 || dir[j]) continue;
      dir[j] = dir[i];
      speed[j] = speed[i];
      queue.push(j);
    }
  }
  return { dir, speed };
}

/* ---------------- Zahnräder ---------------- */

const TEETH = [8, 10, 12, 15, 16, 20, 24, 30];
const radius = (z: number) => 6 + z * 1.6;

function placeChain(r: Rng, count: number, axleAt: number | null): GearFig | null {
  const gears: Gear[] = [];
  const mesh: [number, number][] = [];
  const axle: [number, number][] = [];
  let plane = 0;
  for (let k = 0; k < count; k++) {
    const teeth = r.pick(TEETH);
    const rad = radius(teeth);
    const prev = k - 1;
    if (k === 0) {
      gears.push({ x: 0, y: 0, r: rad, teeth, label: '', plane });
    } else if (axleAt !== null && k === axleAt) {
      // kleineres Rad auf derselben Achse wie das vorige, eine Ebene weiter vorn
      const p = gears[prev];
      const smaller = TEETH.filter((z) => z <= p.teeth - 4);
      if (!smaller.length) return null;
      const tz = r.pick(smaller);
      plane++;
      gears.push({ x: p.x, y: p.y, r: radius(tz), teeth: tz, label: '', plane });
      axle.push([prev, k]);
    } else {
      const p = gears[prev];
      const ang = (r.int(-40, 40) * Math.PI) / 180;
      const d = p.r + rad + 1.5;
      const x = p.x + d * Math.cos(ang);
      const y = p.y + d * Math.sin(ang);
      // Partner auf gemeinsamer Achse mit dem Vorgänger liegt in einer anderen Ebene
      const partners = new Set(
        axle.flatMap(([a, b]) => (a === prev ? [b] : b === prev ? [a] : [])),
      );
      for (let i = 0; i < gears.length; i++) {
        if (i === prev || partners.has(i)) continue;
        const g = gears[i];
        if (Math.hypot(g.x - x, g.y - y) < g.r + rad + 6) return null;
      }
      gears.push({ x, y, r: rad, teeth, label: '', plane });
      mesh.push([prev, k]);
    }
  }
  return {
    type: 'zahnrad',
    gears,
    mesh,
    axle,
    driver: 0,
    dir: r.chance(0.5) ? 1 : -1,
    target: count - 1,
  };
}

function placeTriangle(r: Rng): GearFig {
  // drei Räder, die sich gegenseitig berühren: blockiert
  const t = [r.pick(TEETH), r.pick(TEETH), r.pick(TEETH)];
  const rr = t.map(radius);
  const d01 = rr[0] + rr[1] + 1.5;
  const d02 = rr[0] + rr[2] + 1.5;
  const d12 = rr[1] + rr[2] + 1.5;
  // Rad 2 über dem Abschnitt 0-1 (Kosinussatz)
  const cosA = (d01 * d01 + d02 * d02 - d12 * d12) / (2 * d01 * d02);
  const a = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const gears: Gear[] = [
    { x: 0, y: 0, r: rr[0], teeth: t[0], label: '', plane: 0 },
    { x: d01, y: 0, r: rr[1], teeth: t[1], label: '', plane: 0 },
    { x: d02 * Math.cos(a), y: -d02 * Math.sin(a), r: rr[2], teeth: t[2], label: '', plane: 0 },
  ];
  return {
    type: 'zahnrad',
    gears,
    mesh: [
      [0, 1],
      [1, 2],
      [0, 2],
    ],
    axle: [],
    driver: 0,
    dir: r.chance(0.5) ? 1 : -1,
    target: 2,
  };
}

function gearTask(r: Rng, lvl: number): Omit<TePrompt, 'kind'> & { explanation: string } {
  const withAxle = lvl >= 6 && r.chance(0.6);
  const count = lvl <= 2 ? r.int(2, 3) : lvl <= 5 ? r.int(3, 5) : r.int(4, 6);
  let fig: GearFig | null = null;
  const blockedVariant = lvl >= 3 && !withAxle && r.chance(0.2);
  if (blockedVariant) fig = placeTriangle(r);
  for (let i = 0; !fig && i < 200; i++)
    fig = placeChain(r, count, withAxle ? r.int(1, count - 2) : null);
  if (!fig) fig = placeChain(r, 2, null)!;
  fig.gears.forEach((g, i) => (g.label = 'ABCDEFG'[i]));
  const sol = solveGears(fig);
  const A = fig.gears[fig.driver];
  const T = fig.gears[fig.target];
  const speedQ = !sol.blocked && lvl >= 4 && r.chance(0.5);
  const axleText = fig.axle.length
    ? ` Räder auf einer gemeinsamen Achse (${fig.axle.map(([a, b]) => fig!.gears[a].label + ' und ' + fig!.gears[b].label).join(', ')}) sind fest verbunden.`
    : '';
  if (!speedQ) {
    const correct = sol.blocked ? BLOCK : sol.dir[fig.target] === 1 ? CW : CCW;
    const options = r.shuffle([CW, CCW, BLOCK]);
    const chain = fig.gears.map(
      (g, i) => `${g.label}: ${sol.dir[i] === 1 ? 'rechts' : 'links'}herum`,
    );
    return {
      question: `Rad ${A.label} dreht sich ${fig.dir === 1 ? CW : CCW}. Wie dreht sich Rad ${T.label}?`,
      options,
      correctIndex: options.indexOf(correct),
      figure: fig,
      topic: 'zahnrad',
      explanation: sol.blocked
        ? 'Drei Räder greifen im Kreis ineinander. Jedes müsste sich gegen seine beiden Nachbarn drehen, das geht bei einer ungeraden Anzahl nicht: Das Getriebe blockiert.'
        : `Ineinandergreifende Räder drehen sich gegenläufig, Räder auf einer Achse gleichsinnig.${axleText}\n${chain.join(' · ')}\nTipp: Bei einer einfachen Kette dreht jedes zweite Rad wie das erste.`,
    };
  }
  const n = r.pick([1, 2, 3, 6, 12]);
  const ans = n * sol.speed[fig.target];
  const fmtU = (v: number) => `${f(v)} Umdrehungen`;
  const correct = fmtU(ans);
  const wrongVals = [n * (1 / sol.speed[fig.target]), n * (A.teeth / T.teeth), n, ans * 2, ans / 2];
  const wrong: string[] = [];
  for (const v of wrongVals) {
    const l = fmtU(Math.round(v * 100) / 100);
    if (v > 0 && l !== correct && !wrong.includes(l)) wrong.push(l);
  }
  const { options, correctIndex } = shuffleWithIndex(r, correct, wrong.slice(0, 3));
  return {
    question: `Rad ${A.label} hat ${A.teeth} Zähne und macht ${n} Umdrehung${n > 1 ? 'en' : ''}. Wie viele Umdrehungen macht Rad ${T.label} (${T.teeth} Zähne)?`,
    options,
    correctIndex,
    figure: fig,
    topic: 'zahnrad',
    explanation: fig.axle.length
      ? `Bei Eingriff gilt: Umdrehungen · Zähne bleibt gleich. Auf gemeinsamer Achse ist die Drehzahl gleich.${axleText}\n` +
        fig.gears.map((g, i) => `${g.label} (${g.teeth} Z.): ${f(n * sol.speed[i])} U`).join(' · ')
      : `Zwischenräder ändern nur die Richtung, nicht die Übersetzung. Es zählt nur ${A.label} zu ${T.label}: ${n} · ${A.teeth} : ${T.teeth} = ${f(ans)} Umdrehungen.`,
  };
}

/* ---------------- Riemen ---------------- */

function beltTask(r: Rng, lvl: number): Omit<TePrompt, 'kind'> & { explanation: string } {
  const three = lvl >= 6 && r.chance(0.5);
  const radii = [14, 18, 24, 30, 36];
  const pulleys: BeltFig['pulleys'] = [];
  const belts: BeltFig['belts'] = [];
  const axle: [number, number][] = [];
  const r0 = r.pick(radii);
  // bei drei Rädern muss auf der Achse von B ein kleineres Rad C Platz haben
  const r1 = r.pick(radii.filter((x) => x !== r0 && (!three || x > radii[0])));
  pulleys.push({ x: 0, y: 0, r: r0, label: 'A' });
  pulleys.push({ x: r0 + r1 + 60, y: r.int(-15, 15), r: r1, label: 'B' });
  belts.push({ a: 0, b: 1, crossed: r.chance(0.5) });
  if (three) {
    const rs = r.pick(radii.filter((x) => x < r1));
    pulleys.push({ x: pulleys[1].x, y: pulleys[1].y, r: rs, label: 'C' });
    axle.push([1, 2]);
    const r3 = r.pick(radii.filter((x) => x !== rs));
    pulleys.push({
      x: pulleys[1].x + rs + r3 + 60,
      y: pulleys[1].y + r.int(-15, 15),
      r: r3,
      label: 'D',
    });
    belts.push({ a: 2, b: 3, crossed: r.chance(0.5) });
  }
  const fig: BeltFig = {
    type: 'riemen',
    pulleys,
    belts,
    axle,
    driver: 0,
    dir: r.chance(0.5) ? 1 : -1,
    target: pulleys.length - 1,
  };
  const sol = solveBelts(fig);
  const T = pulleys[fig.target];
  const faster = sol.speed[fig.target] > 1;
  const same = sol.dir[fig.target] === fig.dir;
  const numeric = lvl >= 5 && r.chance(0.5);
  const beltText = belts
    .map(
      (b) =>
        `${pulleys[b.a].label}–${pulleys[b.b].label}: ${b.crossed ? 'gekreuzt (Gegenrichtung)' : 'offen (gleiche Richtung)'}`,
    )
    .join(', ');
  if (!numeric) {
    const opts = ['schneller', 'langsamer'].flatMap((s) =>
      ['in gleicher Richtung', 'in Gegenrichtung'].map((d) => `${s}, ${d}`),
    );
    const correct = `${faster ? 'schneller' : 'langsamer'}, ${same ? 'in gleicher Richtung' : 'in Gegenrichtung'}`;
    const options = r.shuffle(opts);
    return {
      question: `Rad A treibt an. Wie dreht sich Rad ${T.label} im Vergleich zu Rad A?`,
      options,
      correctIndex: options.indexOf(correct),
      figure: fig,
      topic: 'riemen',
      explanation: `Riemen ${beltText}. Ein kleineres Rad dreht sich schneller, ein größeres langsamer; Räder auf einer Achse gleich schnell.\nRad ${T.label} dreht ${f(sol.speed[fig.target])}-mal so schnell wie A, ${same ? 'in gleicher Richtung' : 'in Gegenrichtung'}.`,
    };
  }
  const rpm = r.pick([60, 90, 120, 150, 240]);
  const ans = rpm * sol.speed[fig.target];
  const lab = (v: number) => `${f(Math.round(v * 10) / 10)} U/min`;
  const wrong = [rpm / sol.speed[fig.target], rpm, ans * 2]
    .map(lab)
    .filter((l, i, a) => l !== lab(ans) && a.indexOf(l) === i);
  while (wrong.length < 3) wrong.push(lab(ans * (1.5 + wrong.length / 2)));
  const { options, correctIndex } = shuffleWithIndex(r, lab(ans), wrong.slice(0, 3));
  const diam = pulleys.map((p) => `${p.label}: ${(p.r * 2) / 4} cm`).join(', ');
  return {
    question: `Rad A dreht sich mit ${rpm} Umdrehungen pro Minute. Durchmesser: ${diam}. Wie schnell dreht sich Rad ${T.label}?`,
    options,
    correctIndex,
    figure: fig,
    topic: 'riemen',
    explanation: `Der Riemen bewegt beide Räder am Umfang gleich schnell: Drehzahl · Durchmesser bleibt gleich.${axle.length ? ' B und C sitzen auf einer Achse und drehen gleich schnell.' : ''}\n${pulleys.map((p, i) => `${p.label}: ${f(Math.round(rpm * sol.speed[i] * 10) / 10)} U/min`).join(' · ')}`,
  };
}

/* ---------------- Hebel ---------------- */

function leverTask(r: Rng, lvl: number): Omit<TePrompt, 'kind'> & { explanation: string } {
  for (let i = 0; i < 100; i++) {
    const unit = r.chance(0.5) ? 'kg' : 'N';
    const base = unit === 'kg' ? [2, 3, 4, 5, 6, 8, 10, 12] : [20, 30, 40, 50, 60, 80, 100, 120];
    const loads: LeverFig['loads'] = [];
    const left = lvl >= 6 ? r.int(1, 2) : 1;
    const usedPos = new Set<number>();
    for (let k = 0; k < left; k++) {
      let pos = -r.int(1, 6);
      while (usedPos.has(pos)) pos = -r.int(1, 6);
      usedPos.add(pos);
      loads.push({ pos, value: r.pick(base) });
    }
    if (lvl >= 8 && r.chance(0.5)) {
      let pos = r.int(1, 6);
      while (usedPos.has(pos)) pos = r.int(1, 6);
      usedPos.add(pos);
      loads.push({ pos, value: r.pick(base) });
    }
    let qpos = r.int(1, 6);
    while (usedPos.has(qpos)) qpos = r.int(1, 6);
    const momentL = loads.filter((l) => l.pos < 0).reduce((s, l) => s + l.value! * -l.pos, 0);
    const momentR = loads.filter((l) => l.pos > 0).reduce((s, l) => s + l.value! * l.pos, 0);
    const ans = (momentL - momentR) / qpos;
    if (!(ans > 0) || Math.abs(ans * 2 - Math.round(ans * 2)) > 1e-9) continue;
    loads.push({ pos: qpos, value: null });
    const lab = (v: number) => `${f(v)} ${unit}`;
    const firstL = loads[0];
    const wrongVals = [
      (firstL.value! * qpos) / -firstL.pos,
      momentL - momentR,
      firstL.value!,
      ans * 2,
      ans / 2,
    ];
    const wrong: string[] = [];
    for (const v of wrongVals) {
      const l = lab(Math.round(v * 10) / 10);
      if (v > 0 && l !== lab(ans) && !wrong.includes(l)) wrong.push(l);
    }
    if (wrong.length < 3) continue;
    const { options, correctIndex } = shuffleWithIndex(r, lab(ans), wrong.slice(0, 3));
    const fig: LeverFig = { type: 'hebel', loads, unit };
    const terms = loads
      .filter((l) => l.value !== null && l.pos < 0)
      .map((l) => `${f(l.value!)} · ${-l.pos}`)
      .join(' + ');
    const termsR = loads
      .filter((l) => l.value !== null && l.pos > 0)
      .map((l) => `${f(l.value!)} · ${l.pos}`)
      .join(' + ');
    return {
      question: `Der Balken ist in gleiche Abschnitte geteilt und selbst gewichtslos. Welcher Wert gehört an die Stelle „?“, damit der Balken im Gleichgewicht ist?`,
      options,
      correctIndex,
      figure: fig,
      topic: 'hebel',
      explanation: `Hebelgesetz: Last · Abstand links = Last · Abstand rechts.\nLinks: ${terms} = ${f(momentL)}${termsR ? `\nRechts schon vorhanden: ${termsR} = ${f(momentR)}` : ''}\n? · ${qpos} = ${f(momentL - momentR)}  →  ? = ${lab(ans)}`,
    };
  }
  throw new Error('Hebel: keine Aufgabe');
}

/* ---------------- Flaschenzug ---------------- */

function pulleyTask(r: Rng, lvl: number): Omit<TePrompt, 'kind'> & { explanation: string } {
  const strands = r.pick(lvl <= 4 ? [1, 2, 3, 4] : [2, 3, 4, 5, 6]);
  const load = r.pick([120, 240, 360, 480, 600, 720]);
  const askWay = lvl >= 5 && r.chance(0.4);
  const fig: PulleyFig = { type: 'flaschenzug', strands, load };
  if (!askWay) {
    const ans = load / strands;
    const lab = (v: number) => `${f(Math.round(v * 10) / 10)} N`;
    const wrong = [load, load / (strands + 1), load / Math.max(1, strands - 1), load * strands]
      .map(lab)
      .filter((l, i, a) => l !== lab(ans) && a.indexOf(l) === i);
    const { options, correctIndex } = shuffleWithIndex(r, lab(ans), wrong.slice(0, 3));
    return {
      question: `Die Last wiegt ${load} N. Mit welcher Kraft muss man am Seil ziehen, um sie zu halten? (Rollen und Seil gewichtslos, ohne Reibung)`,
      options,
      correctIndex,
      figure: fig,
      topic: 'flaschenzug',
      explanation: `Zähle die Seilstränge, die die untere (lose) Rolle bzw. die Last tragen: ${strands}. Die Kraft ist Last : Stränge = ${load} : ${strands} = ${lab(ans)}.${strands === 1 ? ' Eine feste Rolle lenkt nur um, sie spart keine Kraft.' : ''}`,
    };
  }
  const h = r.pick([1, 2, 3]);
  const ans = h * strands;
  const lab = (v: number) => `${f(v)} m`;
  const wrong = [h, h / strands, h * (strands + 1), h * strands * 2]
    .map(lab)
    .filter((l, i, a) => l !== lab(ans) && a.indexOf(l) === i);
  const { options, correctIndex } = shuffleWithIndex(r, lab(ans), wrong.slice(0, 3));
  return {
    question: `Die Last soll um ${h} m angehoben werden. Wie viel Seil muss man dafür ziehen?`,
    options,
    correctIndex,
    figure: fig,
    topic: 'flaschenzug',
    explanation: `Jeder der ${strands} tragenden Stränge wird um ${h} m kürzer. Gezogen werden ${strands} · ${h} m = ${lab(ans)}. Kraft gespart, Weg verlängert (goldene Regel der Mechanik).`,
  };
}

/* ---------------- Schiefe Ebene ---------------- */

function rampTask(r: Rng): Omit<TePrompt, 'kind'> & { explanation: string } {
  const [h, l] = r.pick([
    [1, 2],
    [1, 4],
    [2, 5],
    [3, 5],
    [1, 3],
    [2, 8],
    [3, 6],
  ]);
  const load = r.pick([300, 600, 900, 1200, 1500]);
  const ans = (load * h) / l;
  const lab = (v: number) => `${f(Math.round(v * 10) / 10)} N`;
  const wrong = [(load * l) / h, load, (load * h) / (l + h), load - ans]
    .map(lab)
    .filter((x, i, a) => x !== lab(ans) && a.indexOf(x) === i);
  const { options, correctIndex } = shuffleWithIndex(r, lab(ans), wrong.slice(0, 3));
  return {
    question: `Eine Last von ${load} N wird reibungsfrei eine schiefe Ebene hinaufgezogen (Länge ${l} m, Höhe ${h} m). Welche Kraft entlang der Ebene ist nötig?`,
    options,
    correctIndex,
    figure: { type: 'schiefeEbene', length: l, height: h, load },
    topic: 'schiefeEbene',
    explanation: `Kraft · Länge = Last · Höhe (gleiche Arbeit). F = ${load} N · ${h} m : ${l} m = ${lab(ans)}. Je flacher die Ebene, desto kleiner die Kraft, desto länger der Weg.`,
  };
}

/* ---------------- Generator ---------------- */

export function generateTechnik(seed: number, level: number): TeItem {
  const rng = createRng(seed);
  const lvl = Math.max(1, Math.min(10, Math.round(level)));
  const kinds: string[] = ['zahnrad', 'riemen', 'hebel'];
  if (lvl >= 3) kinds.push('flaschenzug', 'schiefeEbene', 'zahnrad');
  const bankPool = TE_BANK.filter((b) => b.stufe <= lvl && b.stufe >= lvl - 3);
  const useBank = bankPool.length > 0 && rng.chance(0.35);
  let p: Omit<TePrompt, 'kind'> & { explanation: string };
  if (useBank) {
    const b = rng.pick(bankPool);
    const { options, correctIndex } = shuffleWithIndex(rng, b.richtig, b.falsch);
    p = {
      question: b.frage,
      options,
      correctIndex,
      topic: b.thema,
      fixed: true,
      bankId: b.id,
      explanation: b.erklaerung,
    };
  } else {
    const k = rng.pick(kinds);
    p =
      k === 'zahnrad'
        ? gearTask(rng, lvl)
        : k === 'riemen'
          ? beltTask(rng, lvl)
          : k === 'hebel'
            ? leverTask(rng, lvl)
            : k === 'flaschenzug'
              ? pulleyTask(rng, lvl)
              : rampTask(rng);
  }
  const { explanation, ...rest } = p;
  const prompt: TePrompt = { kind: p.fixed ? 'fest' : 'grafik', ...rest };
  return {
    id: `technik-${seed}-${lvl}`,
    moduleId: 'technik',
    generatorId: 'technik',
    generatorVersion: 1,
    seed,
    level: lvl,
    tags: ['te.' + prompt.topic],
    prompt,
    correct: prompt.correctIndex,
    correctLabel: prompt.options[prompt.correctIndex],
    explanation,
    timeLimitMs: timeForLevel(lvl, 45, 75),
    answerKind: 'choice',
  };
}

export const technikGenerator = tcGenerator<TePrompt>(
  'technik',
  1,
  generateTechnik,
  (it) =>
    it.prompt.bankId
      ? `bank:${it.prompt.bankId}`
      : `${it.prompt.question}:${JSON.stringify(it.prompt.figure)}`,
  (it) => {
    const errs: string[] = [];
    const fig = it.prompt.figure;
    if (fig?.type === 'zahnrad') {
      const sol = solveGears(fig);
      const isDir = it.prompt.options.includes(CW);
      if (isDir) {
        const expect = sol.blocked ? BLOCK : sol.dir[fig.target] === 1 ? CW : CCW;
        if (it.correctLabel !== expect) errs.push('Drehsinn falsch');
      }
      // Räder dürfen sich nicht überlappen (außer auf gemeinsamer Achse)
      for (let i = 0; i < fig.gears.length; i++)
        for (let j = i + 1; j < fig.gears.length; j++) {
          const a = fig.gears[i];
          const b = fig.gears[j];
          const onAxle = fig.axle.some(([x, y]) => (x === i && y === j) || (x === j && y === i));
          const meshes = fig.mesh.some(([x, y]) => (x === i && y === j) || (x === j && y === i));
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (onAxle) {
            if (Math.hypot(a.x - b.x, a.y - b.y) > 1e-6) errs.push('Achse nicht gemeinsam');
            continue;
          }
          if (meshes && Math.abs(d - (a.r + b.r + 1.5)) > 0.01) errs.push('Eingriff ungenau');
          if (!meshes && a.plane === b.plane && d < a.r + b.r + 4) errs.push('Räder überlappen');
        }
    }
    return errs;
  },
);
