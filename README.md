# PFV Kognitionstrainer

Web-App zum Training der computergestützten kognitiven Tests im Potenzialfeststellungsverfahren (PFV) des KSK.

> **Übungsaufgaben zu öffentlich bekannten Aufgabentypen, keine Originalaufgaben.**
> Die App trainiert Aufgabentypen, Regeln und Tempo. Sie sagt kein Testergebnis voraus.

Alles läuft lokal im Browser. Kein Backend, keine Anmeldung, kein Tracking.

## Stand: Meilenstein 7 (alle Meilensteine gebaut)

| Bereich                                                                                               | Stand                        |
| ----------------------------------------------------------------------------------------------------- | ---------------------------- |
| Navigation, Datenmodell (IndexedDB), Export und Import (JSON), CSV-Export                             | fertig                       |
| Sitzungs-Engine: Lern- und Testmodus, Zeitlimit, Treppenverfahren, Protokoll je Antwort               | fertig                       |
| Sprache und Zahlen: Kopfrechnen, Textaufgaben, Zahlenreihen, Wortanalogien, Begriffe, Rechtschreibung | fertig                       |
| Logik und Technik: Matrizen, Figurenreihen, Technisches Verständnis                                   | fertig                       |
| Räumliches Denken: Rotation (zwei Formate), Würfel drehen, Würfel zählen                              | fertig                       |
| Gedächtnis, Konzentration, Reaktion, Vigilanz                                                         | fertig                       |
| Tageseinheit, Wochenplan, Phasen bis zum Testtermin, „offen diese Woche“                              | fertig                       |
| Kurz- und Vollsimulation mit Bericht und Vergleich, Vigilanz einzeln                                  | fertig                       |
| Belastungsmodus, Vergleich ausgeruht gegen belastet, „Schwächen üben“                                 | fertig                       |
| Fortschritt, Fehlerprotokoll, gemeldete Aufgaben, Debug-Seite, Offline-Nutzung (PWA)                  | fertig                       |
| Gestaltung von Heute und Dashboard                                                                    | offen (gemeinsam am Schluss) |

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
    progress.ts    Bereichswerte, Wochenleiste, Fehlerprotokoll, erledigte Tage
    plan.ts        Wochenplan, Phasen, Tageseinheit (70 % Plan, 30 % Fokus)
    simulation.ts  Ablauf der Kurz- und Vollsimulation
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

**Gedächtnis und Konzentration (Block-Aufgaben)**

- Diese Module sind „Block-Aufgaben“: Das Modul steuert Darbietung, Zeit und Eingabe selbst (`src/modules/blocks/`) und liefert sein Ergebnis als Datenobjekt. Die Sitzungs-Engine speichert es wie jede Antwort, ohne eigenes Zeitlimit.
- Zahlen- und Blockspanne nutzen die Treppenregel aus dem Prompt: eine Stelle mehr nach richtig, eine weniger nach zwei Fehlern in Folge. Stufe = Länge − 2 (Zahlenspanne 3 bis 12, Blockspanne 3 bis 9, ab Stufe 8 schnellere Darbietung). Vorwärts und rückwärts werden zufällig gemischt; bei der Blockspanne schon ab Stufe 1, weil es sonst nur 504 verschiedene Aufgaben gäbe.
- n-back: Stufe 1 bis 3 = 1-back, 4 bis 6 = 2-back, ab 7 = 3-back; innerhalb einer Stufe mehr Reize. Ein Block gilt als geschafft bei mindestens 75 % erkannten Treffern und höchstens 2 Fehlalarmen. Im Lernmodus blinkt das Raster nach jedem Tastendruck grün oder rot.
- Fakten merken: Lagemeldung mit 11 bis 20 erfundenen Fakten, 90 s Einprägen (vorzeitig beendbar), Ablenkung 1 bis 3 Minuten (steigt mit der Stufe), 10 Fragen mit je 4 Antworten und 20 s Zeit. Geschafft ab 7 richtigen. Ab Stufe 6 ähnlich klingende Namen (Meier/Maier/Mayer).
- Wege merken: Routen werden mit Rücksprung-Suche erzeugt (5 bis 14 Abbiegungen auf 8 × 8 Kreuzungen). Bis Stufe 5 wird der Endpunkt gefragt, ab Stufe 6 alle Abbiegepunkte in Reihenfolge. Bedienbar mit Maus oder Pfeiltasten und Leertaste.
- Durchstreichtest: eigene Umsetzung, kein geschützter Test. 14 × 40 Zeichen, Zielregel wechselt je Durchgang (Buchstabe und Strichzahl). Zeit pro Zeile: 20 s (Stufe 1 bis 3), 15 s (4 bis 7), 12 s (ab 8), weil der Prompt nur 15 s nennt, aber Stufen verlangt. Kennwerte: bearbeitete Zeichen (bis zur letzten Markierung je Zeile), Auslassungen, Verwechslungen, KL = Treffer − Verwechslungen, Fehlerprozent, Schwankungsbreite. Geschafft bei höchstens 10 % Fehlern.
- Symbol-Zahl-Kodierung: neue Zuordnung je Block, 2 Minuten. Stufe 1 bis 2 ein Symbol, 3 bis 5 zwei, ab 6 auch drei und Malnehmen. Geschafft ab 85 % richtig (mindestens 8 bearbeitet).
- Rechenkette: Einerstelle als einzelner Tastendruck, ohne Enter. Dauer 3, 4 oder 5 Minuten je Stufe. Geschafft ab 90 % richtig. Die Auswertung zeigt die richtigen Antworten je 30 Sekunden (Ermüdungskurve).

