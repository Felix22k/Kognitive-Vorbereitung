/** Kleine Bruchrechnung mit ganzen Zahlen (für exakte Prüfung von Antworten). */
export interface Rational {
  n: number;
  d: number; // immer > 0
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function lcm(a: number, b: number): number {
  return Math.abs(a * b) / gcd(a, b);
}

export function rat(n: number, d = 1): Rational {
  if (d === 0) throw new Error('Division durch 0');
  if (!Number.isInteger(n) || !Number.isInteger(d)) {
    // Dezimalzahl in Bruch umwandeln (höchstens 6 Nachkommastellen)
    const f = 1_000_000;
    return rat(Math.round(n * f), Math.round(d * f));
  }
  const s = d < 0 ? -1 : 1;
  const g = gcd(n, d);
  return { n: (s * n) / g, d: (s * d) / g };
}

export const add = (a: Rational, b: Rational) => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational) => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational) => rat(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational) => rat(a.n * b.d, a.d * b.n);
export const eq = (a: Rational, b: Rational) => a.n === b.n && a.d === b.d;
export const toNumber = (a: Rational) => a.n / a.d;
export const isInt = (a: Rational) => a.d === 1;

/** true, wenn der Wert als Dezimalzahl mit höchstens `digits` Nachkommastellen darstellbar ist. */
export function isFiniteDecimal(a: Rational, digits = 2): boolean {
  const f = 10 ** digits;
  return (a.n * f) % a.d === 0;
}

/** Deutsche Darstellung: 3,25 oder 3/4 (Bruch, falls kein endlicher Dezimalwert mit 2 Stellen). */
export function formatRational(a: Rational, preferFraction = false): string {
  if (a.d === 1) return formatNumber(a.n);
  if (!preferFraction && isFiniteDecimal(a, 2)) return formatNumber(toNumber(a));
  return (a.n < 0 ? '−' : '') + `${Math.abs(a.n)}/${a.d}`;
}

export function formatNumber(x: number): string {
  const r = Math.round(x * 100) / 100;
  const neg = r < 0;
  const abs = Math.abs(r);
  const [intPart, decPart] = abs
    .toFixed(2)
    .replace(/\.?0+$/, '')
    .split('.');
  const grouped = intPart.length > 4 ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : intPart;
  return (neg ? '−' : '') + grouped + (decPart ? ',' + decPart : '');
}

/**
 * Liest eine Benutzereingabe: ganze Zahl, Dezimalzahl (Komma oder Punkt),
 * Bruch "3/4" oder "-3/4". Ein Punkt mit genau drei Ziffern danach
 * ("1.500", "12.000") gilt als Tausenderpunkt, weil Lösungen höchstens zwei
 * Nachkommastellen haben. Liefert null bei ungültiger Eingabe.
 */
export function parseAnswer(raw: string): { value: Rational; isFraction: boolean } | null {
  let s = raw.trim().replace(/\s+/g, '').replace(/[−–]/g, '-');
  if (s === '') return null;
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const frac = /^(-?\d+)\/(-?\d+)$/.exec(s);
  if (frac) {
    const d = parseInt(frac[2], 10);
    if (d === 0) return null;
    return { value: rat(parseInt(frac[1], 10), d), isFraction: true };
  }
  const dec = /^(-?)(\d*)[.,]?(\d*)$/.exec(s);
  if (!dec || (dec[2] === '' && dec[3] === '')) return null;
  const intPart = dec[2] || '0';
  const decPart = dec[3] || '';
  const sign = dec[1] === '-' ? -1 : 1;
  const den = 10 ** decPart.length;
  const num = parseInt(intPart, 10) * den + (decPart ? parseInt(decPart, 10) : 0);
  return { value: rat(sign * num, den), isFraction: false };
}
