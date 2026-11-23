import type {
  BeltFig,
  Gear,
  GearFig,
  LeverFig,
  PulleyFig,
  RampFig,
  TechFig,
} from '../generators/technik';
import { formatNumber } from '../core/rational';

const INK = '#111';
const SOFT = '#9aa1ab';
const ACC = 'var(--accent-on-paper)';

function gearPath(g: Gear): string {
  const n = g.teeth;
  const ro = g.r + 3;
  const ri = g.r - 3;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI;
    const step = (2 * Math.PI) / n;
    const seq: [number, number][] = [
      [ri, a0],
      [ro, a0 + step * 0.2],
      [ro, a0 + step * 0.5],
      [ri, a0 + step * 0.7],
    ];
    for (const [rad, a] of seq) pts.push(`${g.x + rad * Math.cos(a)},${g.y + rad * Math.sin(a)}`);
  }
  return 'M' + pts.join(' L') + ' Z';
}

/** Drehpfeil um einen Mittelpunkt: dir 1 = Uhrzeigersinn (im SVG mit y nach unten). */
function RotArrow({ x, y, r, dir }: { x: number; y: number; r: number; dir: 1 | -1 }) {
  const a0 = -Math.PI * 0.85;
  const a1 = -Math.PI * 0.15;
  const [s, e] = dir === 1 ? [a0, a1] : [a1, a0];
  const p = (a: number) => [x + r * Math.cos(a), y + r * Math.sin(a)];
  const [sx, sy] = p(s);
  const [ex, ey] = p(e);
  // Pfeilspitze tangential am Ende
  const t = e + (dir === 1 ? Math.PI / 2 : -Math.PI / 2);
  const hx = Math.cos(t);
  const hy = Math.sin(t);
  const nx = Math.cos(e);
  const ny = Math.sin(e);
  const head = [
    [ex + hx * 7, ey + hy * 7],
    [ex - nx * 5, ey - ny * 5],
    [ex + nx * 5, ey + ny * 5],
  ]
    .map((q) => q.join(','))
    .join(' ');
  return (
    <g>
      <path
        d={`M${sx},${sy} A${r},${r} 0 0 ${dir === 1 ? 1 : 0} ${ex},${ey}`}
        fill="none"
        stroke={ACC}
        strokeWidth={3}
      />
      <polygon points={head} fill={ACC} />
    </g>
  );
}

