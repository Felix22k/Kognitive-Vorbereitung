/**
 * Reaktion und Belastung (Modul 6.15) und Wachsamkeit (6.16).
 * Eigene Nachbauten nach dem Prinzip bekannter Tests, keine Kopien.
 * Alle sind Block-Aufgaben; Zeitmessung und Darbietung im Modul.
 */
import { createRng } from '../core/rng';
import type { Generator, Item } from '../core/types';
import { baseValidate, type AnswerValue } from './common';

const data = (a: unknown): Record<string, unknown> | null => {
  const v = a as AnswerValue;
  return v && v.type === 'block' ? v.data : null;
};
const clampLevel = (l: number) => Math.max(1, Math.min(10, Math.round(l)));

function block<P>(
  moduleId: string,
  seed: number,
  level: number,
  tags: string[],
  prompt: P,
  explanation: string,
): Item<P, null> {
  return {
    id: `${moduleId}-${seed}-${level}`,
    moduleId,
    generatorId: moduleId,
    generatorVersion: 1,
    seed,
    level,
    tags,
    prompt,
    correct: null,
    correctLabel: '',
    explanation,
    timeLimitMs: 3_600_000,
    answerKind: 'block',
  };
}

export interface TrialResult {
  /** Reaktion: Index der gedrückten Taste (−1 = keine) */
  resp: number;
  rtMs: number | null;
  correct: boolean;
}

// ---------- Wahlreaktion ----------

export interface WrTrial {
  pos: number; // 0 bis 3 (Wahl) bzw. 0 = Mitte (Go/No-Go)
  yellow?: boolean;
  tone?: boolean;
  go?: boolean;
  isiMs: number;
}
export interface WrPrompt {
  variant: 'wahl' | 'gonogo';
  trials: WrTrial[];
  windowMs: number;
}
export type WrItem = Item<WrPrompt, null>;

export const wahlreaktionGenerator: Generator<WrPrompt, null> = {
  id: 'wahlreaktion',
  version: 1,
  generate(seed, level, opts) {
    const rng = createRng(seed);
    const lvl = clampLevel(level);
    const chosen = (opts?.variante as string) ?? 'auto';
    const variant =
      chosen === 'gonogo' || (chosen === 'auto' && lvl >= 5 && rng.chance(0.5)) ? 'gonogo' : 'wahl';
    const windowMs = 1500 - (lvl - 1) * 80; // 1,5 s bis 0,78 s
    const trials: WrTrial[] = [];
    for (let i = 0; i < 60; i++) {
      const isiMs = rng.int(600, 1400);
      if (variant === 'wahl') {
        let pos: number;
        do pos = rng.int(0, 3);
        while (trials.length && rng.chance(0.5) && pos === trials[trials.length - 1].pos);
        trials.push({ pos, isiMs });
      } else {
        // etwa 40 % Go (Gelb mit Ton), Rest Ablenker: Gelb ohne Ton, andere Farbe mit oder ohne Ton
        const go = rng.chance(0.4);
        const yellow = go ? true : rng.chance(0.4);
        const tone = go ? true : yellow ? false : rng.chance(0.5);
        trials.push({ pos: 0, yellow, tone, go, isiMs });
      }
    }
    return block(
      'wahlreaktion',
      seed,
      lvl,
      ['re.wahl', `re.wahl.${variant}`],
      { variant, trials, windowMs },
      variant === 'wahl'
        ? `Eines von vier Feldern leuchtet, passende Taste D, F, J oder K. Antwortfenster ${windowMs} ms. Geschafft ab 90 % richtig.`
        : `Go/No-Go: nur reagieren (Leertaste), wenn das Feld gelb ist und gleichzeitig ein Ton kommt. Antwortfenster ${windowMs} ms. Geschafft ab 90 % richtig.`,
    );
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    if (item.prompt.trials.length !== 60) errs.push('nicht 60 Durchgänge');
    if (
      item.prompt.variant === 'gonogo' &&
      item.prompt.trials.some((t) => t.go !== (t.yellow && t.tone))
    )
      errs.push('Go-Regel verletzt');
    return errs;
  },
  check(_item, answer) {
    const res = (data(answer)?.results as TrialResult[] | undefined) ?? [];
    return res.length >= 10 && res.filter((r) => r.correct).length / res.length >= 0.9;
  },
  fingerprint: (item) => JSON.stringify(item.prompt.trials.slice(0, 12)),
  promptText: (item) =>
    item.prompt.variant === 'wahl' ? 'Wahlreaktion (4 Felder)' : 'Wahlreaktion Go/No-Go',
};

