import type { AreaId, Attempt, Session } from './types';

export function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${x.getFullYear()}-${m}-${day}`;
}

/** Kalenderwoche nach ISO 8601. */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
}

/** Ganze Kalendertage von heute bis zum Datum (YYYY-MM-DD). */
export function daysUntil(isoDate: string, now: Date): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400_000);
}

/** Montag bis Sonntag der Woche, in der `today` liegt. */
export function weekDays(today: Date): Date[] {
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const offset = (d.getDay() + 6) % 7; // Mo = 0
  d.setDate(d.getDate() - offset);
  return Array.from(
    { length: 7 },
    (_, i) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + i),
  );
}

export function difficultyLabel(level: number): 'leicht' | 'mittel' | 'schwer' {
  if (level <= 3) return 'leicht';
  if (level <= 7) return 'mittel';
  return 'schwer';
}

export const completed = (s: Session) =>
  !!s.endedAt && !s.aborted && Object.keys(s.summary).length > 0;

export interface AreaStat {
  /** Höchster Bereichswert der letzten 30 Tage (0 bis 100). */
  best30: number;
  /** Aktueller Bereichswert. */
  current: number;
  /** Anzahl geübter Module. */
  practiced: number;
}

/**
 * Bereichswert = Mittelwert der Modul-Niveaus der bereits geübten Module
 * im Bereich (jeweils letztes Niveau). Bestwert 30 Tage = höchster
 * Bereichswert, der in den letzten 30 Tagen erreicht wurde.
 */
export function areaStats(
  sessions: Session[],
  moduleArea: Record<string, AreaId>,
  now: Date,
): Record<string, AreaStat> {
  const sorted = sessions.filter(completed).sort((a, b) => (a.endedAt! < b.endedAt! ? -1 : 1));
  const latest: Record<string, number> = {};
  const out: Record<string, AreaStat> = {};
  const cutoff = now.getTime() - 30 * 86400_000;
  const areaValue = (area: string) => {
    const vals = Object.entries(latest)
      .filter(([m]) => moduleArea[m] === area)
      .map(([, v]) => v);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  };
  for (const s of sorted) {
    const touched = new Set<string>();
    for (const [m, sum] of Object.entries(s.summary)) {
      if (!moduleArea[m]) continue;
      latest[m] = sum.niveau;
      touched.add(moduleArea[m]);
    }
    for (const area of touched) {
      const v = areaValue(area);
      const st = (out[area] ??= { best30: 0, current: 0, practiced: 0 });
      st.current = v;
      if (new Date(s.endedAt!).getTime() >= cutoff) st.best30 = Math.max(st.best30, v);
    }
  }
  for (const area of Object.keys(out))
    out[area].practiced = Object.keys(latest).filter((m) => moduleArea[m] === area).length;
  return out;
}

export interface TagStat {
  tag: string;
  n: number;
  errors: number;
  rate: number; // 0 bis 1
}

export function tagStats(attempts: Attempt[]): TagStat[] {
  const map = new Map<string, TagStat>();
  for (const a of attempts)
    for (const t of a.tags) {
      const s = map.get(t) ?? { tag: t, n: 0, errors: 0, rate: 0 };
      s.n += 1;
      if (!a.correct) s.errors += 1;
      map.set(t, s);
    }
  const list = [...map.values()];
  for (const s of list) s.rate = s.n ? s.errors / s.n : 0;
  return list.sort((a, b) => b.rate - a.rate || b.n - a.n);
}

export interface DayStat {
  day: string;
  n: number;
  errors: number;
  rate: number;
}

export function dayStats(attempts: Attempt[]): DayStat[] {
  const map = new Map<string, DayStat>();
  for (const a of attempts) {
    const k = dayKey(a.timestamp);
    const s = map.get(k) ?? { day: k, n: 0, errors: 0, rate: 0 };
    s.n += 1;
    if (!a.correct) s.errors += 1;
    map.set(k, s);
  }
  const list = [...map.values()];
  for (const s of list) s.rate = s.n ? s.errors / s.n : 0;
  return list.sort((a, b) => (a.day < b.day ? 1 : -1));
}
