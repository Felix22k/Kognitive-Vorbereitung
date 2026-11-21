/**
 * Regelbibliothek für Zahlenreihen. Jede Regel kann
 *  - eine Reihe erzeugen (generate) und
 *  - sich an eine Reihe mit höchstens einer Lücke (null) anpassen (fit).
 * fit liefert alle vollständigen Reihen, die zur Regel passen und alle
 * sichtbaren Glieder erklären. Daraus folgt die Eindeutigkeitsprüfung.
 */
import type { Rng } from '../../core/rng';

export type Seq = (number | null)[];

export interface GenOpts {
  level: number;
  /** negative Zahlen erlaubt (ab Stufe 7) */
  neg: boolean;
  /** größere Zahlen (ab Stufe 4) */
  big: boolean;
}

export interface Generated {
  seq: number[];
  /** Regel in Worten. */
  text: string;
  /** zweite Differenzen in der Erklärung zeigen */
  showDiff2?: boolean;
}

export interface Rule {
  id: string;
  tags: string[];
  complexity: number;
  /**
   * Regeln, die mathematisch dieselbe Reihenfamilie beschreiben
   * (z. B. "mal q plus c" und "Differenzen wachsen mit Faktor q").
   * Sie gelten bei der Prüfung "zu einfach" nicht als einfachere Erklärung.
   */
  equivalent?: string[];
  generate(rng: Rng, o: GenOpts): Generated;
  fit(seq: Seq): number[][];
}

export const LEN = 8;

// ---------- Hilfen ----------

const EPS = 1e-7;
const isIntish = (x: number) => Number.isFinite(x) && Math.abs(x - Math.round(x)) < EPS;

function visible(seq: Seq): number[] {
  const v: number[] = [];
  seq.forEach((x, i) => {
    if (x !== null) v.push(i);
  });
  return v;
}

/** Rundet und prüft, ob alle Werte ganzzahlig sind und zu den sichtbaren passen. */
function accept(seq: Seq, full: number[]): number[] | null {
  if (full.length !== seq.length) return null;
  const out: number[] = [];
  for (let i = 0; i < full.length; i++) {
    const x = full[i];
    if (!isIntish(x)) return null;
    const ri = Math.round(x);
    if (Math.abs(ri) > 1e7) return null;
    const s = seq[i];
    if (s !== null && s !== ri) return null;
    out.push(ri);
  }
  return out;
}

function dedupe(list: number[][]): number[][] {
  const seen = new Set<string>();
  const out: number[][] = [];
  for (const l of list) {
    const k = l.join(',');
    if (!seen.has(k)) {
      seen.add(k);
      out.push(l);
    }
  }
  return out;
}

export const sgn = (x: number) => (x < 0 ? `− ${-x}` : `+ ${x}`);
const fmtOp = (op: SimpleOp) =>
  op.k === 'add' ? (op.v < 0 ? `−${-op.v}` : `+${op.v}`) : op.k === 'mul' ? `×${op.v}` : `:${op.v}`;

// ---------- einfache Operationen ----------

export type SimpleOp = { k: 'add' | 'mul' | 'div'; v: number };

function applyOp(op: SimpleOp, x: number): number | null {
  if (op.k === 'add') return x + op.v;
  if (op.k === 'mul') return x * op.v;
  if (op.v === 0 || x % op.v !== 0) return null;
  return x / op.v;
}

const opKey = (op: SimpleOp) => `${op.k}:${op.v}`;

function opCandidates(x: number, y: number): SimpleOp[] {
  const c: SimpleOp[] = [{ k: 'add', v: y - x }];
  if (x !== 0 && y % x === 0) {
    const q = y / x;
    if (q !== 0 && q !== 1) c.push({ k: 'mul', v: q });
  }
  if (y !== 0 && x % y === 0) {
    const q = x / y;
    if (Math.abs(q) >= 2) c.push({ k: 'div', v: q });
  }
  return c;
}

