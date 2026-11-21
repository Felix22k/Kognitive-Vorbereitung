/**
 * Kopfrechen-Strategien für die Erklärungen: Zerlegen, Runden und
 * Ausgleichen, Dreisatz, Bausteine bei Prozent, Fallen.
 * Alle Funktionen sind rein und hängen nur von den Zahlen der Aufgabe ab.
 */
import {
  formatNumber as f,
  formatRational,
  gcd,
  lcm,
  mul,
  rat,
  type Rational,
} from '../core/rational';

const fr = (x: Rational) => formatRational(x, true);

/** Stellenwerte einer positiven ganzen Zahl, z. B. 274 → [200, 70, 4] (ohne Nullen). */
function placeParts(n: number): number[] {
  const out: number[] = [];
  let p = 1;
  while (p * 10 <= n) p *= 10;
  let rest = n;
  for (; p >= 1; p /= 10) {
    const part = Math.floor(rest / p) * p;
    if (part) out.push(part);
    rest -= part;
  }
  return out;
}

function chain(start: number, parts: number[], op: '+' | '−'): string {
  let cur = start;
  const steps: string[] = [];
  for (const p of parts) {
    const next = op === '+' ? cur + p : cur - p;
    steps.push(`${f(cur)} ${op} ${f(p)} = ${f(next)}`);
    cur = next;
  }
  return steps.join(', ');
}

export function tipsAdd(a: number, b: number): string[] {
  const [x, y] = a >= b ? [a, b] : [b, a];
  const tips = [
    `Zerlegen: die kleinere Zahl stellenweise dazuzählen: ${chain(x, placeParts(y), '+')}.`,
  ];
  // Runden und ausgleichen mit dem Summanden, der knapp unter einem Zehner liegt
  const n = [a, b].filter((v) => v % 10 >= 7).sort((p, q) => (q % 10) - (p % 10))[0];
  if (n !== undefined) {
    const o = n === a ? b : a;
    const up = n + (10 - (n % 10));
    tips.push(
      `Runden und ausgleichen: ${f(n)} ist fast ${f(up)}. ${f(o)} + ${f(up)} = ${f(o + up)}, dann ${up - n} zurück: ${f(a + b)}.`,
    );
  }
  return tips;
}

export function tipsSub(a: number, b: number): string[] {
  const tips = [`Schrittweise abziehen: ${chain(a, placeParts(b), '−')}.`];
  const e = b % 10;
  if (e >= 7) {
    const up = b + (10 - e);
    tips.push(
      `Runden und ausgleichen: ${f(b)} ist fast ${f(up)}. ${f(a)} − ${f(up)} = ${f(a - up)}, dann ${10 - e} wieder dazu: ${f(a - b)}.`,
    );
  }
  tips.push(`Probe durch Ergänzen: ${f(b)} + ${f(a - b)} = ${f(a)}.`);
  return tips;
}

