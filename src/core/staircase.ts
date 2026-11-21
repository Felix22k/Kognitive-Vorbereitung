import type { Mode } from './types';

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 10;

export interface StairState {
  level: number;
  streak: number; // richtige Antworten in Folge (nur Lernmodus relevant)
}

export function clampLevel(l: number): number {
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(l)));
}

/**
 * Treppenverfahren.
 * Lernmodus: 2 richtige in Folge → +1, eine falsche → −1 (pendelt bei ca. 70 %).
 * Testmodus/Simulation: jede richtige +1, jede falsche oder abgelaufene −1.
 */
export function updateStair(state: StairState, correct: boolean, mode: Mode): StairState {
  if (mode === 'lernen') {
    if (correct) {
      const streak = state.streak + 1;
      if (streak >= 2) return { level: clampLevel(state.level + 1), streak: 0 };
      return { level: state.level, streak };
    }
    return { level: clampLevel(state.level - 1), streak: 0 };
  }
  return { level: clampLevel(state.level + (correct ? 1 : -1)), streak: 0 };
}

/** Startstufe im Testmodus: 4 oder letztes Niveau minus 1. */
export function testStartLevel(lastTestLevel: number | null): number {
  if (lastTestLevel == null) return 4;
  return clampLevel(lastTestLevel - 1);
}
