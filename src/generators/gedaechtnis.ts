/**
 * Gedächtnis (Modul 6.13): Zahlenspanne, Blockspanne, n-back, Fakten merken,
 * Wege merken. Alle sind Block-Aufgaben: Das Modul steuert Darbietung und
 * Eingabe selbst und liefert sein Ergebnis als data zurück.
 */
import { createRng, type Rng } from '../core/rng';
import type { Generator, Item } from '../core/types';
import { baseValidate, type AnswerValue } from './common';

const data = (a: unknown): Record<string, unknown> | null => {
  const v = a as AnswerValue;
  return v && v.type === 'block' ? v.data : null;
};

function block<P, C>(
  moduleId: string,
  version: number,
  seed: number,
  level: number,
  tags: string[],
  prompt: P,
  correct: C,
  correctLabel: string,
  explanation: string,
): Item<P, C> {
  return {
    id: `${moduleId}-${seed}-${level}`,
    moduleId,
    generatorId: moduleId,
    generatorVersion: version,
    seed,
    level,
    tags,
    prompt,
    correct,
    correctLabel,
    explanation,
    timeLimitMs: 3_600_000, // Zeit steuert das Modul selbst
    answerKind: 'block',
  };
}

const clampLevel = (l: number) => Math.max(1, Math.min(10, Math.round(l)));

// ---------- Zahlenspanne ----------

export interface ZsPrompt {
  digits: number[];
  direction: 'vor' | 'rueck';
  onMs: number;
  offMs: number;
  answerMs: number;
}
export type ZsItem = Item<ZsPrompt, string>;

/** Ziffernfolge ohne Wiederholung direkt hintereinander und ohne Dreierläufe (1 2 3). */
export function digitSequence(rng: Rng, len: number): number[] {
  const out: number[] = [];
  while (out.length < len) {
    const d = rng.int(0, 9);
    const a = out[out.length - 1];
    const b = out[out.length - 2];
    if (d === a) continue;
    if (a !== undefined && b !== undefined && d - a === a - b && Math.abs(d - a) === 1) continue;
    out.push(d);
  }
  return out;
}

export const zahlenspanneGenerator: Generator<ZsPrompt, string> = {
  id: 'zahlenspanne',
  version: 1,
  generate(seed, level) {
    const rng = createRng(seed);
    const lvl = clampLevel(level);
    const len = lvl + 2; // 3 bis 12 Ziffern
    const digits = digitSequence(rng, len);
    const direction = rng.chance(0.5) ? 'vor' : 'rueck';
    const expected = (direction === 'vor' ? digits : [...digits].reverse()).join('');
    return block(
      'zahlenspanne',
      1,
      seed,
      lvl,
      ['gd.zahlenspanne', `gd.zahlenspanne.${direction}`],
      { digits, direction, onMs: 750, offMs: 250, answerMs: 8000 + len * 1500 },
      expected,
      expected.split('').join(' '),
      direction === 'vor'
        ? `${len} Ziffern in der gezeigten Reihenfolge.`
        : `${len} Ziffern in umgekehrter Reihenfolge: von der letzten zur ersten.`,
    );
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    const p = item.prompt;
    if (p.digits.length !== item.level + 2) errs.push('falsche Länge');
    if (p.digits.some((d, i) => d === p.digits[i - 1])) errs.push('Ziffer doppelt hintereinander');
    return errs;
  },
  check(item, answer) {
    const d = data(answer);
    return !!d && String(d.input ?? '').replace(/\D/g, '') === item.correct;
  },
  fingerprint: (item) => item.prompt.digits.join('') + item.prompt.direction,
  promptText: (item) =>
    `Zahlenspanne ${item.prompt.direction === 'vor' ? 'vorwärts' : 'rückwärts'}, ${item.prompt.digits.length} Ziffern`,
};

// ---------- Blockspanne ----------

