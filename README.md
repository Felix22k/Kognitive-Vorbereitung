# PFV Kognitionstrainer

Web-App zum Training der computergestützten kognitiven Tests im Potenzialfeststellungsverfahren (PFV) des KSK.

> **Übungsaufgaben zu öffentlich bekannten Aufgabentypen, keine Originalaufgaben.**
> Die App trainiert Aufgabentypen, Regeln und Tempo. Sie sagt kein Testergebnis voraus.

Alles läuft lokal im Browser. Kein Backend, keine Anmeldung, kein Tracking.

## Stand: Meilenstein 3 (Räumliches Denken)

| Bereich                                                                                        | Stand                                |
| ---------------------------------------------------------------------------------------------- | ------------------------------------ |
| Navigation (Heute, Bibliothek, Simulation, Fortschritt, Einstellungen)                         | fertig                               |
| Datenmodell, IndexedDB (Dexie), Export und Import als JSON, CSV-Export                         | fertig                               |
| Sitzungs-Engine: Lern- und Testmodus, Zeitlimit, Treppenverfahren, Protokoll je Antwort        | fertig                               |
| Modul Kopfrechnen (6.1), Modul Zahlenreihen (6.3)                                              | fertig                               |
| Fortschritt: Verlauf je Modul, Fehlerprotokoll nach Regel-Tag und nach Tag, gemeldete Aufgaben | fertig                               |
| Heute-Seite: Hinweis, Wochenleiste, Bereichskarten, Zuletzt                                    | vorläufig (Tageseinheit folgt in M7) |
| Alle weiteren Module, Simulation, Belastungsmodus, Debug-Seite                                 | Meilensteine 2 bis 7                 |

## Start

Voraussetzung: Node.js 20 oder neuer.

```bash
npm install
```

```bash
npm run dev
```

Dann im Browser `http://localhost:5173` öffnen.

Weitere Befehle:

| Befehl              | Zweck                          |
| ------------------- | ------------------------------ |
| `npm test`          | alle Tests (Vitest)            |
| `npm run lint`      | ESLint                         |
| `npm run format`    | Prettier                       |
| `npm run typecheck` | TypeScript-Prüfung             |
| `npm run build`     | Produktions-Build nach `dist/` |

## Projektstruktur

```
src/
  core/            reine Logik ohne Oberfläche
    rng.ts         seedbarer Zufall (mulberry32)
    rational.ts    exakte Bruchrechnung, Eingaben lesen, deutsche Zahlformate
    staircase.ts   Treppenverfahren
    stats.ts       Median, Niveau, Trefferquote
    progress.ts    Bereichswerte, Wochenleiste, Fehlerprotokoll
    types.ts       Datenmodell (Item, Attempt, Session, …)
  generators/
    expr.ts        Term-Engine für Kopfrechnen (Auswertung, Rechenweg, Strich-vor-Punkt-Fehler)
    kopfrechnen.ts Generator Kopfrechnen
    zahlenreihen/  Regelbibliothek und Generator Zahlenreihen
    common.ts      gemeinsame Hilfen (Zeitlimit je Stufe, Basisprüfung)
  modules/
    catalog.ts     Bereiche, Module, lesbare Namen der Regel-Tags
    views.tsx      Darstellung von Aufgabe und Lösung je Modul
  session/
    engine.ts      Aufgabenauswahl ohne Wiederholung, Kennwerte
    persist.ts     Sitzung starten, Antwort speichern, Sitzung abschließen
    SessionRunner.tsx  Ablauf eines Durchgangs (Start, Aufgabe, Feedback, Auswertung)
  db/              Dexie-Datenbank, Export, Import, CSV
  ui/              App-Hülle, Seiten, Komponenten, Stylesheet
```

Tests liegen neben dem Code (`*.test.ts`).

## Einen Generator hinzufügen

