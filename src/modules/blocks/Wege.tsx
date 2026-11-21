import { useEffect, useRef, useState } from 'react';
import type { Node, WgItem } from '../../generators/gedaechtnis';
import { TimeBar, useCountdown, useKeys, type BlockProps } from './common';

const CELL = 52;
const PAD = 26;

export function CityMap({
  item,
  routeUpTo,
  clicks,
  cursor,
  onNode,
  showRoute,
  showStart = true,
}: {
  item: WgItem;
  routeUpTo: number;
  clicks: Node[];
  cursor?: Node | null;
  onNode?: (n: Node) => void;
  showRoute: boolean;
  showStart?: boolean;
}) {
  const p = item.prompt;
  const size = PAD * 2 + CELL * (p.size - 1);
  const xy = (n: Node) => [PAD + n[0] * CELL, PAD + n[1] * CELL];
  const route = p.route.slice(0, routeUpTo + 1);
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="citymap"
      role="img"
      aria-label="Stadtplan"
    >
      <rect width={size} height={size} fill="#fff" />
      {p.landmarks.map((l, i) => {
        const [x, y] = xy(l.cell);
        return (
          <g key={i}>
            <rect
              x={x + 6}
              y={y + 6}
              width={CELL - 12}
              height={CELL - 12}
              fill="#eef3ea"
              stroke="#9db58f"
              rx={3}
            />
            <text
              x={x + CELL / 2}
              y={y + CELL / 2 + 4}
              textAnchor="middle"
              fontSize="9.5"
              fill="#33502a"
            >
              {l.name}
            </text>
          </g>
        );
      })}
      {Array.from({ length: p.size }, (_, k) => (
        <g key={k} stroke="#bbb" strokeWidth={3}>
          <line x1={PAD} y1={PAD + k * CELL} x2={size - PAD} y2={PAD + k * CELL} />
          <line x1={PAD + k * CELL} y1={PAD} x2={PAD + k * CELL} y2={size - PAD} />
        </g>
      ))}
      {showRoute && route.length > 1 && (
        <polyline
          points={route.map((n) => xy(n).join(',')).join(' ')}
          fill="none"
          stroke="#c2410c"
          strokeWidth={5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {showRoute &&
        route.length > 0 &&
        (() => {
          const [x, y] = xy(route[route.length - 1]);
          return <circle cx={x} cy={y} r={8} fill="#c2410c" />;
        })()}
      {showStart &&
        (() => {
          const [x, y] = xy(p.route[0]);
          return (
            <g>
              <rect x={x - 9} y={y - 9} width={18} height={18} fill="#157f43" />
              <text
                x={x}
                y={y - 13}
                textAnchor="middle"
                fontSize="10"
                fill="#157f43"
                fontWeight="700"
              >
                START
              </text>
            </g>
          );
        })()}
      {onNode &&
        Array.from({ length: p.size * p.size }, (_, k) => {
          const n: Node = [k % p.size, Math.floor(k / p.size)];
          const [x, y] = xy(n);
          const order = clicks.findIndex((c) => c[0] === n[0] && c[1] === n[1]);
          const isCursor = cursor && cursor[0] === n[0] && cursor[1] === n[1];
          return (
            <g key={k} onClick={() => onNode(n)} style={{ cursor: 'pointer' }}>
              <circle
                cx={x}
                cy={y}
                r={11}
                fill={order >= 0 ? '#2a6f97' : 'transparent'}
                stroke={isCursor ? '#111' : 'transparent'}
                strokeWidth={2}
              />
              {order >= 0 && (
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#fff"
                  fontWeight="700"
                >
                  {order + 1}
                </text>
              )}
            </g>
          );
        })}
    </svg>
  );
}

/** Wege merken: Route wird schrittweise gezeigt, danach Endpunkt oder Abbiegepunkte anklicken. */
export function WegeBlock({ item, onDone }: BlockProps<WgItem>) {
  const p = item.prompt;
  const [seg, setSeg] = useState(-1);
  const [clicks, setClicks] = useState<Node[]>([]);
  const [cursor, setCursor] = useState<Node>(p.route[0]);
  const answering = seg >= p.route.length;
  const answerStart = useRef(0);
  const need = p.question === 'ende' ? 1 : p.turns.length;

  useEffect(() => {
    if (answering) {
      answerStart.current = performance.now();
      return;
    }
    const t = setTimeout(() => setSeg((s) => s + 1), seg < 0 ? 1500 : p.segMs);
    return () => clearTimeout(t);
  }, [seg, answering, p.segMs]);

  const finish = (c: Node[]) =>
    onDone({ clicks: c }, Math.round(performance.now() - answerStart.current));
  const left = useCountdown(p.answerMs, () => finish(clicks), answering);
  const toggle = (n: Node) => {
    const i = clicks.findIndex((c) => c[0] === n[0] && c[1] === n[1]);
    if (i >= 0) setClicks(clicks.filter((_, k) => k !== i));
    else if (clicks.length < need) setClicks([...clicks, n]);
  };
  useKeys((e) => {
    if (!answering) return;
    const mv: Record<string, Node> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (mv[e.key]) {
      e.preventDefault();
      setCursor(([x, y]) => [
        Math.max(0, Math.min(p.size - 1, x + mv[e.key][0])),
        Math.max(0, Math.min(p.size - 1, y + mv[e.key][1])),
      ]);
    } else if (e.key === ' ') {
      e.preventDefault();
      toggle(cursor);
    } else if (e.key === 'Backspace') setClicks((c) => c.slice(0, -1));
    else if (e.key === 'Enter' && clicks.length === need) {
      e.preventDefault();
      finish(clicks);
    }
  }, answering);

  return (
    <div className="block-center">
      <div className="block-hint">
        {!answering
          ? 'Route merken'
          : p.question === 'ende'
            ? 'Wo endet die Route? Kreuzung anklicken (oder Pfeiltasten und Leertaste), dann Enter.'
            : `Alle ${need} Abbiegepunkte in der richtigen Reihenfolge anklicken (Pfeiltasten und Leertaste möglich), dann Enter.`}
      </div>
      {answering && <TimeBar left={left} total={p.answerMs} />}
      <CityMap
        item={item}
        routeUpTo={Math.max(0, seg)}
        clicks={clicks}
        cursor={answering ? cursor : null}
        onNode={answering ? toggle : undefined}
        showRoute={!answering && seg >= 0}
      />
      {answering && (
        <button
          className="btn primary"
          disabled={clicks.length !== need}
          onClick={() => finish(clicks)}
        >
          Bestätigen ({clicks.length} von {need}) <kbd className="on-accent">Enter</kbd>
        </button>
      )}
    </div>
  );
}