/** Feste, unregelmäßige Anordnung der 9 Felder (wie beim Corsi-Block-Test), in Prozent. */
export const BLOCKS: [number, number][] = [
  [12, 14],
  [46, 8],
  [80, 20],
  [26, 40],
  [62, 36],
  [8, 66],
  [44, 62],
  [82, 60],
  [30, 86],
];

export interface BsPrompt {
  seq: number[];
  direction: 'vor' | 'rueck';
  onMs: number;
  offMs: number;
  answerMs: number;
}
export type BsItem = Item<BsPrompt, number[]>;

export const blockspanneGenerator: Generator<BsPrompt, number[]> = {
  id: 'blockspanne',
  version: 1,
  generate(seed, level) {
    const rng = createRng(seed);
    const lvl = clampLevel(level);
    const len = Math.min(9, lvl + 2);
    // ab Stufe 8 schneller
    const onMs = lvl >= 8 ? 600 : 800;
    const seq = rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, len);
    // auch auf Stufe 1 schon rückwärts, sonst gäbe es nur 504 verschiedene Aufgaben
    const direction = rng.chance(0.5) ? 'rueck' : 'vor';
    const expected = direction === 'vor' ? seq : [...seq].reverse();
    return block(
      'blockspanne',
      1,
      seed,
      lvl,
      ['gd.blockspanne', `gd.blockspanne.${direction}`],
      { seq, direction, onMs, offMs: 300, answerMs: 8000 + len * 2000 },
      expected,
      expected.map((i) => i + 1).join(' → '),
      direction === 'vor'
        ? `${len} Felder in der gezeigten Reihenfolge anklicken.`
        : `${len} Felder in umgekehrter Reihenfolge anklicken.`,
    );
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    if (new Set(item.prompt.seq).size !== item.prompt.seq.length) errs.push('Feld doppelt');
    return errs;
  },
  check(item, answer) {
    const d = data(answer);
    const clicks = (d?.clicks as number[] | undefined) ?? [];
    return clicks.length === item.correct.length && clicks.every((c, i) => c === item.correct[i]);
  },
  fingerprint: (item) => item.prompt.seq.join(',') + item.prompt.direction,
  promptText: (item) =>
    `Blockspanne ${item.prompt.direction === 'vor' ? 'vorwärts' : 'rückwärts'}, ${item.prompt.seq.length} Felder`,
};

// ---------- n-back ----------

export interface NbPrompt {
  n: number;
  stimuli: number[];
  targets: boolean[];
  isiMs: number;
}
export type NbItem = Item<NbPrompt, null>;

export function nbackSequence(
  rng: Rng,
  n: number,
  count: number,
  targetRate = 0.3,
): { stimuli: number[]; targets: boolean[] } {
  const eligible = count - n;
  const nTargets = Math.round(eligible * targetRate);
  const targetIdx = new Set(
    rng.shuffle(Array.from({ length: eligible }, (_, i) => i + n)).slice(0, nTargets),
  );
  const stimuli: number[] = [];
  const targets: boolean[] = [];
  for (let i = 0; i < count; i++) {
    if (targetIdx.has(i)) {
      stimuli.push(stimuli[i - n]);
      targets.push(true);
    } else {
      let s: number;
      do s = rng.int(0, 8);
      while ((i >= n && s === stimuli[i - n]) || s === stimuli[i - 1]);
      stimuli.push(s);
      targets.push(false);
    }
  }
  return { stimuli, targets };
}

export function nbackScore(targets: boolean[], responses: boolean[]) {
  let hits = 0;
  let misses = 0;
  let falseAlarms = 0;
  targets.forEach((t, i) => {
    if (t && responses[i]) hits++;
    else if (t) misses++;
    else if (responses[i]) falseAlarms++;
  });
  return { hits, misses, falseAlarms, targets: targets.filter(Boolean).length };
}