1. Datei unter `src/generators/` anlegen und das Interface `Generator` aus `src/core/types.ts` umsetzen:
   - `generate(seed, level, opts)` erzeugt **nur** aus Seed und Stufe eine Aufgabe (`createRng(seed)` nutzen, nie `Math.random`).
   - `validate(item)` liefert eine Liste von Fehlern, leer heißt gültig. `baseValidate` aus `common.ts` prüft Stufe, Tags, Erklärung, Zeitlimit.
   - `check(item, answer)` prüft eine Antwort (`{ type: 'text', raw }` oder `{ type: 'choice', index }`).
   - `fingerprint(item)` identifiziert die Aufgabe für den Wiederholungsschutz.
   - `promptText(item)` liefert eine Textfassung für Auswertung, Meldungen und CSV.
2. Jede Aufgabe trägt Regel-Tags (`zr.zweiReihen`, `kr.prozent`, …). Lesbare Namen in `TAG_NAMES` in `src/modules/catalog.ts` ergänzen.
3. Bei inhaltlichen Änderungen `GENERATOR_VERSION` erhöhen. Gespeicherte Antworten enthalten Generator-ID, Version und Seed, damit sich jede Aufgabe exakt wieder erzeugen lässt.
4. Generator im Modul-Eintrag in `src/modules/catalog.ts` eintragen (`generator`, `instructions`, `exampleLevels`, Aufgabenzahl). Darstellung in `src/modules/views.tsx` ergänzen.
5. Den Generator in die Liste `GENS` in `src/generators/generators.test.ts` aufnehmen. Dann laufen automatisch: 2.000 Aufgaben je Stufe gültig, gleicher Seed gleiche Aufgabe, Erzeugung unter 50 ms, keine Wiederholung in 500 Aufgaben.

### Zahlenreihen: neue Regel

Eine Regel in `src/generators/zahlenreihen/rules.ts` braucht `generate` (erzeugt 8 Glieder) und `fit` (liefert alle vollständigen Reihen, die zur Regel passen, wenn ein Glied `null` ist). `fit` ist die Grundlage der Eindeutigkeitsprüfung: Jede neue Regel macht alle anderen Aufgaben strenger geprüft. Danach die Regel in `RULES` und im Stufen-Pool in `index.ts` eintragen.

## Getroffene Entscheidungen

Wo der Bau-Prompt nichts festlegt, gilt:

**Technik**

- React 18, Vite 7, TypeScript 5.9 (strict), Vitest 4, Dexie 4. Kein Router-Paket, sondern ein kleiner Hash-Router (`#/bibliothek`), damit die App auch als statische Datei ohne Server-Konfiguration läuft.
- `.npmrc` setzt `legacy-peer-deps=true`. Grund: npm 10 bricht bei Vitest 4 mit einem internen Fehler (`edgesOut`) in der Auflösung optionaler Peer-Abhängigkeiten ab. Funktional hat das keine Folgen.
- Zeitmessung mit `performance.now()` ab dem ersten gezeichneten Frame (`requestAnimationFrame`), Tastenwiederholung (`event.repeat`) wird ignoriert.

**Sitzungen**

- Aufgaben pro Durchgang: Kopfrechnen 12 (Lernen) und 15 (Test), Zahlenreihen 10 und 12.
- Lernmodus startet auf der gespeicherten Lernstufe, beim ersten Mal auf Stufe 1. Testmodus startet auf Stufe 4 oder der letzten Teststufe minus 1. Lern- und Teststufe werden getrennt gespeichert.
- Zeitlimit im Lernmodus ist standardmäßig aus (Schalter auf dem Startbildschirm und in den Einstellungen).
- Abbrechen (Esc) behält die bisherigen Antworten und die erreichte Stufe, der Durchgang zählt aber nicht für Bestwerte und Wochenleiste.
- Wiederholungsschutz: Pro Modul werden die letzten 500 Fingerabdrücke gespeichert. Eine neue Aufgabe wird bis zu 60-mal neu gezogen, bis sie nicht darunter ist.
- „Aufgabe fehlerhaft?“ speichert Generator, Version, Seed und Stufe sofort, ohne Rückfrage. Die Liste steht unter Fortschritt und ist exportierbar.

**Kennwerte**

