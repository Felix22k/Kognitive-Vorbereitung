export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = values.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Niveau (0 bis 100): Mittelwert der Stufe über die zweite Hälfte des
 * Durchgangs mal 10. Bei ungerader Anzahl gehört die mittlere Aufgabe zur
 * zweiten Hälfte.
 */
export function niveau(levels: number[]): number {
  if (levels.length === 0) return 0;
  const half = levels.slice(Math.floor(levels.length / 2));
  return Math.round(mean(half) * 10);
}

export function trefferquote(correct: boolean[]): number {
  if (correct.length === 0) return 0;
  return Math.round((correct.filter(Boolean).length / correct.length) * 100);
}
