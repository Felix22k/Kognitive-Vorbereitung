import { db } from './db';
import type { Attempt } from '../core/types';

export const EXPORT_FORMAT = 'pfv-kognitionstrainer';
export const EXPORT_VERSION = 1;

export interface ExportData {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  data: {
    attempts: unknown[];
    sessions: unknown[];
    moduleStates: unknown[];
    settings: unknown[];
    reports: unknown[];
  };
}

const TABLES = ['attempts', 'sessions', 'moduleStates', 'settings', 'reports'] as const;

export async function exportAll(): Promise<ExportData> {
  const [attempts, sessions, moduleStates, settings, reports] = await Promise.all([
    db.attempts.toArray(),
    db.sessions.toArray(),
    db.moduleStates.toArray(),
    db.settings.toArray(),
    db.reports.toArray(),
  ]);
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: { attempts, sessions, moduleStates, settings, reports },
  };
}

export function validateExport(x: unknown): string[] {
  const errs: string[] = [];
  if (!x || typeof x !== 'object') return ['Datei enthält kein JSON-Objekt.'];
  const o = x as Partial<ExportData>;
  if (o.format !== EXPORT_FORMAT) errs.push('Unbekanntes Dateiformat.');
  if (typeof o.version !== 'number' || o.version > EXPORT_VERSION)
    errs.push('Version wird nicht unterstützt.');
  if (!o.data || typeof o.data !== 'object') errs.push('Abschnitt "data" fehlt.');
  else
    for (const t of TABLES)
      if (!Array.isArray((o.data as Record<string, unknown>)[t]))
        errs.push(`Tabelle "${t}" fehlt.`);
  return errs;
}

/** Ersetzt alle Daten durch den Inhalt der Datei. */
export async function importAll(x: unknown): Promise<void> {
  const errs = validateExport(x);
  if (errs.length) throw new Error(errs.join(' '));
  const d = (x as ExportData).data;
  await db.transaction(
    'rw',
    [db.attempts, db.sessions, db.moduleStates, db.settings, db.reports],
    async () => {
      await Promise.all(TABLES.map((t) => db[t].clear()));
      /* eslint-disable @typescript-eslint/no-explicit-any */
      await db.attempts.bulkPut(d.attempts as any);
      await db.sessions.bulkPut(d.sessions as any);
      await db.moduleStates.bulkPut(d.moduleStates as any);
      await db.settings.bulkPut(d.settings as any);
      await db.reports.bulkPut(d.reports as any);
      /* eslint-enable @typescript-eslint/no-explicit-any */
    },
  );
}

export async function deleteAll(): Promise<void> {
  await db.transaction(
    'rw',
    [db.attempts, db.sessions, db.moduleStates, db.settings, db.reports],
    async () => {
      await Promise.all(TABLES.map((t) => db[t].clear()));
    },
  );
}

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV mit Semikolon (Excel-freundlich für deutsche Einstellungen). */
export function attemptsToCsv(attempts: Attempt[]): string {
  const cols: (keyof Attempt)[] = [
    'timestamp',
    'sessionId',
    'moduleId',
    'mode',
    'generatorId',
    'generatorVersion',
    'seed',
    'level',
    'tags',
    'answerLabel',
    'correctLabel',
    'correct',
    'timedOut',
    'rtMs',
    'belastet',
    'puls',
    'muedigkeit',
  ];
  const rows = attempts.map((a) =>
    cols.map((c) => (c === 'tags' ? csvCell(a.tags.join(' ')) : csvCell(a[c]))).join(';'),
  );
  return [cols.join(';'), ...rows].join('\n');
}

export function downloadFile(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