- Bereichswert = Mittelwert der jeweils letzten Niveaus der **bereits geübten** Module im Bereich. Nicht geübte Module zählen nicht als 0, sonst würden noch nicht gebaute Module jeden Bereich nach unten ziehen.
- Lern- und Testdurchgänge zählen beide. Unter Fortschritt lässt sich auf „nur Testmodus“ filtern.
- FOKUS erscheint erst, wenn mindestens zwei Bereiche trainierbar sind (ab Meilenstein 2). Mit nur einem Bereich wäre die Markierung bedeutungslos.
- Wochenleiste: Ein Tag gilt bis Meilenstein 7 als erledigt, wenn an ihm mindestens ein Durchgang abgeschlossen wurde. Ab M7 zählt die Tageseinheit.

**Kopfrechnen**

- Gleichwertige Eingaben zählen: `6/8` und `0,75` sind richtig, wenn `3/4` gesucht ist. Ausnahme: Bei „Kürze …“ muss der Bruch vollständig gekürzt eingegeben werden.
- Komma und Punkt sind Dezimaltrenner. Ein Punkt mit genau drei Ziffern danach (`1.500`) gilt als Tausenderpunkt, da Lösungen höchstens zwei Nachkommastellen haben.
- Division wird als `:` geschrieben, Brüche als `3/4`, Multiplikation als `×`.
- Auswahlmodus (4 Optionen) im Testmodus per Schalter. Distraktoren: Strich vor Punkt gerechnet, Stellenfehler (mal oder geteilt durch 10), Vorzeichenfehler, Zehner daneben, plus aufgabentypische Fehler (Umfang statt Fläche, Dreieck ohne „durch 2“, Zähler und Nenner einzeln addiert, Kehrwert vergessen).

- Erklärung in zwei Teilen: „Rechenweg“ und „So geht's im Kopf“ (Zerlegen, Runden und Ausgleichen, Dreisatz bei Prozent und Brüchen, Bausteine wie 15 % = 10 % + 5 %, typische Fallen). Die Tipps entstehen in `src/generators/kopfrechnen-tipps.ts` aus den Zahlen der Aufgabe. Ein Test rechnet jede Rechnung der Form „a + b = c“ in Tipps und Rechenweg nach.
- Generator-Version 2 (seit den Tipps). Ältere gespeicherte Antworten tragen Version 1.

**Rückmeldung im Lernmodus**

- Bei einem Fehler steht zuerst die richtige Lösung, darunter klein die eigene Antwort. Die Erklärung klappt bei Fehlern automatisch auf.

**Zahlenreihen**

- Zahlengrenzen: bis Stufe 6 nur 0 bis 999, ab Stufe 7 auch negativ, Betrag bis 5.000.
- Lücke in der Mitte (Position 3 bis 6): Stufe 7 zu 30 %, Stufe 8 zu 40 %, Stufe 9 bis 10 zu 50 %.
- Eindeutigkeitsprüfung wie gefordert (jede Regel gleicher oder geringerer Komplexität, anderer Wert = verwerfen). **Zusätzlich**: Erklärt eine _einfachere_ Regel die Reihe vollständig, wird sie ebenfalls verworfen. Sonst stünde z. B. eine rein arithmetische Reihe unter dem Tag „zwei Operationen im Wechsel“ und das Fehlerprotokoll wäre falsch.
- „mal q plus c“ und „Differenzen wachsen mit festem Faktor“ beschreiben mathematisch dieselbe Reihenfamilie (a + b·qⁱ). Sie sind als gleichwertig markiert; die Erklärung nennt beide Sichtweisen. „mal q plus c“ kommt erst ab Stufe 7, dann mit negativen Zahlen und Faktor −2.
- Quadratzahlen sind zugleich quadratische Reihen, daher hat `zr.potenz` dieselbe Komplexität wie `zr.diff2`.
- `zr.steigFaktor`: Eine reine Fakultätsreihe (×1, ×2, ×3 …) erreicht mit 8 Gliedern 5.040 und sprengt die Grenze von 999 auf Stufe 5 bis 6. Deshalb wechselt sich der steigende Faktor mit einer festen Addition ab (z. B. 3, 4, 8, 9, 27, 28, 112, ?).
- `zr.prim` liegt auf Stufe 4 (im Prompt keiner Stufe zugeordnet).