// ---------- Determinationstest-ähnlich ----------

/** Reizarten: 0 rot, 1 gelb, 2 grün, 3 blau, 4 weiß, 5 hoher Ton, 6 tiefer Ton */
export const DT_NAMES = ['rot', 'gelb', 'grün', 'blau', 'weiß', 'hoher Ton', 'tiefer Ton'];
export const DT_COLORS = ['#e02424', '#facc15', '#16a34a', '#2563eb', '#ffffff'];

export interface DtPrompt {
  mode: 'adaptiv' | 'aktion' | 'reaktion';
  durationMs: number;
  startMs: number;
  stimuli: number[];
}
export type DtItem = Item<DtPrompt, null>;

export interface DtEvent {
  stim: number;
  shownAt: number;
  durMs: number;
  /** richtig, falsch, verspätet, ausgelassen */
  result: 'richtig' | 'falsch' | 'verspaetet' | 'ausgelassen';
  rtMs: number | null;
}

export function dtScore(events: DtEvent[]) {
  const c = (r: DtEvent['result']) => events.filter((e) => e.result === r).length;
  const rts = events
    .filter((e) => e.result === 'richtig' && e.rtMs !== null)
    .map((e) => e.rtMs as number)
    .sort((a, b) => a - b);
  const median = rts.length
    ? rts.length % 2
      ? rts[(rts.length - 1) / 2]
      : (rts[rts.length / 2 - 1] + rts[rts.length / 2]) / 2
    : null;
  const last = events.slice(-20);
  const endDur = last.length ? last.reduce((s, e) => s + e.durMs, 0) / last.length : null;
  return {
    total: events.length,
    richtig: c('richtig'),
    falsch: c('falsch'),
    verspaetet: c('verspaetet'),
    ausgelassen: c('ausgelassen'),
    medianMs: median,
    /** Reize pro Minute gegen Ende (aus der Reizdauer der letzten 20 Reize) */
    taktProMin: endDur ? Math.round(60000 / endDur) : null,
  };
}

export const determinationGenerator: Generator<DtPrompt, null> = {
  id: 'determination',
  version: 1,
  generate(seed, level, opts) {
    const rng = createRng(seed);
    const lvl = clampLevel(level);
    const mode = ((opts?.modus as string) ?? 'adaptiv') as DtPrompt['mode'];
    const minutes = Number(opts?.dauer ?? 4);
    // Startdauer: adaptiv laut Vorgabe 1,2 s; im Aktionsmodus legt die Stufe den festen Takt fest
    const startMs = mode === 'aktion' ? Math.round(1200 - (lvl - 1) * 60) : 1200;
    const stimuli: number[] = [];
    for (let i = 0; i < 3000; i++) {
      let s: number;
      do s = rng.int(0, 6);
      while (s === stimuli[i - 1]);
      stimuli.push(s);
    }
    return block(
      'determination',
      seed,
      lvl,
      ['re.determination', `re.determination.${mode}`],
      { mode, durationMs: minutes * 60_000, startMs, stimuli },
      `Modus ${mode}, ${minutes} min. Farben und Töne mit den zugeordneten Tasten beantworten. Geschafft ab 80 % richtig.`,
    );
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    if (item.prompt.stimuli.some((s) => s < 0 || s > 6)) errs.push('Reiz außerhalb');
    return errs;
  },
  check(_item, answer) {
    const ev = (data(answer)?.events as DtEvent[] | undefined) ?? [];
    const sc = dtScore(ev);
    return sc.total >= 10 && sc.richtig / sc.total >= 0.8;
  },
  fingerprint: (item) => item.prompt.stimuli.slice(0, 30).join('') + item.prompt.mode,
  promptText: (item) =>
    `Determination (${item.prompt.mode}, ${item.prompt.durationMs / 60000} min)`,
};

