import type { AreaId, Generator } from '../core/types';
import { kopfrechnenGenerator } from '../generators/kopfrechnen';
import { zahlenreihenGenerator } from '../generators/zahlenreihen';
import { matrizenGenerator } from '../generators/matrizen';
import { figurenreihenGenerator } from '../generators/figurenreihen';
import { rotation4Generator, rotationGenerator } from '../generators/rotation';
import { wuerfelGenerator } from '../generators/wuerfel';
import { wuerfelZaehlenGenerator } from '../generators/wuerfelZaehlen';
import {
  blockspanneGenerator,
  faktenGenerator,
  nbackGenerator,
  wegeGenerator,
  zahlenspanneGenerator,
} from '../generators/gedaechtnis';
import {
  durchstreichenGenerator,
  rechenketteGenerator,
  symbolZahlGenerator,
} from '../generators/konzentration';

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
  /** Treppenregel (Spannen-Aufgaben: +1 nach richtig, −1 nach zwei Fehlern) */
  stair?: 'standard' | 'span';
  /** Startstufe im Lernmodus beim ersten Mal (Standard 1) */
  startLevel?: number;
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
    description: '3 × 3 Raster, ein Feld fehlt. Finde die Regeln je Merkmal.',
    milestone: 2,
    generator: matrizenGenerator as Generator,
    instructions:
      'In jeder Zeile (ab Stufe 7 auch in jeder Spalte) gelten Regeln für einzelne Merkmale: Form, Anzahl, Füllung, Größe, Drehung, Linien. Finde für jedes Merkmal die Regel und wähle die Figur, die in das leere Feld gehört. Auswahl mit A bis H oder 1 bis 8, Enter bestätigt. Ab Stufe 8 kann auch ein anderes Feld als unten rechts fehlen.',
    exampleLevels: [1, 4],
    itemsLernen: 8,
    itemsTest: 12,
    timeText: '45 bis 90 s',
  },
  {
    id: 'figurenreihen',
    areaId: 'logik',
    name: 'Figurenreihen',
    description: 'Welche Figur setzt die Reihe fort?',
    milestone: 2,
    generator: figurenreihenGenerator as Generator,
    instructions:
      'Die fünf Figuren verändern sich nach festen Regeln: gleichmäßig (zum Beispiel jedes Mal 45° weiter gedreht) oder im Wechsel zwischen zwei Zuständen. Wähle die Figur, die an Stelle 6 kommt. Auswahl mit A bis E oder 1 bis 5, Enter bestätigt.',
    exampleLevels: [1, 5],
    itemsLernen: 8,
    itemsTest: 10,
    timeText: '30 bis 60 s',
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
    name: 'Mentale Rotation: gleich oder gespiegelt',
    description: 'Tempo-Format: Ist die rechte Figur dieselbe, nur gedreht, oder gespiegelt?',
    milestone: 3,
    generator: rotationGenerator as Generator,
    instructions:
      'Links und rechts siehst du eine Figur aus Würfeln. Die rechte ist gedreht. Ist sie dieselbe Figur (Taste F) oder ihr Spiegelbild (Taste J)? Die Taste antwortet sofort. Es zählt Tempo: Die Zeit ist knapp (7 bis 4 Sekunden). Ein Block hat 50 Aufgaben, die Auswertung zeigt die Zeit je Drehwinkel.',
    exampleLevels: [1, 4],
    itemsLernen: 20,
    itemsTest: 50,
    timeText: '7 bis 4 s',
  },
  {
    id: 'rotation4',
    areaId: 'raum',
    name: 'Mentale Rotation: zwei aus vier',
    description: 'Welche zwei Optionen zeigen die Zielfigur, nur gedreht?',
    milestone: 3,
    generator: rotation4Generator as Generator,
    instructions:
      'Links oben steht die Zielfigur. Genau zwei der vier Optionen zeigen dieselbe Figur, nur gedreht. Die beiden anderen sind gespiegelt oder baulich anders (ein Würfel sitzt woanders). Wähle mit 1 bis 4 oder A bis D zwei Optionen und bestätige mit Enter. Einen Punkt gibt es nur, wenn beide richtig sind.',
    exampleLevels: [1, 5],
    itemsLernen: 8,
    itemsTest: 10,
    timeText: '30 bis 60 s',
  },
  {
    id: 'wuerfelDrehen',
    areaId: 'raum',
    name: 'Würfel drehen',
    description: 'Welcher Würfel ist derselbe in anderer Lage? Ab Stufe 3 auch Faltvorlagen.',
    milestone: 3,
    generator: wuerfelGenerator as Generator,
    instructions:
      'Der Würfel trägt sechs verschiedene Symbole. Welche Ansicht zeigt denselben Würfel in anderer Lage? Achte auf die Reihenfolge der Flächen um eine Ecke und auf die Ausrichtung der Symbole. Ab Stufe 3 gibt es auch Faltvorlagen, ab Stufe 5 die Antwort „keine passt“ (E). Auswahl mit A bis E oder 1 bis 5, Enter bestätigt.',
    exampleLevels: [1, 4],
    itemsLernen: 8,
    itemsTest: 10,
    timeText: '30 bis 60 s',
  },
  {
    id: 'wuerfelZaehlen',
    areaId: 'raum',
    name: 'Würfel zählen',
    description: 'Wie viele Würfel sind es? Ab Stufe 7 auch: Wie viele berühren genau zwei andere?',
    milestone: 3,
    generator: wuerfelZaehlenGenerator as Generator,
    instructions:
      'Die Würfel stehen in Säulen auf einem Bodenraster, keiner schwebt. Zähle alle Würfel, auch die verdeckten unter sichtbaren. Ab Stufe 7 lautet die Frage manchmal: Wie viele Würfel berühren genau zwei andere mit einer ganzen Fläche? Zahl eintippen, Enter bestätigt.',
    exampleLevels: [1, 5],
    itemsLernen: 10,
    itemsTest: 12,
    timeText: '30 bis 45 s',
  },
  {
    id: 'zahlenspanne',
    areaId: 'gedaechtnis',
    name: 'Zahlenspanne',
    description: 'Ziffern merken, vorwärts und rückwärts.',
    milestone: 4,
    generator: zahlenspanneGenerator as Generator,
    stair: 'span',
    instructions:
      'Ziffern erscheinen nacheinander im Sekundentakt. Danach tippst du sie ein: vorwärts in der gezeigten Reihenfolge oder rückwärts, je nach Ansage. Die Länge passt sich an: eine Ziffer mehr nach einer richtigen Antwort, eine weniger nach zwei Fehlern in Folge.',
    itemsLernen: 12,
    itemsTest: 14,
    timeText: '1 Ziffer pro Sekunde',
  },
  {
    id: 'blockspanne',
    areaId: 'gedaechtnis',
    name: 'Blockspanne',
    description: 'Reihenfolge aufleuchtender Felder merken.',
    milestone: 4,
    generator: blockspanneGenerator as Generator,
    stair: 'span',
    instructions:
      'Neun Felder sind unregelmäßig verteilt. Sie leuchten nacheinander auf. Danach klickst du sie in derselben Reihenfolge an oder rückwärts, je nach Ansage. Tasten 1 bis 9 gehen auch, die Rücktaste nimmt den letzten Klick zurück.',
    itemsLernen: 10,
    itemsTest: 12,
    timeText: 'je Feld knapp 1 s',
  },
  {
    id: 'nback',
    areaId: 'gedaechtnis',
    name: 'n-back',
    description: 'Stimmt die Position mit der von n Schritten vorher überein?',
    milestone: 4,
    generator: nbackGenerator as Generator,
    instructions:
      'Ein Feld im 3 × 3 Raster leuchtet alle 2,5 Sekunden auf. Drücke J, wenn die Position dieselbe ist wie n Reize vorher (Stufe 1 bis 3: 1-back, 4 bis 6: 2-back, ab 7: 3-back). Etwa 30 % der Reize sind Treffer. Im Lernmodus blinkt das Raster grün oder rot.',
    itemsLernen: 2,
    itemsTest: 3,
    timeText: '2,5 s pro Reiz',
  },
  {
    id: 'fakten',
    areaId: 'gedaechtnis',
    name: 'Fakten merken',
    description: 'Lagemeldung einprägen, später Fragen beantworten.',
    milestone: 4,
    generator: faktenGenerator as Generator,
    instructions:
      'Du bekommst eine erfundene Lagemeldung mit 11 bis 20 Fakten (Namen, Dienstgrade, Uhrzeiten, Planquadrate, Kennzeichen, Funkrufnamen, Zahlen) und 90 Sekunden zum Einprägen. Danach rechnest du 1 bis 3 Minuten zur Ablenkung, dann folgen 10 Fragen mit je 4 Antworten. Ab Stufe 6 kommen ähnlich klingende Namen vor.',
    itemsLernen: 1,
    itemsTest: 1,
    timeText: '4 bis 6 min je Durchgang',
  },
  {
    id: 'wege',
    areaId: 'gedaechtnis',
    name: 'Wege merken',
    description: 'Route auf dem Stadtplan merken.',
    milestone: 4,
    generator: wegeGenerator as Generator,
    instructions:
      'Auf einem Stadtplan mit 8 × 8 Kreuzungen wird eine Route Stück für Stück gezeigt (30 bis 60 Sekunden). Danach verschwindet sie. Bis Stufe 5 klickst du den Endpunkt an, ab Stufe 6 alle Abbiegepunkte in der richtigen Reihenfolge. Pfeiltasten und Leertaste gehen auch.',
    itemsLernen: 3,
    itemsTest: 4,
    timeText: '30 bis 60 s Route',
  },
  {
    id: 'durchstreichen',
    areaId: 'konzentration',
    name: 'Durchstreichtest',
    description: 'Zielzeichen in Zeilen aus b, d, p, q markieren.',
    milestone: 4,
    generator: durchstreichenGenerator as Generator,
    instructions:
      'Eigener Durchstreichtest: 14 Zeilen mit je 40 Zeichen aus b, d, p, q mit 1 bis 4 Strichen. Markiere jedes Zielzeichen (die Regel steht oben und wechselt je Durchgang). Nach Ablauf der Zeit springt die Zeile automatisch weiter. Gemessen werden bearbeitete Zeichen, Auslassungen, Verwechslungen, Konzentrationsleistung und Schwankung.',
    itemsLernen: 1,
    itemsTest: 1,
    timeText: '20 bis 12 s je Zeile',
  },
  {
    id: 'symbolZahl',
    areaId: 'konzentration',
    name: 'Symbol-Zahl-Kodierung',
    description: 'Symbole mit Hilfe der Schlüsseltabelle verrechnen.',
    milestone: 4,
    generator: symbolZahlGenerator as Generator,
    instructions:
      'Eine Schlüsseltabelle ordnet 9 Symbolen Ziffern zu (neue Zuordnung je Block). Rechne die Aufgaben wie ◆ + ▲ so schnell wie möglich und bestätige mit Enter. Ein Block dauert 2 Minuten.',
    itemsLernen: 1,
    itemsTest: 2,
    timeText: '2 min je Block',
  },
  {
    id: 'rechenkette',
    areaId: 'konzentration',
    name: 'Rechenkette',
    description: 'Fortlaufend addieren, nur die Einerstelle eintippen.',
    milestone: 4,
    generator: rechenketteGenerator as Generator,
    instructions:
      'Zwei benachbarte Zahlen sind markiert. Addiere sie und tippe nur die Einerstelle als Taste (zum Beispiel 7 + 8 = 15 → 5). Danach rückt die Markierung eine Zahl weiter. Die Auswertung zeigt die richtigen Antworten je 30 Sekunden, so wird die Ermüdung sichtbar.',
    itemsLernen: 1,
    itemsTest: 1,
    timeText: '3 bis 5 min',
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
  'mr.gleichSpiegel': 'Rotation: gleich oder gespiegelt',
  'mr.vierOptionen': 'Rotation: zwei aus vier',
  'mr.achse.ebene': 'Rotation in der Bildebene',
  'mr.achse.tiefe': 'Rotation in die Tiefe',
  'mr.achse.kombiniert': 'Rotation um zwei Achsen',
  'wd.drehen': 'Würfel in anderer Lage',
  'wd.netz': 'Würfel aus Faltvorlage',
  'wz.zaehlen': 'Würfel zählen',
  'wz.kontakt': 'Würfel mit genau zwei Nachbarn',
  'gd.zahlenspanne': 'Zahlenspanne',
  'gd.zahlenspanne.vor': 'Zahlenspanne vorwärts',
  'gd.zahlenspanne.rueck': 'Zahlenspanne rückwärts',
  'gd.blockspanne': 'Blockspanne',
  'gd.blockspanne.vor': 'Blockspanne vorwärts',
  'gd.blockspanne.rueck': 'Blockspanne rückwärts',
  'gd.nback': 'n-back',
  'gd.nback.1': '1-back',
  'gd.nback.2': '2-back',
  'gd.nback.3': '3-back',
  'gd.fakten': 'Fakten merken',
  'gd.fakten.aehnlich': 'Fakten mit ähnlichen Namen',
  'gd.wege': 'Wege merken',
  'gd.wege.ende': 'Wege: Endpunkt',
  'gd.wege.folge': 'Wege: Abbiegepunkte',
  'ko.durchstreichen': 'Durchstreichtest',
  'ko.symbolZahl': 'Symbol-Zahl-Kodierung',
  'ko.rechenkette': 'Rechenkette',
};

const FIG_RULES: Record<string, string> = {
  konstant: 'konstant in der Zeile',
  progression: 'Progression',
  vert3: 'Verteilung von drei Werten',
  addSub: 'Addition/Subtraktion',
  xor: 'XOR',
  wechsel: 'Wechsel',
};
const FIG_ATTRS: Record<string, string> = {
  form: 'Form',
  anzahl: 'Anzahl',
  fuellung: 'Füllung',
  groesse: 'Größe',
  drehung: 'Drehung',
  position: 'Position',
  linien: 'Linien',
  linienart: 'Linienart',
};

export function tagName(t: string): string {
  if (TAG_NAMES[t]) return TAG_NAMES[t];
  const [area, rule, attr] = t.split('.');
  if ((area === 'mx' || area === 'fr') && FIG_RULES[rule]) {
    const prefix = area === 'mx' ? 'Matrix' : 'Reihe';
    return `${prefix}: ${FIG_RULES[rule]}${attr ? ` (${FIG_ATTRS[attr] ?? attr})` : ''}`;
  }
  return t;
}
