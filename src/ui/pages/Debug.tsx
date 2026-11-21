import { useMemo, useState } from 'react';
import { MODULES, isAvailable, tagName } from '../../modules/catalog';
import { PromptView, SolutionView, choiceInfo } from '../../modules/views';
import { deriveSeed } from '../../core/rng';
import { LETTERS } from '../../generators/common';
import type { Item } from '../../core/types';

/**
 * Debug-Seite: 20 Beispielaufgaben je Generator und Stufe mit Lösung,
 * Regel-Tags und Prüfergebnis, um die Qualität mit eigenen Augen zu prüfen.
 */
export function Debug() {
  const mods = MODULES.filter(isAvailable);
  const [moduleId, setModuleId] = useState(mods[0]?.id ?? '');
  const [level, setLevel] = useState(5);
  const [base, setBase] = useState(1);
  const mod = mods.find((m) => m.id === moduleId);

  const items = useMemo(() => {
    if (!mod?.generator) return [];
    return Array.from({ length: 20 }, (_, i) => {
      const seed = deriveSeed(base * 7919 + level, i);
      const t0 = performance.now();
      try {
        const item = mod.generator!.generate(seed, level) as Item;
        const ms = performance.now() - t0;
        return { seed, item, ms, errors: mod.generator!.validate(item), fail: '' };
      } catch (e) {
        return { seed, item: null, ms: 0, errors: [], fail: String(e) };
      }
    });
  }, [mod, level, base]);

  return (
    <div className="page">
      <h1>Debug: Generatoren prüfen</h1>
      <p className="muted">
        20 Beispielaufgaben je Generator und Stufe mit Lösung. Seed und Generatorversion stehen an
        jeder Aufgabe, damit sich fehlerhafte Aufgaben exakt melden lassen.
      </p>
      <div className="row card" style={{ marginBottom: 18 }}>
        <label className="field" style={{ margin: 0 }}>
          <span>Generator</span>
          <select value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
            {mods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ margin: 0 }}>
          <span>Stufe</span>
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <button className="btn" style={{ marginTop: 18 }} onClick={() => setBase((b) => b + 1)}>
          Neu würfeln
        </button>
        <span className="muted small" style={{ marginTop: 18 }}>
          {items.filter((x) => x.errors.length || x.fail).length} mit Prüffehlern · max.{' '}
          {Math.max(...items.map((x) => x.ms)).toFixed(1)} ms pro Aufgabe
        </span>
      </div>
      <div className="stack">
        {items.map(({ seed, item, errors, fail, ms }, i) => {
          if (!item)
            return (
              <div key={i} className="card" style={{ borderColor: 'var(--bad)' }}>
                Seed {seed}: {fail}
              </div>
            );
          const ch = choiceInfo(item);
          return (
            <div
              key={i}
              className="card stack"
              style={errors.length ? { borderColor: 'var(--bad)' } : undefined}
            >
              <div className="row small muted">
                <strong style={{ color: 'var(--text)' }}>#{i + 1}</strong>
                <span className="mono">
                  {item.generatorId} v{item.generatorVersion} · Seed {seed} · Stufe {item.level}
                </span>
                <span>{item.tags.map(tagName).join(' · ')}</span>
                <span className="spacer" />
                <span>{ms.toFixed(1)} ms</span>
              </div>
              {errors.length > 0 && (
                <div className="small" style={{ color: 'var(--bad)' }}>
                  Prüffehler: {errors.join('; ')}
                </div>
              )}
              <div className="paper" style={{ minHeight: 0, padding: 20 }}>
                <PromptView item={item} />
              </div>
              {ch && item.answerKind === 'choice' ? (
                <div className={'options' + (ch.figures ? ' figures' : '')}>
                  {Array.from({ length: ch.count }, (_, k) => (
                    <div
                      key={k}
                      className={
                        'option' +
                        (ch.figures ? ' figure' : '') +
                        (k === ch.correctIndex ? ' is-correct' : '')
                      }
                    >
                      <span className="key">{LETTERS[k]}</span>
                      {ch.render(k)}
                    </div>
                  ))}
                </div>
              ) : (
                <div>
                  Lösung: <strong>{item.correctLabel}</strong>
                </div>
              )}
              <div className="explanation" style={{ marginTop: 0 }}>
                <SolutionView item={item} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
