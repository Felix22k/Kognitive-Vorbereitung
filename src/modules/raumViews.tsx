import type { MrItem, Mr4Item } from '../generators/rotation';
import type { WdItem } from '../generators/wuerfel';
import { toPoints, COUNT_VIEW, type WzItem } from '../generators/wuerfelZaehlen';
import { ID } from '../generators/raum/voxel';
import { VoxelSvg, sharedExtent } from './VoxelSvg';
import { CubeSvg, NetSvg } from './CubeSvg';

export function RotationPrompt({ item, size = 260 }: { item: MrItem; size?: number }) {
  const p = item.prompt;
  const ext = sharedExtent([p.left, p.right]);
  return (
    <div className="mr-pair">
      <VoxelSvg fig={p.left} size={size} extent={ext} label="linke Figur" />
      <VoxelSvg fig={p.right} size={size} extent={ext} label="rechte Figur" />
    </div>
  );
}

export function rotation4Extent(item: Mr4Item): number {
  return sharedExtent([item.prompt.target, ...item.prompt.options]);
}

export function Rotation4Prompt({ item }: { item: Mr4Item }) {
  return (
    <div className="mr-target">
      <span className="mr-caption">Zielfigur</span>
      <VoxelSvg
        fig={item.prompt.target}
        size={220}
        extent={rotation4Extent(item)}
        label="Zielfigur"
      />
      <span className="mr-caption muted-ink">
        Welche zwei Optionen zeigen dieselbe Figur, nur gedreht?
      </span>
    </div>
  );
}

export function WuerfelPrompt({ item }: { item: WdItem }) {
  const p = item.prompt;
  if (p.format === 'netz' && p.net)
    return (
      <div className="mr-target">
        <span className="mr-caption">Faltvorlage (Außenseite)</span>
        <NetSvg cells={p.net.cells} faces={p.net.faces} />
        <span className="mr-caption muted-ink">Welcher Würfel entsteht aus dieser Vorlage?</span>
      </div>
    );
  return (
    <div className="mr-target">
      <span className="mr-caption">Ausgangswürfel</span>
      <CubeSvg view={p.reference!} size={150} />
      <span className="mr-caption muted-ink">
        Welche Ansicht zeigt denselben Würfel in anderer Lage? Alle sechs Symbole sind verschieden.
      </span>
    </div>
  );
}

export function ZaehlenPrompt({ item }: { item: WzItem }) {
  const p = item.prompt;
  const fig = { points: toPoints(p.heights), rot: ID };
  const ext = sharedExtent([fig], COUNT_VIEW) * 1.25;
  return (
    <div className="mr-target">
      <VoxelSvg fig={fig} size={320} extent={ext} view={COUNT_VIEW} floor={p.heights.length} />
      <div className="hint" style={{ fontWeight: 600, color: '#111' }}>
        {p.question === 'zaehlen'
          ? 'Wie viele Würfel sind es insgesamt? Verdeckte Würfel unter sichtbaren zählen mit.'
          : 'Wie viele Würfel berühren genau zwei andere Würfel mit einer ganzen Fläche?'}
      </div>
    </div>
  );
}

const ROT_TIPS = [
  'An einem Ende der Figur anfangen und die Abknickungen der Reihe nach verfolgen: Geht der nächste Arm nach links oder nach rechts?',
  'Erst die beiden langen Arme zur Deckung bringen, dann nur noch das Ende prüfen. Dort zeigt sich die Spiegelung.',
  'Nicht die ganze Figur auf einmal drehen, sondern einen markanten Teil (zum Beispiel den kürzesten Arm) als Anker nehmen.',
];

export function RotationSolution({ item }: { item: MrItem | Mr4Item }) {
  return (
    <div className="solution">
      <div className="sol-head">Lösung</div>
      <div style={{ whiteSpace: 'pre-line' }}>{item.explanation}</div>
      <div className="sol-head">So gehst du vor</div>
      <ul className="sol-tips">
        {ROT_TIPS.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

const WD_TIPS = [
  'Eine Ecke merken: Die drei Flächen um eine Ecke stehen in fester Reihenfolge im Uhrzeigersinn. Stimmt die Reihenfolge nicht, ist die Ansicht gespiegelt.',
  'Dann die Ausrichtung prüfen: Wohin zeigt der Pfeil, an welcher Seite steht der Strich des L, in welcher Ecke liegt der Punkt?',
  'Bei der Faltvorlage: Flächen, die in einer Reihe mit einer Fläche dazwischen liegen, sind sich gegenüber und nie gleichzeitig zu sehen.',
];

export function WuerfelSolution({ item }: { item: WdItem }) {
  return (
    <div className="solution">
      <div className="sol-head">Lösung</div>
      <div style={{ whiteSpace: 'pre-line' }}>{item.explanation}</div>
      <div className="sol-head">So gehst du vor</div>
      <ul className="sol-tips">
        {WD_TIPS.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

export function ZaehlenSolution({ item }: { item: WzItem }) {
  return (
    <div className="solution">
      <div className="sol-head">Lösung</div>
      <div style={{ whiteSpace: 'pre-line' }} className="sol-steps">
        {item.explanation}
      </div>
      <div className="sol-head">So gehst du vor</div>
      <ul className="sol-tips">
        {item.prompt.question === 'zaehlen' ? (
          <>
            <li>
              Säule für Säule zählen: Die Höhe einer Säule erkennst du an ihrer Oberseite und am
              Bodenraster.
            </li>
            <li>
              Reihe für Reihe aufschreiben und erst am Ende addieren. Verdeckte Würfel unter
              sichtbaren zählen mit.
            </li>
          </>
        ) : (
          <>
            <li>
              Für jeden Würfel die Nachbarn prüfen: oben, unten, links, rechts, vorn, hinten. Nur
              ganze Flächen zählen.
            </li>
            <li>
              Typisch für genau zwei Nachbarn: Würfel in der Mitte einer Reihe oder unten in einer
              Säule ohne seitliche Nachbarn.
            </li>
          </>
        )}
      </ul>
    </div>
  );
}

/** Zusatzauswertung Format A: Median-Zeit je Drehwinkelgruppe. */
export function RotationAngleSummary({
  results,
}: {
  results: { item: unknown; rtMs: number; correct: boolean }[];
}) {
  const groups = [
    { name: '0 bis 60°', lo: 0, hi: 60 },
    { name: '61 bis 120°', lo: 61, hi: 120 },
    { name: '121 bis 180°', lo: 121, hi: 180 },
  ];
  const med = (xs: number[]) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  return (
    <div className="section card" style={{ padding: 0, overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Drehwinkel</th>
            <th className="num">Aufgaben</th>
            <th className="num">Richtig</th>
            <th className="num">Median-Zeit</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const rs = results.filter((r) => {
              const a = (r.item as MrItem).prompt.angle;
              return a >= g.lo && a <= g.hi;
            });
            const m = med(rs.map((r) => r.rtMs));
            return (
              <tr key={g.name}>
                <td>{g.name}</td>
                <td className="num tnum">{rs.length}</td>
                <td className="num tnum">
                  {rs.length
                    ? Math.round((rs.filter((r) => r.correct).length / rs.length) * 100) + ' %'
                    : '–'}
                </td>
                <td className="num tnum">
                  {m === null
                    ? '–'
                    : (m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' s'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