export function tipsMul(a: number, b: number): string[] {
  const [x, y] = a >= b ? [a, b] : [b, a];
  const tips: string[] = [];
  const res = a * b;
  if (x % 10 === 0 || y % 10 === 0) {
    const [z, o] = x % 10 === 0 ? [x, y] : [y, x];
    const zeros = String(z).match(/0+$/)?.[0].length ?? 0;
    const core = z / 10 ** zeros;
    const null_ = zeros === 1 ? 'eine Null' : `${zeros} Nullen`;
    return [
      core === 1
        ? `Mal ${f(z)}: ${null_} anhängen: ${f(res)}.`
        : `Nullen abtrennen: ${f(core)} × ${f(o)} = ${f(core * o)}, dann ${null_} anhängen: ${f(res)}.`,
    ];
  }
  // Binomischer Trick: beide Zahlen gleich weit von einer runden Zahl entfernt
  if ((a + b) % 2 === 0 && a !== b) {
    const m = (a + b) / 2;
    const d = Math.abs(a - b) / 2;
    if (m % 10 === 0 && d <= 5)
      tips.push(
        `Trick: Beide liegen ${d} um ${m} herum. ${f(x)} × ${f(y)} = ${m}² − ${d}² = ${f(m * m)} − ${d * d} = ${f(res)}.`,
      );
  }
  if (y === 5 || x === 5) {
    const o = y === 5 ? x : y;
    tips.push(`Mal 5 = mal 10 und halbieren: ${f(o)} × 10 = ${f(o * 10)}, halbiert ${f(res)}.`);
  } else if (y === 25 || x === 25) {
    const o = y === 25 ? x : y;
    tips.push(`Mal 25 = mal 100 und durch 4: ${f(o)} × 100 = ${f(o * 100)}, : 4 = ${f(res)}.`);
  } else if (y === 11 || x === 11) {
    const o = y === 11 ? x : y;
    tips.push(`Mal 11 = mal 10 plus einmal: ${f(o * 10)} + ${f(o)} = ${f(res)}.`);
  } else if ((x % 10 === 9 && x >= 19) || (y % 10 === 9 && y >= 19)) {
    const n = x % 10 === 9 && x >= 19 ? x : y;
    const o = n === x ? y : x;
    tips.push(
      `Runden und ausgleichen: ${f(n)} ist fast ${f(n + 1)}. ${f(n + 1)} × ${f(o)} = ${f((n + 1) * o)}, dann einmal ${f(o)} weg: ${f(res)}.`,
    );
  }
  if (x >= 11 && x % 10 !== 0) {
    const t = x - (x % 10);
    const e = x % 10;
    const tz = t >= 20 ? ` (${f(t / 10)} × ${f(y)} = ${f((t / 10) * y)}, eine Null anhängen)` : '';
    tips.push(
      `Zerlegen: ${f(x)} × ${f(y)} = ${f(t)} × ${f(y)} + ${e} × ${f(y)} = ${f(t * y)} + ${f(e * y)} = ${f(res)}${tz}.`,
    );
  } else if (x <= 9 && x >= 6 && y >= 3) {
    tips.push(
      `Vom Fünfer aus: ${x} × ${y} = 5 × ${y} + ${x - 5} × ${y} = ${5 * y} + ${(x - 5) * y} = ${res}. Das kleine Einmaleins muss ohne Nachdenken sitzen.`,
    );
  }
  if (!tips.length)
    tips.push(`Tauschaufgabe nutzen: ${f(y)} × ${f(x)} ist oft leichter zu rechnen.`);
  return tips;
}

export function tipsDiv(n: number, b: number): string[] {
  const q = n / b;
  const tips = [
    `Umkehraufgabe: Welche Zahl mal ${f(b)} ergibt ${f(n)}? ${f(b)} × ${f(q)} = ${f(n)}.`,
  ];
  if (q >= 12 && q % 10 !== 0) {
    const t = q - (q % 10);
    tips.push(
      `Zerlegen in leicht teilbare Teile: ${f(n)} = ${f(b * t)} + ${f(b * (q % 10))}. ${f(b * t)} : ${f(b)} = ${f(t)}, ${f(b * (q % 10))} : ${f(b)} = ${f(q % 10)}, zusammen ${f(q)}.`,
    );
  }
  if (b === 4) tips.push(`Durch 4 = zweimal halbieren: ${f(n)} → ${f(n / 2)} → ${f(q)}.`);
  if (b === 8)
    tips.push(`Durch 8 = dreimal halbieren: ${f(n)} → ${f(n / 2)} → ${f(n / 4)} → ${f(q)}.`);
  if (b === 5) tips.push(`Durch 5 = verdoppeln und durch 10: ${f(n * 2)} : 10 = ${f(q)}.`);
  return tips;
}

export function tipsOrder(invertedLabel: string | null, mixed: boolean): string[] {
  const tips = [
    'Reihenfolge: zuerst Klammern, dann Punktrechnung (× und :), zuletzt Strichrechnung (+ und −) von links nach rechts.',
  ];
  if (invertedLabel)
    tips.push(`Falle: Wer Strich vor Punkt rechnet, kommt auf ${invertedLabel}. Das ist falsch.`);
  if (mixed)
    tips.push(
      'Brüche und Dezimalzahlen nicht mischen: umwandeln (0,5 = 1/2, 0,25 = 1/4, 0,2 = 1/5, 0,75 = 3/4). Bruch mal Zahl: erst durch den Nenner teilen, dann mal den Zähler.',
    );
  return tips;
}