export const nbackGenerator: Generator<NbPrompt, null> = {
  id: 'nback',
  version: 1,
  generate(seed, level) {
    const rng = createRng(seed);
    const lvl = clampLevel(level);
    const n = lvl <= 3 ? 1 : lvl <= 6 ? 2 : 3;
    // innerhalb einer n-Stufe: mehr Reize auf den höheren Stufen
    const extra = lvl <= 3 ? (lvl - 1) * 4 : lvl <= 6 ? (lvl - 4) * 4 : (lvl - 7) * 3;
    const { stimuli, targets } = nbackSequence(rng, n, 20 + n + extra);
    return block(
      'nback',
      1,
      seed,
      lvl,
      ['gd.nback', `gd.nback.${n}`],
      { n, stimuli, targets, isiMs: 2500 },
      null,
      '',
      `${n}-back: Taste J, wenn die Position dieselbe ist wie ${n === 1 ? 'beim vorigen Reiz' : `${n} Reize vorher`}. Gewertet als geschafft, wenn mindestens 75 % der Treffer erkannt und höchstens 2 Fehlalarme gedrückt wurden.`,
    );
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    const { n, stimuli, targets } = item.prompt;
    stimuli.forEach((s, i) => {
      const isMatch = i >= n && s === stimuli[i - n];
      if (isMatch !== targets[i]) errs.push(`Reiz ${i}: Treffer falsch markiert`);
    });
    return errs;
  },
  check(item, answer) {
    const d = data(answer);
    if (!d) return false;
    const sc = nbackScore(item.prompt.targets, (d.responses as boolean[]) ?? []);
    return sc.hits / Math.max(1, sc.targets) >= 0.75 && sc.falseAlarms <= 2;
  },
  fingerprint: (item) => item.prompt.stimuli.join('') + item.prompt.n,
  promptText: (item) => `${item.prompt.n}-back, ${item.prompt.stimuli.length} Reize`,
};

// ---------- Fakten merken ----------

const NACHNAMEN = [
  'Brandt',
  'Keller',
  'Wagner',
  'Hoffmann',
  'Schröder',
  'Neumann',
  'Krüger',
  'Lorenz',
  'Vogel',
  'Franke',
  'Albrecht',
  'Busch',
  'Engel',
  'Haas',
  'Jäger',
  'Kuhn',
  'Lang',
  'Möller',
  'Otto',
  'Pohl',
  'Roth',
  'Seidel',
  'Thiel',
  'Ulrich',
  'Wolf',
  'Zimmer',
  'Graf',
  'Berger',
  'Fuchs',
  'Winter',
];
/** Ähnlich klingende Namen für höhere Stufen */
const AEHNLICH = [
  ['Meier', 'Maier', 'Mayer', 'Meyer'],
  ['Schmitt', 'Schmidt', 'Schmid', 'Schmied'],
  ['Becker', 'Bäcker', 'Becher', 'Böcker'],
  ['Hartmann', 'Hartung', 'Hartwig', 'Hartl'],
  ['Kraus', 'Krause', 'Kranz', 'Kraut'],
];
const DIENSTGRADE = [
  'Gefreiter',
  'Obergefreiter',
  'Hauptgefreiter',
  'Stabsgefreiter',
  'Unteroffizier',
  'Stabsunteroffizier',
  'Feldwebel',
  'Oberfeldwebel',
  'Hauptfeldwebel',
  'Stabsfeldwebel',
  'Leutnant',
  'Oberleutnant',
  'Hauptmann',
  'Major',
];
const RUFNAMEN = [
  'Adler',
  'Falke',
  'Bussard',
  'Habicht',
  'Sperber',
  'Milan',
  'Kauz',
  'Uhu',
  'Rabe',
  'Kranich',
];
const ORTE = [
  'Sammelpunkt',
  'Beobachtungsposten',
  'Treffpunkt',
  'Verwundetennest',
  'Landezone',
  'Kontrollpunkt',
];
const ZEITEN_TXT = [
  'Abmarsch',
  'Funkkontakt',
  'Ablösung',
  'Abholung',
  'Lagebesprechung',
  'Feuerpause',
];
const ARTIKEL: Record<string, string> = {
  Abmarsch: 'der',
  Funkkontakt: 'der',
  Ablösung: 'die',
  Abholung: 'die',
  Lagebesprechung: 'die',
  Feuerpause: 'die',
  Sammelpunkt: 'der',
  Beobachtungsposten: 'der',
  Treffpunkt: 'der',
  Verwundetennest: 'das',
  Landezone: 'die',
  Kontrollpunkt: 'der',
};

