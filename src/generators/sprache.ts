/**
 * Sprachmodule: Wortanalogien (6.7), Begriffe vergleichen (6.8),
 * Rechtschreibung (6.9). Inhalte stammen aus den Wortbanken in src/data.
 */
import { createRng } from '../core/rng';
import analogien from '../data/analogien.json';
import begriffe from '../data/begriffe.json';
import rechtschreibung from '../data/rechtschreibung.json';
import { timeForLevel } from './common';
import { byLevel, shuffleWithIndex, tcGenerator, type TcItem, type TcPrompt } from './textChoice';

/* ------------------------------------------------------------------ */
/* Wortanalogien                                                       */
/* ------------------------------------------------------------------ */

export interface WaPaar {
  stufe: number;
  wort: string;
  ziel: string;
  ablenker: string[];
}
export interface WaBeziehung {
  id: string;
  name: string;
  paare: WaPaar[];
}
export const WA_DATA = analogien as { beschreibung: string; beziehungen: WaBeziehung[] };

export interface WaPrompt extends TcPrompt {
  relation: string;
  pairA: number;
  pairC: number;
  twoGaps: boolean;
}

export function generateWortanalogie(seed: number, level: number): TcItem<WaPrompt> {
  const rng = createRng(seed);
  const lvl = Math.max(1, Math.min(10, Math.round(level)));
  const rels = WA_DATA.beziehungen;
  for (let attempt = 0; attempt < 50; attempt++) {
    const rel = rng.pick(rels);
    const targets = rel.paare
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.stufe <= lvl && p.stufe >= lvl - 2);
    if (!targets.length) continue;
    const c = rng.pick(targets);
    const examples = rel.paare
      .map((p, i) => ({ p, i }))
      .filter(({ p, i }) => i !== c.i && p.stufe <= Math.max(3, lvl));
    if (!examples.length) continue;
    const a = rng.pick(examples);
    const twoGaps = lvl >= 8 && rng.chance(0.5);
    let prompt: WaPrompt;
    if (!twoGaps) {
      const { options, correctIndex } = shuffleWithIndex(rng, c.p.ziel, c.p.ablenker);
      prompt = {
        kind: 'analogie',
        question: 'Welches Wort ergänzt die Analogie?',
        stem: `${a.p.wort} : ${a.p.ziel} = ${c.p.wort} : ?`,
        options,
        correctIndex,
        relation: rel.id,
        pairA: a.i,
        pairC: c.i,
        twoGaps,
      };
    } else {
      // ? : B = C : ?  Gesucht ist das Wortpaar (A, D)
      const abA = rng.shuffle(a.p.ablenker);
      const abC = rng.shuffle(c.p.ablenker);
      const correct = `${a.p.wort} · ${c.p.ziel}`;
      const wrong = [
        `${abA[0]} · ${c.p.ziel}`,
        `${a.p.wort} · ${abC[0]}`,
        `${abA[1]} · ${abC[1]}`,
        `${abA[2]} · ${abC[2]}`,
      ];
      const { options, correctIndex } = shuffleWithIndex(rng, correct, wrong);
      prompt = {
        kind: 'analogie2',
        question: 'Welches Wortpaar füllt beide Lücken?',
        stem: `? : ${a.p.ziel} = ${c.p.wort} : ?`,
        options,
        correctIndex,
        relation: rel.id,
        pairA: a.i,
        pairC: c.i,
        twoGaps,
      };
    }
    if (new Set(prompt.options).size !== prompt.options.length) continue;
    const explanation =
      `Beziehung: ${rel.name}.\n` +
      `${a.p.wort} : ${a.p.ziel} genauso wie ${c.p.wort} : ${c.p.ziel}.\n` +
      `Tipp: Formuliere die Beziehung des vollständigen Paars als Satz und setze das zweite Paar ein.`;
    return {
      id: `wortanalogien-${seed}-${lvl}`,
      moduleId: 'wortanalogien',
      generatorId: 'wortanalogien',
      generatorVersion: 1,
      seed,
      level: lvl,
      tags: ['wa.' + rel.id],
      prompt,
      correct: prompt.correctIndex,
      correctLabel: prompt.options[prompt.correctIndex],
      explanation,
      timeLimitMs: timeForLevel(lvl, 30, 45),
      answerKind: 'choice',
    };
  }
  throw new Error(`Wortanalogien: keine Aufgabe für Stufe ${lvl}`);
}