// ---------- Farb-Wort-Interferenz ----------

export const STROOP_NAMES = ['ROT', 'GRÜN', 'BLAU', 'GELB'];
export const STROOP_COLORS = ['#dc2626', '#16a34a', '#2563eb', '#ca8a04'];
export const STROOP_KEYS = ['d', 'f', 'j', 'k'];

export interface StTrial {
  word: number;
  ink: number;
}
export interface StPrompt {
  trials: StTrial[];
  windowMs: number;
}
export type StItem = Item<StPrompt, null>;

export function stroopScore(trials: StTrial[], res: TrialResult[]) {
  const med = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const rt = (cong: boolean) =>
    med(
      res
        .filter(
          (r, i) => r.correct && r.rtMs !== null && (trials[i].word === trials[i].ink) === cong,
        )
        .map((r) => r.rtMs as number),
    );
  const c = rt(true);
  const inc = rt(false);
  return {
    richtig: res.filter((r) => r.correct).length,
    n: res.length,
    medianPassend: c,
    medianUnpassend: inc,
    interferenzMs: c !== null && inc !== null ? Math.round(inc - c) : null,
  };
}

export const stroopGenerator: Generator<StPrompt, null> = {
  id: 'stroop',
  version: 1,
  generate(seed, level) {
    const rng = createRng(seed);
    const lvl = clampLevel(level);
    const trials: StTrial[] = [];
    for (let i = 0; i < 48; i++) {
      const word = rng.int(0, 3);
      const incongruent = i % 2 === 1;
      let ink = word;
      if (incongruent)
        do ink = rng.int(0, 3);
        while (ink === word);
      trials.push({ word, ink });
    }
    const shuffled = rng.shuffle(trials);
    const windowMs = 2500 - (lvl - 1) * 150; // 2,5 s bis 1,15 s
    return block(
      'stroop',
      seed,
      lvl,
      ['re.stroop'],
      { trials: shuffled, windowMs },
      `Taste für die Schriftfarbe, nicht für das Wort. Die Hälfte der Wörter ist unpassend gefärbt. Kennwert: Zeitdifferenz unpassend minus passend. Geschafft ab 90 % richtig.`,
    );
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    const inc = item.prompt.trials.filter((t) => t.word !== t.ink).length;
    if (inc !== 24) errs.push('nicht 50 % unpassend');
    return errs;
  },
  check(_item, answer) {
    const res = (data(answer)?.results as TrialResult[] | undefined) ?? [];
    return res.length >= 10 && res.filter((r) => r.correct).length / res.length >= 0.9;
  },
  fingerprint: (item) => JSON.stringify(item.prompt.trials.slice(0, 12)),
  promptText: () => 'Farb-Wort-Interferenz',
};

// ---------- Vigilanz-Uhr ----------

export const VIG_PRESETS: Record<string, { p: number; label: string }> = {
  original: { p: 0.006, label: 'Original-nah (ca. 0,6 %)' },
  training: { p: 0.02, label: 'Training (2 %)' },
  einstieg: { p: 0.05, label: 'Einstieg (5 %, mit Rückmeldung)' },
};

export interface VgPrompt {
  tickMs: number;
  durationMs: number;
  windowMs: number;
  preset: string;
  /** Schritte (Takte), an denen ein Doppelsprung kommt */
  signals: number[];
}
export type VgItem = Item<VgPrompt, null>;