**Figurale Matrizen**

- Objektmodell mit drei Ebenen-Arten: große Form (Form, Größe, Füllung, Drehung, Linienart), kleine Figuren im 3 × 3 Untergitter (Form, Anzahl, Füllung, Position) und Linien (8 Striche). Ein Feld hat eine oder zwei Ebenen. Code: `src/generators/figuren/`.
- Drehung gibt es nur bei Formen, deren Drehung in 45°-Schritten immer sichtbar ist (Dreieck, Fünfeck, Pfeil). Gedreht werden nur die Eckpunkte, die Schraffur bleibt gleich ausgerichtet.
- Linienart hat nur zwei Werte und ist deshalb nie eine aktive Regel, nur ein festes Merkmal.
- Eindeutigkeit: Für jedes sichtbare Merkmal werden alle fünf Regeln zeilen- und spaltenweise angepasst. Sagen sie unterschiedliche Werte für die Lücke voraus, wird die Aufgabe verworfen.
- **Abweichung vom Bau-Prompt bei den Antwortoptionen:** Der Prompt verlangt, dass jede falsche Option in genau einem Merkmal abweicht _und_ jeder Merkmalswert unter den Optionen gleich oft vorkommt. Beides zusammen ist nur möglich, wenn sich alle Optionen im selben einzigen Merkmal unterscheiden (Beweis: Bei n Optionen und genau einer Abweichung je falscher Option müsste jedes veränderte Merkmal in n/2 Optionen abweichen, die Summe ergäbe aber n − 1). Dann müsste man nur dieses eine Merkmal ansehen. Umgesetzt ist deshalb die Ausgewogenheit, wie beim Forschungsdatensatz I-RAVEN: Die Optionen entstehen als vollständige Kombination aus 2 oder 3 Merkmalen (6 Optionen = 3 × 2, 8 Optionen = 2 × 2 × 2). Jeder Merkmalswert kommt gleich oft vor, die falschen Optionen weichen in 1 bis 3 Merkmalen ab. Wer nur die Optionen vergleicht, kann die Lösung nicht erschließen. Ein Test prüft das für jede erzeugte Aufgabe.
- Variiert die Anzahl kleiner Figuren, steht eine einzelne Figur immer in der Mitte.

**Figurenreihen**

- Regeln: gleichmäßige Veränderung (Drehung, Position, Anzahl) und Wechsel zweier Zustände (Form, Füllung, Größe, Linienart, Anzahl). Ab Stufe 9 unterscheiden sich die Schrittweiten der gleichmäßig veränderten Merkmale.
- 5 Optionen: 2 × 2 ausgewogen nach typischen Fehlern (nicht weitergerechnet, doppelt weitergerechnet, falscher Wechselzustand) plus eine Option mit zwei weiteren Fehlern. Volle Ausgewogenheit ist mit 5 Optionen nicht möglich; die Lösung ist aber nie der einzige Mehrheitswert.

**Mentale Rotation**

- Die beiden Formate sind zwei Module in der Bibliothek („gleich oder gespiegelt“ und „zwei aus vier“), weil sie sich in Bedienung, Aufgabenzahl und Zeit grundlegend unterscheiden.
- Figuren: 8 bis 10 Würfel als Kette mit 3 bis 4 Armen, alle drei Achsen kommen vor, kein Würfel berührt einen anderen als seinen Vorgänger. Chiralität wird über die Normalform aller 24 Würfeldrehungen geprüft.
- Sichtbarkeit: Jede Figur wird gerastert; jeder Würfel braucht eine Mindestzahl sichtbarer Pixel. Ab Stufe 8 ist die Schwelle niedriger (teilweise Verdeckung als Schwierigkeit).
- Bei Drehung in der Bildebene wird das Licht mitgedreht, damit das Bild wie eine reine Bilddrehung aussieht. Bei Drehung in die Tiefe bleibt das Licht fest. Ein Test prüft, dass das rechte Bild exakt das gedrehte linke ist.
- Stufen: 1 bis 3 Bildebene (bis 60°, 120°, 180°), 4 bis 6 in die Tiefe, ab 7 zwei Achsen kombiniert; Würfelzahl steigt von 8 auf 10.
- Format A antwortet sofort mit F oder J (keine Bestätigung), die Auswertung zeigt Median-Zeit und Trefferquote je Drehwinkelgruppe.
- Format B: Die baulich andere Figur entsteht, indem ein Endwürfel an eine andere Stelle wandert. Ab Stufe 8 sind oft beide falschen Optionen baulich ähnlich.

