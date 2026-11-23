/**
 * Trainingsplanung: Wochenplan, Phasen bis zum Testtermin, Tageseinheit.
 * Reine Funktionen ohne Datenbank, damit sie testbar sind.
 */
import type { Rng } from './rng';
import type { Attempt, Session } from './types';
import { dayKey, daysUntil, weekDays } from './progress';

/** Wochenplan: Wochentag (0 = So … 6 = Sa) → Module */
export type WeekPlan = Record<string, string[]>;

export const DEFAULT_WEEK_PLAN: WeekPlan = {
  '1': ['kopfrechnen', 'zahlenreihen'],
  '2': ['matrizen', 'figurenreihen'],
  '3': ['rotation', 'wuerfelDrehen'],
  '4': ['wortanalogien', 'begriffe', 'rechtschreibung'],
  '5': ['technik', 'textaufgaben'],
  '6': ['zahlenspanne', 'nback', 'symbolZahl'],
  '0': [],
};

export const WEEKDAY_NAMES = [
  'Sonntag',
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
];

/**
 * Geschätzte Sekunden je Aufgabe im Lernmodus (mit Rückmeldung) bzw. je Block.
 * `block`: eine Aufgabe ist ein ganzer Block mit fester Dauer.
 */
export const ESTIMATE: Record<string, { sec: number; min: number; block?: boolean }> = {
  kopfrechnen: { sec: 25, min: 4 },
  textaufgaben: { sec: 75, min: 2 },
  zahlenreihen: { sec: 45, min: 3 },
  wortanalogien: { sec: 30, min: 4 },
  begriffe: { sec: 25, min: 4 },
  rechtschreibung: { sec: 15, min: 6 },
  matrizen: { sec: 60, min: 2 },
  figurenreihen: { sec: 45, min: 3 },
  technik: { sec: 55, min: 2 },
  rotation: { sec: 8, min: 10 },
  rotation4: { sec: 45, min: 3 },
  wuerfelDrehen: { sec: 45, min: 3 },
  wuerfelZaehlen: { sec: 35, min: 3 },
  zahlenspanne: { sec: 20, min: 5 },
  blockspanne: { sec: 20, min: 5 },
  wege: { sec: 60, min: 2 },
  nback: { sec: 70, min: 1, block: true },
  fakten: { sec: 300, min: 1, block: true },
  durchstreichen: { sec: 280, min: 1, block: true },
  symbolZahl: { sec: 125, min: 1, block: true },
  rechenkette: { sec: 240, min: 1, block: true },
  wahlreaktion: { sec: 90, min: 1, block: true },
  determination: { sec: 250, min: 1, block: true },
  stroop: { sec: 90, min: 1, block: true },
  vigilanz: { sec: 330, min: 1, block: true },
};

/* ------------------------------------------------------------------ */
/* Phasen                                                              */
/* ------------------------------------------------------------------ */

export interface WeekGoals {
  /** abgeschlossene Tageseinheiten */
  tag: number;
  kurzsim: number;
  vollsim: number;
  /** Durchgänge unter Belastung */
  belastung: number;
}

export interface Phase {
  id: 'grundlage' | 'aufbau' | 'peak' | 'taper' | 'ohne';
  name: string;
  text: string;
  goals: WeekGoals;
  daysLeft: number | null;
}