/** Periodische Operationen (Periode p): Glied i+1 = op[i mod p](Glied i). */
function fitPeriodic(seq: Seq, p: number): number[][] {
  if (seq[0] === null) return [];
  const phases: SimpleOp[][] = [];
  for (let ph = 0; ph < p; ph++) {
    let cands: SimpleOp[] | null = null;
    for (let i = ph; i < seq.length - 1; i += p) {
      const x = seq[i];
      const y = seq[i + 1];
      if (x === null || y === null) continue;
      const c = opCandidates(x, y);
      if (cands === null) cands = c;
      else {
        const keys = new Set(c.map(opKey));
        cands = cands.filter((o) => keys.has(opKey(o)));
      }
    }
    if (!cands || cands.length === 0) return [];
    phases.push(cands);
  }
  const results: number[][] = [];
  const combo = (ph: number, chosen: SimpleOp[]) => {
    if (ph === p) {
      const full: number[] = [seq[0] as number];
      for (let i = 0; i < seq.length - 1; i++) {
        const nx = applyOp(chosen[i % p], full[i]);
        if (nx === null) return;
        full.push(nx);
      }
      const a = accept(seq, full);
      if (a) results.push(a);
      return;
    }
    for (const o of phases[ph]) combo(ph + 1, [...chosen, o]);
  };
  combo(0, []);
  return dedupe(results);
}

/** Polynom vom Grad deg durch die ersten deg+1 sichtbaren Punkte (Lagrange). */
function fitPoly(seq: Seq, deg: number): number[][] {
  const vis = visible(seq);
  if (vis.length < deg + 1) return [];
  const pts = vis.slice(0, deg + 1);
  const full: number[] = [];
  for (let x = 0; x < seq.length; x++) {
    let sum = 0;
    for (let i = 0; i < pts.length; i++) {
      let term = seq[pts[i]] as number;
      for (let j = 0; j < pts.length; j++) {
        if (j !== i) term *= (x - pts[j]) / (pts[i] - pts[j]);
      }
      sum += term;
    }
    full.push(sum);
  }
  const a = accept(seq, full);
  return a ? [a] : [];
}

function fitGeom(seq: Seq): number[][] {
  for (let i = 0; i < seq.length - 1; i++) {
    const x = seq[i];
    const y = seq[i + 1];
    if (x === null || y === null || x === 0) continue;
    const q = y / x;
    if (q === 0) return [];
    const full = seq.map((_, j) => x * q ** (j - i));
    const a = accept(seq, full);
    return a ? [a] : [];
  }
  return [];
}

// ---------- Regeln ----------

const PRIMES: number[] = (() => {
  const out: number[] = [];
  for (let n = 2; out.length < 400; n++) {
    let p = true;
    for (let d = 2; d * d <= n; d++)
      if (n % d === 0) {
        p = false;
        break;
      }
    if (p) out.push(n);
  }
  return out;
})();

function seqFrom(t0: number, ops: SimpleOp[]): number[] | null {
  const s = [t0];
  for (let i = 0; i < LEN - 1; i++) {
    const nx = applyOp(ops[i % ops.length], s[i]);
    if (nx === null) return null;
    s.push(nx);
  }
  return s;
}

export const arith: Rule = {
  id: 'arith',
  tags: ['zr.arith'],
  complexity: 1,
  generate(rng, o) {
    const dMax = o.big ? 40 : 12;
    let d = rng.int(2, dMax);
    const down = o.level >= 2 && rng.chance(0.4);
    if (down) d = -d;
    let a: number;
    if (o.neg) a = rng.int(-60, 120);
    else if (down) a = rng.int(-d * 7 + 1, -d * 7 + (o.big ? 400 : 60));
    else a = rng.int(1, o.big ? 400 : 60);
    const seq = Array.from({ length: LEN }, (_, i) => a + i * d);
    return { seq, text: `Konstante Differenz: ${sgn(d)} pro Schritt.` };
  },
  fit(seq) {
    return fitPoly(seq, 1);
  },
};