export const wortanalogienGenerator = tcGenerator<WaPrompt>(
  'wortanalogien',
  1,
  generateWortanalogie,
  (it) =>
    `${it.prompt.relation}:${it.prompt.pairA}:${it.prompt.pairC}:${it.prompt.twoGaps ? 2 : 1}`,
  (it) => {
    const errs: string[] = [];
    const rel = WA_DATA.beziehungen.find((r) => r.id === it.prompt.relation);
    if (!rel) return ['Beziehung unbekannt'];
    const c = rel.paare[it.prompt.pairC];
    const a = rel.paare[it.prompt.pairA];
    const expect = it.prompt.twoGaps ? `${a.wort} · ${c.ziel}` : c.ziel;
    if (it.correctLabel !== expect) errs.push('Lösung passt nicht zur Wortbank');
    return errs;
  },
);

/* ------------------------------------------------------------------ */
/* Begriffe vergleichen                                                */
/* ------------------------------------------------------------------ */

export interface BvKategorie {
  gruppe: string;
  name: string;
  stufe: number;
  woerter: string[];
}
export const BV_DATA = begriffe as { beschreibung: string; kategorien: BvKategorie[] };

export interface BvPrompt extends TcPrompt {
  kind: 'passtNicht' | 'oberbegriff' | 'gemeinsamkeit';
  category: string;
  other?: string;
}

/** Ablenker-Kategorien: ab Stufe 6 bevorzugt aus derselben Gruppe (ähnliche Begriffe). */
function otherCats(rng: ReturnType<typeof createRng>, cat: BvKategorie, lvl: number, n: number) {
  const all = BV_DATA.kategorien.filter((k) => k.name !== cat.name);
  const same = all.filter((k) => k.gruppe === cat.gruppe);
  const diff = all.filter((k) => k.gruppe !== cat.gruppe && k.stufe <= Math.max(lvl, 4));
  const pool = lvl >= 6 ? [...rng.shuffle(same), ...rng.shuffle(diff)] : rng.shuffle(diff);
  return pool.slice(0, n);
}

export function generateBegriffe(seed: number, level: number): TcItem<BvPrompt> {
  const rng = createRng(seed);
  const lvl = Math.max(1, Math.min(10, Math.round(level)));
  const kinds: BvPrompt['kind'][] =
    lvl <= 2
      ? ['passtNicht', 'oberbegriff']
      : lvl <= 4
        ? ['passtNicht', 'oberbegriff', 'gemeinsamkeit']
        : ['passtNicht', 'passtNicht', 'oberbegriff', 'gemeinsamkeit'];
  const kind = rng.pick(kinds);
  const cands = BV_DATA.kategorien.filter((k) => k.stufe <= lvl && k.stufe >= lvl - 4);
  const pool = cands.length ? cands : BV_DATA.kategorien.filter((k) => k.stufe <= lvl);
  const cat = rng.pick(pool.length ? pool : BV_DATA.kategorien);
  let prompt: BvPrompt;
  let explanation: string;
  if (kind === 'passtNicht') {
    const [other] = otherCats(rng, cat, lvl, 1);
    const four = rng.shuffle(cat.woerter).slice(0, 4);
    const odd = rng.pick(other.woerter);
    const options = rng.shuffle([...four, odd]);
    prompt = {
      kind,
      question: 'Welcher Begriff passt nicht zu den anderen?',
      options,
      correctIndex: options.indexOf(odd),
      category: cat.name,
      other: other.name,
    };
    explanation = `${four.join(', ')} gehören zur Kategorie „${cat.name}“. ${odd} gehört zu „${other.name}“.`;
  } else {
    const n = kind === 'oberbegriff' ? 4 : 2;
    const words = rng.shuffle(cat.woerter).slice(0, n);
    const others = otherCats(rng, cat, lvl, 3).map((k) => k.name);
    const { options, correctIndex } = shuffleWithIndex(rng, cat.name, others);
    prompt = {
      kind,
      question:
        kind === 'oberbegriff'
          ? 'Welcher Oberbegriff passt zu allen vier Wörtern?'
          : 'Was haben die beiden Begriffe gemeinsam? Sie sind beide …',
      words,
      options,
      correctIndex,
      category: cat.name,
    };
    explanation =
      n > 2
        ? `${words.join(', ')} sind alle ${cat.name}.`
        : `${words.join(' und ')} sind beide ${cat.name}.`;
    if (lvl >= 6)
      explanation +=
        ' Achte auf ähnliche Nachbarbegriffe: Nur eine Kategorie umfasst alle genannten Wörter.';
  }
  return {
    id: `begriffe-${seed}-${lvl}`,
    moduleId: 'begriffe',
    generatorId: 'begriffe',
    generatorVersion: 1,
    seed,
    level: lvl,
    tags: [
      kind === 'passtNicht'
        ? 'bv.passtNicht'
        : kind === 'oberbegriff'
          ? 'bv.oberbegriff'
          : 'bv.gemeinsamkeit',
    ],
    prompt,
    correct: prompt.correctIndex,
    correctLabel: prompt.options[prompt.correctIndex],
    explanation,
    timeLimitMs: timeForLevel(lvl, 20, 40),
    answerKind: 'choice',
  };
}