export interface FkQuestion {
  q: string;
  options: string[];
  correct: number;
}
export interface FkPrompt {
  title: string;
  facts: string[];
  questions: FkQuestion[];
  memorizeMs: number;
  pauseMs: number;
  answerMs: number;
}
export type FkItem = Item<FkPrompt, number[]>;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

function timeStr(rng: Rng): string {
  return `${pad(rng.int(4, 22))}:${pad(rng.int(0, 11) * 5)}`;
}
function gridStr(rng: Rng): string {
  const letters = 'MNPQ';
  return `${rng.pick(letters.split(''))}${rng.pick('ABCDE'.split(''))} ${pad(rng.int(100, 999), 3)} ${pad(rng.int(100, 999), 3)}`;
}
function plateStr(rng: Rng): string {
  return `Y-${rng.int(100, 999)} ${rng.int(100, 999)}`;
}

/** Ähnliche Werte für Antwortoptionen (verwechselbar, aber eindeutig falsch). */
function similar(rng: Rng, kind: string, v: string): string {
  switch (kind) {
    case 'zeit': {
      const [h, m] = v.split(':').map(Number);
      const t = h * 60 + m + rng.pick([-30, -15, -10, -5, 5, 10, 15, 30, 60]);
      return `${pad(Math.floor(((t + 1440) % 1440) / 60))}:${pad((t + 1440) % 60)}`;
    }
    case 'gitter': {
      const parts = v.split(' ');
      const i = rng.int(1, 2);
      const digits = parts[i].split('');
      const j = rng.int(0, 2);
      digits[j] = String((Number(digits[j]) + rng.int(1, 8)) % 10);
      parts[i] = digits.join('');
      if (rng.chance(0.3)) [parts[1], parts[2]] = [parts[2], parts[1]];
      return parts.join(' ');
    }
    case 'kennzeichen': {
      const d = v.replace('Y-', '').split(' ');
      if (rng.chance(0.5)) return `Y-${d[1]} ${d[0]}`;
      const s = d[1].split('');
      const j = rng.int(0, 2);
      s[j] = String((Number(s[j]) + rng.int(1, 8)) % 10);
      return `Y-${d[0]} ${s.join('')}`;
    }
    case 'zahl':
      return String(Math.max(1, Number(v) + rng.pick([-3, -2, -1, 1, 2, 3, 5])));
    default:
      return v;
  }
}

