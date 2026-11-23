/**
 * Ablauf der Kurz- und Vollsimulation. Alle Teile laufen im Testmodus
 * (adaptiv, mit Zeitlimit, ohne Rückmeldung). Teile mit `minutes` enden nach
 * Ablauf der Zeit mit der laufenden Aufgabe; Block-Module haben eine eigene
 * Dauer (über `opts`).
 */
export interface SimPart {
  moduleId: string;
  /** Zeitbudget in Minuten (Aufgaben-Module) */
  minutes?: number;
  /** feste Anzahl (Block-Module: 1) */
  count?: number;
  opts?: Record<string, string>;
}

export interface SimBlock {
  id: string;
  name: string;
  /** geplante Dauer in Minuten (für Anzeige und Gesamtzeit) */
  minutes: number;
  intro: string;
  parts: SimPart[];
}

export interface SimDef {
  id: 'kurzsim' | 'vollsim';
  name: string;
  blocks: SimBlock[];
}

export const KURZSIM: SimDef = {
  id: 'kurzsim',
  name: 'Kurzsimulation',
  blocks: [
    {
      id: 'zr',
      name: 'Zahlenreihen',
      minutes: 6,
      intro: 'Ergänze das fehlende Glied. Die Schwierigkeit passt sich deinen Antworten an.',
      parts: [{ moduleId: 'zahlenreihen', minutes: 6 }],
    },
    {
      id: 'mx',
      name: 'Figurale Matrizen',
      minutes: 8,
      intro: 'Finde die Figur für das leere Feld. Auswahl mit A bis H, Enter bestätigt.',
      parts: [{ moduleId: 'matrizen', minutes: 8 }],
    },
    {
      id: 'mr',
      name: 'Mentale Rotation',
      minutes: 5,
      intro: 'Gleich (F) oder gespiegelt (J)? Die Taste antwortet sofort, die Zeit ist knapp.',
      parts: [{ moduleId: 'rotation', minutes: 5 }],
    },
    {
      id: 'kr',
      name: 'Kopfrechnen',
      minutes: 5,
      intro: 'Ergebnis eintippen, Enter bestätigt. Ohne Hilfsmittel.',
      parts: [{ moduleId: 'kopfrechnen', minutes: 5 }],
    },
    {
      id: 'wa',
      name: 'Wortanalogien',
      minutes: 3,
      intro: 'Welches Wort ergänzt die Analogie?',
      parts: [{ moduleId: 'wortanalogien', minutes: 3 }],
    },
    {
      id: 'dt',
      name: 'Determination',
      minutes: 3,
      intro:
        'Farben und Töne den Tasten zuordnen. Adaptiv: Das Tempo steigt nach richtigen Antworten. Die Legende blendest du mit L ein und aus.',
      parts: [{ moduleId: 'determination', count: 1, opts: { modus: 'adaptiv', dauer: '3' } }],
    },
  ],
};

export const VOLLSIM: SimDef = {
  id: 'vollsim',
  name: 'Vollsimulation',
  blocks: [
    {
      id: 'b1',
      name: 'Rechnen',
      minutes: 15,
      intro:
        'Kopfrechnen (8 min), danach Textaufgaben (7 min). Papier ist nur für Textaufgaben erlaubt.',
      parts: [
        { moduleId: 'kopfrechnen', minutes: 8 },
        { moduleId: 'textaufgaben', minutes: 7 },
      ],
    },
    {
      id: 'b2',
      name: 'Zahlenreihen',
      minutes: 10,
      intro: 'Zahlenreihen fortsetzen, adaptiv.',
      parts: [{ moduleId: 'zahlenreihen', minutes: 10 }],
    },
    {
      id: 'b3',
      name: 'Sprache',
      minutes: 15,
      intro: 'Wortanalogien, Begriffe vergleichen und Rechtschreibung, je 5 Minuten.',
      parts: [
        { moduleId: 'wortanalogien', minutes: 5 },
        { moduleId: 'begriffe', minutes: 5 },
        { moduleId: 'rechtschreibung', minutes: 5 },
      ],
    },
    {
      id: 'b4',
      name: 'Figurale Matrizen',
      minutes: 15,
      intro: 'Matrizen, adaptiv. Für jedes Merkmal die Regel finden.',
      parts: [{ moduleId: 'matrizen', minutes: 15 }],
    },
    {
      id: 'b5',
      name: 'Logik und Technik',
      minutes: 15,
      intro: 'Figurenreihen (7 min), danach technisches Verständnis (8 min).',
      parts: [
        { moduleId: 'figurenreihen', minutes: 7 },
        { moduleId: 'technik', minutes: 8 },
      ],
    },
    {
      id: 'b6',
      name: 'Räumliches Denken',
      minutes: 15,
      intro: 'Mentale Rotation, Würfel drehen und Würfel zählen, je 5 Minuten.',
      parts: [
        { moduleId: 'rotation', minutes: 5 },
        { moduleId: 'wuerfelDrehen', minutes: 5 },
        { moduleId: 'wuerfelZaehlen', minutes: 5 },
      ],
    },
    {
      id: 'b7',
      name: 'Gedächtnis',
      minutes: 13,
      intro: 'Zahlenspanne (4 min), Fakten merken (ein Durchgang), Wege merken (3 Routen).',
      parts: [
        { moduleId: 'zahlenspanne', minutes: 4 },
        { moduleId: 'fakten', count: 1 },
        { moduleId: 'wege', count: 3 },
      ],
    },
    {
      id: 'b8',
      name: 'Konzentration und Reaktion',
      minutes: 12,
      intro: 'Durchstreichtest (ein Durchgang), danach Determination (6 min).',
      parts: [
        { moduleId: 'durchstreichen', count: 1 },
        { moduleId: 'determination', count: 1, opts: { modus: 'adaptiv', dauer: '6' } },
      ],
    },
    {
      id: 'b9',
      name: 'Vigilanz',
      minutes: 30,
      intro:
        '30 Minuten Vigilanz-Uhr mit seltenen Signalen (original-nah). Leertaste beim Doppelsprung. Das letzte Drittel zählt am meisten.',
      parts: [
        {
          moduleId: 'vigilanz',
          count: 1,
          opts: { dauer: '30', haeufigkeit: 'original', takt: '1000', fenster: '1000' },
        },
      ],
    },
  ],
};

export const simMinutes = (d: SimDef) => d.blocks.reduce((s, b) => s + b.minutes, 0);
