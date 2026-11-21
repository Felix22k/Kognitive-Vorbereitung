import { describe, expect, it } from 'vitest';
import { bin, evalText, evaluate, num, paren, render, steps } from './expr';
import { rat, eq } from '../core/rational';

describe('Ausdrücke', () => {
  it('Punkt vor Strich und Klammern', () => {
    const e = bin('+', num(7), bin('*', num(2), num(4)));
    expect(render(e)).toBe('7 + 2 × 4');
    expect(eq(evaluate(e), rat(15))).toBe(true);
    expect(eq(evalText(render(e), true), rat(36))).toBe(true);
    const f = bin('*', paren(bin('+', num(3), num(4))), num(5));
    expect(render(f)).toBe('(3 + 4) × 5');
    expect(eq(evalText(render(f)), rat(35))).toBe(true);
  });
  it('rechte Seite bei Minus und Geteilt klammern', () => {
    expect(render(bin('-', num(10), bin('-', num(4), num(1))))).toBe('10 − (4 − 1)');
    expect(render(bin(':', num(24), bin('*', num(2), num(3))))).toBe('24 : (2 × 3)');
  });
  it('Rechenweg', () => {
    const e = bin(
      '-',
      bin('*', paren(bin('+', num(rat(1, 3), true), num(rat(1, 2), true))), num(24)),
      num(rat(83, 10)),
    );
    expect(steps(e)).toEqual(['5/6 × 24 − 8,3', '20 − 8,3', '11,7']);
  });
  it('Text mit Brüchen, Dezimalzahlen und negativen Zahlen auswerten', () => {
    expect(eq(evalText('3/4 × 8 + 0,5'), rat(13, 2))).toBe(true);
    expect(eq(evalText('(−3) × 4'), rat(-12))).toBe(true);
    expect(eq(evalText('10.000 : 4'), rat(2500))).toBe(true);
  });
});
