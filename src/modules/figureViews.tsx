import type { MxItem } from '../generators/matrizen';
import type { FrItem } from '../generators/figurenreihen';
import { FigureSvg } from './FigureSvg';

const MX_TIPS = [
  'Merkmal für Merkmal prüfen: Form, Anzahl, Füllung, Größe, Drehung, Linien. Nie alles auf einmal betrachten.',
  'Erst die Zeilen vergleichen, dann die Spalten. Ab Stufe 7 kann eine Regel auch spaltenweise gelten.',
  'Ausschlussverfahren: Jede Option streichen, die ein bereits erkanntes Merkmal verletzt. Das spart Zeit.',
];

const FR_TIPS = [
  'Von Figur zu Figur nur ein Merkmal verfolgen: Wie ändert sich die Drehung, wie die Anzahl, wie die Form?',
  'Wechselt etwas hin und her, kommt an Stelle 6 derselbe Zustand wie an Stelle 2 und 4.',
];

export function MatrixGrid({
  item,
  showSolution = false,
}: {
  item: MxItem;
  showSolution?: boolean;
}) {
  const p = item.prompt;
  return (
    <div className="mx-grid" aria-label="Matrix">
      {p.cells.map((c, i) => (
        <div
          key={i}
          className={'mx-cell' + (i === p.missing ? (showSolution ? ' solved' : ' missing') : '')}
        >
          {c ? (
            <FigureSvg panel={c} size={96} />
          ) : showSolution ? (
            <FigureSvg panel={p.solution} size={96} label="Lösung" />
          ) : (
            <span className="mx-q">?</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function MatrixPrompt({ item }: { item: MxItem }) {
  return <MatrixGrid item={item} />;
}

export function SequenceRow({
  item,
  showSolution = false,
}: {
  item: FrItem;
  showSolution?: boolean;
}) {
  const p = item.prompt;
  return (
    <div className="fr-row" aria-label="Figurenreihe">
      {p.seq.map((c, i) => (
        <div key={i} className="mx-cell">
          <FigureSvg panel={c} size={88} />
        </div>
      ))}
      <div className={'mx-cell' + (showSolution ? ' solved' : ' missing')}>
        {showSolution ? (
          <FigureSvg panel={p.solution} size={88} />
        ) : (
          <span className="mx-q">?</span>
        )}
      </div>
    </div>
  );
}

function RuleList({
  rules,
  constants,
  tips,
}: {
  rules: { text: string }[];
  constants: string[];
  tips: string[];
}) {
  return (
    <div className="solution">
      <div className="sol-head">Regeln</div>
      <ul className="sol-tips">
        {rules.map((r, i) => (
          <li key={i}>{r.text}</li>
        ))}
      </ul>
      {constants.length > 0 && (
        <>
          <div className="sol-head">Bleibt gleich</div>
          <div className="muted small">{constants.join(' · ')}</div>
        </>
      )}
      <div className="sol-head">So gehst du vor</div>
      <ul className="sol-tips">
        {tips.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export function MatrixSolution({ item }: { item: MxItem }) {
  return (
    <div className="fig-solution">
      <div className="paper-mini">
        <MatrixGrid item={item} showSolution />
      </div>
      <RuleList rules={item.prompt.rules} constants={item.prompt.constants} tips={MX_TIPS} />
    </div>
  );
}

export function SequenceSolution({ item }: { item: FrItem }) {
  return (
    <div>
      <div className="paper-mini" style={{ marginBottom: 12 }}>
        <SequenceRow item={item} showSolution />
      </div>
      <RuleList rules={item.prompt.rules} constants={item.prompt.constants} tips={FR_TIPS} />
    </div>
  );
}
