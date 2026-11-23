/**
 * Prüfung der festen Wort- und Aufgabenbanken (npm run validate:banks):
 * Schema, keine Dubletten, Lösung unter den Optionen und nicht zugleich
 * Ablenker, Erklärung vorhanden.
 */
import { describe, expect, it } from 'vitest';
import { BV_DATA, RS_DATA, WA_DATA } from '../generators/sprache';
import { TE_BANK } from '../generators/technik';

const stufeOk = (s: number) => Number.isInteger(s) && s >= 1 && s <= 10;

describe('Wortanalogien (analogien.json)', () => {
  it('Schema, Ablenker, keine Dubletten', () => {
    const seen = new Set<string>();
    let n = 0;
    for (const rel of WA_DATA.beziehungen) {
      expect(rel.id && rel.name).toBeTruthy();
      expect(rel.paare.length).toBeGreaterThanOrEqual(8);
      for (const p of rel.paare) {
        n++;
        const key = `${rel.id}:${p.wort}:${p.ziel}`;
        expect(seen.has(key), key).toBe(false);
        seen.add(key);
        expect(stufeOk(p.stufe), key).toBe(true);
        expect(p.wort.trim() && p.ziel.trim(), key).toBeTruthy();
        expect(p.ablenker.length, key).toBe(4);
        expect(new Set(p.ablenker).size, key).toBe(4);
        expect(p.ablenker.includes(p.ziel), key).toBe(false);
        expect(p.ablenker.includes(p.wort), key).toBe(false);
      }
    }
    expect(n).toBeGreaterThanOrEqual(150);
  });
});

describe('Begriffe (begriffe.json)', () => {
  it('jedes Wort genau einer Kategorie, mindestens 4 Wörter je Kategorie', () => {
    const all = BV_DATA.kategorien.flatMap((k) => k.woerter);
    expect(new Set(all).size).toBe(all.length);
    const names = BV_DATA.kategorien.map((k) => k.name);
    expect(new Set(names).size).toBe(names.length);
    for (const k of BV_DATA.kategorien) {
      expect(stufeOk(k.stufe), k.name).toBe(true);
      expect(k.woerter.length, k.name).toBeGreaterThanOrEqual(4);
      expect(k.gruppe, k.name).toBeTruthy();
    }
    // Ab Stufe 6 werden Nachbarkategorien derselben Gruppe gebraucht
    const groups = new Map<string, number>();
    for (const k of BV_DATA.kategorien) groups.set(k.gruppe, (groups.get(k.gruppe) ?? 0) + 1);
    expect([...groups.values()].filter((v) => v >= 2).length).toBeGreaterThanOrEqual(10);
  });
});

describe('Rechtschreibung (rechtschreibung.json)', () => {
  const E = RS_DATA.eintraege;
  it('mindestens 400 Einträge, eindeutige IDs', () => {
    expect(E.length).toBeGreaterThanOrEqual(400);
    expect(new Set(E.map((e) => e.id)).size).toBe(E.length);
  });
  it('Lösung eindeutig, keine Dubletten, Erklärung wo nötig', () => {
    const seen = new Set<string>();
    for (const e of E) {
      expect(stufeOk(e.stufe), e.id).toBe(true);
      if (e.typ === 'dasDass') {
        const gaps = e.satz.split('___').length - 1;
        expect(gaps, e.id).toBe(e.loesung.length);
        for (const w of e.loesung) expect(['das', 'dass'], e.id).toContain(w.toLowerCase());
        const key = 'd:' + e.satz;
        expect(seen.has(key), key).toBe(false);
        seen.add(key);
        continue;
      }
      const key = `${e.typ}:${'satz' in e ? e.satz : ''}:${e.richtig}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
      expect(e.falsch.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.falsch.includes(e.richtig), e.id).toBe(false);
      expect(new Set(e.falsch).size, e.id).toBe(e.falsch.length);
      for (const f of e.falsch) expect(f.trim(), e.id).toBeTruthy();
      if (e.typ === 'verwechslung') expect(e.satz.split('___').length - 1, e.id).toBe(1);
      if (e.typ === 'gross' || e.typ === 'getrennt') {
        expect(e.falsch.length, e.id).toBe(3);
        expect(e.hinweis.trim(), e.id).toBeTruthy();
      }
    }
  });
  it('alle Aufgabenarten vorhanden', () => {
    const typen = new Set(E.map((e) => e.typ));
    expect([...typen].sort()).toEqual(['dasDass', 'getrennt', 'gross', 'verwechslung', 'wort']);
  });
});

describe('Technik: feste Sammlung (technik.json)', () => {
  it('mindestens 60 Aufgaben, 3 bis 5 Optionen, Erklärung, keine Dubletten', () => {
    expect(TE_BANK.length).toBeGreaterThanOrEqual(60);
    expect(new Set(TE_BANK.map((a) => a.id)).size).toBe(TE_BANK.length);
    expect(new Set(TE_BANK.map((a) => a.frage)).size).toBe(TE_BANK.length);
    for (const a of TE_BANK) {
      expect(stufeOk(a.stufe), a.id).toBe(true);
      const n = a.falsch.length + 1;
      expect(n >= 3 && n <= 5, a.id).toBe(true);
      expect(a.falsch.includes(a.richtig), a.id).toBe(false);
      expect(new Set(a.falsch).size, a.id).toBe(a.falsch.length);
      expect(a.erklaerung.trim().length, a.id).toBeGreaterThan(10);
    }
    const themen = new Set(TE_BANK.map((a) => a.thema));
    for (const t of ['strom', 'waerme', 'auftrieb', 'hydraulik', 'roehren', 'schwerpunkt', 'kurve'])
      expect(themen.has(t), t).toBe(true);
  });
});
