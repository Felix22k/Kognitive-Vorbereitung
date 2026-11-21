/**
 * Objektmodell für figurale Aufgaben (Matrizen, Figurenreihen).
 * Ein Feld (Panel) besteht aus 1 oder 2 Ebenen:
 *  - form:   eine große Figur in der Mitte (Form, Größe, Füllung, Drehung, Linienart)
 *  - punkte: kleine Figuren im 3 × 3 Untergitter (Form, Anzahl, Füllung, Position)
 *  - linien: Menge aus 8 Strichen (oben, unten, links, rechts, zwei Diagonalen, zwei Mittellinien)
 */

export type ShapeName =
  | 'kreis'
  | 'quadrat'
  | 'dreieck'
  | 'fuenfeck'
  | 'raute'
  | 'sechseck'
  | 'pfeil';

export interface FormLayer {
  kind: 'form';
  shape: ShapeName;
  size: number; // 0 bis 2
  fill: number; // 0 leer, 1 schraffiert, 2 grau, 3 schwarz
  rot: number; // 0 bis 7, Schritte zu 45°
  line: number; // 0 durchgezogen, 1 gestrichelt
}

export interface PunkteLayer {
  kind: 'punkte';
  shape: ShapeName;
  count: number; // 1 bis 9
  fill: number; // 0 leer, 1 grau, 2 schwarz
  pos: number; // 0 bis 8, nur bei count = 1 sichtbar
}

export interface LinienLayer {
  kind: 'linien';
  set: number; // Bitmaske über 8 Striche
}

export type Layer = FormLayer | PunkteLayer | LinienLayer;

export interface Panel {
  layers: Layer[];
}

export const ALL_SHAPES: ShapeName[] = [
  'kreis',
  'quadrat',
  'dreieck',
  'fuenfeck',
  'raute',
  'sechseck',
];
/** Formen, deren Drehung in 45°-Schritten immer sichtbar ist. */
export const ROTATABLE: ShapeName[] = ['dreieck', 'fuenfeck', 'pfeil'];
/** Kleine Figuren (gut unterscheidbar in klein). */
export const SMALL_SHAPES: ShapeName[] = ['kreis', 'quadrat', 'dreieck', 'raute'];
/** Äußere Formen, in die kleine Figuren passen. */
export const OUTER_SHAPES: ShapeName[] = ['kreis', 'quadrat', 'sechseck'];

export const SHAPE_NAME: Record<ShapeName, string> = {
  kreis: 'Kreis',
  quadrat: 'Quadrat',
  dreieck: 'Dreieck',
  fuenfeck: 'Fünfeck',
  raute: 'Raute',
  sechseck: 'Sechseck',
  pfeil: 'Pfeil',
};
export const FORM_FILL_NAME = ['leer', 'schraffiert', 'grau', 'schwarz'];
export const PUNKTE_FILL_NAME = ['leer', 'grau', 'schwarz'];
export const SIZE_NAME = ['klein', 'mittel', 'groß'];
export const LINE_NAME = ['durchgezogen', 'gestrichelt'];
export const SEGMENT_NAME = [
  'oben',
  'unten',
  'links',
  'rechts',
  'Diagonale ↘',
  'Diagonale ↗',
  'senkrechte Mitte',
  'waagerechte Mitte',
];

/** Anordnung der kleinen Figuren je Anzahl im 3 × 3 Untergitter (wie auf einem Würfel). */
export const LAYOUTS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
  7: [0, 2, 3, 4, 5, 6, 8],
  8: [0, 1, 2, 3, 5, 6, 7, 8],
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

export function popcount(x: number): number {
  let n = 0;
  for (let v = x; v; v &= v - 1) n++;
  return n;
}

// ---------- Merkmale ----------

export type AttrKind = 'cat' | 'ord' | 'cyc' | 'num' | 'set';

export interface AttrRef {
  layer: number;
  key: string;
}

export const attrId = (a: AttrRef) => `${a.layer}.${a.key}`;

export function getAttr(p: Panel, a: AttrRef): number | string {
  return (p.layers[a.layer] as unknown as Record<string, number | string>)[a.key];
}

export function setAttr(p: Panel, a: AttrRef, v: number | string): Panel {
  const layers = p.layers.map((l, i) => (i === a.layer ? ({ ...l, [a.key]: v } as Layer) : l));
  return { layers };
}

export function clonePanel(p: Panel): Panel {
  return { layers: p.layers.map((l) => ({ ...l })) };
}

