import { useId } from 'react';
import {
  LAYOUTS,
  ROTATABLE,
  type Layer,
  type Panel,
  type ShapeName,
} from '../generators/figuren/model';

/** Schwarz auf Weiß, unabhängig vom Farbschema (wie im echten Test). */
const INK = '#111111';
const GREY = '#9a9a9a';
const PAPER = '#ffffff';

function poly(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

function regular(
  n: number,
  r: number,
  cx: number,
  cy: number,
  startDeg: number,
): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((startDeg + (360 / n) * i) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

function shapePoints(
  shape: Exclude<ShapeName, 'kreis'>,
  r: number,
  cx: number,
  cy: number,
): [number, number][] {
  switch (shape) {
    case 'quadrat': {
      const h = (r * 1.7) / 2;
      return [
        [cx - h, cy - h],
        [cx + h, cy - h],
        [cx + h, cy + h],
        [cx - h, cy + h],
      ];
    }
    case 'dreieck':
      return regular(3, r * 1.2, cx, cy + r * 0.15, -90);
    case 'fuenfeck':
      return regular(5, r * 1.08, cx, cy + r * 0.05, -90);
    case 'sechseck':
      return regular(6, r * 1.06, cx, cy, 0);
    case 'raute':
      return [
        [cx, cy - r * 1.2],
        [cx + r * 0.8, cy],
        [cx, cy + r * 1.2],
        [cx - r * 0.8, cy],
      ];
    case 'pfeil':
      return [
        [cx, cy - r],
        [cx + r * 0.75, cy - r * 0.1],
        [cx + r * 0.3, cy - r * 0.1],
        [cx + r * 0.3, cy + r],
        [cx - r * 0.3, cy + r],
        [cx - r * 0.3, cy - r * 0.1],
        [cx - r * 0.75, cy - r * 0.1],
      ];
  }
}

/** Dreht nur die Eckpunkte, damit Schraffur und Füllung beim Drehen gleich aussehen. */
function rotatePoints(
  pts: [number, number][],
  deg: number,
  cx: number,
  cy: number,
): [number, number][] {
  if (!deg) return pts;
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}

function ShapeEl({
  shape,
  r,
  cx,
  cy,
  fill,
  strokeWidth,
  dashed,
  rotDeg,
}: {
  shape: ShapeName;
  r: number;
  cx: number;
  cy: number;
  fill: string;
  strokeWidth: number;
  dashed: boolean;
  rotDeg: number;
}) {
  const common = {
    fill,
    stroke: INK,
    strokeWidth,
    strokeLinejoin: 'round' as const,
    strokeDasharray: dashed ? '7 5' : undefined,
  };
  if (shape === 'kreis') return <circle cx={cx} cy={cy} r={r} {...common} />;
  return (
    <polygon
      points={poly(rotatePoints(shapePoints(shape, r, cx, cy), rotDeg, cx, cy))}
      {...common}
    />
  );
}

const SEGMENTS: [number, number, number, number][] = [
  [18, 18, 82, 18],
  [18, 82, 82, 82],
  [18, 18, 18, 82],
  [82, 18, 82, 82],
  [18, 18, 82, 82],
  [18, 82, 82, 18],
  [50, 18, 50, 82],
  [18, 50, 82, 50],
];

function LayerEl({ layer, panel, hatchId }: { layer: Layer; panel: Panel; hatchId: string }) {
  const two = panel.layers.length > 1;
  if (layer.kind === 'form') {
    const r = two ? 40 : [18, 26, 34][layer.size];
    const fill = two ? PAPER : [PAPER, `url(#${hatchId})`, GREY, INK][layer.fill];
    const rot = !two && ROTATABLE.includes(layer.shape) ? layer.rot * 45 : 0;
    return (
      <ShapeEl
        shape={layer.shape}
        r={r}
        cx={50}
        cy={50}
        fill={fill}
        strokeWidth={2.6}
        dashed={layer.line === 1}
        rotDeg={rot}
      />
    );
  }
  if (layer.kind === 'punkte') {
    const inner = two && panel.layers[0].kind === 'form';
    const spacing = inner ? 17 : 28;
    const r = inner ? 5.5 : 9;
    const slots = layer.count === 1 ? [layer.pos] : LAYOUTS[layer.count];
    const fill = [PAPER, GREY, INK][layer.fill];
    return (
      <g>
        {slots.map((s) => (
          <ShapeEl
            key={s}
            shape={layer.shape}
            r={r}
            cx={50 + ((s % 3) - 1) * spacing}
            cy={50 + (Math.floor(s / 3) - 1) * spacing}
            fill={fill}
            strokeWidth={1.8}
            dashed={false}
            rotDeg={0}
          />
        ))}
      </g>
    );
  }
  return (
    <g stroke={INK} strokeWidth={3.5} strokeLinecap="round">
      {SEGMENTS.map((s, i) =>
        layer.set & (1 << i) ? <line key={i} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} /> : null,
      )}
    </g>
  );
}

export function FigureSvg({
  panel,
  size = 100,
  label,
}: {
  panel: Panel;
  size?: number;
  label?: string;
}) {
  const hatchId = 'h' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={label ?? 'Figur'}
      style={{ display: 'block' }}
    >
      <defs>
        <pattern
          id={hatchId}
          patternUnits="userSpaceOnUse"
          width="6"
          height="6"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill={PAPER} />
          <line x1="0" y1="0" x2="0" y2="6" stroke={INK} strokeWidth="1.8" />
        </pattern>
      </defs>
      {panel.layers.map((l, i) => (
        <LayerEl key={i} layer={l} panel={panel} hatchId={hatchId} />
      ))}
    </svg>
  );
}
