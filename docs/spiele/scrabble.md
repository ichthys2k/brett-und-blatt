# Wortgitter (Scrabble-Familie)

| Steckbrief | |
|---|---|
| Spieler | 2–4 (Fokus: 2-Spieler-Turnierduell, 3–4 für Familienrunden) |
| Dauer | 20–45 Minuten |
| Modi | Solo gegen Bot, Hot-Seat (mit verdecktem Bänkchen & Übergabe), online |
| Muster | verdeckt (Buchstabenbänkchen & Beutel), Zug um Zug, mit Wörterbuch-Validierung |
| Bausteine | 15×15 Gitterbrett mit Multiplikatoren, zoombares Brett (`ZoomBoard`), DAWG-Wörterbuch, GADDAG/DAWG-Wortsuch-Bot |
| Aufwand | Regeln M, Wörterbuch L, Oberfläche L, Bot L |
| Etappe | 7 |
| Ordner | `packages/games/scrabble` |

Das weltbekannte Kreuzwort- und Buchstaben-Legespiel: Wörter auf dem 15×15-Brett kombinieren, Buchstabensummen mit Prämienfeldern (Dreifacher Wortwert, Doppelter Buchstabe) multiplizieren und die eigene Bank geschickt ausbalancieren.

## Regeln (Standard: Deutsches Scrabble)

- **Brett:** 15×15 Felder (Zeilen 0–14, Spalten 0–14, A–O und 1–15).
  - **Mittelfeld H8** (Stern): Das erste Wort der Partie muss dieses Feld überdecken; es zählt beim Erstzug als doppelter Wortwert (2W).
  - **Multiplikator-Felder:**
    - **3W** (Dreifacher Wortwert, dunkelrot): 8 Felder (Ecken und Mitten der Ränder: A1, H1, O1, A8, O8, A15, H15, O15).
    - **2W** (Doppelter Wortwert, rosa): 17 Felder (Diagonalen und Mittelfeld H8).
    - **3B** (Dreifacher Buchstabe, dunkelblau): 12 Felder (z. B. B6, F2, F6 ...).
    - **2B** (Doppelter Buchstabe, hellblau): 24 Felder (z. B. D1, F3, A4 ...).
  - **Prämienregel:** Multiplikatoren gelten **nur in dem Zug, in dem sie erstmals belegt werden**. Spätere Wörter, die diese Steine mitbenutzen, zählen nur deren normalen Buchstabenwert.

- **Steine & Buchstabenverteilung (Deutsch, 102 Steine):**
  - **1 Punkt (56 Steine):** E (15×), N (9×), S (7×), I (6×), R (6×), T (6×), U (6×), A (5×), D (4×)
  - **2 Punkte (10 Steine):** H (4×), G (3×), L (3×), O (3×)
  - **3 Punkte (11 Steine):** M (4×), B (2×), W (2×), Z (2×)
  - **4 Punkte (7 Steine):** C (2×), F (2×), K (2×), P (1×)
  - **6 Punkte (4 Steine):** Ä (1×), J (1×), Ü (1×), V (1×)
  - **8 Punkte (2 Steine):** Ö (1×), X (1×)
  - **10 Punkte (2 Steine):** Q (1×), Y (1×)
  - **0 Punkte (2 Steine):** Joker / Blanko (2×)
  - *Hinweis:* Ein „ß“ existiert im Scrabble nicht; es wird nach offizieller Regel immer als „SS“ (zwei Steine „S“) gelegt.

