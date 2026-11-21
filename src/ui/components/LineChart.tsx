/** Schlichtes Liniendiagramm als SVG (0 bis 100 oder freie Skala). */
export interface Point {
  x: number; // Zeitstempel
  y: number;
}

export function LineChart({
  points,
  height = 140,
  yMax = 100,
  yLabel = '%',
  color = 'var(--accent-strong)',
}: {
  points: Point[];
  height?: number;
  yMax?: number;
  yLabel?: string;
  color?: string;
}) {
  const w = 360;
  const h = height;
  const pad = { l: 40, r: 10, t: 10, b: 22 };
  if (points.length === 0) return <p className="muted small">Noch keine Daten.</p>;
  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const sx = (x: number) =>
    pad.l +
    (maxX === minX ? (w - pad.l - pad.r) / 2 : ((x - minX) / (maxX - minX)) * (w - pad.l - pad.r));
  const sy = (y: number) => pad.t + (1 - Math.min(y, yMax) / yMax) * (h - pad.t - pad.b);
  const d = points
    .map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
    .join(' ');
  const ticks = [0, yMax / 2, yMax];
  const fmtDate = (t: number) =>
    new Date(t).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      role="img"
      aria-label="Verlauf"
      style={{ maxWidth: w }}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={pad.l}
            x2={w - pad.r}
            y1={sy(t)}
            y2={sy(t)}
            stroke="var(--line)"
            strokeWidth="1"
          />
          <text x={pad.l - 6} y={sy(t) + 4} fontSize="12" fill="var(--muted)" textAnchor="end">
            {t}
            {yLabel}
          </text>
        </g>
      ))}
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3" fill={color}>
          <title>
            {fmtDate(p.x)}: {p.y}
            {yLabel}
          </title>
        </circle>
      ))}
      <text x={pad.l} y={h - 6} fontSize="12" fill="var(--muted)">
        {fmtDate(minX)}
      </text>
      <text x={w - pad.r} y={h - 6} fontSize="12" fill="var(--muted)" textAnchor="end">
        {fmtDate(maxX)}
      </text>
    </svg>
  );
}