export function phaseFor(testDate: string | null, now: Date): Phase {
  if (!testDate)
    return {
      id: 'ohne',
      name: 'Ohne Testtermin',
      text: 'Lege in den Einstellungen den Testtermin fest, dann richtet sich der Plan nach den verbleibenden Wochen.',
      goals: { tag: 5, kurzsim: 0, vollsim: 0, belastung: 0 },
      daysLeft: null,
    };
  const d = daysUntil(testDate, now);
  if (d < 0)
    return {
      id: 'ohne',
      name: 'Testtermin vorbei',
      text: 'Der eingetragene Termin liegt in der Vergangenheit. Trage einen neuen ein oder trainiere frei weiter.',
      goals: { tag: 5, kurzsim: 0, vollsim: 0, belastung: 0 },
      daysLeft: d,
    };
  if (d <= 7)
    return {
      id: 'taper',
      name: 'Taper',
      text: 'Letzte Woche: kurz auffrischen, Schlaf und Erholung gehen vor. In den letzten 3 Tagen keine Vollsimulation mehr.',
      goals: { tag: 3, kurzsim: d > 3 ? 1 : 0, vollsim: 0, belastung: 0 },
      daysLeft: d,
    };
  if (d <= 21)
    return {
      id: 'peak',
      name: 'Peak',
      text: 'Testnah trainieren: Simulationen unter Zeitdruck, auch einmal direkt nach Belastung.',
      goals: { tag: 4, kurzsim: 2, vollsim: 1, belastung: 1 },
      daysLeft: d,
    };
  if (d <= 56)
    return {
      id: 'aufbau',
      name: 'Aufbau',
      text: 'Schwächen gezielt angehen und den Testmodus üben. Eine Kurzsimulation pro Woche.',
      goals: { tag: 5, kurzsim: 1, vollsim: 0, belastung: 1 },
      daysLeft: d,
    };
  return {
    id: 'grundlage',
    name: 'Grundlage',
    text: 'Alle Aufgabentypen kennenlernen, Regeln verstehen, im Lernmodus Stufen aufbauen.',
    goals: { tag: 5, kurzsim: 0, vollsim: 0, belastung: 0 },
    daysLeft: d,
  };
}

/** Erledigtes in der laufenden Woche (Mo bis So). */
export function weekDone(sessions: Session[], now: Date): WeekGoals {
  const keys = new Set(weekDays(now).map(dayKey));
  const inWeek = sessions.filter((s) => s.endedAt && !s.aborted && keys.has(dayKey(s.endedAt)));
  const groups = (type: Session['type']) =>
    new Set(inWeek.filter((s) => s.type === type && s.groupDone).map((s) => s.groupId)).size;
  return {
    tag: groups('tag'),
    kurzsim: groups('kurzsim'),
    vollsim: groups('vollsim'),
    belastung: new Set(inWeek.filter((s) => s.belastet).map((s) => s.groupId ?? s.id)).size,
  };
}

/* ------------------------------------------------------------------ */
/* Tageseinheit                                                        */
/* ------------------------------------------------------------------ */

export interface DayPart {
  moduleId: string;
  count: number;
  reason: 'plan' | 'fokus';
  /** Fokus auf bestimmte Regel-Tags */
  tags?: string[];
  /** Startstufe für Tag-Übung */
  startLevel?: number;
  estSec: number;
}

export interface DayUnit {
  weekday: number;
  rest: boolean;
  parts: DayPart[];
  totalSec: number;
  /** Fokus-Tag und Fehlerquote, wenn vorhanden */
  focusTag?: { tag: string; rate: number };
}

interface TagWeight {
  tag: string;
  moduleId: string;
  rate: number;
  weight: number;
  level: number;
}

/**
 * Schwache Regel-Tags der letzten 30 Tage: Gewicht 1 + 2 × Fehlerquote
 * (nur Tags mit mindestens 3 Versuchen).
 */
export function weakTags(attempts: Attempt[], now: Date, available: Set<string>): TagWeight[] {
  const since = now.getTime() - 30 * 86400000;
  const map = new Map<string, { n: number; err: number; moduleId: string; levels: number[] }>();
  for (const a of attempts) {
    if (!available.has(a.moduleId) || new Date(a.timestamp).getTime() < since) continue;
    for (const t of a.tags) {
      const e = map.get(t) ?? { n: 0, err: 0, moduleId: a.moduleId, levels: [] };
      e.n++;
      if (!a.correct) {
        e.err++;
        e.levels.push(a.level);
      }
      map.set(t, e);
    }
  }
  return [...map.entries()]
    .filter(([, e]) => e.n >= 3)
    .map(([tag, e]) => {
      const rate = e.err / e.n;
      const lv = e.levels.length
        ? Math.round(e.levels.reduce((s, x) => s + x, 0) / e.levels.length)
        : 3;
      return { tag, moduleId: e.moduleId, rate, weight: 1 + 2 * rate, level: lv };
    });
}