function GearSvg({ fig }: { fig: GearFig }) {
  const xs = fig.gears.flatMap((g) => [g.x - g.r - 22, g.x + g.r + 22]);
  const ys = fig.gears.flatMap((g) => [g.y - g.r - 26, g.y + g.r + 22]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  const order = fig.gears.map((g, i) => ({ g, i })).sort((a, b) => a.g.plane - b.g.plane);
  return (
    <svg
      viewBox={`${minX} ${minY} ${w} ${h}`}
      width="100%"
      style={{ maxWidth: Math.min(560, w * 2.2), maxHeight: 340 }}
      role="img"
      aria-label="Zahnräder"
    >
      {order.map(({ g, i }) => {
        const back = fig.gears.some((o, j) => j !== i && o.plane > g.plane);
        return (
          <g key={i} opacity={back && g.plane === 0 && fig.axle.length ? 0.55 : 1}>
            <path
              d={gearPath(g)}
              fill={g.plane > 0 ? '#e9ecef' : '#f6f7f8'}
              stroke={INK}
              strokeWidth={1.6}
            />
            <circle cx={g.x} cy={g.y} r={3} fill={INK} />
          </g>
        );
      })}
      {fig.axle.map(([a, b], k) => (
        <circle
          key={'ax' + k}
          cx={fig.gears[a].x}
          cy={fig.gears[a].y}
          r={6}
          fill="none"
          stroke={INK}
          strokeWidth={2}
          strokeDasharray="2 2"
        >
          <title>
            gemeinsame Achse {fig.gears[a].label} und {fig.gears[b].label}
          </title>
        </circle>
      ))}
      {fig.gears.map((g, i) => {
        // Beschriftung: Räder auf gemeinsamer Achse versetzt beschriften
        const partner = fig.axle.find(([a, b]) => a === i || b === i);
        const isFront = partner && g.plane > 0;
        const lx = g.x + (partner ? (isFront ? 0 : -g.r - 10) : 0);
        const ly = g.y + (partner ? (isFront ? -6 : g.r + 8) : -8);
        return (
          <text
            key={'l' + i}
            x={lx}
            y={ly}
            fontSize={13}
            fontWeight={700}
            textAnchor="middle"
            fill={i === fig.target ? ACC : INK}
          >
            {g.label}
            {i === fig.target ? ' ?' : ''}
          </text>
        );
      })}
      <RotArrow
        x={fig.gears[fig.driver].x}
        y={fig.gears[fig.driver].y}
        r={fig.gears[fig.driver].r + 12}
        dir={fig.dir}
      />
    </svg>
  );
}

/** Äußere Tangenten (offen) bzw. innere Tangenten (gekreuzt) zweier Kreise. */
function beltLines(
  a: { x: number; y: number; r: number },
  b: { x: number; y: number; r: number },
  crossed: boolean,
): [number, number, number, number][] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx);
  const res: [number, number, number, number][] = [];
  for (const s of [1, -1]) {
    if (!crossed) {
      const phi = Math.acos((a.r - b.r) / d);
      const ang = base + s * phi;
      res.push([
        a.x + a.r * Math.cos(ang),
        a.y + a.r * Math.sin(ang),
        b.x + b.r * Math.cos(ang),
        b.y + b.r * Math.sin(ang),
      ]);
    } else {
      const phi = Math.acos((a.r + b.r) / d);
      const ang = base + s * phi;
      res.push([
        a.x + a.r * Math.cos(ang),
        a.y + a.r * Math.sin(ang),
        b.x - b.r * Math.cos(ang),
        b.y - b.r * Math.sin(ang),
      ]);
    }
  }
  return res;
}

function BeltSvg({ fig }: { fig: BeltFig }) {
  const xs = fig.pulleys.flatMap((p) => [p.x - p.r - 22, p.x + p.r + 22]);
  const ys = fig.pulleys.flatMap((p) => [p.y - p.r - 26, p.y + p.r + 34]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  return (
    <svg
      viewBox={`${minX} ${minY} ${w} ${h}`}
      width="100%"
      style={{ maxWidth: Math.min(560, w * 2.2), maxHeight: 300 }}
      role="img"
      aria-label="Riementrieb"
    >
      {fig.pulleys.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill={i === 2 ? '#e9ecef' : '#f6f7f8'}
            stroke={INK}
            strokeWidth={2}
          />
          <circle cx={p.x} cy={p.y} r={3} fill={INK} />
        </g>
      ))}
      {fig.belts.map((bl, k) =>
        beltLines(fig.pulleys[bl.a], fig.pulleys[bl.b], bl.crossed).map(([x1, y1, x2, y2], j) => (
          <line key={k + '-' + j} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK} strokeWidth={2.4} />
        )),
      )}
      {fig.pulleys.map((p, i) => {
        const onAxle = fig.axle.some(([a, b]) => a === i || b === i);
        const small = onAxle && fig.pulleys.some((o, j) => j !== i && o.x === p.x && o.r > p.r);
        return (
          <text
            key={'t' + i}
            x={p.x + (small ? 0 : 0)}
            y={small ? p.y + 4 : p.y + p.r + 18}
            fontSize={13}
            fontWeight={700}
            textAnchor="middle"
            fill={i === fig.target ? ACC : INK}
          >
            {p.label}
            {i === fig.target ? ' ?' : ''}
          </text>
        );
      })}
      <RotArrow
        x={fig.pulleys[fig.driver].x}
        y={fig.pulleys[fig.driver].y}
        r={fig.pulleys[fig.driver].r + 10}
        dir={fig.dir}
      />
    </svg>
  );
}