export interface AttrInfo {
  kind: AttrKind;
  /** Wertebereich (für cat die Liste, sonst Anzahl Werte bzw. Modul) */
  values: (number | string)[];
  name: string;
  /** Tag-Kürzel, z. B. "anzahl" */
  tag: string;
  format(v: number | string): string;
}

export function attrInfo(p: Panel, a: AttrRef): AttrInfo {
  const layer = p.layers[a.layer];
  const two = p.layers.length > 1;
  const where = (l: string) => (two ? ` (${l})` : '');
  if (layer.kind === 'form') {
    switch (a.key) {
      case 'shape':
        return {
          kind: 'cat',
          values: ALL_SHAPES,
          name: 'Form' + where('außen'),
          tag: 'form',
          format: (v) => SHAPE_NAME[v as ShapeName],
        };
      case 'size':
        return {
          kind: 'ord',
          values: [0, 1, 2],
          name: 'Größe',
          tag: 'groesse',
          format: (v) => SIZE_NAME[v as number],
        };
      case 'fill':
        return {
          kind: 'ord',
          values: [0, 1, 2, 3],
          name: 'Füllung' + where('außen'),
          tag: 'fuellung',
          format: (v) => FORM_FILL_NAME[v as number],
        };
      case 'rot':
        return {
          kind: 'cyc',
          values: [0, 1, 2, 3, 4, 5, 6, 7],
          name: 'Drehung',
          tag: 'drehung',
          format: (v) => `${(v as number) * 45}°`,
        };
      default:
        return {
          kind: 'cat',
          values: [0, 1],
          name: 'Linienart',
          tag: 'linienart',
          format: (v) => LINE_NAME[v as number],
        };
    }
  }
  if (layer.kind === 'punkte') {
    switch (a.key) {
      case 'shape':
        return {
          kind: 'cat',
          values: SMALL_SHAPES,
          name: 'Form' + where('innen'),
          tag: 'form',
          format: (v) => SHAPE_NAME[v as ShapeName],
        };
      case 'count':
        return {
          kind: 'num',
          values: [1, 2, 3, 4, 5, 6, 7, 8, 9],
          name: 'Anzahl' + where('innen'),
          tag: 'anzahl',
          format: (v) => String(v),
        };
      case 'fill':
        return {
          kind: 'ord',
          values: [0, 1, 2],
          name: 'Füllung' + where('innen'),
          tag: 'fuellung',
          format: (v) => PUNKTE_FILL_NAME[v as number],
        };
      default:
        return {
          kind: 'cyc',
          values: [0, 1, 2, 3, 4, 5, 6, 7, 8],
          name: 'Position',
          tag: 'position',
          format: (v) => `Feld ${(v as number) + 1} im Raster`,
        };
    }
  }
  return {
    kind: 'set',
    values: [],
    name: 'Linien',
    tag: 'linien',
    format: (v) => {
      const bits = SEGMENT_NAME.filter((_, i) => (v as number) & (1 << i));
      return bits.length ? bits.join(', ') : 'keine';
    },
  };
}

/** Alle Merkmale eines Panels, die tatsächlich sichtbar sind. */
export function visibleAttrs(p: Panel): AttrRef[] {
  const out: AttrRef[] = [];
  p.layers.forEach((l, i) => {
    if (l.kind === 'form') {
      out.push({ layer: i, key: 'shape' }, { layer: i, key: 'line' });
      // Als äußere Hülle um kleine Figuren bleiben Größe, Füllung und Drehung fest
      if (p.layers.length === 1) {
        out.push({ layer: i, key: 'fill' }, { layer: i, key: 'size' });
        if (ROTATABLE.includes(l.shape)) out.push({ layer: i, key: 'rot' });
      }
    } else if (l.kind === 'punkte') {
      out.push({ layer: i, key: 'shape' }, { layer: i, key: 'count' }, { layer: i, key: 'fill' });
      if (l.count === 1) out.push({ layer: i, key: 'pos' });
    } else out.push({ layer: i, key: 'set' });
  });
  return out;
}

/** Schlüssel für die sichtbare Darstellung (gleicher Schlüssel = sieht gleich aus). */
export function renderKey(p: Panel): string {
  return p.layers
    .map((l) => {
      if (l.kind === 'form') {
        if (p.layers.length > 1) return `F${l.shape}/${l.line}`;
        const rot = ROTATABLE.includes(l.shape) ? l.rot : 0;
        return `F${l.shape}/${l.size}/${l.fill}/${rot}/${l.line}`;
      }
      if (l.kind === 'punkte')
        return `P${l.shape}/${l.count}/${l.fill}/${l.count === 1 ? l.pos : '-'}`;
      return `L${l.set}`;
    })
    .join('|');
}