function catOf(word: string): BvKategorie | undefined {
  return BV_DATA.kategorien.find((k) => k.woerter.includes(word));
}

export const begriffeGenerator = tcGenerator<BvPrompt>(
  'begriffe',
  1,
  generateBegriffe,
  (it) => `${it.prompt.kind}:${[...(it.prompt.words ?? it.prompt.options)].sort().join(',')}`,
  (it) => {
    const p = it.prompt;
    const errs: string[] = [];
    if (p.kind === 'passtNicht') {
      const cats = p.options.map((w) => catOf(w)?.name);
      const odd = cats.filter((c) => c !== p.category);
      if (odd.length !== 1 || cats[p.correctIndex] === p.category)
        errs.push('nicht genau ein abweichender Begriff');
    } else {
      for (const w of p.words ?? []) if (catOf(w)?.name !== p.category) errs.push('Wort falsch');
      const hits = p.options.filter((o) =>
        (p.words ?? []).every((w) =>
          BV_DATA.kategorien.find((k) => k.name === o)?.woerter.includes(w),
        ),
      );
      if (hits.length !== 1) errs.push('Oberbegriff nicht eindeutig');
    }
    return errs;
  },
);

/* ------------------------------------------------------------------ */
/* Rechtschreibung                                                     */
/* ------------------------------------------------------------------ */

export type RsEintrag =
  | { id: string; typ: 'wort'; stufe: number; richtig: string; falsch: string[]; hinweis: string }
  | { id: string; typ: 'dasDass'; stufe: number; satz: string; loesung: string[] }
  | {
      id: string;
      typ: 'verwechslung';
      stufe: number;
      satz: string;
      richtig: string;
      falsch: string[];
      hinweis: string;
    }
  | {
      id: string;
      typ: 'gross' | 'getrennt';
      stufe: number;
      richtig: string;
      falsch: string[];
      hinweis: string;
    };

export const RS_DATA = rechtschreibung as { beschreibung: string; eintraege: RsEintrag[] };

export interface RsPrompt extends TcPrompt {
  typ: RsEintrag['typ'];
  /** wort: 'richtig' (welches ist richtig) oder 'falsch' (welches ist falsch) */
  variant?: 'richtig' | 'falsch';
}

const RS_TAG: Record<RsEintrag['typ'], string> = {
  wort: 'rs.wort',
  dasDass: 'rs.dasDass',
  verwechslung: 'rs.verwechslung',
  gross: 'rs.gross',
  getrennt: 'rs.getrennt',
};

/** Lücken nummerieren, wenn es mehrere gibt. */
function gapText(satz: string, n: number): string {
  if (n === 1) return satz.replace('___', '___');
  let k = 0;
  return satz.replace(/___/g, () => `___(${++k})`);
}

