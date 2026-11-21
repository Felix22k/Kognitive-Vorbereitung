import type { Item } from '../../core/types';
import {
  nbackScore,
  type BsItem,
  type FkItem,
  type NbItem,
  type WgItem,
  type ZsItem,
} from '../../generators/gedaechtnis';
import {
  dsScore,
  rkSegments,
  type DsItem,
  type RkItem,
  type SzItem,
} from '../../generators/konzentration';
import { median, type BlockProps } from './common';
import { BlockBoard, BlockspanneBlock, ZahlenspanneBlock } from './Spanne';
import { NbackBlock } from './Nback';
import { FaktenBlock } from './Fakten';
import { CityMap, WegeBlock } from './Wege';
import { DurchstreichenBlock, RechenketteBlock, SymbolZahlBlock } from './Konzentration';

export function BlockView(props: BlockProps<Item>) {
  const { item } = props;
  switch (item.moduleId) {
    case 'zahlenspanne':
      return <ZahlenspanneBlock {...(props as BlockProps<ZsItem>)} />;
    case 'blockspanne':
      return <BlockspanneBlock {...(props as BlockProps<BsItem>)} />;
    case 'nback':
      return <NbackBlock {...(props as BlockProps<NbItem>)} />;
    case 'fakten':
      return <FaktenBlock {...(props as BlockProps<FkItem>)} />;
    case 'wege':
      return <WegeBlock {...(props as BlockProps<WgItem>)} />;
    case 'durchstreichen':
      return <DurchstreichenBlock {...(props as BlockProps<DsItem>)} />;
    case 'symbolZahl':
      return <SymbolZahlBlock {...(props as BlockProps<SzItem>)} />;
    case 'rechenkette':
      return <RechenketteBlock {...(props as BlockProps<RkItem>)} />;
    default:
      return <div>Unbekanntes Modul</div>;
  }
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0) + ' %';
const sec = (ms: number | null) =>
  ms === null ? '–' : (ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' s';

function Stats({ items }: { items: [string, string | number][] }) {
  return (
    <div className="stat-row compact">
      {items.map(([l, v]) => (
        <div key={l} className="stat">
          <div className="v">{v}</div>
          <div className="l">{l}</div>
        </div>
      ))}
    </div>
  );
}

function Bars({
  values,
  labels,
  max,
  unit = '',
}: {
  values: number[];
  labels: string[];
  max: number;
  unit?: string;
}) {
  return (
    <div className="mini-bars">
      {values.map((v, i) => (
        <div key={i} className="mini-bar" title={`${labels[i]}: ${v}${unit}`}>
          <div style={{ height: `${max ? (v / max) * 100 : 0}%` }} />
          <span>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

/** Ergebnis einer Block-Aufgabe mit Kennwerten. */
export function BlockResultView({ item, data }: { item: Item; data?: Record<string, unknown> }) {
  if (!data) return <div style={{ whiteSpace: 'pre-line' }}>{item.explanation}</div>;
  switch (item.moduleId) {
    case 'zahlenspanne': {
      const it = item as ZsItem;
      return (
        <div>
          <div>
            Gezeigt: <strong className="mono">{it.prompt.digits.join(' ')}</strong>
          </div>
          <div>
            Erwartet ({it.prompt.direction === 'vor' ? 'vorwärts' : 'rückwärts'}):{' '}
            <strong className="mono">{it.correctLabel}</strong>
          </div>
          <div>
            Eingegeben:{' '}
            <strong className="mono">
              {String(data.input || '–')
                .split('')
                .join(' ')}
            </strong>
          </div>
          <p className="small" style={{ marginTop: 8 }}>
            Tipp: In Dreiergruppen merken (z. B. 4 7 2 · 9 1 5) und innerlich wiederholen.
          </p>
        </div>
      );
    }
    case 'blockspanne': {
      const it = item as BsItem;
      return (
        <div className="fig-solution">
          <div className="paper-mini">
            <BlockBoard lit={null} clicks={it.correct} showNumbers={false} />
          </div>
          <div>
            <div>
              Richtige Reihenfolge:{' '}
              <strong className="mono">{it.correct.map((x) => x + 1).join(' → ')}</strong>
            </div>
            <div>
              Deine Reihenfolge:{' '}
              <strong className="mono">
                {((data.clicks as number[]) ?? []).map((x) => x + 1).join(' → ') || '–'}
              </strong>
            </div>
            <p className="small" style={{ marginTop: 8 }}>
              Tipp: Den Weg als Linie oder Form merken statt einzelner Felder.
            </p>
          </div>
        </div>
      );
    }
    case 'nback': {
      const it = item as NbItem;
      const sc = nbackScore(it.prompt.targets, (data.responses as boolean[]) ?? []);
      const rts = ((data.rts as (number | null)[]) ?? []).filter(
        (r, i): r is number => r !== null && it.prompt.targets[i],
      );
      return (
        <Stats
          items={[
            ['Treffer', `${sc.hits} von ${sc.targets}`],
            ['Verpasst', sc.misses],
            ['Fehlalarme', sc.falseAlarms],
            ['Median-Zeit Treffer', sec(median(rts))],
          ]}
        />
      );
    }
    case 'fakten': {
      const it = item as FkItem;
      const ans = (data.answers as (number | null)[]) ?? [];
      const right = it.prompt.questions.filter((q, i) => ans[i] === q.correct).length;
      const dis = data.distraction as { n: number; correct: number } | undefined;
      return (
        <div>
          <Stats
            items={[
              ['Richtig', `${right} von ${it.prompt.questions.length}`],
              ['Ablenkaufgaben', dis ? `${dis.correct} von ${dis.n}` : '–'],
            ]}
          />
          <table style={{ marginTop: 10 }}>
            <tbody>
              {it.prompt.questions.map((q, i) => (
                <tr key={i}>
                  <td>{q.q}</td>
                  <td style={{ color: ans[i] === q.correct ? 'var(--ok)' : 'var(--bad)' }}>
                    {ans[i] === null || ans[i] === undefined ? '–' : q.options[ans[i]!]}
                  </td>
                  <td>
                    <strong>{q.options[q.correct]}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small" style={{ marginTop: 8 }}>
            Tipp: Fakten verknüpfen (Person, Dienstgrad, Rufname als ein Bild) und Zahlen mit etwas
            Bekanntem verbinden.
          </p>
        </div>
      );
    }
    case 'wege': {
      const it = item as WgItem;
      return (
        <div className="fig-solution">
          <div className="paper-mini">
            <CityMap
              item={it}
              routeUpTo={it.prompt.route.length - 1}
              clicks={(data.clicks as [number, number][]) ?? []}
              onNode={() => undefined}
              showRoute
            />
          </div>
          <div>
            <p>
              Rot: die Route. Blau: deine Auswahl (
              {it.prompt.question === 'ende' ? 'Endpunkt' : 'Abbiegepunkte in Reihenfolge'}).
            </p>
            <p className="small">
              Tipp: Abbiegungen als Folge sprechen (links, rechts, rechts …) und an
              Orientierungspunkten festmachen.
            </p>
          </div>
        </div>
      );
    }
    case 'durchstreichen': {
      const it = item as DsItem;
      const sc = dsScore(it.prompt, (data.marks as number[][]) ?? []);
      return (
        <div>
          <Stats
            items={[
              ['bearbeitete Zeichen', sc.processed],
              ['Konzentrationsleistung (KL)', sc.kl],
              ['Auslassungen', sc.omissions],
              ['Verwechslungen', sc.confusions],
              ['Fehlerprozent', `${sc.fehlerProzent.toLocaleString('de-DE')} %`],
              ['Schwankungsbreite', sc.schwankung],
            ]}
          />
          <div className="small muted" style={{ marginTop: 10 }}>
            Bearbeitete Zeichen je Zeile
          </div>
          <Bars values={sc.perRow} labels={sc.perRow.map((_, i) => String(i + 1))} max={40} />
        </div>
      );
    }
    case 'symbolZahl': {
      const res = (data.results as { correct: boolean; rtMs: number }[]) ?? [];
      return (
        <Stats
          items={[
            ['bearbeitet', res.length],
            ['richtig', pct(res.filter((r) => r.correct).length, res.length)],
            ['Median-Zeit', sec(median(res.map((r) => r.rtMs)))],
          ]}
        />
      );
    }
    case 'rechenkette': {
      const it = item as RkItem;
      const res = (data.results as { t: number; correct: boolean }[]) ?? [];
      const segs = rkSegments(res, it.prompt.durationMs);
      return (
        <div>
          <Stats
            items={[
              ['bearbeitet', res.length],
              ['richtig', pct(res.filter((r) => r.correct).length, res.length)],
            ]}
          />
          <div className="small muted" style={{ marginTop: 10 }}>
            Richtige Antworten je 30 Sekunden (Ermüdungskurve)
          </div>
          <Bars
            values={segs.map((s) => s.correct)}
            labels={segs.map((s) => `${s.from / 1000}`)}
            max={Math.max(1, ...segs.map((s) => s.n))}
          />
        </div>
      );
    }
    default:
      return <div style={{ whiteSpace: 'pre-line' }}>{item.explanation}</div>;
  }
}
