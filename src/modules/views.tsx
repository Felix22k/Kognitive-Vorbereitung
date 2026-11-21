import type { Item } from '../core/types';
import { formatNumber } from '../core/rational';
import type { KrItem } from '../generators/kopfrechnen';
import type { ZrItem } from '../generators/zahlenreihen';
import type { MxItem } from '../generators/matrizen';
import type { FrItem } from '../generators/figurenreihen';
import type { ReactNode } from 'react';
import { FigureSvg } from './FigureSvg';
import { MatrixPrompt, MatrixSolution, SequenceRow, SequenceSolution } from './figureViews';

function KopfrechnenPrompt({ item }: { item: KrItem }) {
  return (
    <div>
      <div className="expr">{item.prompt.text}</div>
      {item.prompt.hint && <div className="hint">{item.prompt.hint}</div>}
    </div>
  );
}

function ZahlenreihenPrompt({ item }: { item: ZrItem }) {
  return (
    <div className="zr" aria-label="Zahlenreihe">
      {item.prompt.terms.map((t, i) => (
        <div key={i} className={'term' + (t === null ? ' missing' : '')}>
          {t === null ? '?' : formatNumber(t)}
        </div>
      ))}
    </div>
  );
}

/** Erkennungshinweise je Regel der Zahlenreihen. */
const ZR_TIPS: Record<string, string[]> = {
  arith: ['Die Differenzen sind alle gleich. Immer zuerst die Differenzen bilden.'],
  geom: [
    'Die Differenzen wachsen stark, aber jedes Glied ist ein festes Vielfaches des vorigen. Teile zwei Nachbarn durcheinander.',
  ],
  diff2: [
    'Die Differenzen sind nicht gleich, steigen aber gleichmäßig. Bilde dann die Differenzen der Differenzen.',
  ],
  potenz: [
    'Zahlen wie 49, 64, 81 oder 125, 216 fallen als Quadrat- bzw. Kubikzahlen auf. Prüfe auch „Quadratzahl plus oder minus 1“.',
    'Bei Quadratzahlen steigen die Differenzen um 2 (ungerade Zahlen: +3, +5, +7 …).',
  ],
  prim: [
    'Keine Rechenregel passt und keine Zahl lässt sich teilen: an Primzahlen denken (2, 3, 5, 7, 11, 13, 17, 19, 23, 29 …).',
  ],
  wechsel: [
    'Die Differenzen springen hin und her. Schau dir jeden zweiten Schritt getrennt an: Wiederholt sich ein Muster aus zwei Rechenschritten?',
  ],
  zyklus3: [
    'Kein Zweier-Muster erkennbar? Dann Dreiergruppen von Schritten prüfen: Schritt 1, 4, 7 und 2, 5 und 3, 6.',
  ],
  zweiReihen: [
    'Die Zahlen springen groß-klein-groß. Lies jedes zweite Glied als eigene Reihe: Glieder 1, 3, 5, 7 und Glieder 2, 4, 6.',
  ],
  zweiReihenKombi: [
    'Erst in zwei Reihen trennen (jedes zweite Glied), dann jede Teilreihe für sich untersuchen, auch mit zweiten Differenzen.',
  ],
  diffGeom: [
    'Die Differenzen verdoppeln oder verdreifachen sich. Wenn die Differenzen selbst eine Malreihe sind, liegt diese Regel vor.',
  ],
  mulAdd: [
    'Die Zahlen wachsen etwa um einen festen Faktor, aber nicht exakt. Prüfe „mal q, dann plus c“: Glied × 2 und schauen, was fehlt.',
  ],
  fibonacci: [
    'Prüfe, ob jedes Glied die Summe der beiden vorigen ist. Wächst ungefähr um den Faktor 1,6.',
  ],
  steigFaktor: [
    'Die Faktoren zwischen den Gliedern steigen (×1, ×2, ×3 …). Dazwischen kann eine feste Addition stehen: Schritte einzeln aufschreiben.',
  ],
  diffZweiReihen: [
    'Die Glieder steigen unregelmäßig. Bilde die Differenzen und lies dann jede zweite Differenz als eigene Reihe.',
  ],
};

const signed = (x: number) => (x < 0 ? `−${formatNumber(-x)}` : `+${formatNumber(x)}`);