- **Ablauf & Züge:**
  - Jeder Spieler hat bis zu 7 Steine auf dem Bänkchen.
  - Der Spieler am Zug führt genau eine Aktion aus:
    1. **Wort legen (`play`):** 1 bis 7 Steine in einer lückenlosen Linie (waagerecht oder senkrecht) anlegen.
       - Erstzug: muss das Mittelfeld H8 bedecken und mindestens 2 Steine umfassen.
       - Folgezüge: müssen lückenlos an mindestens einen bereits liegenden Stein anschließen (durch Verlängerung oder orthogonales Kreuzen).
       - Alle in diesem Zug neu entstandenen Wörter (Hauptwort + orthogonale Querwörter) müssen gültige Wörter sein (mindestens 2 Buchstaben).
       - **Wertung:** Buchstabe × Buchstabenprämie; Summe × Wortmultiplikatoren (multiplizieren sich, z. B. 3W + 3W = 9×). Querwörter werden separat berechnet.
       - **Bingo-Prämie:** Wer alle 7 Steine von der Bank ausspielt, erhält **+50 Punkte** extra.
       - Anschließend zieht der Spieler aus dem Beutel auf 7 Steine nach.
    2. **Steine tauschen (`exchange`):** 1 bis 7 Steine in den Beutel zurücklegen und neue ziehen. Nur möglich, wenn noch mindestens 7 Steine im Beutel liegen. Zug endet ohne Punkte.
    3. **Passen (`pass`):** Zug abgeben (0 Punkte).

- **Joker (Blanko):**
  - Zählt 0 Punkte (auch auf Multiplikatoren wird nur der Wortwert multipliziert, der Buchstabenwert bleibt 0).
  - Beim Legen bestimmt der Spieler den dargestellten Buchstaben, der dauerhaft gilt.

- **Spielende:**
  - **Regulär:** Beutel leer und ein Spieler hat alle Steine gelegt. Ihm wird die Summe aller Reststeine auf den Bänken der Gegner gutgeschrieben (bei den Gegnern abgezogen).
  - **Vorzeitig:** 6 torlose Züge in Folge (z. B. alle Spieler passen 2 Runden lang hintereinander). Jeder zieht die Punkte seiner verbliebenen Steine ab.

## Optionen in der Lobby

| Option | Werte | Standard | Beschreibung |
|---|---|---|---|
| **Wörterbuch** | Deutsch (Standard), Englisch (SOWPODS) | Deutsch | Sprache und Wortliste für die Gültigkeitsprüfung. |
| **Prüfmodus** | Sofortprüfung, Challenge (Anfechten) | Sofortprüfung | *Sofort*: Nur gültige Wörter können gelegt werden (einsteigerfreundlich).<br/>*Challenge*: Man darf jedes Wort legen; der Gegner kann vor seinem nächsten Zug anfechten. |
| **Joker-Tausch** | Aus, An (Hausregel) | Aus | Erlaubt den Tausch eines auf dem Brett liegenden Jokers gegen den passenden Buchstaben von der eigenen Bank. |
| **Bänkchengröße** | 7 Steine, 8 Steine | 7 Steine | 8 Steine erleichtert das Finden von Wörtern für Gelegenheitsspieler. |
| **Bingo-Prämie** | 50 Punkte, Aus | 50 Punkte | Prämie für das Ausspielen aller 7 Steine in einem Zug. |

## Technische Architektur: Das DAWG-Wörterbuch

```
Wortliste (Roh, 350.000 Wörter, ~4 MB)
       │
       ▼ (scripts/build-scrabble-dawg.ts zur Build-Zeit)
Minimierter Directed Acyclic Word Graph (DAWG)
       │
       ▼
Uint32Array Binär-Blob (ca. 180 KB, gzippt < 80 KB)
       │
       ├── Browser (Vite dynamic import / Static Asset)
       └── Server (Cloudflare Worker, In-Memory TypedArray)
```

- **Kompakter Knoten (32 Bit):**
  - `Bits 0–4` (5 Bits): Buchstabe ($1 = A, \dots, 26 = Z, 27 = Ä, 28 = Ö, 29 = Ü$)
  - `Bit 5` (1 Bit): `isEndOfWord`
  - `Bit 6` (1 Bit): `isLastChild`
  - `Bits 7–31` (25 Bits): Index des ersten Kindknotens im Array
- **Performance:** Wortsuche in $O(L)$ mit $< 100\,\text{ns}$ pro Wort.
- **Speicher:** Passt problemlos in das 1-MB-Limit von Cloudflare Workers.
- **Quelle:** Freie Wortlisten (`igerman99` / `hunspell-de`, Wiktionary-Flexionen; bereinigt um Eigennamen und Sonderzeichen, AGPL-/CC-kompatibel).