function LeverSvg({ fig }: { fig: LeverFig }) {
  const U = 40;
  const W = 6 * U * 2 + 60;
  const cx = W / 2;
  const beamY = 70;
  return (
    <svg
      viewBox={`0 0 ${W} 190`}
      width="100%"
      style={{ maxWidth: 560 }}
      role="img"
      aria-label="Hebel"
    >
      <rect
        x={cx - 6 * U - 8}
        y={beamY - 5}
        width={12 * U + 16}
        height={10}
        fill="#d9dde2"
        stroke={INK}
      />
      {Array.from({ length: 13 }, (_, i) => i - 6).map((k) => (
        <g key={k}>
          <line x1={cx + k * U} x2={cx + k * U} y1={beamY - 5} y2={beamY + 5} stroke={INK} />
          {k !== 0 && (
            <text x={cx + k * U} y={beamY - 10} fontSize={10} textAnchor="middle" fill={SOFT}>
              {Math.abs(k)}
            </text>
          )}
        </g>
      ))}
      <polygon
        points={`${cx},${beamY + 5} ${cx - 16},${beamY + 34} ${cx + 16},${beamY + 34}`}
        fill={INK}
      />
      <line
        x1={cx - 40}
        x2={cx + 40}
        y1={beamY + 35}
        y2={beamY + 35}
        stroke={INK}
        strokeWidth={2}
      />
      {fig.loads.map((l, i) => {
        const x = cx + l.pos * U;
        const unknown = l.value === null;
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={beamY + 5} y2={beamY + 45} stroke={INK} />
            <rect
              x={x - 18}
              y={beamY + 45}
              width={36}
              height={34}
              rx={3}
              fill={unknown ? '#fff' : '#cfd4da'}
              stroke={unknown ? ACC : INK}
              strokeWidth={unknown ? 2.5 : 1.5}
            />
            <text
              x={x}
              y={beamY + 67}
              fontSize={11}
              fontWeight={700}
              textAnchor="middle"
              fill={unknown ? ACC : INK}
            >
              {unknown ? '?' : `${formatNumber(l.value!)} ${fig.unit}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Faktorenflaschenzug: Seil vom Zughaken über obere Rolle 1, runter um untere
 * Rolle 1, hoch über obere Rolle 2 … Jeder senkrechte Strang zwischen oberem
 * und unterem Block trägt. Ungerade Strangzahl: Seilende am unteren Block,
 * gerade: Seilende an der Decke.
 */
function PulleySvg({ fig }: { fig: PulleyFig }) {
  const n = fig.strands;
  const R = 14;
  const top = Math.ceil(n / 2);
  const bottom = Math.floor(n / 2);
  const c0 = 70;
  const topY = 56;
  const botY = 176;
  const tc = Array.from({ length: top }, (_, i) => c0 + i * 4 * R);
  const bc = Array.from({ length: bottom }, (_, i) => c0 + 2 * R + i * 4 * R);
  const strands = Array.from({ length: n }, (_, k) => c0 + R + k * 2 * R);
  const W = Math.max(...strands) + 70;
  const pullX = c0 - R;
  const barY = botY + R + 8;
  const minS = Math.min(...strands);
  const maxS = Math.max(...strands);
  const loadX = n === 1 ? strands[0] : (minS + maxS) / 2;
  const loadY = n === 1 ? botY + 20 : barY + 26;
  return (
    <svg
      viewBox={`0 0 ${W} 290`}
      width="100%"
      style={{ maxWidth: 380 }}
      role="img"
      aria-label="Flaschenzug"
    >
      <rect x={20} y={10} width={W - 40} height={10} fill="#cfd4da" stroke={INK} />
      {/* Zugseil */}
      <line x1={pullX} x2={pullX} y1={topY} y2={250} stroke={ACC} strokeWidth={2.5} />
      <polygon points={`${pullX},266 ${pullX - 7},250 ${pullX + 7},250`} fill={ACC} />
      <text x={pullX - 10} y={264} fontSize={13} fontWeight={700} textAnchor="end" fill={ACC}>
        F ?
      </text>
      {/* tragende Stränge */}
      {strands.map((x, k) => {
        const last = k === n - 1;
        const goingDown = k % 2 === 0;
        let y1 = topY;
        let y2 = botY;
        if (last && n > 1) {
          if (goingDown)
            y2 = barY; // Ende am unteren Block
          else y1 = 20; // Ende an der Decke
        }
        if (n === 1) y2 = loadY;
        return <line key={k} x1={x} x2={x} y1={y1} y2={y2} stroke={INK} strokeWidth={2} />;
      })}
      {tc.map((cx, i) => (
        <g key={'t' + i}>
          <line x1={cx} x2={cx} y1={20} y2={topY} stroke={INK} strokeWidth={3} />
          <circle cx={cx} cy={topY} r={R} fill="#f6f7f8" stroke={INK} strokeWidth={2} />
          <circle cx={cx} cy={topY} r={2.5} fill={INK} />
        </g>
      ))}
      {bc.map((cx, i) => (
        <g key={'b' + i}>
          <circle cx={cx} cy={botY} r={R} fill="#f6f7f8" stroke={INK} strokeWidth={2} />
          <circle cx={cx} cy={botY} r={2.5} fill={INK} />
          <line x1={cx} x2={cx} y1={botY} y2={barY} stroke={INK} strokeWidth={3} />
        </g>
      ))}
      {n > 1 && (
        <>
          <line x1={minS - 4} x2={maxS + 4} y1={barY} y2={barY} stroke={INK} strokeWidth={4} />
          <line x1={loadX} x2={loadX} y1={barY} y2={loadY} stroke={INK} strokeWidth={2} />
        </>
      )}
      {n > 1 && n % 2 === 0 && <circle cx={strands[n - 1]} cy={20} r={3} fill={INK} />}
      <rect x={loadX - 32} y={loadY} width={64} height={38} fill="#cfd4da" stroke={INK} />
      <text x={loadX} y={loadY + 24} fontSize={12} textAnchor="middle" fontWeight={700} fill={INK}>
        {fig.load} N
      </text>
    </svg>
  );
}

function RampSvg({ fig }: { fig: RampFig }) {
  const L = 300;
  const ang = Math.asin(fig.height / fig.length);
  const base = L * Math.cos(ang);
  const H = L * Math.sin(ang);
  const x0 = 30;
  const y0 = 30 + H;
  const bx = x0 + base * 0.45;
  const by = y0 - H * 0.45;
  const deg = (-ang * 180) / Math.PI;
  return (
    <svg
      viewBox={`0 0 ${base + 90} ${H + 70}`}
      width="100%"
      style={{ maxWidth: 440 }}
      role="img"
      aria-label="Schiefe Ebene"
    >
      <polygon
        points={`${x0},${y0} ${x0 + base},${y0} ${x0 + base},${y0 - H}`}
        fill="#e9ecef"
        stroke={INK}
        strokeWidth={2}
      />
      <g transform={`translate(${bx},${by}) rotate(${deg})`}>
        <rect x={-24} y={-30} width={48} height={30} fill="#cfd4da" stroke={INK} />
        <text x={0} y={-11} fontSize={11} textAnchor="middle" fontWeight={700} fill={INK}>
          {fig.load} N
        </text>
        <line x1={24} y1={-15} x2={70} y2={-15} stroke={ACC} strokeWidth={2.5} />
        <polygon points="80,-15 68,-21 68,-9" fill={ACC} />
        <text x={84} y={-20} fontSize={12} fontWeight={700} fill={ACC}>
          F ?
        </text>
      </g>
      <text
        x={x0 + base * 0.62}
        y={y0 - H * 0.62 + 20}
        fontSize={12}
        fontWeight={700}
        textAnchor="middle"
        fill={INK}
        transform={`rotate(${deg} ${x0 + base * 0.62} ${y0 - H * 0.62 + 20})`}
      >
        {formatNumber(fig.length)} m
      </text>
      <text x={x0 + base + 8} y={y0 - H / 2 + 4} fontSize={12} fill={INK}>
        {formatNumber(fig.height)} m
      </text>
    </svg>
  );
}

export function TechSvg({ fig }: { fig: TechFig }) {
  switch (fig.type) {
    case 'zahnrad':
      return <GearSvg fig={fig} />;
    case 'riemen':
      return <BeltSvg fig={fig} />;
    case 'hebel':
      return <LeverSvg fig={fig} />;
    case 'flaschenzug':
      return <PulleySvg fig={fig} />;
    case 'schiefeEbene':
      return <RampSvg fig={fig} />;
  }
}
