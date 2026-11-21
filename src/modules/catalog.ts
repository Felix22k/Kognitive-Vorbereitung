import type { AreaId, Generator } from '../core/types';
import { kopfrechnenGenerator } from '../generators/kopfrechnen';
import { zahlenreihenGenerator } from '../generators/zahlenreihen';

export interface AreaDef {
  id: AreaId;
  name: string;
  icon: 'sprechblase' | 'verzweigung' | 'wuerfel' | 'raster' | 'ziel' | 'puls' | 'uhr';
}

export interface ModuleDef {
  id: string;
  areaId: AreaId;
  name: string;
  description: string;
  /** Meilenstein, in dem das Modul gebaut wird. */
  milestone: number;
  generator?: Generator;
  /** Kurze Anleitung für den ersten Start. */
  instructions?: string;
  /** Stufen für die beiden Beispielaufgaben der Anleitung. */
  exampleLevels?: [number, number];
  /** Standard-Aufgabenanzahl je Durchgang. */
  itemsLernen?: number;
  itemsTest?: number;
  /** Zeitspanne für die Anzeige, z. B. "15 bis 45 s". */
  timeText?: string;
}

export const AREAS: AreaDef[] = [
  { id: 'sprache', name: 'Sprache und Zahlen', icon: 'sprechblase' },
  { id: 'logik', name: 'Logik und Technik', icon: 'verzweigung' },
  { id: 'raum', name: 'Räumliches Denken', icon: 'wuerfel' },
  { id: 'gedaechtnis', name: 'Gedächtnis', icon: 'raster' },
  { id: 'konzentration', name: 'Konzentration', icon: 'ziel' },
  { id: 'reaktion', name: 'Reaktion und Belastung', icon: 'puls' },
  { id: 'wachsamkeit', name: 'Wachsamkeit', icon: 'uhr' },
];