export const geom: Rule = {
  id: 'geom',
  tags: ['zr.geom'],
  complexity: 2,
  generate(rng, o) {
    const qs = o.neg ? [2, 3, -2] : [2];
    const q = rng.pick(qs);
    const divide = o.level >= 2 && rng.chance(0.4);
    const maxA = Math.max(1, Math.floor((o.neg ? 5000 : 999) / Math.abs(q) ** 7));
    const a = rng.int(1, maxA);
    let seq = Array.from({ length: LEN }, (_, i) => a * q ** i);
    if (divide) seq = seq.reverse();
    return {
      seq,
      text: divide
        ? `Konstanter Faktor: jedes Glied ist das vorige geteilt durch ${q}.`
        : `Konstanter Faktor: jedes Glied ist das vorige mal ${q}.`,
    };
  },
  fit: fitGeom,
};

export const diff2: Rule = {
  id: 'diff2',
  tags: ['zr.diff2'],
  complexity: 3,
  generate(rng, o) {
    const t0 = o.neg ? rng.int(-40, 60) : rng.int(1, o.big ? 150 : 50);
    let d0 = rng.int(1, o.big ? 15 : 6);
    let s = rng.int(1, o.big ? 6 : 4);
    if (o.neg && rng.chance(0.5)) {
      d0 = rng.int(5, 25);
      s = -rng.int(1, 5);
    }
    const seq = Array.from({ length: LEN }, (_, i) => t0 + i * d0 + (s * i * (i - 1)) / 2);
    return {
      seq,
      text: `Die Differenzen ändern sich gleichmäßig um ${sgn(s)} (${sgn(d0)}, ${sgn(d0 + s)}, ${sgn(d0 + 2 * s)} …).`,
      showDiff2: true,
    };
  },
  fit(seq) {
    return fitPoly(seq, 2);
  },
};

function randomOp(rng: Rng, kinds: ('add' | 'sub' | 'mul')[], big: boolean): SimpleOp {
  const k = rng.pick(kinds);
  if (k === 'add') return { k: 'add', v: rng.int(1, big ? 15 : 9) };
  if (k === 'sub') return { k: 'add', v: -rng.int(1, big ? 15 : 9) };
  return { k: 'mul', v: rng.pick([2, 2, 3]) };
}

export const wechsel: Rule = {
  id: 'wechsel',
  tags: ['zr.wechsel'],
  complexity: 3,
  generate(rng, o) {
    for (;;) {
      const a = randomOp(rng, ['add', 'sub', 'mul'], o.big);
      const b = randomOp(rng, ['add', 'sub', 'mul'], o.big);
      if (opKey(a) === opKey(b)) continue;
      if (a.k === 'add' && b.k === 'add' && a.v + b.v === 0) continue;
      const t0 = o.neg ? rng.int(-9, 15) : rng.int(1, 15);
      const seq = seqFrom(t0, [a, b]);
      if (!seq) continue;
      return {
        seq,
        text: `Zwei Rechenschritte im Wechsel: ${fmtOp(a)}, ${fmtOp(b)}, ${fmtOp(a)}, ${fmtOp(b)} …`,
      };
    }
  },
  fit(seq) {
    return fitPeriodic(seq, 2);
  },
};

export const zyklus3: Rule = {
  id: 'zyklus3',
  tags: ['zr.zyklus3'],
  complexity: 8,
  generate(rng, o) {
    for (;;) {
      const ops = [0, 1, 2].map(() => randomOp(rng, ['add', 'sub', 'mul'], o.big));
      const keys = new Set(ops.map(opKey));
      if (keys.size < 3) continue;
      if (!ops.some((x) => x.k === 'mul')) continue;
      const t0 = o.neg ? rng.int(-9, 20) : rng.int(1, 20);
      const seq = seqFrom(t0, ops);
      if (!seq) continue;
      return {
        seq,
        text: `Drei Rechenschritte im Zyklus: ${ops.map(fmtOp).join(', ')}, dann wieder von vorn.`,
      };
    }
  },
  fit(seq) {
    return fitPeriodic(seq, 3);
  },
};