export const faktenGenerator: Generator<FkPrompt, number[]> = {
  id: 'fakten',
  version: 1,
  generate(seed, level) {
    const rng = createRng(seed);
    const lvl = clampLevel(level);
    const nFacts = 10 + lvl; // 11 bis 20
    const similarNames = lvl >= 6;
    // Personen
    const nPeople = 3 + Math.floor(lvl / 3);
    let names: string[];
    if (similarNames) {
      const group = rng.pick(AEHNLICH);
      names = [...rng.shuffle(group).slice(0, 2), ...rng.shuffle(NACHNAMEN)].slice(0, nPeople);
    } else names = rng.shuffle(NACHNAMEN).slice(0, nPeople);
    names = rng.shuffle(names);
    const ranks = rng.shuffle(DIENSTGRADE).slice(0, nPeople);
    const calls = rng
      .shuffle(RUFNAMEN)
      .slice(0, nPeople)
      .map((c) => `${c} ${rng.int(1, 4)}`);
    type Fact = { text: string; q: string; answer: string; kind: string; pool: string[] };
    const facts: Fact[] = [];
    names.forEach((n, i) => {
      facts.push({
        text: `${ranks[i]} ${n} führt den Trupp mit dem Rufnamen ${calls[i]}.`,
        q: `Welchen Dienstgrad hat ${n}?`,
        answer: ranks[i],
        kind: 'dienstgrad',
        pool: DIENSTGRADE,
      });
    });
    const extraFacts: (() => Fact)[] = [
      () => {
        const what = rng.pick(ZEITEN_TXT);
        const t = timeStr(rng);
        return {
          text: `${what} um ${t} Uhr.`,
          q: `Um wie viel Uhr ist ${ARTIKEL[what]} ${what}?`,
          answer: t,
          kind: 'zeit',
          pool: [],
        };
      },
      () => {
        const ort = rng.pick(ORTE);
        const g = gridStr(rng);
        return {
          text: `${ort} bei Planquadrat ${g}.`,
          q: `Bei welchem Planquadrat liegt ${ARTIKEL[ort]} ${ort}?`,
          answer: g,
          kind: 'gitter',
          pool: [],
        };
      },
      () => {
        const n = rng.int(2, 6);
        const p = plateStr(rng);
        return {
          text: `Fahrzeug ${n} der Kolonne hat das Kennzeichen ${p}.`,
          q: `Welches Kennzeichen hat Fahrzeug ${n}?`,
          answer: p,
          kind: 'kennzeichen',
          pool: [],
        };
      },
      () => {
        const k = rng.int(3, 40);
        const what = rng.pick(['Personen', 'Fahrzeuge', 'Kisten', 'Zelte']);
        return {
          text: `Am Kontrollpunkt wurden ${k} ${what} gezählt.`,
          q: `Wie viele ${what} wurden am Kontrollpunkt gezählt?`,
          answer: String(k),
          kind: 'zahl',
          pool: [],
        };
      },
      () => {
        const km = rng.int(2, 35);
        return {
          text: `Entfernung bis zum Ziel: ${km} km.`,
          q: 'Wie weit ist es bis zum Ziel (in km)?',
          answer: String(km),
          kind: 'zahl',
          pool: [],
        };
      },
      () => {
        const f = `${rng.int(30, 87)},${rng.int(0, 9)}${rng.pick([0, 5])}`;
        return {
          text: `Ausweichfrequenz ${f} MHz.`,
          q: 'Wie lautet die Ausweichfrequenz (MHz)?',
          answer: f,
          kind: 'frequenz',
          pool: [],
        };
      },
    ];
    // Rufname zu Person als eigene Frage
    const callFacts: Fact[] = names.map((n, i) => ({
      text: '',
      q: `Welchen Rufnamen hat der Trupp von ${n}?`,
      answer: calls[i],
      kind: 'rufname',
      pool: calls,
    }));
    const usedText = new Set(facts.map((f) => f.text));
    let guard = 0;
    while (facts.length < nFacts && guard++ < 200) {
      const f = rng.pick(extraFacts)();
      const key = f.text.split(' ')[0] + f.q;
      if (usedText.has(f.text) || facts.some((x) => x.q === f.q) || usedText.has(key)) continue;
      usedText.add(f.text);
      usedText.add(key);
      facts.push(f);
    }
    const shuffledFacts = rng.shuffle(facts);
    // 10 Fragen: Mischung aus Faktenfragen und Rufnamen
    const qPool = rng.shuffle([...facts, ...callFacts]).slice(0, 10);
    const questions: FkQuestion[] = qPool.map((f) => {
      const opts = new Set([f.answer]);
      // zuerst Werte aus der Meldung selbst (verwechselbar), dann ähnliche
      const sameKind = facts
        .filter((x) => x.kind === f.kind && x.answer !== f.answer)
        .map((x) => x.answer);
      for (const v of rng.shuffle([...sameKind, ...(f.pool ?? [])])) {
        if (opts.size >= 4) break;
        opts.add(v);
      }
      let g = 0;
      while (opts.size < 4 && g++ < 50) {
        const s =
          f.kind === 'frequenz'
            ? `${rng.int(30, 87)},${rng.int(0, 9)}${rng.pick([0, 5])}`
            : f.kind === 'rufname'
              ? rng.chance(0.5)
                ? `${f.answer.split(' ')[0]} ${rng.int(1, 4)}`
                : `${rng.pick(RUFNAMEN)} ${f.answer.split(' ')[1]}`
              : similar(rng, f.kind, f.answer);
        opts.add(s);
      }
      const options = rng.shuffle([...opts].slice(0, 4));
      return { q: f.q, options, correct: options.indexOf(f.answer) };
    });
    const pauseMs = 60_000 + (lvl - 1) * 13_333;
    return block(
      'fakten',
      1,
      seed,
      lvl,
      ['gd.fakten', ...(similarNames ? ['gd.fakten.aehnlich'] : [])],
      {
        title: `Lagemeldung ${timeStr(rng)} Uhr`,
        facts: shuffledFacts.map((f) => f.text),
        questions,
        memorizeMs: 90_000,
        pauseMs: Math.round(pauseMs / 1000) * 1000,
        answerMs: 20_000,
      },
      questions.map((q) => q.correct),
      '',
      `${nFacts} Fakten, ${Math.round((pauseMs / 60000) * 10) / 10} min Ablenkung. Geschafft ab 7 von 10 richtigen Antworten.`,
    );
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    const p = item.prompt;
    if (p.facts.length !== item.level + 10) errs.push(`Faktenzahl ${p.facts.length}`);
    if (p.questions.length !== 10) errs.push('nicht 10 Fragen');
    for (const q of p.questions) {
      if (new Set(q.options).size !== 4) errs.push(`Optionen nicht verschieden: ${q.q}`);
      if (q.correct < 0) errs.push(`Lösung fehlt: ${q.q}`);
    }
    return errs;
  },
  check(item, answer) {
    const d = data(answer);
    const a = (d?.answers as (number | null)[] | undefined) ?? [];
    return item.correct.filter((c, i) => a[i] === c).length >= 7;
  },
  fingerprint: (item) => item.prompt.facts.join('|'),
  promptText: (item) => `${item.prompt.title}, ${item.prompt.facts.length} Fakten`,
};