## Spielmodell

```ts
export type Letter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'
  | 'K' | 'L' | 'M' | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T'
  | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z' | 'Ä' | 'Ö' | 'Ü';

export interface BoardCell {
  letter: Letter;
  isBlank: boolean;
  placedBy: SeatId;
  turn: number;
}

export interface PlacedTile {
  row: number;    // 0..14
  col: number;    // 0..14
  letter: Letter;
  isBlank?: boolean;
}

export type ScrabbleMove =
  | { type: 'play'; tiles: PlacedTile[] }
  | { type: 'exchange'; letters: (Letter | '?')[] }
  | { type: 'pass' }
  | { type: 'swapJoker'; row: number; col: number; rackIndex: number }
  | { type: 'challenge'; challenge: boolean };

export interface ScrabbleState {
  board: (BoardCell | null)[];  // 225 Felder (15 x 15)
  racks: (Letter | '?')[][];    // geheim, je SeatId
  bag: (Letter | '?')[];        // geheim, gemischter Beutel
  scores: number[];             // Punkte je Spieler
  consecutivePasses: number;    // Zähler für torlose Züge
  turn: SeatId;
  phase: 'play' | 'challenge';
  lastMove?: {
    actor: SeatId;
    move: ScrabbleMove;
    words: { word: string; score: number }[];
    score: number;
  };
  options: ScrabbleOptions;
}

export interface ScrabbleView {
  board: (BoardCell | null)[];
  rack: (Letter | '?')[];       // NUR eigenes Bänkchen
  rackCounts: number[];         // Anzahl Steine der Gegner
  bagCount: number;             // Verbleibende Steine im Beutel
  scores: number[];
  consecutivePasses: number;
  turn: SeatId;
  phase: 'play' | 'challenge';
  lastMove?: ScrabbleState['lastMove'];
}
```

- **Sicht (`playerView`):** Nur die eigenen Banksteine sind sichtbar. Fremde Bänke und der Beutel erscheinen nur als Zähler.
- **`sampleHidden`:** Füllt für Bots fremde Hände und den Beutel aus den verbleibenden ungesehenen Steinen auf.

## Bot

Basierend auf Gordon's GADDAG- und Appel-Jacobson-DAWG-Suche mit Ankerfeldern und Cross-Checks:

| Stufe | Verhalten |
|---|---|
| **leicht** (Anfänger) | Durchsucht nur wenige Ankerfelder. Wählt kurze Wörter (3–4 Buchstaben) mit geringem Punktwert (8–18 Punkte). Übersieht Prämienfelder. |
| **mittel** (Fortgeschritten) | Findet alle legalen Züge. Wählt gierig aus den oberen 15–20 % der punktbesten Züge. Einfache Bank-Balance (Vokal-/Konsonanten-Verhältnis). |
| **schwer** (Turnierspieler) | Bewertet Züge nach Turniertheorie: $\text{Wert} = \text{Punkte} + \text{Leave-Score}(\text{Restbank}) - \text{Gegnergefahr}$. Vermeidet das Öffnen von 3W-Feldern für den Gegner. Tauscht gezielt unbrauchbare Bänke. |

## Zeitlimits

| Voreinstellung | Modell | Beschreibung |
|---|---|---|
| **gemütlich** | aus | Ohne Zeitdruck, ideal zum Tüfteln |
| **normal** | Schachuhr 15 min + 10 s Inkrement | Standard-Turnieruhr für Scrabble |
| **schnell** | 60 s pro Zug | Schnelle Runden für zwischendurch |

## Oberfläche

- **Zoombares Brett (`ZoomBoard`):**
  - Doppeltippen oder Lupen-Knopf vergrößert einen Ausschnitt auf 200 % mit sanftem Verschieben (`pan`).
  - Desktop & Tablet: Passt vollflächig ohne Zoom in die Ansicht.
- **Dual-Input:**
  - **Drag & Drop:** Steine per Pointer-Drag vom Bänkchen direkt aufs Brett ziehen.
  - **Tastatur & Tipp-Modus:** Feld antippen -> Richtungspfeil erscheint -> Steine auf der Bank oder PC-Tastatur tippen.
