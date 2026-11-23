import { db, getModuleState, saveModuleState } from '../db/db';
import type { Attempt, Mode, Report, Session, SessionType } from '../core/types';
import { uid } from '../core/ids';
import { pushRecent, summarize } from './engine';

export async function startSession(p: {
  type: SessionType;
  mode: Mode;
  moduleIds: string[];
  belastet?: boolean;
  puls?: number;
  muedigkeit?: 1 | 2 | 3 | 4 | 5;
  schlafStunden?: number;
  protokoll?: Session['protokoll'];
  groupId?: string;
  block?: string;
}): Promise<Session> {
  const s: Session = {
    id: uid('s-'),
    type: p.type,
    mode: p.mode,
    moduleIds: p.moduleIds,
    startedAt: new Date().toISOString(),
    belastet: !!p.belastet,
    puls: p.puls,
    muedigkeit: p.muedigkeit,
    schlafStunden: p.schlafStunden,
    protokoll: p.protokoll,
    groupId: p.groupId,
    block: p.block,
    summary: {},
  };
  await db.sessions.put(s);
  return s;
}

export async function recordAttempt(a: Attempt, fingerprint: string): Promise<void> {
  await db.transaction('rw', [db.attempts, db.moduleStates], async () => {
    await db.attempts.put(a);
    const st = await getModuleState(a.moduleId);
    st.attempts += 1;
    if (a.correct) st.solved += 1;
    st.recent = pushRecent(st.recent, fingerprint);
    st.lastPlayed = a.timestamp;
    await saveModuleState(st);
  });
}

/** Schließt eine Sitzung ab, berechnet die Kennwerte und speichert die Stufe. */
export async function finishSession(
  session: Session,
  endLevels: Record<string, number>,
  aborted = false,
): Promise<Session> {
  const attempts = await db.attempts.where('sessionId').equals(session.id).sortBy('timestamp');
  const summary: Session['summary'] = {};
  for (const moduleId of new Set(attempts.map((a) => a.moduleId))) {
    const list = attempts.filter((a) => a.moduleId === moduleId);
    summary[moduleId] = summarize(list, endLevels[moduleId] ?? list[list.length - 1].level);
  }
  const done: Session = { ...session, endedAt: new Date().toISOString(), summary, aborted };
  await db.sessions.put(done);
  for (const [moduleId, lvl] of Object.entries(endLevels)) {
    const st = await getModuleState(moduleId);
    if (session.mode === 'lernen') st.levelLernen = lvl;
    else st.levelTest = lvl;
    await saveModuleState(st);
  }
  return done;
}

export async function markIntroSeen(moduleId: string): Promise<void> {
  const st = await getModuleState(moduleId);
  if (!st.introSeen) {
    st.introSeen = true;
    await saveModuleState(st);
  }
}

export async function addReport(r: Omit<Report, 'id' | 'timestamp'>): Promise<void> {
  await db.reports.put({ ...r, id: uid('r-'), timestamp: new Date().toISOString() });
}

/** Markiert die Gruppe (Tageseinheit, Simulation) als vollständig abgeschlossen. */
export async function markGroupDone(sessionId: string): Promise<void> {
  const s = await db.sessions.get(sessionId);
  if (s) await db.sessions.put({ ...s, groupDone: true });
}
