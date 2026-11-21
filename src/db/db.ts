import Dexie, { type Table } from 'dexie';
import type { Attempt, ModuleState, Report, Session, Settings } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/types';

export interface SettingsRow {
  key: 'settings';
  value: Settings;
}

export class TrainerDB extends Dexie {
  attempts!: Table<Attempt, string>;
  sessions!: Table<Session, string>;
  moduleStates!: Table<ModuleState, string>;
  settings!: Table<SettingsRow, string>;
  reports!: Table<Report, string>;

  constructor(name = 'pfv-kognitionstrainer') {
    super(name);
    this.version(1).stores({
      attempts: 'id, sessionId, moduleId, timestamp, *tags, belastet',
      sessions: 'id, type, startedAt',
      moduleStates: 'moduleId',
      settings: 'key',
      reports: 'id, moduleId, timestamp',
    });
  }
}

export let db = new TrainerDB();

/** Nur für Tests: andere Datenbank verwenden. */
export function useDatabase(name: string): TrainerDB {
  db = new TrainerDB(name);
  return db;
}

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('settings');
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const cur = await getSettings();
  const next = { ...cur, ...patch };
  await db.settings.put({ key: 'settings', value: next });
  return next;
}

export function defaultModuleState(moduleId: string): ModuleState {
  return {
    moduleId,
    levelLernen: 1,
    levelTest: null,
    solved: 0,
    attempts: 0,
    introSeen: false,
    recent: [],
  };
}

export async function getModuleState(moduleId: string): Promise<ModuleState> {
  return (await db.moduleStates.get(moduleId)) ?? defaultModuleState(moduleId);
}

export async function saveModuleState(s: ModuleState): Promise<void> {
  await db.moduleStates.put(s);
}
