import type { Item } from '../core/types';
import { formatNumber } from '../core/rational';
import type { KrItem } from '../generators/kopfrechnen';
import type { ZrItem } from '../generators/zahlenreihen';

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
    </div>
  );
}

export function PromptView({ item }: { item: Item }) {
  switch (item.moduleId) {
    case 'kopfrechnen':
      return <KopfrechnenPrompt item={item as KrItem} />;
    case 'zahlenreihen':
      return <ZahlenreihenPrompt item={item as ZrItem} />;
    default:
      return <div>Unbekanntes Modul</div>;
  }
}

/** Erklärung nach dem Antworten. */
export function SolutionView({ item }: { item: Item }) {
  if (item.moduleId === 'zahlenreihen') return <ZahlenreihenSolution item={item as ZrItem} />;
  return <div style={{ whiteSpace: 'pre-line' }}>{item.explanation}</div>;
}

/** Optionen, falls die Aufgabe im Auswahlmodus gezeigt werden kann. */
export function choiceOptions(item: Item): { options: string[]; correctIndex: number } | null {
  if (item.moduleId === 'kopfrechnen') {
    const p = (item as KrItem).prompt;
    return { options: p.options, correctIndex: p.correctIndex };
  }
  return null;
}