/** Bausteine für Prozentsätze, z. B. 15 % = 10 % + 5 %. */
function prozentBaustein(p: number, g: number): string | null {
  const v = (q: number) => f((g * q) / 100);
  switch (p) {
    case 50:
      return `50 % ist die Hälfte: ${f(g)} : 2 = ${v(50)}.`;
    case 25:
      return `25 % ist ein Viertel, also zweimal halbieren: ${f(g)} → ${v(50)} → ${v(25)}.`;
    case 75:
      return `75 % sind drei Viertel: ein Viertel ist ${v(25)}, mal 3 = ${v(75)}.`;
    case 20:
      return `20 % ist ein Fünftel: ${f(g)} : 5 = ${v(20)}.`;
    case 10:
      return `10 %: Komma eine Stelle nach links: ${v(10)}.`;
    case 5:
      return `5 % ist die Hälfte von 10 %: 10 % = ${v(10)}, halbiert ${v(5)}.`;
    case 15:
      return `15 % = 10 % + 5 % = ${v(10)} + ${v(5)} = ${v(15)}.`;
    case 12:
      return `12 % = 10 % + 2 × 1 % = ${v(10)} + ${v(2)} = ${v(12)}.`;
    case 35:
      return `35 % = 25 % + 10 % = ${v(25)} + ${v(10)} = ${v(35)}.`;
    case 60:
      return `60 % = 50 % + 10 % = ${v(50)} + ${v(10)} = ${v(60)}.`;
    case 80:
      return `80 % = 100 % − 20 % = ${f(g)} − ${v(20)} = ${v(80)}.`;
    case 30:
    case 40:
      return `${p} % = ${p / 10} × 10 % = ${p / 10} × ${v(10)} = ${v(p)}.`;
    default:
      return null;
  }
}

export function tipsProzent(p: number, g: number): string[] {
  const w = (g * p) / 100;
  const base = p % 10 === 0 ? 10 : p % 5 === 0 ? 5 : 1;
  const bv = (g * base) / 100;
  const dreisatz =
    `Dreisatz: 100 % ≙ ${f(g)} | : ${100 / base} → ${base} % ≙ ${f(bv)}` +
    (p === base ? '' : ` | × ${p / base} → ${p} % ≙ ${f(w)}`) +
    '.';
  const tips = [dreisatz];
  const b = prozentBaustein(p, g);
  if (b) tips.push(`Bausteine: ${b}`);
  return tips;
}

export function tipsProzentRueck(w: number, p: number): string[] {
  const g = (w * 100) / p;
  const tips: string[] = [];
  const base = p % 10 === 0 ? 10 : p % 5 === 0 ? 5 : 1;
  const bv = (w * base) / p;
  tips.push(
    `Dreisatz: ${p} % ≙ ${f(w)}` +
      (p === base ? '' : ` | : ${p / base} → ${base} % ≙ ${f(bv)}`) +
      ` | × ${100 / base} → 100 % ≙ ${f(g)}.`,
  );
  if (100 % p === 0 && p !== base)
    tips.push(
      `Abkürzung: ${p} % ist der ${100 / p}. Teil vom Ganzen, also ${f(w)} × ${100 / p} = ${f(g)}.`,
    );
  tips.push(
    `Falle: Gesucht ist das Ganze (100 %), nicht ${p} % von ${f(w)}. Das Ergebnis muss ${p < 100 ? 'größer' : 'kleiner'} als ${f(w)} sein.`,
  );
  return tips;
}

const SMALL_PRIMES = [2, 3, 5, 7, 11, 13];

export function tipsKuerzen(n: number, d: number): string[] {
  const g = gcd(n, d);
  const steps: string[] = [];
  let a = n;
  let b = d;
  for (const p of SMALL_PRIMES) {
    while (a % p === 0 && b % p === 0) {
      a /= p;
      b /= p;
      steps.push(`: ${p} → ${a}/${b}`);
    }
  }
  const tips = [
    `Größter gemeinsamer Teiler von ${n} und ${d} ist ${g}: ${n} : ${g} = ${n / g}, ${d} : ${g} = ${d / g}.`,
  ];
  if (steps.length > 1)
    tips.push(`Siehst du den ggT nicht sofort, kürze schrittweise: ${n}/${d} ${steps.join(' ')}.`);
  tips.push(
    'Fertig ist der Bruch erst, wenn Zähler und Nenner keinen gemeinsamen Teiler mehr haben.',
  );
  return tips;
}