**Reaktion und Vigilanz**

- Optionen je Modul stehen auf dem Startbildschirm (Variante, Modus, Dauer, Signalhäufigkeit, Takt, Antwortfenster) und werden gemerkt.
- Töne: Sinustöne über die Web Audio API, einmal als Puffer erzeugt und über die Audiouhr geplant. Ist der Ton in den Einstellungen aus, erscheinen Tonreize als Symbol (♪ hoch/tief), damit die Aufgabe lösbar bleibt.
- Reizzeit: Ein Reiz gilt ab dem übernächsten Bildschirmframe als sichtbar (requestAnimationFrame), Reaktionszeiten zählen ab dort. Browser messen etwa einen Frame ungenau (8 bis 17 ms).
- Determinationstest-ähnlich: Ein Reiz ist 75 % der Taktzeit sichtbar, danach kurz leer. Richtige Antworten in der Lücke zählen als „verspätet“. Adaptiv: −5 % nach richtig, +10 % nach Fehler oder Auslassung, Start 1,2 s, Grenzen 0,25 bis 3 s. Aktion: fester Takt je Stufe (1,2 s bis 0,66 s). Reaktion: nächster Reiz nach der Antwort, höchstens 3 s Wartezeit. Tastenbelegung in den Einstellungen änderbar.
- Wahlreaktion: 60 Durchgänge, Antwortfenster 1,5 s bis 0,78 s je Stufe. Go/No-Go: etwa 40 % Go-Reize (Gelb plus Ton), Ablenker sind Gelb ohne Ton oder Blau mit oder ohne Ton.
- Vigilanz-Uhr: Der Takt hängt an requestAnimationFrame; jede Taktabweichung vom Soll wird gemessen und in der Auswertung angezeigt. Signale haben mindestens 20 Schritte Abstand. Original-nah ergibt bei 1 s Takt im Mittel rund 11 Signale in 30 min (Test). Gemessen in einem echten 30-Minuten-Lauf (Chromium, ohne Vorspulen): mittlere Taktabweichung 8,8 ms über 1.799 Takte, also unter einem halben Bildschirmframe.

**Textaufgaben**

- 28 Vorlagen in acht Typen (Dreisatz, umgekehrter Dreisatz, Geschwindigkeit, Prozent, Zins, Mischung, Maßstab, Marsch). Zahlen werden so gezogen, dass die Lösung glatt ist (höchstens zwei Nachkommastellen).
- Ablenker sind ausgerechnete typische Denkfehler: Dreisatz in die falsche Richtung, Prozent vom neuen statt vom alten Grundwert, Monate vergessen, Mittelwert statt gewichtetem Mittel, Faktor 10 bei Maßstab, Pausen falsch gezählt. Fehlen davon welche (gleiche Werte), wird mit Nachbarwerten aufgefüllt.
- Marschregel steht immer im Aufgabentext („nach jeder vollen Marschstunde 10 Minuten Pause, am Ziel keine“), damit die Lösung eindeutig ist.

