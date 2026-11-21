import type { Sym, View } from '../generators/wuerfel';
import type { Cell } from '../generators/wuerfel';

/** Symbol in einem 100 × 100-Feld (y nach unten), schwarz auf weiß. */
export function SymbolShape({ sym }: { sym: Sym }) {
  const st = {
    fill: 'none',
    stroke: '#111',
    strokeWidth: 11,
    strokeLinecap: 'square' as const,
    strokeLinejoin: 'miter' as const,
  };
  switch (sym) {
    case 'pfeil':
      return <polygon points="50,14 80,48 61,48 61,86 39,86 39,48 20,48" fill="#111" />;
    case 'F':
      return <path d="M34 84 V18 H72 M34 50 H64" {...st} />;
    case 'L':
      return <path d="M34 16 V82 H72" {...st} />;
    case 'P':
      return <path d="M34 84 V18 H56 A16 16 0 0 1 56 50 H34" {...st} />;
    case 'R':
      return <path d="M34 84 V18 H56 A16 16 0 0 1 56 50 H34 M50 50 L72 84" {...st} />;
    case 'halb':
      return (
        <g>
          <rect x="16" y="16" width="68" height="68" fill="none" stroke="#111" strokeWidth="5" />
          <rect x="16" y="16" width="34" height="68" fill="#111" />
        </g>
      );
    case 'punkt':
      return <circle cx="27" cy="27" r="11" fill="#111" />;
  }
}

const C = Math.cos(Math.PI / 6);
const S = 0.5;
type P3 = [number, number, number];
/** Isometrische Projektion: +x nach rechts unten, +z nach links unten, +y nach oben. */
const iso = (p: P3, s: number): [number, number] => [
  (p[0] - p[2]) * C * s,
  (p[0] + p[2]) * S * s - p[1] * s,
];

const FACES: { w: 'top' | 'left' | 'right'; tl: P3; right: P3; down: P3; tint: string }[] = [
  { w: 'top', tl: [0, 1, 0], right: [1, 0, 0], down: [0, 0, 1], tint: '#ffffff' },
  { w: 'left', tl: [0, 1, 1], right: [1, 0, 0], down: [0, -1, 0], tint: '#f1f1f1' },
  { w: 'right', tl: [1, 1, 1], right: [0, 0, -1], down: [0, -1, 0], tint: '#e2e2e2' },
];

export function CubeSvg({ view, size = 120 }: { view: View; size?: number }) {
  const s = size / 2.15;
  const ox = size / 2;
  const oy = size / 2;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="Würfel"
      style={{ display: 'block' }}
    >
      {FACES.map(({ w, tl, right, down, tint }) => {
        const [ex, ey] = iso(tl, s);
        const [ax, ay] = iso(right, s);
        const [cx, cy] = iso(down, s);
        const m = `matrix(${ax / 100} ${ay / 100} ${cx / 100} ${cy / 100} ${ox + ex} ${oy + ey})`;
        return (
          <g key={w} transform={m}>
            <rect x="0" y="0" width="100" height="100" fill={tint} stroke="#111" strokeWidth="3" />
            <g transform={`rotate(${view[w].k * 90} 50 50)`}>
              <SymbolShape sym={view[w].sym} />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

export function NetSvg({
  cells,
  faces,
  cell = 52,
}: {
  cells: Cell[];
  faces: { sym: Sym; k: number }[];
  cell?: number;
}) {
  const w = (Math.max(...cells.map((c) => c[0])) + 1) * cell;
  const h = (Math.max(...cells.map((c) => c[1])) + 1) * cell;
  return (
    <svg
      viewBox={`-2 -2 ${w + 4} ${h + 4}`}
      width={w + 4}
      height={h + 4}
      role="img"
      aria-label="Faltvorlage"
      style={{ display: 'block' }}
    >
      {cells.map(([c, r], i) => (
        <g key={i} transform={`translate(${c * cell} ${r * cell}) scale(${cell / 100})`}>
          <rect x="0" y="0" width="100" height="100" fill="#fff" stroke="#111" strokeWidth="3" />
          <g transform={`rotate(${faces[i].k * 90} 50 50)`}>
            <SymbolShape sym={faces[i].sym} />
          </g>
        </g>
      ))}
    </svg>
  );
}