- **Entwurfs-Phase (Staging) & Live-Punkte:**
  - Gelegte Steine verbleiben bis zur Bestätigung als Entwurf.
  - Live-Anzeige: `GARTEN (+28 Pkt. ✓)` oder rotes Feedback bei ungültiger Lage/Wort.
  - Knöpfe: **Legen** (grün), **Zurücknehmen**, **Mischen** (Bänkchen schütteln), **Sortieren** (A–Z), **Tauschen**, **Passen**.
- **Joker-Auswahl:**
  - Beim Legen eines Blanko öffnet sich ein kreisförmiges oder gerastertes Buchstaben-Auswahlfeld (A–Z, Ä, Ö, Ü).

## Tests

- Plattform-Vertragsprüfungen (`gameContractChecks`).
- DAWG-Integritätstests: Wortsuche, Suffix-Kompression, Erkennung von Umlauten und Grenzprüfungen (2–15 Zeichen).
- Legeregeln: Erstzug über H8; Mindestlänge 2; lückenloser Verbund; Erkennung aller orthogonalen Querwörter.
- Wertung: Buchstaben- und Wortmultiplikatoren (inkl. mehrfacher Multiplikatoren wie 3W × 3W = 9×); einmalige Gültigkeit von Prämienfeldern; Bingo-Bonus (+50 Punkte); Blanko zählt 0 Punkte.
- Tausch- und Pass-Regeln; Endabrechnung bei leerem Beutel vs. Pass-Remis.

## Umsetzungsstand (28.10.2026, Neufassung)

Die erste Fassung war nicht spielbar (Oberfläche ohne Funktion, Startfeld (4,4) statt H8, `legalMoves` ohne Legungen, Bot stürzte ab, Bänkchen offen). In Etappe 3 des Korrekturplans neu geschrieben:

- `src/rules.ts`: `checkPlay` prüft eine Legung (eine Linie, lückenlos, über H8 bzw. angelegt, alle Wörter im Wörterbuch) und wertet sie (Prämien nur für neue Steine, Joker 0, 50 Punkte für 7 Steine). Tauschen ab 7 Steinen im Beutel (Beutel wird mit dem Zufallsstrom im Zustand gemischt), Passen, Ende bei leerem Beutel und leerem Bänkchen oder nach max(6, 2 × Plätze) Zügen ohne Punkte; Reststeine werden verrechnet (`final`). Sicht verdeckt fremde Bänkchen, Beutel und Zufallsstrom.
- `src/movegen.ts`: Zuggenerator nach Appel & Jacobson mit Querprüfungen; senkrechte Legungen auf dem gespiegelten Brett. `legalMoves` liefert alle Legungen, das ganze Bänkchen zum Tauschen und Passen; beliebige Tauschmengen erlaubt `isLegal`.
- `src/dict.ts`: Präfixbaum statt DAWG. Wörter ohne Selbstlaut fallen weg, Wörter aus zwei Buchstaben nur nach einer kleinen Liste.
- `src/bots.ts`: „Wortmeister“ – leicht ein mittelmäßiges Wort (30.–70. Perzentil), mittel das punktstärkste, schwer Punkte plus Bewertung des Rests (Joker, S, E behalten; Dubletten, Q ohne U meiden; Selbstlaute ausgewogen) und Tauschen bei schwachem Zug.
- `src/ui/`: Brett mit Prämienfeldern, Steine antippen oder ziehen (`usePointerDrag`), Joker-Buchstabenwahl, Vorschau mit Wörtern und Punkten bzw. Fehlergrund, Mischen, Tauschen, Passen, Tipp als Geisterbuchstaben.
- Optionen: Bänkchen 7/8 Steine, Prämie für 7 Steine an/aus. Englisches Wörterbuch, Anfechten und Joker-Tausch sind gestrichen.

**Noch offen (Etappe 4):** Das Wörterbuch `src/dict/words-de.json` hat unklare Herkunft und Lizenz und enthält Namen und englische Wörter. Ersatz durch eine frei lizenzierte Liste (z. B. aus igerman98) mit Quelle in `THIRD_PARTY.md`.
