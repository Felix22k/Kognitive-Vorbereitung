import {
  DEFAULT_VIEW,
  bounds,
  faces,
  projector,
  type Face,
  type Mat3,
  type V3,
} from '../generators/raum/voxel';

const SHADES = ['#f4f4f4', '#bdbdbd', '#7c7c7c'];

export interface Fig {
  points: V3[];
  rot: Mat3;
  lightDeg?: number;
}

/** Größte Ausdehnung über mehrere Figuren, damit alle im gleichen Maßstab erscheinen. */
export function sharedExtent(figs: Fig[], view: Mat3 = DEFAULT_VIEW): number {
  let ext = 0;
  for (const f of figs) {
    const b = bounds(faces(f.points, f.rot, view));
    ext = Math.max(ext, b.maxX - b.minX, b.maxY - b.minY);
  }
  return ext;
}

export function VoxelSvg({
  fig,
  size,
  extent,
  view = DEFAULT_VIEW,
  floor,
  label,
}: {
  fig: Fig;
  size: number;
  /** Ausdehnung in Welteinheiten, die auf size abgebildet wird */
  extent: number;
  view?: Mat3;
  /** Bodenraster n × n (für Würfel zählen) */
  floor?: number;
  label?: string;
}) {
  const fs: Face[] = faces(fig.points, fig.rot, view, fig.lightDeg ?? 0);
  const pad = 0.06;
  const scale = (size * (1 - 2 * pad)) / extent;
  const proj = projector(fig.points, fig.rot, view);
  // Mittelpunkt aus Flächen plus Boden
  const all: [number, number][] = fs.flatMap((f) => f.pts);
  const floorQuads: [number, number][][] = [];
  if (floor) {
    for (let z = 0; z < floor; z++)
      for (let x = 0; x < floor; x++) {
        const q = (
          [
            [x - 0.5, -0.5, z - 0.5],
            [x + 0.5, -0.5, z - 0.5],
            [x + 0.5, -0.5, z + 0.5],
            [x - 0.5, -0.5, z + 0.5],
          ] as V3[]
        ).map(proj);
        floorQuads.push(q);
        all.push(...q);
      }
  }
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const tx = (p: [number, number]) =>
    `${(size / 2 + (p[0] - cx) * scale).toFixed(1)},${(size / 2 + (p[1] - cy) * scale).toFixed(1)}`;
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={label ?? 'Würfelfigur'}
      style={{ display: 'block' }}
    >
      {floorQuads.map((q, i) => (
        <polygon
          key={'f' + i}
          points={q.map(tx).join(' ')}
          fill="#fafafa"
          stroke="#9a9a9a"
          strokeWidth={1}
        />
      ))}
      {fs.map((f, i) => (
        <polygon
          key={i}
          points={f.pts.map(tx).join(' ')}
          fill={SHADES[f.shade]}
          stroke="#111"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
