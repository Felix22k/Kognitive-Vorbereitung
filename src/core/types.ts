import { DEFAULT_WEEK_PLAN } from './plan';
export type Mode = 'lernen' | 'test' | 'simulation';

export type AreaId =
  | 'sprache'
  | 'logik'
  | 'raum'
  | 'gedaechtnis'
  | 'konzentration'
  | 'reaktion'
  | 'wachsamkeit';

/** Wie eine Aufgabe beantwortet wird. */
export type AnswerKind = 'number' | 'choice' | 'block';

export interface Item<P = unknown, C = unknown> {
  id: string;
  moduleId: string;
  generatorId: string;
  generatorVersion: number;
  seed: number;
  level: number; // 1 bis 10
  tags: string[];
  prompt: P; // modulspezifisch
  options?: unknown[];
  correct: C; // Index, Indizes oder Wert
  /** Anzeigetext der richtigen Lösung. */
  correctLabel: string;
  explanation: string;
  timeLimitMs: number;
  answerKind: AnswerKind;
}

export interface Attempt {
  id: string;
  sessionId: string;
  itemId: string;
  moduleId: string;
  mode: Mode;
  generatorId: string;
  generatorVersion: number;
  seed: number;
  level: number;
  tags: string[];
  answer: unknown;
  answerLabel: string;
  correctAnswer: unknown;
  correctLabel: string;
  correct: boolean;
  timedOut: boolean;
  rtMs: number;
  timestamp: string; // ISO
  belastet: boolean;
  puls?: number;
  muedigkeit?: number;
}

export type SessionType = 'tag' | 'modul' | 'kurzsim' | 'vollsim' | 'vigilanz';

export interface ModuleSummary {
  niveau: number; // 0 bis 100
  trefferquote: number; // 0 bis 100
  medianMs: number;
  anzahl: number;
  endLevel: number;
}

export interface Session {
  id: string;
  type: SessionType;
  mode: Mode;
  moduleIds: string[];
  startedAt: string;
  endedAt?: string;
  /** Abgebrochene Durchgänge zählen nicht in die Bestwerte. */
  aborted?: boolean;
  belastet: boolean;
  puls?: number;
  muedigkeit?: 1 | 2 | 3 | 4 | 5;
  schlafStunden?: number;
  protokoll?: 'extern' | 'app' | 'wechsel';
  /** Teile einer Tageseinheit oder Simulation teilen sich eine Gruppe */
  groupId?: string;
  /** letzter Teil einer vollständig abgeschlossenen Tageseinheit oder Simulation */
  groupDone?: boolean;
  /** Block einer Simulation (Name) */
  block?: string;
  summary: Record<string, ModuleSummary>;
}

export interface ModuleState {
  moduleId: string;
  /** Stufe im Lernmodus. */
  levelLernen: number;
  /** Zuletzt erreichte Stufe im Testmodus. */
  levelTest: number | null;
  solved: number;
  attempts: number;
  introSeen: boolean;
  lastPlayed?: string;
  /** Fingerabdrücke der zuletzt gezeigten Aufgaben (gegen Wiederholung). */
  recent: string[];
}

export interface Report {
  id: string;
  moduleId: string;
  generatorId: string;
  generatorVersion: number;
  seed: number;
  level: number;
  timestamp: string;
  promptText: string;
  note?: string;
  /** Fingerabdruck der Aufgabe: gemeldete Aufgaben werden nicht mehr gezeigt */
  fingerprint?: string;
}

export interface Settings {
  testDate: string | null; // YYYY-MM-DD
  dailyMinutes: 5 | 8 | 10;
  restDay: number; // 0 = So, 1 = Mo ... 6 = Sa
  sound: boolean;
  timeLimitInLearning: boolean;
  kopfrechnenAuswahlImTest: boolean;
  disclaimerDismissed: boolean;
  /** Farbschema: dem System folgen, hell oder dunkel. */
  theme: 'system' | 'hell' | 'dunkel';
  /** Debug-Seite in der Navigation anzeigen */
  devTools: boolean;
  /** Optionen je Modul (z. B. Dauer, Modus), vom Startbildschirm */
  moduleOptions: Record<string, Record<string, string>>;
  /** Tastenbelegung Determinationstest: rot, gelb, grün, blau, weiß, hoher Ton, tiefer Ton */
  dtKeys: string[];
  /** Wochenplan: Wochentag (0 = So … 6 = Sa) → Module */
  weekPlan: Record<string, string[]>;
  /** Pausen in der Vollsimulation: keine („Ernstfall“) oder 5 Minuten */
  simPause: 'ernstfall' | '5';
}

export const DEFAULT_SETTINGS: Settings = {
  testDate: null,
  dailyMinutes: 8,
  restDay: 0,
  sound: true,
  timeLimitInLearning: false,
  kopfrechnenAuswahlImTest: false,
  disclaimerDismissed: false,
  theme: 'dunkel',
  devTools: false,
  moduleOptions: {},
  dtKeys: ['a', 's', 'd', 'f', ' ', 'j', 'k'],
  weekPlan: DEFAULT_WEEK_PLAN,
  simPause: '5',
};

export interface Generator<P = unknown, C = unknown> {
  id: string;
  version: number;
  generate(seed: number, level: number, opts?: Record<string, unknown>): Item<P, C>;
  /** Leere Liste = gültig. */
  validate(item: Item<P, C>): string[];
  /** Prüft eine gegebene Antwort. */
  check(item: Item<P, C>, answer: unknown): boolean;
  /** Fingerabdruck zum Erkennen von Wiederholungen. */
  fingerprint(item: Item<P, C>): string;
  /** Text für Meldungen und Protokoll. */
  promptText(item: Item<P, C>): string;
}