// ---------- Wege merken ----------

export type Node = [number, number];
export interface WgPrompt {
  size: number;
  route: Node[];
  turns: Node[];
  landmarks: { cell: Node; name: string }[];
  question: 'ende' | 'folge';
  segMs: number;
  answerMs: number;
}
export type WgItem = Item<WgPrompt, Node[]>;

const LANDMARKS = [
  'Kirche',
  'Tankstelle',
  'Schule',
  'Brücke',
  'Funkturm',
  'Park',
  'Depot',
  'Wache',
  'Markt',
  'Klinik',
];

/**
 * Route aus geraden Stücken (1 bis 3 Kreuzungen lang), ohne einen Knoten
 * zweimal zu betreten. Suche mit Rücksprung, damit auch 14 Abbiegungen
 * auf dem 8 × 8 Raster zuverlässig gelingen.
 */
export function makeRoute(rng: Rng, size: number, turns: number): Node[] | null {
  const dirs: Node[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const start: Node = [rng.int(0, size - 1), rng.int(0, size - 1)];
  const path: Node[] = [start];
  const seen = new Set([start.join()]);
  let budget = 4000;
  const extend = (seg: number, prev: Node | null): boolean => {
    if (budget-- <= 0) return false;
    if (seg > turns) return true;
    const options: [Node, number][] = [];
    for (const d of rng.shuffle(
      prev ? dirs.filter((x) => x[0] * prev[0] + x[1] * prev[1] === 0) : dirs,
    ))
      for (const len of rng.shuffle([1, 2, 3])) options.push([d, len]);
    for (const [d, len] of options) {
      const added: Node[] = [];
      let ok = true;
      for (let k = 0; k < len; k++) {
        const last = added.length ? added[added.length - 1] : path[path.length - 1];
        const n: Node = [last[0] + d[0], last[1] + d[1]];
        if (n[0] < 0 || n[1] < 0 || n[0] >= size || n[1] >= size || seen.has(n.join())) {
          ok = false;
          break;
        }
        added.push(n);
      }
      if (!ok) continue;
      added.forEach((n) => {
        path.push(n);
        seen.add(n.join());
      });
      if (extend(seg + 1, d)) return true;
      added.forEach(() => {
        const n = path.pop()!;
        seen.delete(n.join());
      });
    }
    return false;
  };
  return extend(0, null) ? path : null;
}

export function turnPoints(path: Node[]): Node[] {
  const out: Node[] = [];
  for (let i = 1; i < path.length - 1; i++) {
    const a = [path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]];
    const b = [path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]];
    if (a[0] !== b[0] || a[1] !== b[1]) out.push(path[i]);
  }
  return out;
}

