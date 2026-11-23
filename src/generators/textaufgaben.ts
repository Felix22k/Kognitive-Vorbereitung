/**
 * Textaufgaben (Modul 6.2): Dreisatz, umgekehrter Dreisatz, Geschwindigkeit,
 * Prozent, Zins, Mischung, Maßstab, Marschdauer.
 * Jede Vorlage liefert die Lösung, typische Fehlerwerte als Ablenker und
 * einen Rechenweg. Zahlen werden so gewählt, dass die Lösung glatt ist.
 */
import { createRng, type Rng } from '../core/rng';
import { formatNumber } from '../core/rational';
import { timeForLevel } from './common';
import { tcGenerator, type TcItem, type TcPrompt } from './textChoice';

export type TaTyp =
  | 'dreisatz'
  | 'antiprop'
  | 'geschwindigkeit'
  | 'prozent'
  | 'zins'
  | 'mischung'
  | 'massstab'
  | 'marsch';

export interface TaPrompt extends TcPrompt {
  template: string;
  typ: TaTyp;
  steps: string[];
}

export type TaItem = TcItem<TaPrompt>;

interface TaOut {
  text: string;
  answer: number;
  /** Fehlerwerte mit Begründung (typische Denkfehler) */
  errors: number[];
  steps: string[];
  /** Formatierung der Antwort (Standard: Zahl plus Einheit) */
  unit?: string;
  clock?: boolean;
}

interface Tpl {
  id: string;
  typ: TaTyp;
  min: number;
  make(r: Rng, hard: boolean): TaOut | null;
}

const f = formatNumber;
const clock = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')} Uhr`;
};
const dur = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
};
const isNice = (x: number, dec = 2) => Math.abs(Math.round(x * 10 ** dec) - x * 10 ** dec) < 1e-6;