**Wortanalogien, Begriffe, Rechtschreibung (Wortbanken in `src/data/`)**

- `analogien.json`: 10 Beziehungen, 164 Wortpaare mit je 4 Ablenkern. Eine Aufgabe kombiniert zwei Paare derselben Beziehung (rund 2.500 Kombinationen). Die Stufe ist die des gefragten Paars. Ab Stufe 8 in der Hälfte der Fälle zwei Lücken („? : B = C : ?“) mit Wortpaaren als Optionen.
- `begriffe.json`: 46 Kategorien in Gruppen (zum Beispiel Saiten-, Blas-, Schlaginstrumente). Jedes Wort steht in genau einer Kategorie; mehrdeutige Wörter (Becken, Golf, Drohne, Hammer) wurden bewusst entfernt. Ab Stufe 6 kommen die Ablenker aus derselben Gruppe.
- `rechtschreibung.json`: 413 Einträge (Wörter, das/dass, Verwechslungswörter, Groß- und Kleinschreibung, Getrennt- und Zusammenschreibung ab Stufe 6). Wo der Duden zwei Schreibweisen zulässt (kennenlernen/kennen lernen, Recht/recht haben, aufs Neue/neue …), wurde der Eintrag gestrichen oder nur eine Form angeboten. Fälle mit zwei zulässigen Formen sind die größte Fehlerquelle; wer einen Fehler findet, meldet ihn mit „Aufgabe fehlerhaft?“.
- `npm run validate:banks` prüft alle Banken: Schema, keine Dubletten, Lösung nicht unter den Ablenkern, Erklärung vorhanden, Mindestumfang (Rechtschreibung 400, Technik 60).

**Technisches Verständnis**

- Erzeugte Grafiken: Zahnradketten (Drehsinn und Drehzahl, ab Stufe 3 auch blockierende Dreierkreise, ab Stufe 6 Räder auf gemeinsamer Achse), Riemen offen oder gekreuzt (ab Stufe 6 mit Zwischenwelle), Hebel (ab Stufe 6 mehrere Gewichte), Flaschenzug (Kraft und Seilweg), schiefe Ebene.
- Drehsinn und Drehzahl werden über einen Kopplungsgraphen berechnet (Eingriff: Gegenrichtung und Zähneverhältnis, Achse: gleich). Ein Widerspruch im Graphen heißt „blockiert“.
- Räder auf gemeinsamer Achse liegen in zwei Ebenen: Das hintere Rad ist blasser gezeichnet, die Achse gestrichelt markiert. Räder derselben Ebene überlappen nie (Test).
- Feste Sammlung `technik.json`: 61 Fragen zu Strom, Wärme, Auftrieb, Hydraulik, verbundenen Gefäßen, Schwerpunkt, Kurvenfahrt und Mechanik (Stufe 1 bis 6). Sie ist begrenzt und als „feste Aufgabe“ gekennzeichnet; etwa jede dritte Aufgabe stammt daraus.

**Gemeldete Aufgaben und begrenzte Aufgabenräume**

- „Aufgabe fehlerhaft?“ speichert jetzt auch den Fingerabdruck. Gemeldete Aufgaben werden in diesem Modul nicht mehr gezeigt, solange es Alternativen gibt.
- Wortbanken und feste Sammlungen haben je Stufe nur einige hundert verschiedene Aufgaben (Rechtschreibung etwa 100 bis 370, Analogien 270 bis 1.000). Für sie prüft der Test „keine Wiederholung“, bis die Hälfte des Aufgabenraums der Stufe gezeigt wurde, statt starr 500.

**Tageseinheit und Wochenplan**

