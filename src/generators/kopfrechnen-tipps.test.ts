import { describe, expect, it } from 'vitest';
import { kopfrechnenGenerator } from './kopfrechnen';
import { deriveSeed } from '../core/rng';
import { tipsAdd, tipsMul, tipsProzent, tipsProzentRueck, tipsSub } from './kopfrechnen-tipps';

const NUM = String.raw`\d+(?:\.\d{3})*(?:,\d+)?`;
// a op b = c, wobei a nicht Teil einer längeren Rechnung ist und c nicht weitergerechnet wird
const RE = new RegExp(
  String.raw`(?<![\d/,.])(?<![+−×:]\s)(${NUM}) ([+−×:]) (${NUM}) = (${NUM})(?![\d/²³]|\s[+−×:]|,\d)`,
  'g',
);
const val = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

export function wrongCalcs(text: string): string[] {
  const bad: string[] = [];
  for (const m of text.matchAll(RE)) {
    const [, a, op, b, c] = m;
    const x = val(a);
    const y = val(b);
    const z = op === '+' ? x + y : op === '−' ? x - y : op === '×' ? x * y : x / y;
    if (Math.abs(z - val(c)) > 1e-9) bad.push(m[0]);
  }
  return bad;
}

describe('Kopfrechen-Tipps', () => {
  it('Prüfer erkennt Rechenfehler', () => {
    expect(wrongCalcs('62 + 80 = 142, dann 1 zurück')).toEqual([]);
    expect(wrongCalcs('62 + 80 = 143.')).toEqual(['62 + 80 = 143']);
    expect(wrongCalcs('8 × 7 = 5 × 7 + 3 × 7 = 35 + 21 = 56.')).toEqual([]);
    expect(wrongCalcs('0,14 × 49 = 6,86')).toEqual([]);
  });

  it('alle Rechnungen in Tipps und Rechenweg stimmen (alle Stufen)', () => {
    let checked = 0;
    for (let level = 1; level <= 10; level++)
      for (let i = 0; i < 1500; i++) {
        const it = kopfrechnenGenerator.generate(deriveSeed(level * 31, i), level);
        const text = [...it.prompt.steps, ...it.prompt.tips].join('\n');
        checked += [...text.matchAll(RE)].length;
        const bad = wrongCalcs(text);
        if (bad.length) throw new Error(`${it.prompt.text}: ${bad.join(' | ')}\n${text}`);
        expect(it.prompt.tips.length).toBeGreaterThan(0);
      }
    expect(checked).toBeGreaterThan(10000);
  });

  it('Beispiele', () => {
    expect(tipsAdd(62, 79).join(' ')).toContain('62 + 80 = 142, dann 1 zurück: 141');
    expect(tipsSub(90, 63)[0]).toContain('90 − 60 = 30, 30 − 3 = 27');
    expect(tipsMul(48, 52)[0]).toContain('50² − 2²');
    expect(tipsProzent(15, 240)[0]).toBe(
      'Dreisatz: 100 % ≙ 240 | : 20 → 5 % ≙ 12 | × 3 → 15 % ≙ 36.',
    );
    expect(tipsProzent(15, 240)[1]).toContain('10 % + 5 % = 24 + 12 = 36');
    expect(tipsProzentRueck(18, 15)[0]).toBe(
      'Dreisatz: 15 % ≙ 18 | : 3 → 5 % ≙ 6 | × 20 → 100 % ≙ 120.',
    );
  });
});