const TEMPLATES: Tpl[] = [
  /* ---------------- Dreisatz (proportional) ---------------- */
  {
    id: 'diesel',
    typ: 'dreisatz',
    min: 1,
    make(r, hard) {
      const per = hard ? r.pick([1.45, 1.65, 1.79, 1.85]) : r.pick([1.5, 2]);
      const a = r.pick(hard ? [12, 15, 24, 35] : [5, 10, 20]);
      const b = r.pick(hard ? [18, 28, 42, 55] : [15, 30, 40, 60]);
      if (a === b) return null;
      const ans = per * b;
      return {
        text: `${a} Liter Diesel kosten ${f(per * a)} €. Wie viel kosten ${b} Liter?`,
        answer: ans,
        unit: '€',
        errors: [per * a + (b - a), (per * a * a) / b, per * a * b],
        steps: [
          `1 Liter: ${f(per * a)} € : ${a} = ${f(per)} €`,
          `${b} Liter: ${f(per)} € · ${b} = ${f(ans)} €`,
        ],
      };
    },
  },
  {
    id: 'verbrauch',
    typ: 'dreisatz',
    min: 2,
    make(r, hard) {
      const per100 = r.pick(hard ? [7.5, 8.5, 12.5, 24] : [6, 8, 10, 20]);
      const a = r.pick([100, 200, 50]);
      const b = r.pick(hard ? [350, 450, 260, 180] : [300, 150, 400, 250]);
      const used = (per100 * a) / 100;
      const ans = (per100 * b) / 100;
      return {
        text: `Ein Fahrzeug verbraucht auf ${a} km ${f(used)} Liter. Wie viel verbraucht es auf ${b} km?`,
        answer: ans,
        unit: 'l',
        errors: [used + (b - a) / 10, (used * a) / b, used * (b / 100)],
        steps: [
          `Auf 1 km: ${f(used)} l : ${a} = ${f(used / a)} l`,
          `Auf ${b} km: ${f(used / a)} l · ${b} = ${f(ans)} l`,
        ],
      };
    },
  },
  {
    id: 'pumpe',
    typ: 'dreisatz',
    min: 1,
    make(r, hard) {
      const perMin = r.pick(hard ? [35, 45, 75, 125] : [20, 30, 50]);
      const a = r.pick([4, 6, 8, 5]);
      const b = r.pick(hard ? [14, 18, 22, 27] : [10, 12, 15, 20]);
      const ans = perMin * b;
      return {
        text: `Eine Pumpe fördert in ${a} Minuten ${f(perMin * a)} Liter Wasser. Wie viele Liter fördert sie in ${b} Minuten?`,
        answer: ans,
        unit: 'l',
        errors: [perMin * a + (b - a), (perMin * a * a) / b, perMin * (a + b)],
        steps: [
          `In 1 Minute: ${f(perMin * a)} l : ${a} = ${perMin} l`,
          `In ${b} Minuten: ${perMin} l · ${b} = ${f(ans)} l`,
        ],
      };
    },
  },
  {
    id: 'verpflegung',
    typ: 'dreisatz',
    min: 3,
    make(r, hard) {
      const per = r.pick(hard ? [0.35, 0.45, 0.6] : [0.5, 0.25]);
      const a = r.pick([20, 40, 12, 16]);
      const b = r.pick(hard ? [28, 36, 54, 66] : [30, 60, 24, 80]);
      if (a === b) return null;
      const ans = per * b;
      return {
        text: `Für ${a} Soldaten werden pro Tag ${f(per * a)} kg Brot gebraucht. Wie viel Brot brauchen ${b} Soldaten pro Tag?`,
        answer: ans,
        unit: 'kg',
        errors: [per * a + (b - a), (per * a * a) / b, per * a * (b / 10)],
        steps: [
          `Pro Soldat: ${f(per * a)} kg : ${a} = ${f(per)} kg`,
          `Für ${b} Soldaten: ${f(per)} kg · ${b} = ${f(ans)} kg`,
        ],
      };
    },
  },
  /* ---------------- Umgekehrter Dreisatz ---------------- */
  {
    id: 'arbeiter',
    typ: 'antiprop',
    min: 2,
    make(r, hard) {
      const total = r.pick(hard ? [72, 90, 84, 120] : [24, 36, 48, 60]);
      const divs = Array.from({ length: 12 }, (_, i) => i + 2).filter((d) => total % d === 0);
      const a = r.pick(divs);
      const b = r.pick(divs.filter((d) => d !== a));
      const ans = total / b;
      return {
        text: `${a} Soldaten brauchen für den Bau einer Stellung ${total / a} Stunden. Wie lange brauchen ${b} Soldaten bei gleicher Arbeitsleistung?`,
        answer: ans,
        unit: 'h',
        errors: [((total / a) * b) / a, total / a + (a - b), total / a - (b - a)],
        steps: [
          `Gesamtarbeit: ${a} · ${total / a} h = ${total} Soldatenstunden`,
          `Mit ${b} Soldaten: ${total} : ${b} = ${f(ans)} h`,
          'Mehr Leute, weniger Zeit: umgekehrter Dreisatz (multiplizieren, dann teilen).',
        ],
      };
    },
  },
  {
    id: 'vorrat',
    typ: 'antiprop',
    min: 3,
    make(r, hard) {
      const total = r.pick(hard ? [360, 420, 480, 540] : [120, 180, 240]);
      const divs = [4, 5, 6, 8, 10, 12, 15, 20, 24, 30].filter((d) => total % d === 0);
      const a = r.pick(divs);
      const b = r.pick(divs.filter((d) => d !== a));
      const ans = total / b;
      return {
        text: `Ein Vorrat reicht für ${a} Personen ${total / a} Tage. Wie viele Tage reicht er für ${b} Personen?`,
        answer: ans,
        unit: 'Tage',
        errors: [((total / a) * b) / a, total / a + a - b, (total / a) * (a / b) * 2],
        steps: [
          `Vorrat in Personentagen: ${a} · ${total / a} = ${total}`,
          `Für ${b} Personen: ${total} : ${b} = ${f(ans)} Tage`,
        ],
      };
    },
  },
  {
    id: 'fahrzeit',
    typ: 'antiprop',
    min: 3,
    make(r, hard) {
      const dist = r.pick(hard ? [180, 240, 210, 300] : [60, 120, 90]);
      const speeds = [30, 40, 45, 50, 60, 70, 75, 80, 90, 100, 120].filter((v) =>
        isNice((dist / v) * 60, 0),
      );
      const v1 = r.pick(speeds);
      const v2 = r.pick(speeds.filter((v) => v !== v1));
      const t1 = (dist / v1) * 60;
      const ans = (dist / v2) * 60;
      return {
        text: `Bei ${v1} km/h dauert eine Fahrt ${dur(t1)}. Wie lange dauert dieselbe Strecke bei ${v2} km/h?`,
        answer: ans,
        unit: 'min',
        errors: [(t1 * v2) / v1, t1 + (v1 - v2), (dist / v2) * 100],
        steps: [
          `Strecke: ${v1} km/h · ${dur(t1)} = ${dist} km`,
          `Neue Zeit: ${dist} km : ${v2} km/h = ${dur(ans)}`,
          'Schneller fahren, kürzere Zeit: umgekehrter Dreisatz.',
        ],
      };
    },
  },
  {
    id: 'pumpen',
    typ: 'antiprop',
    min: 4,
    make(r, hard) {
      const total = r.pick(hard ? [36, 48, 60, 72] : [12, 24]);
      const divs = [2, 3, 4, 6, 8, 12].filter((d) => total % d === 0);
      const a = r.pick(divs);
      const b = r.pick(divs.filter((d) => d !== a));
      const ans = total / b;
      return {
        text: `${a} gleiche Pumpen leeren ein Becken in ${total / a} Stunden. Wie lange brauchen ${b} solcher Pumpen?`,
        answer: ans,
        unit: 'h',
        errors: [((total / a) * b) / a, total / a + a - b, total / (a + b)],
        steps: [
          `${a} Pumpen · ${total / a} h = ${total} Pumpenstunden`,
          `${total} : ${b} = ${f(ans)} h`,
        ],
      };
    },
  },
  /* ---------------- Geschwindigkeit ---------------- */
  {
    id: 'durchschnitt',
    typ: 'geschwindigkeit',
    min: 2,
    make(r, hard) {
      const v = r.pick(hard ? [54, 66, 84, 96, 72] : [60, 80, 90, 120]);
      const t = r.pick(hard ? [25, 35, 40, 50] : [15, 30, 45, 20]);
      const d = (v * t) / 60;
      if (!isNice(d, 1)) return null;
      return {
        text: `Ein Fahrzeug legt ${f(d)} km in ${t} Minuten zurück. Wie hoch ist seine Durchschnittsgeschwindigkeit?`,
        answer: v,
        unit: 'km/h',
        errors: [d / t, (d * t) / 60, (d / t) * 100],
        steps: [
          `Pro Minute: ${f(d)} km : ${t} = ${f(v / 60)} km`,
          `Pro Stunde (60 min): ${f(v / 60)} km · 60 = ${v} km/h`,
          'Tipp: km pro Minute mal 60 ergibt km/h.',
        ],
      };
    },
  },
  {
    id: 'strecke',
    typ: 'geschwindigkeit',
    min: 1,
    make(r, hard) {
      const v = r.pick(hard ? [48, 54, 72, 84] : [60, 30, 90, 120]);
      const t = r.pick(hard ? [25, 35, 50, 55] : [20, 30, 40, 90]);
      const d = (v * t) / 60;
      if (!isNice(d, 1)) return null;
      return {
        text: `Ein Konvoi fährt mit ${v} km/h. Wie weit kommt er in ${t} Minuten?`,
        answer: d,
        unit: 'km',
        errors: [v * t, (v * t) / 100, v / t],
        steps: [
          `${v} km/h sind ${f(v / 60)} km pro Minute`,
          `In ${t} Minuten: ${f(v / 60)} km · ${t} = ${f(d)} km`,
        ],
      };
    },
  },
  {
    id: 'begegnung',
    typ: 'geschwindigkeit',
    min: 5,
    make(r, hard) {
      const v1 = r.pick([40, 50, 60, 70, 80]);
      const v2 = r.pick([30, 40, 50, 60, 90].filter((x) => x !== v1));
      const t = r.pick(hard ? [24, 36, 42, 48] : [30, 60, 45]);
      const d = ((v1 + v2) * t) / 60;
      if (!isNice(d, 1)) return null;
      return {
        text: `Zwei Fahrzeuge sind ${f(d)} km voneinander entfernt und fahren gleichzeitig aufeinander zu: eines mit ${v1} km/h, das andere mit ${v2} km/h. Nach welcher Zeit treffen sie sich?`,
        answer: t,
        unit: 'min',
        errors: [(d / Math.abs(v1 - v2 || 10)) * 60, (d / v1) * 60, (d / ((v1 + v2) / 2)) * 60 * 2],
        steps: [
          `Sie nähern sich mit ${v1} + ${v2} = ${v1 + v2} km/h`,
          `Zeit: ${f(d)} km : ${v1 + v2} km/h = ${dur(t)}`,
        ],
      };
    },
  },
  {
    id: 'aufholen',
    typ: 'geschwindigkeit',
    min: 7,
    make(r) {
      const v1 = r.pick([40, 50, 60]);
      const v2 = v1 + r.pick([10, 20, 30]);
      const delay = r.pick([15, 20, 30, 45]);
      const vorsprung = (v1 * delay) / 60;
      const t = (vorsprung / (v2 - v1)) * 60;
      if (!isNice(t, 0)) return null;
      return {
        text: `Ein Lkw fährt mit ${v1} km/h los. ${delay} Minuten später folgt auf derselben Strecke ein Pkw mit ${v2} km/h. Wie lange nach seinem eigenen Start holt der Pkw den Lkw ein?`,
        answer: t,
        unit: 'min',
        errors: [t + delay, (vorsprung / v2) * 60, (vorsprung / (v1 + v2)) * 60],
        steps: [
          `Vorsprung des Lkw: ${f(v1 / 60)} km pro Minute · ${delay} min = ${f(vorsprung)} km`,
          `Der Pkw ist ${v2 - v1} km/h schneller`,
          `Aufholzeit: ${f(vorsprung)} km : ${v2 - v1} km/h = ${dur(t)}`,
        ],
      };
    },
  },
  /* ---------------- Prozent ---------------- */
  {
    id: 'rabatt',
    typ: 'prozent',
    min: 1,
    make(r, hard) {
      const p = r.pick(hard ? [15, 35, 12, 18] : [10, 20, 25, 50]);
      const g = r.pick(hard ? [240, 380, 150, 460] : [80, 120, 200, 60]);
      const ans = g * (1 - p / 100);
      if (!isNice(ans)) return null;
      return {
        text: `Ein Fernglas kostet ${f(g)} €. Es gibt ${p} % Rabatt. Was kostet es jetzt?`,
        answer: ans,
        unit: '€',
        errors: [(g * p) / 100, g - p, g * (1 + p / 100)],
        steps: [
          `${p} % von ${f(g)} € = ${f((g * p) / 100)} €`,
          `${f(g)} € − ${f((g * p) / 100)} € = ${f(ans)} €`,
          `Schneller: ${f(g)} · ${f(1 - p / 100)} = ${f(ans)}`,
        ],
      };
    },
  },
  {
    id: 'quote',
    typ: 'prozent',
    min: 2,
    make(r, hard) {
      const n = r.pick(hard ? [40, 80, 120, 160] : [20, 50, 25, 200]);
      const p = r.pick(hard ? [35, 45, 65, 85, 15] : [20, 40, 60, 80]);
      const k = (n * p) / 100;
      if (!isNice(k, 0)) return null;
      return {
        text: `Von ${n} Bewerbern bestehen ${k} den Sporttest. Wie viel Prozent sind das?`,
        answer: p,
        unit: '%',
        errors: [n - k, (n / k) * 10, 100 - p],
        steps: [`Anteil: ${k} : ${n} = ${f(k / n)}`, `${f(k / n)} · 100 = ${p} %`],
      };
    },
  },
  {
    id: 'grundwert',
    typ: 'prozent',
    min: 5,
    make(r, hard) {
      const p = r.pick(hard ? [12, 15, 8] : [10, 20, 25]);
      const g = r.pick([200, 400, 250, 500, 150, 300]);
      const neu = g * (1 + p / 100);
      if (!isNice(neu)) return null;
      return {
        text: `Nach einer Preiserhöhung um ${p} % kostet ein Schlafsack ${f(neu)} €. Was hat er vorher gekostet?`,
        answer: g,
        unit: '€',
        errors: [neu * (1 - p / 100), neu - p, (neu * p) / 100],
        steps: [
          `Neuer Preis = ${100 + p} % des alten`,
          `Alter Preis: ${f(neu)} € : ${f(1 + p / 100)} = ${f(g)} €`,
          `Typischer Fehler: ${p} % vom neuen Preis abziehen ergibt ${f(neu * (1 - p / 100))} €, das ist zu wenig.`,
        ],
      };
    },
  },
  {
    id: 'hochrunter',
    typ: 'prozent',
    min: 6,
    make(r) {
      const p = r.pick([10, 20, 25, 50]);
      const g = r.pick([100, 200, 400, 80]);
      const ans = g * (1 + p / 100) * (1 - p / 100);
      return {
        text: `Ein Preis von ${f(g)} € steigt zuerst um ${p} % und sinkt danach um ${p} %. Wie hoch ist der Preis am Ende?`,
        answer: ans,
        unit: '€',
        errors: [g, g * (1 - p / 100), g * (1 + p / 100)],
        steps: [
          `Nach der Erhöhung: ${f(g)} · ${f(1 + p / 100)} = ${f(g * (1 + p / 100))} €`,
          `Nach der Senkung: ${f(g * (1 + p / 100))} · ${f(1 - p / 100)} = ${f(ans)} €`,
          'Die Senkung bezieht sich auf den höheren Wert, darum endet man unter dem Startpreis.',
        ],
      };
    },
  },
  /* ---------------- Zins ---------------- */
  {
    id: 'jahreszins',
    typ: 'zins',
    min: 2,
    make(r, hard) {
      const k = r.pick(hard ? [2400, 3600, 1800, 7500] : [1000, 2000, 5000, 500]);
      const p = r.pick(hard ? [1.5, 2.5, 3.5, 4.5] : [2, 3, 4, 5]);
      const z = (k * p) / 100;
      return {
        text: `${f(k)} € werden zu ${f(p)} % Zinsen pro Jahr angelegt. Wie viel Zinsen gibt es nach einem Jahr?`,
        answer: z,
        unit: '€',
        errors: [k * p, (k * p) / 10, k + z],
        steps: [
          `1 % von ${f(k)} € = ${f(k / 100)} €`,
          `${f(p)} % = ${f(k / 100)} € · ${f(p)} = ${f(z)} €`,
        ],
      };
    },
  },
  {
    id: 'monatszins',
    typ: 'zins',
    min: 4,
    make(r, hard) {
      const k = r.pick(hard ? [4800, 3600, 7200] : [1200, 2400, 6000]);
      const p = r.pick([2, 3, 4, 5]);
      const m = r.pick(hard ? [5, 7, 9, 10] : [3, 6, 4, 8]);
      const z = (((k * p) / 100) * m) / 12;
      if (!isNice(z)) return null;
      return {
        text: `${f(k)} € liegen ${m} Monate zu ${p} % Jahreszins auf einem Konto. Wie viel Zinsen gibt es?`,
        answer: z,
        unit: '€',
        errors: [(k * p) / 100, ((k * p) / 100) * m, (((k * p) / 100) * 12) / m],
        steps: [
          `Jahreszinsen: ${f(k)} € · ${p} % = ${f((k * p) / 100)} €`,
          `Für ${m} Monate: ${f((k * p) / 100)} € · ${m}/12 = ${f(z)} €`,
        ],
      };
    },
  },
  {
    id: 'kapital',
    typ: 'zins',
    min: 6,
    make(r) {
      const p = r.pick([2, 2.5, 4, 5]);
      const k = r.pick([2000, 4000, 8000, 1600]);
      const z = (k * p) / 100;
      return {
        text: `Welches Kapital bringt bei ${f(p)} % Jahreszins nach einem Jahr ${f(z)} € Zinsen?`,
        answer: k,
        unit: '€',
        errors: [(z * p) / 100, z * p, z * 100],
        steps: [
          `${f(p)} % entsprechen ${f(z)} €`,
          `1 % entspricht ${f(z)} € : ${f(p)} = ${f(z / p)} €`,
          `100 % = ${f(z / p)} € · 100 = ${f(k)} €`,
        ],
      };
    },
  },
  {
    id: 'zinseszins',
    typ: 'zins',
    min: 8,
    make(r) {
      const k = r.pick([1000, 2000, 5000, 10000]);
      const p = r.pick([5, 10, 4, 20]);
      const ans = k * (1 + p / 100) ** 2;
      if (!isNice(ans)) return null;
      return {
        text: `${f(k)} € werden zwei Jahre lang zu ${p} % angelegt. Die Zinsen des ersten Jahres werden mitverzinst. Wie hoch ist das Guthaben nach zwei Jahren?`,
        answer: ans,
        unit: '€',
        errors: [k * (1 + (2 * p) / 100), k * (1 + p / 100), k + (k * p) / 100 / 2],
        steps: [
          `Nach Jahr 1: ${f(k)} · ${f(1 + p / 100)} = ${f(k * (1 + p / 100))} €`,
          `Nach Jahr 2: ${f(k * (1 + p / 100))} · ${f(1 + p / 100)} = ${f(ans)} €`,
        ],
      };
    },
  },
  /* ---------------- Mischung ---------------- */
  {
    id: 'verduennen',
    typ: 'mischung',
    min: 3,
    make(r) {
      const a = r.pick([2, 3, 4, 6]);
      const p = r.pick([30, 40, 60, 90]);
      const w = r.pick([1, 2, 3, 4, 6]);
      const ans = (a * p) / (a + w);
      if (!isNice(ans, 1)) return null;
      return {
        text: `${a} Liter Saft mit ${p} % Fruchtanteil werden mit ${w} Liter Wasser gemischt. Wie hoch ist der Fruchtanteil der Mischung?`,
        answer: ans,
        unit: '%',
        errors: [p / 2, (a * p) / w, p - w * 10],
        steps: [
          `Frucht: ${a} l · ${p} % = ${f((a * p) / 100)} l`,
          `Gesamtmenge: ${a} + ${w} = ${a + w} l`,
          `Anteil: ${f((a * p) / 100)} : ${a + w} = ${f(ans)} %`,
        ],
      };
    },
  },
  {
    id: 'preismischung',
    typ: 'mischung',
    min: 5,
    make(r) {
      const x = r.pick([6, 8, 10, 12]);
      const y = r.pick([14, 16, 18, 20]);
      const a = r.pick([1, 2, 3, 4]);
      const b = r.pick([1, 2, 3, 4].filter((v) => v !== a));
      const ans = (a * x + b * y) / (a + b);
      if (!isNice(ans)) return null;
      return {
        text: `${a} kg Kaffee zu ${x} €/kg werden mit ${b} kg Kaffee zu ${y} €/kg gemischt. Was kostet 1 kg der Mischung?`,
        answer: ans,
        unit: '€',
        errors: [(x + y) / 2, a * x + b * y, (b * x + a * y) / (a + b)],
        steps: [
          `Gesamtpreis: ${a} · ${x} + ${b} · ${y} = ${a * x + b * y} €`,
          `Gesamtmenge: ${a + b} kg`,
          `Pro kg: ${a * x + b * y} : ${a + b} = ${f(ans)} €`,
          'Nicht einfach den Mittelwert der Preise nehmen: Die Mengen sind verschieden.',
        ],
      };
    },
  },
  {
    id: 'wasserzugabe',
    typ: 'mischung',
    min: 7,
    make(r) {
      const a = r.pick([4, 6, 8, 10, 12]);
      const p = r.pick([20, 30, 40, 50]);
      const q = r.pick([10, 15, 20, 25].filter((v) => v < p));
      const w = (a * p) / q - a;
      if (!isNice(w, 1) || w <= 0) return null;
      return {
        text: `Du hast ${a} Liter einer ${p}-prozentigen Lösung. Wie viel Wasser musst du zugeben, damit sie nur noch ${q}-prozentig ist?`,
        answer: w,
        unit: 'l',
        errors: [(a * (p - q)) / 100, (a * p) / q, a * (p / q - 1) * 2],
        steps: [
          `Wirkstoff bleibt gleich: ${a} l · ${p} % = ${f((a * p) / 100)} l`,
          `Neue Gesamtmenge: ${f((a * p) / 100)} l : ${q} % = ${f((a * p) / q)} l`,
          `Wasser: ${f((a * p) / q)} − ${a} = ${f(w)} l`,
        ],
      };
    },
  },
  /* ---------------- Maßstab ---------------- */
  {
    id: 'karteNachReal',
    typ: 'massstab',
    min: 2,
    make(r, hard) {
      const m = r.pick([25000, 50000, 100000]);
      const cm = r.pick(hard ? [3.5, 4.2, 7.5, 6.4] : [2, 4, 6, 8]);
      const km = (cm * m) / 100000;
      return {
        text: `Auf einer Karte im Maßstab 1 : ${f(m)} misst eine Strecke ${f(cm)} cm. Wie lang ist sie in Wirklichkeit?`,
        answer: km,
        unit: 'km',
        errors: [km * 10, km / 10, (cm * m) / 1000],
        steps: [
          `${f(cm)} cm · ${f(m)} = ${f(cm * m)} cm`,
          `${f(cm * m)} cm = ${f(km)} km (100.000 cm = 1 km)`,
          `Tipp: Bei 1 : ${f(m)} entspricht 1 cm ${f(m / 100000)} km.`,
        ],
      };
    },
  },
  {
    id: 'realNachKarte',
    typ: 'massstab',
    min: 4,
    make(r, hard) {
      const m = r.pick([25000, 50000]);
      const km = r.pick(hard ? [1.75, 3.25, 2.4, 4.5] : [1, 2, 3, 5]);
      const cm = (km * 100000) / m;
      if (!isNice(cm, 1)) return null;
      return {
        text: `Zwei Punkte liegen in Wirklichkeit ${f(km)} km auseinander. Wie weit sind sie auf einer Karte im Maßstab 1 : ${f(m)} voneinander entfernt?`,
        answer: cm,
        unit: 'cm',
        errors: [cm * 10, cm / 10, (km * m) / 100000],
        steps: [
          `${f(km)} km = ${f(km * 100000)} cm`,
          `${f(km * 100000)} cm : ${f(m)} = ${f(cm)} cm`,
        ],
      };
    },
  },
  {
    id: 'kartenwechsel',
    typ: 'massstab',
    min: 7,
    make(r) {
      const m1 = r.pick([25000, 50000]);
      const m2 = r.pick([50000, 100000, 200000].filter((x) => x !== m1));
      const cm1 = r.pick([4, 6, 8, 12, 10]);
      const cm2 = (cm1 * m1) / m2;
      if (!isNice(cm2, 1)) return null;
      return {
        text: `Eine Strecke misst auf einer Karte 1 : ${f(m1)} genau ${cm1} cm. Wie lang ist sie auf einer Karte 1 : ${f(m2)}?`,
        answer: cm2,
        unit: 'cm',
        errors: [(cm1 * m2) / m1, cm1, cm1 / 10],
        steps: [
          `Wirklichkeit: ${cm1} cm · ${f(m1)} = ${f(cm1 * m1)} cm`,
          `Neue Karte: ${f(cm1 * m1)} : ${f(m2)} = ${f(cm2)} cm`,
          'Größere Maßstabszahl, kleinere Karte: die Strecke wird kürzer.',
        ],
      };
    },
  },
  /* ---------------- Marsch ---------------- */
  {
    id: 'marschdauer',
    typ: 'marsch',
    min: 3,
    make(r, hard) {
      const v = r.pick([4, 5, 6]);
      const d = r.pick(hard ? [14, 18, 21, 22] : [8, 12, 10, 15]);
      const gehMin = (d / v) * 60;
      if (!isNice(gehMin, 0)) return null;
      const pausen = Math.ceil(gehMin / 60) - 1; // nach jeder vollen Stunde, nicht am Ziel
      const ans = gehMin + pausen * 10;
      return {
        text: `Ein Zug marschiert ${d} km mit ${v} km/h. Nach jeder vollen Marschstunde gibt es 10 Minuten Pause, am Ziel keine. Wie lange dauert der Marsch insgesamt?`,
        answer: ans,
        unit: 'min',
        errors: [
          gehMin,
          gehMin + Math.ceil(gehMin / 60) * 10,
          gehMin + Math.floor(gehMin / 60) * 10 + 10,
        ],
        steps: [
          `Reine Gehzeit: ${d} km : ${v} km/h = ${dur(gehMin)}`,
          `Pausen: ${pausen} × 10 min = ${pausen * 10} min`,
          `Gesamt: ${dur(ans)}`,
        ],
      };
    },
  },
  {
    id: 'ankunft',
    typ: 'marsch',
    min: 4,
    make(r, hard) {
      const start = r.pick([6 * 60, 6 * 60 + 30, 7 * 60 + 15, 5 * 60 + 45, 8 * 60 + 40]);
      const v = r.pick([4, 5, 6]);
      const d = r.pick(hard ? [11, 13, 17, 9] : [8, 10, 12, 6]);
      const t = (d / v) * 60;
      if (!isNice(t, 0)) return null;
      const ans = start + t;
      return {
        text: `Abmarsch ist um ${clock(start)}. Die Strecke ist ${d} km lang, das Tempo ${v} km/h, ohne Pausen. Wann ist die Ankunft?`,
        answer: ans,
        clock: true,
        errors: [start + d * 10, start + (t / 60) * 100, start + t + 60],
        steps: [
          `Gehzeit: ${d} km : ${v} km/h = ${dur(t)}`,
          `${clock(start)} + ${dur(t)} = ${clock(ans)}`,
        ],
      };
    },
  },
  {
    id: 'abmarsch',
    typ: 'marsch',
    min: 6,
    make(r) {
      const ziel = r.pick([9 * 60, 10 * 60 + 30, 12 * 60, 14 * 60 + 15]);
      const v = r.pick([4, 5]);
      const d = r.pick([10, 12, 15, 9]);
      const geh = (d / v) * 60;
      if (!isNice(geh, 0)) return null;
      const pausen = Math.ceil(geh / 60) - 1;
      const ans = ziel - geh - pausen * 10 - 15;
      return {
        text: `Ein Trupp muss spätestens um ${clock(ziel)} am Ziel sein. Die Strecke ist ${d} km lang, das Tempo ${v} km/h. Nach jeder vollen Marschstunde gibt es 10 Minuten Pause, und 15 Minuten Puffer sind eingeplant. Wann ist der späteste Abmarsch?`,
        answer: ans,
        clock: true,
        errors: [ziel - geh, ziel - geh - 15, ziel - geh - pausen * 10],
        steps: [
          `Gehzeit: ${dur(geh)}`,
          `Pausen: ${pausen} × 10 min`,
          `Puffer: 15 min`,
          `${clock(ziel)} − ${dur(geh + pausen * 10 + 15)} = ${clock(ans)}`,
        ],
      };
    },
  },
];