- Die Tageseinheit (5, 8 oder 10 min, Lernmodus) besteht zu rund 70 % aus den Modulen des Wochenplans für den Tag und zu 30 % aus einem Fokus-Teil. Der Fokus zieht zufällig einen Regel-Tag der letzten 30 Tage mit Gewicht 1 + 2 × Fehlerquote (mindestens 3 Versuche je Tag) und übt genau diese Regel, ab der Stufe, auf der die Fehler lagen. Ohne Daten: das am längsten nicht geübte Modul.
- Aufgabenzahl je Teil aus Erfahrungswerten pro Aufgabe (`ESTIMATE` in `plan.ts`). Lange Blöcke (Durchstreichtest, Fakten, Determination …) werden weggelassen, wenn sie nicht in die Zeit passen; ihre Zeit geht an die anderen Module.
- Die Zusammenstellung hängt an einem festen Zufallswert je Kalendertag, damit Heute-Seite und Tageseinheit dasselbe zeigen. „Fokus neu wählen“ würfelt neu.
- Ein Tag gilt als erledigt bei abgeschlossener Tageseinheit oder mindestens 5 Minuten Training in abgeschlossenen Durchgängen. Freies Training zählt also mit, nur ein einzelner kurzer Durchgang nicht.
- Standard-Wochenplan laut Prompt; Donnerstag „Sprache“ = Wortanalogien, Begriffe, Rechtschreibung; Samstag „Gedächtnis/Konzentration“ = Zahlenspanne, n-back, Symbol-Zahl. Änderbar in den Einstellungen.

**Phasen**

- Aus dem Testtermin: Grundlage (mehr als 8 Wochen), Aufbau (8 bis 3 Wochen), Peak (3 bis 1 Woche), Taper (letzte Woche, in den letzten 3 Tagen keine Simulation). Jede Phase hat Wochenziele (Tageseinheiten, Kurz-/Vollsimulationen, Belastungstest), die Heute-Seite zeigt, was diese Woche noch offen ist. Die Schwellen sind eigene Festlegungen, keine offizielle Empfehlung.

**Simulationen**

- Alle Teile laufen im Testmodus (adaptiv, Zeitlimit, keine Rückmeldung) mit eigener Anleitungsseite je Block. Teile mit Zeitbudget enden nach Ablauf mit der laufenden Aufgabe.
- Kurzsimulation 30 min: Zahlenreihen 6, Matrizen 8, Rotation 5, Kopfrechnen 5, Wortanalogien 3, Determination 3 (Minuten).
- Vollsimulation: 9 Blöcke, 140 min Aufgabenzeit, am Ende 30 min Vigilanz (original-nah). Pausen 5 min oder „Ernstfall“ ohne Pause. Mit Anleitungsseiten und Pausen rund 2,5 bis 3 Stunden.
- Jeder Teil ist eine eigene Sitzung mit gemeinsamer Gruppen-ID. Der Bericht zeigt je Block Niveau, Treffer, Median, den Vergleich zur letzten vollständigen Simulation gleicher Art und die Vigilanz-Kurve. Abgebrochene Simulationen bleiben mit ihren erledigten Blöcken sichtbar.

**Belastungsmodus**

- Vorher: Müdigkeit (1 bis 5), Schlaf, Bestätigung „gesund und belastbar“ (ohne sie startet nichts). Abläufe: geführt (4 × 40 s Übung, 20 s Pause, mit Ton), eigene Belastung, oder im Wechsel (3 × 60 s Belastung, dann je ein Drittel der Aufgaben). Puls optional nach der Belastung.
- Alle Antworten tragen `belastet = true` plus Puls und Müdigkeit. Fortschritt vergleicht je Modul Trefferquote und Median-Zeit im Testmodus ausgeruht gegen belastet.

**Schwächen üben**

- Im Fehlerprotokoll startet „Üben“ 10 neue Aufgaben mit genau diesem Regel-Tag. Die Engine erzeugt dafür Aufgaben, bis der Tag passt (höchstens 250 ms je Aufgabe), sonst nimmt sie eine beliebige des Moduls.

**Offline (PWA)**

- Manifest und Service Worker: Die Seite selbst wird zuerst aus dem Netz geladen (Updates kommen sofort), gebaute Dateien aus dem Cache. Nach dem ersten Besuch läuft die App ohne Netz und lässt sich auf dem Handy zum Startbildschirm hinzufügen.

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
- Die Gestaltung von Heute und Dashboard ist noch nicht überarbeitet (geplant als letzter Schritt).
- Simulationen bilden Ablauf und Zeitdruck nach, nicht die echten Aufgaben oder deren Bewertung.
- Sprach- und Technikbanken sind von Hand geschrieben und damit begrenzt. Sie wiederholen sich bei intensivem Training nach einigen Wochen.