export const wegeGenerator: Generator<WgPrompt, Node[]> = {
  id: 'wege',
  version: 1,
  generate(seed, level) {
    const rng = createRng(seed);
    const lvl = clampLevel(level);
    const size = 8;
    const nTurns = 4 + lvl; // 5 bis 14 Abbiegungen
    for (let attempt = 0; attempt < 500; attempt++) {
      const route = makeRoute(rng, size, nTurns);
      if (!route) continue;
      const turns = turnPoints(route);
      if (turns.length !== nTurns) continue;
      const question = lvl <= 5 ? 'ende' : 'folge';
      const cells = rng.shuffle(
        Array.from(
          { length: (size - 1) * (size - 1) },
          (_, i) => [i % (size - 1), Math.floor(i / (size - 1))] as Node,
        ),
      );
      const landmarks = rng
        .shuffle(LANDMARKS)
        .slice(0, 7)
        .map((name, i) => ({ cell: cells[i], name }));
      const total = 30_000 + (lvl - 1) * 3_300; // 30 bis 60 s
      const correct = question === 'ende' ? [route[route.length - 1]] : turns;
      return block(
        'wege',
        1,
        seed,
        lvl,
        ['gd.wege', `gd.wege.${question}`],
        {
          size,
          route,
          turns,
          landmarks,
          question,
          segMs: Math.round(total / (route.length - 1)),
          answerMs: question === 'ende' ? 20_000 : 15_000 + nTurns * 3_000,
        },
        correct,
        '', // die Karte in der Auswertung zeigt die Lösung
        question === 'ende'
          ? `Die Route hat ${nTurns} Abbiegungen. Gesucht war der Endpunkt.`
          : `Gesucht waren alle ${nTurns} Abbiegepunkte in der richtigen Reihenfolge.`,
      );
    }
    throw new Error('Wege: keine Route gefunden');
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    const p = item.prompt;
    if (turnPoints(p.route).length !== item.level + 4) errs.push('Zahl der Abbiegungen');
    if (new Set(p.route.map((n) => n.join())).size !== p.route.length) errs.push('Knoten doppelt');
    return errs;
  },
  check(item, answer) {
    const d = data(answer);
    const clicks = (d?.clicks as Node[] | undefined) ?? [];
    const c = item.correct;
    return (
      clicks.length === c.length && clicks.every((n, i) => n[0] === c[i][0] && n[1] === c[i][1])
    );
  },
  fingerprint: (item) => item.prompt.route.map((n) => n.join(',')).join(';'),
  promptText: (item) =>
    `Wege merken: ${item.prompt.turns.length} Abbiegungen, ${item.prompt.question === 'ende' ? 'Endpunkt' : 'Reihenfolge'}`,
};