export function generateRechtschreibung(seed: number, level: number): TcItem<RsPrompt> {
  const rng = createRng(seed);
  const lvl = Math.max(1, Math.min(10, Math.round(level)));
  const typen: RsEintrag['typ'][] = ['wort', 'wort', 'dasDass', 'verwechslung', 'gross'];
  if (lvl >= 6) typen.push('getrennt', 'getrennt');
  const typ = rng.pick(typen);
  const ofType = RS_DATA.eintraege.filter((e) => e.typ === typ);
  const e = rng.pick(byLevel(ofType, Math.max(lvl, 2), 2));
  let prompt: RsPrompt;
  let explanation: string;
  let timeS: [number, number] = [20, 14];
  if (e.typ === 'wort') {
    timeS = [15, 10];
    const invert = lvl >= 5 && rng.chance(0.4);
    if (!invert) {
      const { options, correctIndex } = shuffleWithIndex(rng, e.richtig, e.falsch);
      prompt = {
        kind: 'wort',
        typ: e.typ,
        variant: 'richtig',
        question: 'Welche Schreibweise ist richtig?',
        options,
        correctIndex,
        bankId: e.id,
      };
      explanation = `Richtig: ${e.richtig}.${e.hinweis ? ' ' + e.hinweis : ''}`;
    } else {
      // Drei richtig geschriebene Wörter aus anderen Einträgen, ein falsches aus diesem
      const others = rng
        .shuffle(
          RS_DATA.eintraege.filter(
            (x): x is Extract<RsEintrag, { typ: 'wort' }> =>
              x.typ === 'wort' && x.id !== e.id && Math.abs(x.stufe - e.stufe) <= 3,
          ),
        )
        .slice(0, 3)
        .map((x) => x.richtig);
      const wrong = rng.pick(e.falsch);
      const options = rng.shuffle([...others, wrong]);
      prompt = {
        kind: 'wort',
        typ: e.typ,
        variant: 'falsch',
        question: 'Welches Wort ist FALSCH geschrieben?',
        options,
        correctIndex: options.indexOf(wrong),
        bankId: e.id,
      };
      explanation = `Falsch ist „${wrong}“, richtig wäre ${e.richtig}.${e.hinweis ? ' ' + e.hinweis : ''}`;
    }
  } else if (e.typ === 'dasDass') {
    const n = e.loesung.length;
    const cap = (w: string, i: number) => {
      // Lücke am Satzanfang: großes D
      const idx = nthGap(e.satz, i);
      return idx === 0 ? w[0].toUpperCase() + w.slice(1) : w.toLowerCase();
    };
    const label = (combo: string[]) =>
      n === 1 ? cap(combo[0], 0) : combo.map((w, i) => `(${i + 1}) ${cap(w, i)}`).join('  ');
    const correctCombo = e.loesung.map((w) => w.toLowerCase());
    const combos: string[][] = [];
    for (let m = 0; m < 1 << n; m++)
      combos.push(Array.from({ length: n }, (_, i) => ((m >> i) & 1 ? 'dass' : 'das')));
    const wrongCombos = rng
      .shuffle(combos.filter((c) => c.join() !== correctCombo.join()))
      .slice(0, 3);
    const { options, correctIndex } = shuffleWithIndex(
      rng,
      label(correctCombo),
      wrongCombos.map(label),
    );
    prompt = {
      kind: 'dasDass',
      typ: e.typ,
      question: n === 1 ? 'Was gehört in die Lücke?' : 'Was gehört in die Lücken?',
      stem: gapText(e.satz, n),
      options,
      correctIndex,
      bankId: e.id,
    };
    explanation =
      `Richtig: ${label(correctCombo)}.\n` +
      'Ersatzprobe: Lässt sich „dieses“, „jenes“ oder „welches“ einsetzen, schreibt man „das“ (Artikel oder Relativpronomen). Sonst ist es die Konjunktion „dass“, die einen Nebensatz einleitet.';
  } else if (e.typ === 'verwechslung') {
    timeS = [15, 10];
    const { options, correctIndex } = shuffleWithIndex(rng, e.richtig, e.falsch);
    prompt = {
      kind: 'verwechslung',
      typ: e.typ,
      question: 'Welches Wort gehört in die Lücke?',
      stem: e.satz,
      options,
      correctIndex,
      bankId: e.id,
    };
    explanation = `Richtig: ${e.satz.replace('___', e.richtig)}${e.hinweis ? '\n' + e.hinweis : ''}`;
  } else {
    const { options, correctIndex } = shuffleWithIndex(rng, e.richtig, e.falsch);
    prompt = {
      kind: e.typ,
      typ: e.typ,
      question: 'Welcher Satz ist richtig geschrieben?',
      options,
      correctIndex,
      bankId: e.id,
    };
    explanation = `Richtig: ${e.richtig}\n${e.hinweis}`;
  }
  return {
    id: `rechtschreibung-${seed}-${lvl}`,
    moduleId: 'rechtschreibung',
    generatorId: 'rechtschreibung',
    generatorVersion: 1,
    seed,
    level: lvl,
    tags: [RS_TAG[e.typ]],
    prompt,
    correct: prompt.correctIndex,
    correctLabel: prompt.options[prompt.correctIndex],
    explanation,
    timeLimitMs: timeForLevel(lvl, timeS[0], timeS[1]),
    answerKind: 'choice',
  };
}

/** Zeichenposition der i-ten Lücke (0, wenn sie am Satzanfang steht). */
function nthGap(satz: string, i: number): number {
  let pos = -1;
  for (let k = 0; k <= i; k++) pos = satz.indexOf('___', pos + 1);
  return pos;
}

export const rechtschreibungGenerator = tcGenerator<RsPrompt>(
  'rechtschreibung',
  1,
  generateRechtschreibung,
  (it) =>
    `${it.prompt.bankId}:${it.prompt.variant ?? ''}:${it.prompt.variant === 'falsch' ? it.correctLabel : ''}`,
);