export const potenz: Rule = {
  id: 'potenz',
  tags: ['zr.potenz'],
  // Quadratzahlen sind zugleich quadratische Reihen (diff2), daher gleiche Komplexität.
  complexity: 3,
  generate(rng, o) {
    const cube = rng.chance(0.3);
    const e = cube ? 3 : 2;
    const sMax = cube ? (o.neg ? 9 : 2) : o.neg ? 60 : 23;
    const s = rng.int(1, sMax);
    const c = o.level >= 4 && rng.chance(0.6) ? rng.pick([-3, -2, -1, 1, 2, 3, 5]) : 0;
    const seq = Array.from({ length: LEN }, (_, i) => (i + s) ** e + c);
    const base = cube ? 'Kubikzahlen' : 'Quadratzahlen';
    const n0 = s;
    return {
      seq,
      text:
        c === 0
          ? `${base} von ${n0} an: ${n0}${cube ? '³' : '²'}, ${n0 + 1}${cube ? '³' : '²'}, ${n0 + 2}${cube ? '³' : '²'} …`
          : `${base} von ${n0} an, jeweils ${sgn(c)}: ${n0}${cube ? '³' : '²'} ${sgn(c)}, ${n0 + 1}${cube ? '³' : '²'} ${sgn(c)} …`,
      showDiff2: !cube,
    };
  },
  fit(seq) {
    const vis = visible(seq);
    const v0 = vis[0];
    const out: number[][] = [];
    for (const e of [2, 3]) {
      for (let s = 0; s <= (e === 2 ? 70 : 17); s++) {
        const c = (seq[v0] as number) - (v0 + s) ** e;
        const a = accept(
          seq,
          seq.map((_, i) => (i + s) ** e + c),
        );
        if (a) out.push(a);
      }
    }
    return dedupe(out);
  },
};

export const prim: Rule = {
  id: 'prim',
  tags: ['zr.prim'],
  complexity: 4,
  generate(rng, o) {
    const step = rng.chance(0.4) ? 2 : 1;
    const limit = o.neg ? 5000 : 999;
    let maxStart = 0;
    while (PRIMES[maxStart + 1 + (LEN - 1) * step] <= limit) maxStart++;
    const s = rng.int(0, Math.min(maxStart, o.big ? 120 : 25));
    const seq = Array.from({ length: LEN }, (_, i) => PRIMES[s + i * step]);
    return {
      seq,
      text:
        step === 1
          ? 'Aufeinanderfolgende Primzahlen.'
          : 'Jede zweite Primzahl (eine wird immer übersprungen).',
    };
  },
  fit(seq) {
    const vis = visible(seq);
    const out: number[][] = [];
    for (const step of [1, 2]) {
      for (let s = 0; s + (LEN - 1) * step < PRIMES.length; s++) {
        const full = seq.map((_, i) => PRIMES[s + i * step]);
        if (full[vis[0]] !== seq[vis[0]]) continue;
        const a = accept(seq, full);
        if (a) out.push(a);
      }
    }
    return out;
  },
};

function subseqs(seq: Seq): [Seq, Seq] {
  return [seq.filter((_, i) => i % 2 === 0), seq.filter((_, i) => i % 2 === 1)];
}

function interleave(e: number[], o: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < e.length + o.length; i++) out.push(i % 2 === 0 ? e[i / 2] : o[(i - 1) / 2]);
  return out;
}

function fitWith(rules: ((s: Seq) => number[][])[], s: Seq): number[][] {
  return dedupe(rules.flatMap((f) => f(s)));
}

function fitTwoSeries(seq: Seq, subFits: ((s: Seq) => number[][])[]): number[][] {
  const [e, o] = subseqs(seq);
  const fe = fitWith(subFits, e);
  if (!fe.length) return [];
  const fo = fitWith(subFits, o);
  const out: number[][] = [];
  for (const a of fe) for (const b of fo) out.push(interleave(a, b));
  return dedupe(out);
}

interface SubGen {
  seq: number[];
  text: string;
}

