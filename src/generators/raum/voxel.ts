/**
 * 3D-Kern für Würfelkörper: Vektoren, Drehungen, Normalform (Chiralität),
 * orthografische Projektion, Flächenliste mit Schattierung und eine
 * Rasterprüfung, wie viel von jedem Würfel bzw. jeder Fläche sichtbar ist.
 */

export type V3 = [number, number, number];
export type Mat3 = number[]; // 3 × 3, zeilenweise

export const ID: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function mul(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}

export function apply(m: Mat3, v: V3): V3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function transpose(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export function rotX(deg: number): Mat3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [1, 0, 0, 0, c, -s, 0, s, c];
}
export function rotY(deg: number): Mat3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c, 0, s, 0, 1, 0, -s, 0, c];
}
export function rotZ(deg: number): Mat3 {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

const roundM = (m: Mat3): Mat3 => m.map((x) => Math.round(x));

/** Die 24 Drehungen, die einen Würfel auf sich selbst abbilden. */
export const CUBE_ROTATIONS: Mat3[] = (() => {
  const gens = [roundM(rotX(90)), roundM(rotY(90)), roundM(rotZ(90))];
  const seen = new Map<string, Mat3>([[ID.join(), ID]]);
  const queue = [ID];
  while (queue.length) {
    const m = queue.shift()!;
    for (const g of gens) {
      const n = mul(g, m);
      const k = n.join();
      if (!seen.has(k)) {
        seen.set(k, n);
        queue.push(n);
      }
    }
  }
  return [...seen.values()];
})();

export const DIRS: V3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export const key = (p: V3) => p.join(',');

/** Normalform eines Würfelkörpers: kleinste Darstellung über alle 24 Drehungen. */
export function canonical(points: V3[]): string {
  let best: string | null = null;
  for (const R of CUBE_ROTATIONS) {
    const q = points.map((p) => apply(R, p));
    const min = [0, 1, 2].map((i) => Math.min(...q.map((p) => p[i])));
    const s = q
      .map((p) => [p[0] - min[0], p[1] - min[1], p[2] - min[2]].join(','))
      .sort()
      .join(';');
    if (best === null || s < best) best = s;
  }
  return best!;
}

export const mirror = (points: V3[]): V3[] => points.map(([x, y, z]) => [-x, y, z]);

export function isChiral(points: V3[]): boolean {
  return canonical(points) !== canonical(mirror(points));
}

export function centroid(points: V3[]): V3 {
  const n = points.length;
  return [0, 1, 2].map((i) => points.reduce((s, p) => s + p[i], 0) / n) as V3;
}

// ---------- Projektion und Flächen ----------

export interface Face {
  /** Bildschirmpunkte (x nach rechts, y nach unten) */
  pts: [number, number][];
  /** Index des Würfels */
  cube: number;
  /** Richtung der Fläche im Körper (0 bis 5, siehe DIRS) */
  dir: number;
  shade: 0 | 1 | 2;
  depth: number;
}

const LIGHT: V3 = (() => {
  const v: V3 = [-0.45, 0.8, 0.55];
  const l = Math.hypot(...v);
  return v.map((x) => x / l) as V3;
})();

/**
 * Sichtbare Außenflächen eines Würfelkörpers, von hinten nach vorn sortiert
 * (Maleralgorithmus). rot dreht den Körper um seinen Schwerpunkt, danach
 * kommt die Blickrichtung view.
 */
export function faces(points: V3[], rot: Mat3, view: Mat3, lightDeg = 0): Face[] {
  const light = lightDeg ? apply(rotZ(lightDeg), LIGHT) : LIGHT;
  const occ = new Set(points.map(key));
  const c = centroid(points);
  const M = mul(view, rot);
  const cubes = points
    .map((p, i) => {
      const center = apply(M, [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
      return { p, i, center };
    })
    .sort((a, b) => a.center[2] - b.center[2]);
  const out: Face[] = [];
  for (const { p, i, center } of cubes) {
    DIRS.forEach((d, di) => {
      if (occ.has(key([p[0] + d[0], p[1] + d[1], p[2] + d[2]]))) return;
      const n = apply(M, d);
      if (n[2] <= 1e-6) return;
      // zwei Achsen in der Fläche
      const e1: V3 = d[0] ? [0, 1, 0] : [1, 0, 0];
      const e2: V3 = [
        d[1] * e1[2] - d[2] * e1[1],
        d[2] * e1[0] - d[0] * e1[2],
        d[0] * e1[1] - d[1] * e1[0],
      ];
      const corners: V3[] = [
        [0.5, 0.5],
        [0.5, -0.5],
        [-0.5, -0.5],
        [-0.5, 0.5],
      ].map(([a, b]) => [
        p[0] - c[0] + 0.5 * d[0] + a * e1[0] + b * e2[0],
        p[1] - c[1] + 0.5 * d[1] + a * e1[1] + b * e2[1],
        p[2] - c[2] + 0.5 * d[2] + a * e1[2] + b * e2[2],
      ]);
      const proj = corners.map((v) => apply(M, v));
      const l = n[0] * light[0] + n[1] * light[1] + n[2] * light[2];
      out.push({
        pts: proj.map((v) => [v[0], -v[1]]),
        cube: i,
        dir: di,
        shade: l > 0.62 ? 0 : l > 0.18 ? 1 : 2,
        depth: center[2],
      });
    });
  }
  return out;
}

export function bounds(fs: Face[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const f of fs)
    for (const [x, y] of f.pts) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  return { minX, minY, maxX, maxY };
}

function inside(pts: [number, number][], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const cr = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cr) < 1e-12) continue;
    const s = cr > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * Rasterprüfung: Anzahl sichtbarer Pixel je Würfel und je Fläche
 * (Schlüssel "würfel:richtung") bei res × res Pixeln.
 */
export function visibility(
  fs: Face[],
  res = 64,
): { perCube: Map<number, number>; perFace: Map<string, number> } {
  const b = bounds(fs);
  const size = Math.max(b.maxX - b.minX, b.maxY - b.minY);
  const perCube = new Map<number, number>();
  const perFace = new Map<string, number>();
  // Bounding-Boxen vorab, um Tests zu sparen
  const boxes = fs.map((f) => {
    const xs = f.pts.map((p) => p[0]);
    const ys = f.pts.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  });
  for (let py = 0; py < res; py++)
    for (let px = 0; px < res; px++) {
      const x = b.minX + ((px + 0.5) / res) * size;
      const y = b.minY + ((py + 0.5) / res) * size;
      let hit = -1;
      for (let i = fs.length - 1; i >= 0; i--) {
        const bb = boxes[i];
        if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) continue;
        if (inside(fs[i].pts, x, y)) {
          hit = i;
          break;
        }
      }
      if (hit < 0) continue;
      const f = fs[hit];
      perCube.set(f.cube, (perCube.get(f.cube) ?? 0) + 1);
      const k = `${f.cube}:${f.dir}`;
      perFace.set(k, (perFace.get(k) ?? 0) + 1);
    }
  return { perCube, perFace };
}

/** Standard-Blickrichtung: etwa 25° von oben, 35° seitlich. */
export const DEFAULT_VIEW: Mat3 = mul(rotX(25), rotY(-35));

/** Drehung um eine Achse im Blick-Koordinatensystem (Bildebene = z, senkrecht = y, waagerecht = x). */
export function viewAxisRotation(view: Mat3, axis: 'x' | 'y' | 'z', deg: number): Mat3 {
  const r = axis === 'x' ? rotX(deg) : axis === 'y' ? rotY(deg) : rotZ(deg);
  return mul(transpose(view), mul(r, view));
}

/** Projektionsfunktion passend zu faces() (gleicher Schwerpunkt, gleiche Drehung). */
export function projector(points: V3[], rot: Mat3, view: Mat3): (p: V3) => [number, number] {
  const c = centroid(points);
  const M = mul(view, rot);
  return (p) => {
    const v = apply(M, [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
    return [v[0], -v[1]];
  };
}
