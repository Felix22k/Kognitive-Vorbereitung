import { useEffect, useRef, useState } from 'react';
import type { NbItem } from '../../generators/gedaechtnis';
import { useKeys, type BlockProps } from './common';

const SHOW_MS = 1000;

/** n-back: Positionen im 3 × 3 Raster, Taste J bei Übereinstimmung mit n Schritten vorher. */
export function NbackBlock({ item, mode, onDone }: BlockProps<NbItem>) {
  const p = item.prompt;
  const [i, setI] = useState(-3); // Countdown 3, 2, 1
  const [visible, setVisible] = useState(false);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);
  const responses = useRef<boolean[]>(p.stimuli.map(() => false));
  const rts = useRef<(number | null)[]>(p.stimuli.map(() => null));
  const shownAt = useRef(0);

  useEffect(() => {
    if (i < 0) {
      const t = setTimeout(() => setI((x) => x + 1), 1000);
      return () => clearTimeout(t);
    }
    if (i >= p.stimuli.length) {
      onDone({ responses: responses.current, rts: rts.current });
      return;
    }
    const raf = requestAnimationFrame(() => {
      shownAt.current = performance.now();
    });
    setVisible(true);
    setFlash(null);
    const t1 = setTimeout(() => setVisible(false), SHOW_MS);
    const t2 = setTimeout(() => setI((x) => x + 1), p.isiMs);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // onDone ist stabil genug; nur bei Reizwechsel neu planen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, p.isiMs, p.stimuli.length]);

  const press = () => {
    if (i < 0 || i >= p.stimuli.length || responses.current[i]) return;
    responses.current[i] = true;
    rts.current[i] = Math.round(performance.now() - shownAt.current);
    if (mode === 'lernen') setFlash(p.targets[i] ? 'ok' : 'bad');
  };
  useKeys((e) => {
    if (e.key.toLowerCase() === 'j') {
      e.preventDefault();
      press();
    }
  });

  return (
    <div className="block-center">
      <div className="block-hint">
        {p.n}-back · Taste <kbd>J</kbd>, wenn die Position dieselbe ist wie{' '}
        {p.n === 1 ? 'beim vorigen Reiz' : `${p.n} Reize vorher`}
      </div>
      {i < 0 ? (
        <div className="span-digit">{-i}</div>
      ) : (
        <div className={'nback-grid' + (flash ? ' flash-' + flash : '')}>
          {Array.from({ length: 9 }, (_, k) => (
            <div key={k} className={'nback-cell' + (visible && p.stimuli[i] === k ? ' on' : '')} />
          ))}
        </div>
      )}
      <button className="btn" type="button" onClick={press} disabled={i < 0}>
        Übereinstimmung <kbd>J</kbd>
      </button>
      <div className="muted-ink small">
        Reiz {Math.max(0, Math.min(i + 1, p.stimuli.length))} von {p.stimuli.length}
      </div>
    </div>
  );
}
