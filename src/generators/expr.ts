/**
 * Kleine Ausdrucks-Engine für Rechenterme: AST, Auswertung mit Brüchen,
 * Darstellung auf Deutsch, Rechenweg Schritt für Schritt und eine
 * "falsche" Auswertung (Strich vor Punkt) für Distraktoren.
 */
import { add, div, formatRational, mul, rat, sub, type Rational } from '../core/rational';

export type Op = '+' | '-' | '*' | ':';

export type Expr =
  | { k: 'num'; v: Rational; frac?: boolean }
  | { k: 'bin'; op: Op; l: Expr; r: Expr; paren?: boolean };

export const num = (v: number | Rational, frac = false): Expr => ({
  k: 'num',
  v: typeof v === 'number' ? rat(v) : v,
  frac,
});
export const bin = (op: Op, l: Expr, r: Expr): Expr => ({ k: 'bin', op, l, r });
export const paren = (e: Expr): Expr => (e.k === 'bin' ? { ...e, paren: true } : e);

const prec = (op: Op) => (op === '+' || op === '-' ? 1 : 2);

function apply(op: Op, a: Rational, b: Rational): Rational {
  switch (op) {
    case '+':
      return add(a, b);
    case '-':
      return sub(a, b);
    case '*':
      return mul(a, b);
    case ':':
      if (b.n === 0) throw new Error('Division durch 0');
      return div(a, b);
  }
}

export function evaluate(e: Expr): Rational {
  if (e.k === 'num') return e.v;
  return apply(e.op, evaluate(e.l), evaluate(e.r));
}

const OP_TEXT: Record<Op, string> = { '+': '+', '-': '−', '*': '×', ':': ':' };

function numText(e: Extract<Expr, { k: 'num' }>): string {
  const t = formatRational(e.v, e.frac);
  return e.v.n < 0 ? `(${t})` : t;
}

/** Darstellung mit den nötigen Klammern (explizite Klammern bleiben erhalten). */
export function render(e: Expr, parentPrec = 0, rightSide = false): string {
  if (e.k === 'num') return numText(e);
  const p = prec(e.op);
  const inner = `${render(e.l, p, false)} ${OP_TEXT[e.op]} ${render(e.r, p, true)}`;
  const need = e.paren || p < parentPrec || (rightSide && p === parentPrec); // a − (b + c), a : (b × c)
  return need ? `(${inner})` : inner;
}

/** Normalisiert: setzt paren dort, wo render Klammern zeigt, damit Schritte stabil bleiben. */
function withParens(e: Expr, parentPrec = 0, rightSide = false): Expr {
  if (e.k === 'num') return e;
  const p = prec(e.op);
  const need = e.paren || p < parentPrec || (rightSide && p === parentPrec);
  return { ...e, paren: need, l: withParens(e.l, p, false), r: withParens(e.r, p, true) };
}

/**
 * Rechenweg: In jedem Schritt werden alle Teilterme ausgerechnet, deren
 * beide Seiten bereits Zahlen sind. Liefert die Zwischenzeilen
 * (ohne den Ausgangsterm, mit dem Endergebnis).
 */
export function steps(e: Expr): string[] {
  const out: string[] = [];
  let cur = withParens(e);
  const reduce = (x: Expr): Expr => {
    if (x.k === 'num') return x;
    if (x.l.k === 'num' && x.r.k === 'num') {
      const v = apply(x.op, x.l.v, x.r.v);
      return { k: 'num', v, frac: (x.l.frac || x.r.frac) && v.d !== 1 };
    }
    return { ...x, l: reduce(x.l), r: reduce(x.r) };
  };
  let guard = 0;
  while (cur.k !== 'num' && guard++ < 20) {
    cur = reduce(cur);
    out.push(render(cur));
  }
  return out;
}

// ---------- Parser (für die Strich-vor-Punkt-Auswertung) ----------

type Tok = { t: 'num'; v: Rational } | { t: 'op'; v: Op } | { t: '(' } | { t: ')' };

function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') {
      i++;
      continue;
    }
    if (c === '(' || c === ')') {
      toks.push({ t: c });
      i++;
      continue;
    }
    if (c === '+' || c === '−' || c === '×' || c === ':') {
      // Negatives Vorzeichen direkt nach "(" gehört zur Zahl
      const prev = toks[toks.length - 1];
      if (c === '−' && prev && prev.t === '(' && /\d/.test(s[i + 1] ?? '')) {
        const m = /^−(\d+(?:,\d+)?(?:\/\d+)?)/.exec(s.slice(i));
        if (m) {
          toks.push({ t: 'num', v: parseNum(m[1], -1) });
          i += m[0].length;
          continue;
        }
      }
      toks.push({ t: 'op', v: c === '+' ? '+' : c === '−' ? '-' : c === '×' ? '*' : ':' });
      i++;
      continue;
    }
    const m = /^(\d+(?:\.\d{3})*(?:,\d+)?(?:\/\d+)?)/.exec(s.slice(i));
    if (!m) throw new Error(`Unerwartetes Zeichen: ${c}`);
    toks.push({ t: 'num', v: parseNum(m[1], 1) });
    i += m[0].length;
  }
  return toks;
}

function parseNum(s: string, sign: number): Rational {
  const clean = s.replace(/\./g, '');
  if (clean.includes('/')) {
    const [a, b] = clean.split('/');
    return rat(sign * parseInt(a, 10), parseInt(b, 10));
  }
  const [ip, dp = ''] = clean.split(',');
  const den = 10 ** dp.length;
  return rat(sign * (parseInt(ip, 10) * den + (dp ? parseInt(dp, 10) : 0)), den);
}

/**
 * Wertet einen dargestellten Term aus. Mit `inverted = true` bindet
 * Strich stärker als Punkt (typischer Fehler "Strich vor Punkt").
 */
export function evalText(s: string, inverted = false): Rational {
  const toks = tokenize(s);
  let pos = 0;
  const pr = (op: Op) => (inverted ? 3 - prec(op) : prec(op));
  const primary = (): Rational => {
    const t = toks[pos++];
    if (!t) throw new Error('Unerwartetes Ende');
    if (t.t === 'num') return t.v;
    if (t.t === '(') {
      const v = expr(1);
      if (toks[pos++]?.t !== ')') throw new Error('")" erwartet');
      return v;
    }
    throw new Error('Zahl erwartet');
  };
  const expr = (minPrec: number): Rational => {
    let left = primary();
    for (;;) {
      const t = toks[pos];
      if (!t || t.t !== 'op' || pr(t.v) < minPrec) break;
      pos++;
      const right = expr(pr(t.v) + 1);
      left = apply(t.v, left, right);
    }
    return left;
  };
  const v = expr(1);
  if (pos !== toks.length) throw new Error('Überzählige Zeichen');
  return v;
}