export const TA_TEMPLATES = TEMPLATES.map((t) => ({ id: t.id, typ: t.typ, min: t.min }));

function label(out: TaOut, v: number): string {
  if (out.clock) return clock(v);
  if (out.unit === 'min' && v >= 60) return dur(v);
  return `${f(v)} ${out.unit}`;
}

export function generateTextaufgabe(
  seed: number,
  level: number,
  opts?: Record<string, unknown>,
): TaItem {
  const rng = createRng(seed);
  const lvl = Math.max(1, Math.min(10, Math.round(level)));
  const forced = typeof opts?.template === 'string' ? opts.template : null;
  const pool = TEMPLATES.filter((t) =>
    forced ? t.id === forced : t.min <= lvl && t.min >= lvl - 5,
  );
  for (let attempt = 0; attempt < 200; attempt++) {
    const tpl = rng.pick(pool.length ? pool : TEMPLATES);
    const out = tpl.make(rng, lvl >= 6);
    if (!out || !(out.answer > 0) || !isNice(out.answer)) continue;
    const correct = label(out, out.answer);
    const wrong: string[] = [];
    const add = (v: number) => {
      if (!(v > 0) || !Number.isFinite(v)) return;
      const l = label(out, Math.round(v * 100) / 100);
      if (l !== correct && !wrong.includes(l)) wrong.push(l);
    };
    out.errors.forEach(add);
    // auffüllen mit plausiblen Nachbarwerten
    for (const k of [1.2, 0.8, 1.5, 0.5, 2, 1.25, 0.75]) {
      if (wrong.length >= 3) break;
      add(out.clock ? out.answer + (k - 1) * 100 : out.answer * k);
    }
    if (wrong.length < 3) continue;
    const options = rng.shuffle([correct, ...wrong.slice(0, 3)]);
    const prompt: TaPrompt = {
      kind: 'text',
      question: 'Berechne die Lösung. Notizen auf Papier sind erlaubt.',
      stem: out.text,
      options,
      correctIndex: options.indexOf(correct),
      template: tpl.id,
      typ: tpl.typ,
      steps: out.steps,
    };
    return {
      id: `textaufgaben-${seed}-${lvl}`,
      moduleId: 'textaufgaben',
      generatorId: 'textaufgaben',
      generatorVersion: 1,
      seed,
      level: lvl,
      tags: ['ta.' + tpl.typ],
      prompt,
      correct: prompt.correctIndex,
      correctLabel: correct,
      explanation: out.steps.join('\n'),
      timeLimitMs: timeForLevel(lvl, 60, 90),
      answerKind: 'choice',
    };
  }
  throw new Error(`Textaufgaben: keine Aufgabe für Stufe ${lvl}`);
}

export const textaufgabenGenerator = tcGenerator<TaPrompt>(
  'textaufgaben',
  1,
  generateTextaufgabe,
  (it) => `${it.prompt.template}:${it.prompt.stem}`,
  (it) => (it.prompt.steps.length ? [] : ['kein Rechenweg']),
);