export function tipsBruchAddSub(a: Rational, b: Rational, op: '+' | '-'): string[] {
  const hn = lcm(a.d, b.d);
  const opT = op === '+' ? '+' : '−';
  const tips = [
    `Hauptnenner = kleinstes gemeinsames Vielfaches der Nenner: kgV(${a.d}, ${b.d}) = ${hn}. Tipp: Vielfache des größeren Nenners durchgehen, bis der kleinere hineinpasst.`,
    `Erweitern: ${a.n}/${a.d} = ${(a.n * hn) / a.d}/${hn}, ${b.n}/${b.d} = ${(b.n * hn) / b.d}/${hn}. Dann nur die Zähler rechnen, am Ende kürzen.`,
  ];
  if (op === '+')
    tips.push(
      `Falle: Zähler plus Zähler und Nenner plus Nenner (${a.n + b.n}/${a.d + b.d}) ist immer falsch.`,
    );
  else
    tips.push(
      `Ergebnis: ${(a.n * hn) / a.d} ${opT} ${(b.n * hn) / b.d} = ${(a.n * hn) / a.d - (b.n * hn) / b.d} im Zähler.`,
    );
  return tips;
}

export function tipsBruchMul(a: Rational, b: Rational): string[] {
  const tips = ['Zähler mal Zähler, Nenner mal Nenner.'];
  const g1 = gcd(a.n, b.d);
  const g2 = gcd(b.n, a.d);
  if (g1 > 1 || g2 > 1)
    tips.push(
      `Vorher über Kreuz kürzen spart Arbeit: ${[g1 > 1 ? `${a.n} und ${b.d} durch ${g1}` : '', g2 > 1 ? `${b.n} und ${a.d} durch ${g2}` : ''].filter(Boolean).join(', ')}.`,
    );
  return tips;
}

export function tipsBruchDiv(a: Rational, b: Rational): string[] {
  return [
    `Durch einen Bruch teilen heißt mit dem Kehrwert malnehmen: ${b.n}/${b.d} wird zu ${b.d}/${b.n}.`,
    `${a.n}/${a.d} × ${b.d}/${b.n} = ${fr(mul(a, rat(b.d, b.n)))}.`,
    'Überschlag: Wer durch etwas Kleineres als 1 teilt, bekommt ein größeres Ergebnis.',
  ];
}

export function tipsBruchVon(n: number, d: number, g: number): string[] {
  const one = g / d;
  return [
    `Dreisatz: ${d}/${d} ≙ ${f(g)} | : ${d} → 1/${d} ≙ ${f(one)} | × ${n} → ${n}/${d} ≙ ${f(one * n)}.`,
    'Merksatz: erst durch den Nenner teilen, dann mit dem Zähler malnehmen. So bleiben die Zahlen klein.',
  ];
}

const SQUARE_END: Record<number, number[]> = {
  0: [0],
  1: [1, 9],
  4: [2, 8],
  9: [3, 7],
  6: [4, 6],
  5: [5],
};
const CUBE_END: Record<number, number> = {
  0: 0,
  1: 1,
  8: 2,
  7: 3,
  4: 4,
  5: 5,
  6: 6,
  3: 7,
  2: 8,
  9: 9,
};

export function tipsWurzel(n: number, cube: boolean): string[] {
  if (cube) {
    const v = n ** 3;
    return [
      `Endziffer verrät die Wurzel: ${f(v)} endet auf ${v % 10}, und nur Zahlen mit Endziffer ${CUBE_END[v % 10]} ergeben das. Also ${n}.`,
      'Kubikzahlen auswendig: 8, 27, 64, 125, 216, 343, 512, 729, 1000.',
    ];
  }
  const v = n * n;
  const tips: string[] = [];
  if (n > 10) {
    const lo = Math.floor(n / 10) * 10;
    const hi = lo + 10;
    if (n % 10 !== 0) {
      tips.push(
        `Eingrenzen: ${lo}² = ${f(lo * lo)} und ${hi}² = ${f(hi * hi)}, also liegt die Wurzel zwischen ${lo} und ${hi}.`,
      );
      const ends = SQUARE_END[v % 10];
      tips.push(
        `Endziffer: ${f(v)} endet auf ${v % 10}, das geht nur mit ${ends.join(' oder ')} am Ende. ${ends.length > 1 ? `Kandidaten ${ends.map((e) => lo + e).join(' und ')}, ` : ''}Probe: ${n} × ${n} = ${f(v)}.`,
      );
    }
  }
  tips.push('Quadratzahlen bis 25² auswendig zu können, spart im Test viel Zeit.');
  return tips;
}