function subArith(rng: Rng, n: number, o: GenOpts): SubGen {
  const d = rng.int(1, o.big ? 25 : 12) * (rng.chance(o.neg ? 0.5 : 0.3) ? -1 : 1);
  const a =
    d < 0 && !o.neg ? rng.int(-d * (n - 1) + 1, -d * (n - 1) + 80) : rng.int(o.neg ? -30 : 1, 80);
  return { seq: Array.from({ length: n }, (_, i) => a + i * d), text: `${sgn(d)}` };
}

function subGeom(rng: Rng, n: number): SubGen {
  const q = rng.pick([2, 3]);
  const a = rng.int(1, q === 2 ? 9 : 4);
  return { seq: Array.from({ length: n }, (_, i) => a * q ** i), text: `×${q}` };
}

function subDiff2(rng: Rng, n: number, o: GenOpts): SubGen {
  const t0 = rng.int(o.neg ? -20 : 1, 60);
  const d0 = rng.int(1, 9);
  const s = rng.int(1, 5) * (o.neg && rng.chance(0.4) ? -1 : 1);
  return {
    seq: Array.from({ length: n }, (_, i) => t0 + i * d0 + (s * i * (i - 1)) / 2),
    text: `Differenzen ${sgn(d0)}, ${sgn(d0 + s)}, ${sgn(d0 + 2 * s)}`,
  };
}

export const zweiReihen: Rule = {
  id: 'zweiReihen',
  tags: ['zr.zweiReihen'],
  complexity: 5,
  generate(rng, o) {
    for (;;) {
      const e = rng.chance(0.75) ? subArith(rng, 4, o) : subGeom(rng, 4);
      const od = rng.chance(0.75) ? subArith(rng, 4, o) : subGeom(rng, 4);
      if (e.text === od.text && e.seq[0] === od.seq[0]) continue;
      return {
        seq: interleave(e.seq, od.seq),
        text: `Zwei verschränkte Reihen: Glieder 1, 3, 5, 7: ${e.text}; Glieder 2, 4, 6, 8: ${od.text}.`,
      };
    }
  },
  fit(seq) {
    return fitTwoSeries(seq, [(s) => fitPoly(s, 1), fitGeom]);
  },
};

export const zweiReihenKombi: Rule = {
  id: 'zweiReihenKombi',
  tags: ['zr.zweiReihen', 'zr.diff2'],
  complexity: 10,
  generate(rng, o) {
    const e = subDiff2(rng, 4, o);
    const r = rng.next();
    const od = r < 0.5 ? subDiff2(rng, 4, o) : r < 0.8 ? subArith(rng, 4, o) : subGeom(rng, 4);
    return {
      seq: interleave(e.seq, od.seq),
      text: `Zwei verschränkte Reihen mit eigenen Regeln. Glieder 1, 3, 5, 7: ${e.text}; Glieder 2, 4, 6, 8: ${od.text}.`,
    };
  },
  fit(seq) {
    return fitTwoSeries(seq, [(s) => fitPoly(s, 1), fitGeom, (s) => fitPoly(s, 2)]);
  },
};

export const diffGeom: Rule = {
  id: 'diffGeom',
  tags: ['zr.diffGeom'],
  complexity: 5,
  generate(rng, o) {
    const r = rng.chance(0.75) ? 2 : 3;
    const t0 = o.neg ? rng.int(-30, 30) : rng.int(1, 40);
    const d0 = rng.int(1, r === 2 ? 6 : 1) * (o.neg && rng.chance(0.4) ? -1 : 1);
    const seq = [t0];
    let d = d0;
    for (let i = 1; i < LEN; i++) {
      seq.push(seq[i - 1] + d);
      d *= r;
    }
    return {
      seq,
      text: `Die Differenzen ${r === 2 ? 'verdoppeln' : 'verdreifachen'} sich: ${sgn(d0)}, ${sgn(d0 * r)}, ${sgn(d0 * r * r)} …`,
      showDiff2: false,
    };
  },
  fit(seq) {
    for (let i = 0; i + 2 < seq.length; i++) {
      const a = seq[i];
      const b = seq[i + 1];
      const c = seq[i + 2];
      if (a === null || b === null || c === null) continue;
      const d1 = b - a;
      const d2 = c - b;
      if (d1 === 0) continue;
      const r = d2 / d1;
      if (r === 0) return [];
      if (r === 1) return fitPoly(seq, 1);
      const vis = visible(seq);
      const p = vis[0];
      const q = vis[1];
      const B = ((seq[p] as number) - (seq[q] as number)) / (r ** p - r ** q);
      const A = (seq[p] as number) - B * r ** p;
      const res = accept(
        seq,
        seq.map((_, j) => A + B * r ** j),
      );
      return res ? [res] : [];
    }
    return [];
  },
};