function weightedPick<T extends { weight: number }>(rng: Rng, list: T[]): T {
  const sum = list.reduce((s, x) => s + x.weight, 0);
  let r = rng.next() * sum;
  for (const x of list) {
    r -= x.weight;
    if (r <= 0) return x;
  }
  return list[list.length - 1];
}

function partFor(moduleId: string, budgetSec: number): DayPart | null {
  const est = ESTIMATE[moduleId] ?? { sec: 40, min: 3 };
  if (est.block) {
    if (est.sec > budgetSec * 1.25) return null;
    return { moduleId, count: 1, reason: 'plan', estSec: est.sec };
  }
  const count = Math.max(est.min, Math.round(budgetSec / est.sec));
  return { moduleId, count, reason: 'plan', estSec: count * est.sec };
}

/**
 * Stellt die Tageseinheit zusammen: etwa 70 % der Zeit Module des Wochenplans,
 * 30 % Fokus auf schwache Regel-Tags (gewichtet 1 + 2 × Fehlerquote). Ohne
 * Daten: Fokus auf das am längsten nicht geübte verfügbare Modul.
 */
export function planDay(p: {
  now: Date;
  minutes: number;
  restDay: number;
  weekPlan: WeekPlan;
  available: string[];
  attempts: Attempt[];
  lastPlayed: Record<string, string | undefined>;
  rng: Rng;
}): DayUnit {
  const weekday = p.now.getDay();
  const avail = new Set(p.available);
  const rest = weekday === p.restDay;
  const total = p.minutes * 60;
  let planMods = (p.weekPlan[String(weekday)] ?? []).filter((m) => avail.has(m));
  // Ruhetag oder leerer Plantag: ganze Zeit als Fokus
  const planShare = planMods.length ? 0.7 : 0;
  const parts: DayPart[] = [];
  if (planMods.length) {
    let budgetEach = (total * planShare) / planMods.length;
    // Blöcke, die nicht passen, fallen heraus; ihre Zeit geht an die anderen
    const fitting = planMods.filter((m) => partFor(m, budgetEach));
    if (fitting.length && fitting.length < planMods.length) {
      planMods = fitting;
      budgetEach = (total * planShare) / planMods.length;
    }
    for (const m of planMods) {
      const part = partFor(m, budgetEach);
      if (part) parts.push(part);
    }
  }
  const used = parts.reduce((s, x) => s + x.estSec, 0);
  const focusBudget = Math.max(total - used, total * 0.25);
  const weak = weakTags(p.attempts, p.now, avail).filter(
    (w) => !(ESTIMATE[w.moduleId]?.block ?? false),
  );
  let focusTag: DayUnit['focusTag'];
  if (weak.length) {
    const w = weightedPick(p.rng, weak);
    const part = partFor(w.moduleId, focusBudget);
    if (part) {
      parts.push({ ...part, reason: 'fokus', tags: [w.tag], startLevel: w.level });
      focusTag = { tag: w.tag, rate: w.rate };
    }
  } else {
    // am längsten nicht geübtes Modul, das kein langer Block ist
    const cands = p.available
      .filter((m) => !planMods.includes(m) && !(ESTIMATE[m]?.block ?? false))
      .sort((a, b) => (p.lastPlayed[a] ?? '').localeCompare(p.lastPlayed[b] ?? ''));
    const m = cands[0];
    const part = m ? partFor(m, focusBudget) : null;
    if (part) parts.push({ ...part, reason: 'fokus' });
  }
  return {
    weekday,
    rest,
    parts,
    totalSec: parts.reduce((s, x) => s + x.estSec, 0),
    focusTag,
  };
}

/** Fester Zufallswert je Kalendertag: Die Tageseinheit bleibt über den Tag gleich. */
export function daySeed(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}
