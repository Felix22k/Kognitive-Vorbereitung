import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDatabase, saveSettings, getSettings, getModuleState } from './db';
import { deleteAll, exportAll, importAll, validateExport, attemptsToCsv } from './exportImport';
import { finishSession, recordAttempt, startSession } from '../session/persist';
import type { Attempt } from '../core/types';

let n = 0;
beforeEach(() => {
  useDatabase('test-' + n++);
});

function attempt(sessionId: string, i: number, correct: boolean): Attempt {
  return {
    id: 'a' + i,
    sessionId,
    itemId: 'it' + i,
    moduleId: 'kopfrechnen',
    mode: 'test',
    generatorId: 'kopfrechnen',
    generatorVersion: 1,
    seed: i,
    level: 3 + (i % 3),
    tags: ['kr.add'],
    answer: { type: 'text', raw: '12' },
    answerLabel: '12',
    correctAnswer: { n: 12, d: 1 },
    correctLabel: '12',
    correct,
    timedOut: false,
    rtMs: 1000 + i * 100,
    timestamp: new Date(Date.UTC(2026, 10, 21, 10, 0, i)).toISOString(),
    belastet: false,
  };
}

describe('Speicherung, Export und Import', () => {
  it('Sitzung speichert Kennwerte und Stufe', async () => {
    const s = await startSession({ type: 'modul', mode: 'test', moduleIds: ['kopfrechnen'] });
    for (let i = 0; i < 4; i++) await recordAttempt(attempt(s.id, i, i % 2 === 0), 'fp' + i);
    const done = await finishSession(s, { kopfrechnen: 6 });
    expect(done.summary.kopfrechnen.anzahl).toBe(4);
    expect(done.summary.kopfrechnen.trefferquote).toBe(50);
    const ms = await getModuleState('kopfrechnen');
    expect(ms.levelTest).toBe(6);
    expect(ms.attempts).toBe(4);
    expect(ms.solved).toBe(2);
    expect(ms.recent).toEqual(['fp0', 'fp1', 'fp2', 'fp3']);
  });

  it('Export und Import stellen alles wieder her', async () => {
    await saveSettings({ dailyMinutes: 10, testDate: '2028-03-01' });
    const s = await startSession({ type: 'modul', mode: 'lernen', moduleIds: ['kopfrechnen'] });
    for (let i = 0; i < 3; i++) await recordAttempt(attempt(s.id, i, true), 'fp' + i);
    await finishSession(s, { kopfrechnen: 4 });
    const dump = JSON.parse(JSON.stringify(await exportAll()));
    expect(validateExport(dump)).toEqual([]);

    await deleteAll();
    expect((await exportAll()).data.attempts.length).toBe(0);
    expect((await getSettings()).dailyMinutes).toBe(8);

    await importAll(dump);
    const back = await exportAll();
    expect(back.data).toEqual(dump.data);
    expect((await getSettings()).testDate).toBe('2028-03-01');
  });

  it('ungültige Datei wird abgelehnt', async () => {
    expect(validateExport({ foo: 1 }).length).toBeGreaterThan(0);
    await expect(importAll({ format: 'x' })).rejects.toThrow();
  });

  it('CSV mit Semikolon und Kopfzeile', () => {
    const csv = attemptsToCsv([attempt('s', 1, true)]);
    const [head, row] = csv.split('\n');
    expect(head.split(';')).toContain('rtMs');
    expect(row.split(';').length).toBe(head.split(';').length);
  });
});