export const fibonacci: Rule = {
  id: 'fibonacci',
  tags: ['zr.fibonacci'],
  complexity: 6,
  generate(rng, o) {
    const a = o.neg ? rng.int(-10, 15) : rng.int(1, 15);
    const b = o.neg ? rng.int(-5, 15) : rng.int(1, 15);
    const seq = [a, b];
    for (let i = 2; i < LEN; i++) seq.push(seq[i - 1] + seq[i - 2]);
    return { seq, text: 'Jedes Glied ist die Summe der beiden vorigen Glieder.' };
  },
  fit(seq) {
    if (seq[0] === null || seq[1] === null) return [];
    const full = [seq[0], seq[1]];
    for (let i = 2; i < seq.length; i++) full.push(full[i - 1] + full[i - 2]);
    const a = accept(seq, full);
    return a ? [a] : [];
  },
};

/**
 * Steigender Faktor: Multiplikation mit wachsendem Faktor (×1, ×2, ×3 …)
 * im Wechsel mit einer festen Addition. Reine Fakultätsreihen würden mit
 * 8 Gliedern die Zahlengrenze sprengen (siehe README).
 */
export const steigFaktor: Rule = {
  id: 'steigFaktor',
  tags: ['zr.steigFaktor'],
  complexity: 6,
  generate(rng, o) {
    for (;;) {
      const p = rng.int(0, 1);
      const f0 = rng.int(1, 2);
      const c = rng.int(1, 9) * (rng.chance(0.4) ? -1 : 1);
      const t0 = o.neg ? rng.int(-5, 9) : rng.int(1, 9);
      const seq = [t0];
      for (let i = 0; i < LEN - 1; i++) {
        if (i % 2 === p) seq.push(seq[i] * (f0 + (i - p) / 2));
        else seq.push(seq[i] + c);
      }
      if (!o.neg && seq.some((x) => x < 0)) continue;
      const mulTxt = `×${f0}, ×${f0 + 1}, ×${f0 + 2} …`;
      return {
        seq,
        text:
          p === 0
            ? `Im Wechsel: mal steigendem Faktor (${mulTxt}) und ${sgn(c)}.`
            : `Im Wechsel: ${sgn(c)} und mal steigendem Faktor (${mulTxt}).`,
      };
    }
  },
  fit(seq) {
    if (seq[0] === null) return [];
    const out: number[][] = [];
    for (const p of [0, 1]) {
      let f0: number | null = null;
      let c: number | null = null;
      for (let i = 0; i < seq.length - 1; i++) {
        const x = seq[i];
        const y = seq[i + 1];
        if (x === null || y === null) continue;
        if (i % 2 === p) {
          if (f0 === null && x !== 0) {
            const q = y / x;
            if (!isIntish(q)) break;
            f0 = q - (i - p) / 2;
          }
        } else if (c === null) c = y - x;
      }
      if (f0 === null || c === null) continue;
      const full = [seq[0]];
      for (let i = 0; i < seq.length - 1; i++)
        full.push(i % 2 === p ? full[i] * (f0 + (i - p) / 2) : full[i] + c);
      const a = accept(seq, full);
      if (a) out.push(a);
    }
    return dedupe(out);
  },
};