export const MODULES: ModuleDef[] = [
  {
    id: 'kopfrechnen',
    areaId: 'sprache',
    name: 'Kopfrechnen',
    description: 'Grundrechenarten, Klammern, Prozent, Brüche, Wurzeln, Flächen, Dezimalzahlen.',
    milestone: 1,
    generator: kopfrechnenGenerator as Generator,
    instructions:
      'Rechne die Aufgabe im Kopf und tippe das Ergebnis ein. Dezimalzahlen mit Komma oder Punkt, Brüche als 3/4. Enter bestätigt. Punkt vor Strich beachten.',
    exampleLevels: [1, 4],
    itemsLernen: 12,
    itemsTest: 15,
    timeText: '15 bis 45 s',
  },
  {
    id: 'textaufgaben',
    areaId: 'sprache',
    name: 'Textaufgaben',
    description: 'Dreisatz, Geschwindigkeit, Prozent, Zins, Maßstab, Marschdauer.',
    milestone: 6,
  },
  {
    id: 'zahlenreihen',
    areaId: 'sprache',
    name: 'Zahlenreihen',
    description: 'Finde die Regel und ergänze das fehlende Glied.',
    milestone: 1,
    generator: zahlenreihenGenerator as Generator,
    instructions:
      'Die Zahlen folgen einer Regel. Finde sie und tippe die Zahl ein, die an die Stelle des Fragezeichens gehört. Tipp: Bilde zuerst die Differenzen zwischen den Gliedern. Ab Stufe 7 kann auch ein Glied in der Mitte fehlen.',
    exampleLevels: [1, 3],
    itemsLernen: 10,
    itemsTest: 12,
    timeText: '30 bis 60 s',
  },
  {
    id: 'wortanalogien',
    areaId: 'sprache',
    name: 'Wortanalogien',
    description: 'Hammer : Nagel = Schraubendreher : ?',
    milestone: 6,
  },
  {
    id: 'begriffe',
    areaId: 'sprache',
    name: 'Begriffe vergleichen',
    description: 'Was passt nicht, Oberbegriffe, Gemeinsamkeiten.',
    milestone: 6,
  },
  {
    id: 'rechtschreibung',
    areaId: 'sprache',
    name: 'Rechtschreibung',
    description: 'Falsch geschriebene Wörter, das/dass, Groß- und Kleinschreibung.',
    milestone: 6,
  },
  {
    id: 'matrizen',
    areaId: 'logik',
    name: 'Figurale Matrizen',
    description: '3 × 3 Raster, ein Feld fehlt.',
    milestone: 2,
  },
  {
    id: 'figurenreihen',
    areaId: 'logik',
    name: 'Figurenreihen',
    description: 'Welche Figur setzt die Reihe fort?',
    milestone: 2,
  },
  {
    id: 'technik',
    areaId: 'logik',
    name: 'Technisches Verständnis',
    description: 'Zahnräder, Riemen, Hebel, Flaschenzüge, schiefe Ebene.',
    milestone: 6,
  },
  {
    id: 'rotation',
    areaId: 'raum',
    name: 'Mentale Rotation 3D',
    description: 'Gleich oder gespiegelt? Würfelfiguren im Raum drehen.',
    milestone: 3,
  },
  {
    id: 'wuerfelDrehen',
    areaId: 'raum',
    name: 'Würfel drehen',
    description: 'Welcher Würfel ist derselbe in anderer Lage?',
    milestone: 3,
  },
  {
    id: 'wuerfelZaehlen',
    areaId: 'raum',
    name: 'Würfel zählen',
    description: 'Wie viele Würfel sind es?',
    milestone: 3,
  },
  {
    id: 'zahlenspanne',
    areaId: 'gedaechtnis',
    name: 'Zahlenspanne',
    description: 'Ziffern merken, vorwärts und rückwärts.',
    milestone: 4,
  },
  {
    id: 'blockspanne',
    areaId: 'gedaechtnis',
    name: 'Blockspanne',
    description: 'Reihenfolge aufleuchtender Felder merken.',
    milestone: 4,
  },
  {
    id: 'nback',
    areaId: 'gedaechtnis',
    name: 'n-back',
    description: 'Stimmt die Position mit der von n Schritten vorher überein?',
    milestone: 4,
  },
  {
    id: 'fakten',
    areaId: 'gedaechtnis',
    name: 'Fakten merken',
    description: 'Lagemeldung einprägen, später Fragen beantworten.',
    milestone: 4,
  },
  {
    id: 'wege',
    areaId: 'gedaechtnis',
    name: 'Wege merken',
    description: 'Route auf dem Stadtplan merken.',
    milestone: 4,
  },
  {
    id: 'durchstreichen',
    areaId: 'konzentration',
    name: 'Durchstreichtest',
    description: 'Zielzeichen in Zeilen aus b, d, p, q markieren.',
    milestone: 4,
  },
  {
    id: 'symbolZahl',
    areaId: 'konzentration',
    name: 'Symbol-Zahl-Kodierung',
    description: 'Symbole mit Hilfe der Schlüsseltabelle verrechnen.',
    milestone: 4,
  },
  {
    id: 'rechenkette',
    areaId: 'konzentration',
    name: 'Rechenkette',
    description: 'Fortlaufend addieren, nur die Einerstelle eintippen.',
    milestone: 4,
  },
  {
    id: 'wahlreaktion',
    areaId: 'reaktion',
    name: 'Wahlreaktion',
    description: 'Auf eines von vier Feldern schnell reagieren.',
    milestone: 5,
  },
  {
    id: 'determination',
    areaId: 'reaktion',
    name: 'Determinationstest-ähnlich',
    description: 'Farben und Töne unter Tempo zuordnen.',
    milestone: 5,
  },
  {
    id: 'stroop',
    areaId: 'reaktion',
    name: 'Farb-Wort-Interferenz',
    description: 'Schriftfarbe nennen, nicht das Wort.',
    milestone: 5,
  },
  {
    id: 'vigilanz',
    areaId: 'wachsamkeit',
    name: 'Vigilanz-Uhr',
    description: 'Doppelsprünge eines Lichtpunkts über lange Zeit erkennen.',
    milestone: 5,
  },
];

export const MODULE_BY_ID: Record<string, ModuleDef> = Object.fromEntries(
  MODULES.map((m) => [m.id, m]),
);

export const isAvailable = (m: ModuleDef) => !!m.generator;

export function modulesOfArea(areaId: AreaId): ModuleDef[] {
  return MODULES.filter((m) => m.areaId === areaId);
}

/** Lesbare Namen für Regel-Tags (Fehlerprotokoll). */
export const TAG_NAMES: Record<string, string> = {
  'kr.add': 'Addition',
  'kr.sub': 'Subtraktion',
  'kr.mul': 'Multiplikation',
  'kr.div': 'Division',
  'kr.klammer': 'Klammer, Punkt vor Strich',
  'kr.prozent': 'Prozent',
  'kr.bruch': 'Brüche',
  'kr.wurzel': 'Wurzeln',
  'kr.flaeche': 'Flächen',
  'kr.dezimal': 'Dezimalzahlen',
  'zr.arith': 'konstante Differenz',
  'zr.geom': 'konstanter Faktor',
  'zr.diff2': 'gleichmäßig steigende Differenzen',
  'zr.diffGeom': 'sich verdoppelnde Differenzen',
  'zr.zweiReihen': 'zwei verschränkte Reihen',
  'zr.wechsel': 'zwei Operationen im Wechsel',
  'zr.zyklus3': 'drei Operationen im Zyklus',
  'zr.fibonacci': 'Summe der Vorgänger',
  'zr.steigFaktor': 'steigender Faktor',
  'zr.mulAdd': 'mal q plus c',
  'zr.potenz': 'Quadrat- und Kubikzahlen',
  'zr.prim': 'Primzahlen',
  'zr.diffZweiReihen': 'verschränkte Differenzen',
};

export const tagName = (t: string) => TAG_NAMES[t] ?? t;