export interface VgEvent {
  step: number;
  t: number;
  hit: boolean;
  rtMs: number | null;
}

export function vigScore(p: VgPrompt, signals: VgEvent[], falseAlarms: number[]) {
  const third = p.durationMs / 3;
  const parts = [0, 1, 2].map((k) => {
    const s = signals.filter((e) => e.t >= k * third && e.t < (k + 1) * third);
    const fa = falseAlarms.filter((t) => t >= k * third && t < (k + 1) * third).length;
    const rts = s
      .filter((e) => e.hit && e.rtMs !== null)
      .map((e) => e.rtMs as number)
      .sort((a, b) => a - b);
    const med = rts.length
      ? rts.length % 2
        ? rts[(rts.length - 1) / 2]
        : (rts[rts.length / 2 - 1] + rts[rts.length / 2]) / 2
      : null;
    return {
      signale: s.length,
      treffer: s.filter((e) => e.hit).length,
      auslassungen: s.filter((e) => !e.hit).length,
      fehlalarme: fa,
      medianMs: med,
    };
  });
  const sum = (k: 'signale' | 'treffer' | 'auslassungen' | 'fehlalarme') =>
    parts.reduce((a, b) => a + b[k], 0);
  return {
    parts,
    signale: sum('signale'),
    treffer: sum('treffer'),
    auslassungen: sum('auslassungen'),
    fehlalarme: sum('fehlalarme'),
  };
}

export const vigilanzGenerator: Generator<VgPrompt, null> = {
  id: 'vigilanz',
  version: 1,
  generate(seed, level, opts) {
    const rng = createRng(seed);
    const lvl = clampLevel(level);
    const preset = (opts?.haeufigkeit as string) ?? 'training';
    const p = VIG_PRESETS[preset]?.p ?? 0.02;
    const tickMs = Number(opts?.takt ?? 1000);
    const durationMs = Number(opts?.dauer ?? 5) * 60_000;
    const windowMs = Number(opts?.fenster ?? 1000);
    const steps = Math.floor(durationMs / tickMs);
    const signals: number[] = [];
    let last = -100;
    for (let s = 10; s < steps - 2; s++) {
      if (s - last < 20) continue;
      if (rng.next() < p * (20 / 19)) {
        signals.push(s);
        last = s;
      }
    }
    // mindestens zwei Signale, damit es etwas auszuwerten gibt (dann fest bei 40 % und 80 %)
    if (signals.length < 2)
      signals.splice(0, signals.length, Math.floor(steps * 0.4), Math.floor(steps * 0.8));
    signals.sort((a, b) => a - b);
    return block(
      'vigilanz',
      seed,
      lvl,
      ['vg.vigilanz', `vg.${preset}`],
      { tickMs, durationMs, windowMs, preset, signals },
      `Leertaste beim Doppelsprung. ${signals.length} Signale in ${durationMs / 60000} min. Geschafft ab 75 % Treffern und höchstens 3 Fehlalarmen.`,
    );
  },
  validate(item) {
    const errs = baseValidate(item as Item);
    const s = item.prompt.signals;
    if (s.some((x, i) => i > 0 && x - s[i - 1] < 20)) errs.push('Signale zu dicht');
    return errs;
  },
  check(item, answer) {
    const d = data(answer);
    if (!d) return false;
    const sc = vigScore(
      item.prompt,
      (d.signals as VgEvent[]) ?? [],
      (d.falseAlarms as number[]) ?? [],
    );
    return sc.signale > 0 && sc.treffer / sc.signale >= 0.75 && sc.fehlalarme <= 3;
  },
  fingerprint: (item) => item.prompt.signals.join(',') + item.prompt.tickMs,
  promptText: (item) =>
    `Vigilanz ${item.prompt.durationMs / 60000} min (${VIG_PRESETS[item.prompt.preset]?.label ?? item.prompt.preset})`,
};