export function tipsRechteck(a: number, b: number): string[] {
  return [
    'Fläche Rechteck = Länge × Breite.',
    ...tipsMul(a, b).slice(0, 1),
    `Falle: 2 × (a + b) = ${2 * (a + b)} ist der Umfang, nicht die Fläche.`,
  ];
}

export function tipsDreieck(g: number, h: number): string[] {
  const tips = ['Ein Dreieck ist ein halbes Rechteck: g × h, dann halbieren.'];
  if (g % 2 === 0)
    tips.push(
      `Leichter: die gerade Zahl zuerst halbieren: ${g} : 2 = ${g / 2}, × ${h} = ${f((g / 2) * h)}.`,
    );
  else if (h % 2 === 0)
    tips.push(
      `Leichter: die gerade Zahl zuerst halbieren: ${h} : 2 = ${h / 2}, × ${g} = ${f((h / 2) * g)}.`,
    );
  tips.push(`Falle: Ohne „: 2“ kommt ${g * h} heraus.`);
  return tips;
}

export function tipsTrapez(a: number, c: number, h: number): string[] {
  const m = (a + c) / 2;
  return [
    `Mittellinie: (a + c) : 2 = (${a} + ${c}) : 2 = ${f(m)}. Dann Mittellinie × Höhe = ${f(m)} × ${h} = ${f(m * h)}.`,
    'Merkbild: Das Trapez ist ein Rechteck mit der Mittellinie als Länge.',
  ];
}

export function tipsKreis(rad: number): string[] {
  const r2 = rad * rad;
  return [
    `Erst r² = ${r2}, dann 3,14 zerlegen: 3 × ${r2} = ${3 * r2}, 0,14 × ${r2} = ${f(0.14 * r2)}, zusammen ${f(3.14 * r2)}.`,
    `Fallen: Durchmesser statt Radius nehmen, oder 2 × π × r rechnen (das ist der Umfang: ${f(2 * 3.14 * rad)}).`,
  ];
}

function decimals(x: Rational): number {
  let k = 0;
  while ((x.n * 10 ** k) % x.d !== 0 && k < 6) k++;
  return k;
}

export function tipsDezimalAddSub(a: Rational, b: Rational, op: '+' | '-'): string[] {
  const k = Math.max(decimals(a), decimals(b));
  const s = 10 ** k;
  const ai = Math.round((a.n * s) / a.d);
  const bi = Math.round((b.n * s) / b.d);
  const res = op === '+' ? ai + bi : ai - bi;
  return [
    `Komma unter Komma: beide auf ${k} Nachkommastellen bringen (${(ai / s).toFixed(k).replace('.', ',')} und ${(bi / s).toFixed(k).replace('.', ',')}).`,
    `Dann ohne Komma rechnen: ${ai} ${op === '+' ? '+' : '−'} ${bi} = ${res}, Komma ${k} Stellen von rechts setzen: ${f(res / s)}.`,
  ];
}

export function tipsDezimalMul(a: Rational, b: Rational): string[] {
  const ka = decimals(a);
  const kb = decimals(b);
  const ai = Math.round((a.n * 10 ** ka) / a.d);
  const bi = Math.round((b.n * 10 ** kb) / b.d);
  const k = ka + kb;
  const res = (ai * bi) / 10 ** k;
  return [
    `Komma erst weglassen: ${ai} × ${bi} = ${ai * bi}.`,
    `Das Ergebnis bekommt so viele Nachkommastellen wie beide Faktoren zusammen (${k}): ${f(res)}.`,
  ];
}

export function tipsDezimalDiv(a: Rational, b: Rational): string[] {
  const kb = decimals(b);
  const s = 10 ** kb;
  const an = (a.n * s) / a.d;
  const bn = (b.n * s) / b.d;
  return [
    `Beide Zahlen mit ${s} malnehmen, bis der Teiler ganz ist: ${formatRational(a)} : ${formatRational(b)} = ${f(an)} : ${f(bn)} = ${f(an / bn)}.`,
    'Das Ergebnis ändert sich dabei nicht, weil beide Zahlen gleich stark vergrößert werden.',
  ];
}