export const mulAdd: Rule = {
  id: 'mulAdd',
  tags: ['zr.mulAdd'],
  complexity: 7,
  equivalent: ['diffGeom'],
  generate(rng, o) {
    for (;;) {
      const q = rng.pick(o.neg ? [2, 2, 3, -2] : [2, 3]);
      const c = rng.int(1, 9) * (rng.chance(0.4) ? -1 : 1);
      const t0 = o.neg ? rng.int(-6, 12) : rng.int(1, 12);
      const seq = [t0];
      if (t0 * q + c === t0) continue; // Fixpunkt ergäbe eine konstante Reihe
      for (let i = 1; i < LEN; i++) seq.push(seq[i - 1] * q + c);
      return {
        seq,
        text: `In jedem Schritt mal ${q}, dann ${sgn(c)}. Gleichwertig: Die Differenzen werden jeweils mit ${q} malgenommen.`,
      };
    }
  },
  fit(seq) {
    if (seq[0] === null) return [];
    const tr: [number, number][] = [];
    for (let i = 0; i < seq.length - 1; i++) {
      const x = seq[i];
      const y = seq[i + 1];
      if (x !== null && y !== null) tr.push([x, y]);
    }
    for (let i = 0; i < tr.length; i++)
      for (let j = i + 1; j < tr.length; j++) {
        if (tr[i][0] === tr[j][0]) continue;
        const q = (tr[j][1] - tr[i][1]) / (tr[j][0] - tr[i][0]);
        if (!isIntish(q)) return [];
        const c = tr[i][1] - q * tr[i][0];
        const full = [seq[0]];
        for (let k = 1; k < seq.length; k++) full.push(full[k - 1] * q + c);
        const a = accept(seq, full);
        return a ? [a] : [];
      }
    return [];
  },
};

export const diffZweiReihen: Rule = {
  id: 'diffZweiReihen',
  tags: ['zr.diffZweiReihen'],
  complexity: 9,
  generate(rng, o) {
    for (;;) {
      const de = rng.chance(0.7) ? subArith(rng, 4, { ...o, big: false }) : subGeom(rng, 4);
      const dd = rng.chance(0.7) ? subArith(rng, 3, { ...o, big: false }) : subGeom(rng, 3);
      if (de.text === dd.text) continue;
      const diffs = interleave(de.seq, dd.seq);
      const t0 = o.neg ? rng.int(-30, 40) : rng.int(1, 40);
      const seq = [t0];
      for (const d of diffs) seq.push(seq[seq.length - 1] + d);
      return {
        seq,
        text: `Die Differenzen bilden zwei verschränkte Reihen: Differenzen 1, 3, 5, 7: ${de.text}; Differenzen 2, 4, 6: ${dd.text}.`,
      };
    }
  },
  fit(seq) {
    if (seq[0] === null) return [];
    const diffs: Seq = [];
    for (let i = 0; i < seq.length - 1; i++) {
      const x = seq[i];
      const y = seq[i + 1];
      diffs.push(x === null || y === null ? null : y - x);
    }
    const [e, o] = subseqs(diffs);
    const sub = [(s: Seq) => fitPoly(s, 1), fitGeom];
    const fe = fitWith(sub, e);
    const fo = fitWith(sub, o);
    const out: number[][] = [];
    for (const a of fe)
      for (const b of fo) {
        const d = interleave(a, b);
        const full = [seq[0]];
        for (const x of d) full.push(full[full.length - 1] + x);
        const r = accept(seq, full);
        if (r) out.push(r);
      }
    return dedupe(out);
  },
};

export const RULES: Rule[] = [
  arith,
  geom,
  diff2,
  wechsel,
  potenz,
  prim,
  zweiReihen,
  diffGeom,
  fibonacci,
  steigFaktor,
  mulAdd,
  zyklus3,
  diffZweiReihen,
  zweiReihenKombi,
];

export const RULE_BY_ID: Record<string, Rule> = Object.fromEntries(RULES.map((r) => [r.id, r]));