function ZahlenreihenSolution({ item }: { item: ZrItem }) {
  const { full, showDiff2, ruleText } = item.prompt.solution;
  const d1 = full.slice(1).map((x, i) => x - full[i]);
  const d2 = d1.slice(1).map((x, i) => x - d1[i]);
  // Raster: Glieder in geraden Spalten, Differenzen dazwischen
  const cols = full.length * 2 - 1;
  return (
    <div>
      <div className="zr-solution" style={{ gridTemplateColumns: `auto repeat(${cols}, auto)` }}>
        <div className="cell lab">Reihe</div>
        {Array.from({ length: cols }, (_, c) =>
          c % 2 === 0 ? (
            <div
              key={c}
              className={'cell t' + (c / 2 === item.prompt.missingIndex ? ' missing' : '')}
            >
              {formatNumber(full[c / 2])}
            </div>
          ) : (
            <div key={c} />
          ),
        )}
        <div className="cell lab">Diff.</div>
        {Array.from({ length: cols }, (_, c) =>
          c % 2 === 1 ? (
            <div key={c} className="cell d1">
              {signed(d1[(c - 1) / 2])}
            </div>
          ) : (
            <div key={c} />
          ),
        )}
        {showDiff2 && (
          <>
            <div className="cell lab">2. Diff.</div>
            {Array.from({ length: cols }, (_, c) =>
              c % 2 === 0 && c > 0 && c < cols - 1 ? (
                <div key={c} className="cell d2">
                  {signed(d2[c / 2 - 1])}
                </div>
              ) : (
                <div key={c} />
              ),
            )}
          </>
        )}
      </div>
      <p style={{ marginTop: 10, marginBottom: 0 }}>
        <strong>Regel:</strong> {ruleText}
      </p>
      {ZR_TIPS[item.prompt.ruleId] && (
        <>
          <div className="sol-head">So erkennst du es</div>
          <ul className="sol-tips">
            {ZR_TIPS[item.prompt.ruleId].map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function PromptView({ item }: { item: Item }) {
  switch (item.moduleId) {
    case 'kopfrechnen':
      return <KopfrechnenPrompt item={item as KrItem} />;
    case 'zahlenreihen':
      return <ZahlenreihenPrompt item={item as ZrItem} />;
    case 'matrizen':
      return <MatrixPrompt item={item as MxItem} />;
    case 'figurenreihen':
      return <SequenceRow item={item as FrItem} />;
    default:
      return <div>Unbekanntes Modul</div>;
  }
}

/** Erklärung nach dem Antworten. */
function KopfrechnenSolution({ item }: { item: KrItem }) {
  const { steps, tips } = item.prompt;
  // Ältere gespeicherte Aufgaben (Version 1) haben nur den Erklärungstext
  if (!steps) return <div style={{ whiteSpace: 'pre-line' }}>{item.explanation}</div>;
  return (
    <div className="solution">
      <div className="sol-head">Rechenweg</div>
      {steps.map((s, i) => (
        <div key={i} className="sol-steps">
          {s}
        </div>
      ))}
      {tips.length > 0 && (
        <>
          <div className="sol-head">So geht's im Kopf</div>
          <ul className="sol-tips">
            {tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function SolutionView({ item }: { item: Item }) {
  if (item.moduleId === 'zahlenreihen') return <ZahlenreihenSolution item={item as ZrItem} />;
  if (item.moduleId === 'kopfrechnen') return <KopfrechnenSolution item={item as KrItem} />;
  if (item.moduleId === 'matrizen') return <MatrixSolution item={item as MxItem} />;
  if (item.moduleId === 'figurenreihen') return <SequenceSolution item={item as FrItem} />;
  return <div style={{ whiteSpace: 'pre-line' }}>{item.explanation}</div>;
}

export interface ChoiceInfo {
  count: number;
  correctIndex: number;
  /** Inhalt einer Option (Text oder Figur) */
  render(i: number): ReactNode;
  /** Text für Protokoll und Auswertung */
  label(i: number): string;
  /** Figuren-Optionen (weißes Feld, größere Kacheln) */
  figures: boolean;
}

/** Antwortoptionen, falls die Aufgabe im Auswahlmodus gezeigt werden kann. */
export function choiceInfo(item: Item): ChoiceInfo | null {
  if (item.moduleId === 'kopfrechnen') {
    const p = (item as KrItem).prompt;
    return {
      count: p.options.length,
      correctIndex: p.correctIndex,
      render: (i) => p.options[i],
      label: (i) => p.options[i],
      figures: false,
    };
  }
  if (item.moduleId === 'matrizen' || item.moduleId === 'figurenreihen') {
    const p = (item as MxItem | FrItem).prompt;
    return {
      count: p.options.length,
      correctIndex: p.correctIndex,
      render: (i) => (
        <FigureSvg panel={p.options[i]} size={item.moduleId === 'matrizen' ? 96 : 88} />
      ),
      label: (i) => 'ABCDEFGH'[i],
      figures: true,
    };
  }
  return null;
}