**Würfel drehen**

- Symbole: Pfeil, F, L, P, R, halb gefüllte Fläche, Punkt in der Ecke (6 von 7 je Würfel), alle in jeder 90°-Lage unterscheidbar.
- Prüfung „möglich oder unmöglich“: Eine Ansicht ist möglich, wenn eine der 24 Würfellagen sie erzeugt und dabei alle bekannten Flächen mit Symbol und Ausrichtung stimmen. Beim Format „drehen“ sind nur die drei sichtbaren Flächen der Ausgangsansicht bekannt; unbekannte Flächen dürfen jedes noch nicht vergebene Symbol tragen. Deshalb zeigen alle Optionen mindestens eine bekannte Fläche (unten mindestens zwei).
- Ablenker: falsch ausgerichtetes Symbol, zwei Flächen vertauscht, gespiegelte Anordnung, Symbol an unmöglicher Stelle. Sie werden abwechselnd gezogen, damit nicht immer derselbe Fehlertyp vorkommt.
- Faltnetze werden nicht von Hand eingetragen, sondern aus allen Hexominos durch Falten ermittelt (ein Test bestätigt: genau 11 Grundformen). Bis Stufe 5 nur Netze mit Viererreihe.
- Ab Stufe 5 gibt es die Option „keine passt“ (in etwa 20 % der Aufgaben richtig).

**Würfel zählen**

- Höhenkarten werden als Treppe mit Zufall erzeugt (hinten höher). Geprüft wird an 25 Punkten je Oberseite, dass jede Säulenoberseite zu mindestens 45 % sichtbar ist.
- Blickwinkel bewusst nicht exakt isometrisch, sonst wären Höhe und Tiefe verwechselbar. Ein Bodenraster zeigt die Grundfläche.
- Ab Stufe 7 die Kontaktfrage (genau zwei Nachbarn über eine ganze Fläche), dann auf höchstens 4 × 4 Grundfläche.

**Debug-Seite**

- Laut Prompt nur im Entwicklungsmodus. Weil die App vor allem über GitHub Pages genutzt wird, lässt sie sich dort unter Einstellungen → Entwicklerwerkzeuge einschalten. Sie zeigt 20 Aufgaben je Generator und Stufe mit Lösung, Regel-Tags, Seed und Prüfergebnis.

**Darstellung**

- Farbschema hell, dunkel oder wie das Betriebssystem. Das Schema wird zusätzlich in `localStorage` gemerkt, damit beim Laden nichts dunkel aufblitzt.
- Aufgabenfelder und Figuren bleiben in beiden Schemata schwarz auf weiß.

**Daten**

- Import ersetzt alle vorhandenen Daten (nach Rückfrage). Löschen braucht zwei Bestätigungen.
- CSV mit Semikolon und UTF-8-BOM, damit Excel mit deutscher Einstellung sie direkt öffnet.

## Bekannte Grenzen

- Browser-Zeitmessung ist etwa einen Bildschirmframe ungenau (rund 8 bis 17 ms). Für Tempo-Vergleiche über Wochen reicht das, für Millisekunden-Diagnostik nicht.
- Die Daten liegen nur in diesem Browser. Privates Fenster, Browserwechsel oder „Websitedaten löschen“ entfernen sie. Regelmäßig exportieren.
- Die Treppenlogik misst ein relatives Niveau innerhalb der App. Es ist nicht mit Punktwerten des echten Tests vergleichbar.
- Noch nicht gebaut: Tageseinheit, Wochenplan, Phasen, Simulationen, Belastungsmodus, „Schwächen üben“, Debug-Seite, PWA. Siehe Meilensteine im Bau-Prompt.
