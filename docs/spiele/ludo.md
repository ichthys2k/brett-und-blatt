# Nicht ärgern! (Ludo)

| Steckbrief | |
|---|---|
| Spieler | 2–6 (ab 5 auf dem Sternbrett) |
| Dauer | 20–45 Minuten |
| Modi | Solo gegen Bot, Hot-Seat, online |
| Muster | offen, Zug um Zug, Würfelglück & Taktik |
| Bausteine | SVG-Kreuzbrett / Sternbrett, 3D-Würfel & Würfelbecher, Heuristik-Bot |
| Aufwand | Regeln M, Oberfläche M, Bot M |
| Etappe | 7 |
| Ordner | `packages/games/ludo` |

Das beliebte Laufspiel für Familie und Freunde: Figuren aus dem Häuschen bringen, den 40-Felder-Rundkurs meistern, gegnerische Steine rauskegeln und die eigenen Püppchen sicher ins Ziel retten. „Mensch ärgere dich nicht“ ist eine eingetragene Marke der Schmidt Spiele GmbH, daher trägt das Spiel in Brett & Blatt den freien Namen **„Nicht ärgern!“** (Paket- und Modul-ID `ludo`).

## Regeln (Standard: Klassisch)

- **Ziel:** Jeder Spieler besitzt 4 Spielfiguren einer Farbe (Gelb, Grün, Rot oder Blau/Schwarz). Ziel ist es, alle 4 Figuren aus dem Wartebereich (Stall/Base) über den 40 Felder langen Rundkurs in die 4 Zielfelder (Häuschen a–d) der eigenen Farbe zu bringen. Wer zuerst alle 4 Steine im Ziel hat, gewinnt.
- **Start & Würfeln:**
  - **Drei Versuche:** Hat ein Spieler keine einzige Figur auf dem Rundkurs (alle Steine stehen im Stall oder bereits im Ziel), darf er in seinem Zug bis zu dreimal würfeln, um eine 6 zu erzielen. Fällt eine 6, muss sofort gezogen werden; verbleibende Versuche verfallen.
  - **Ein Wurf:** Sobald mindestens eine Figur auf der Laufstrecke steht, darf pro Runde nur einmal gewürfelt werden.
- **Die 6:**
  - Mit einer 6 **muss** ein Stein aus dem Stall auf das eigene Startfeld (B-Feld / Pfeil) gesetzt werden, solange sich noch Steine im Stall befinden.
  - Das Startfeld muss sofort freigemacht werden: Befindet sich dort bereits ein eigener Stein, muss dieser im nächsten Schritt weggesteuert werden.
  - Befindet sich auf dem Startfeld ein gegnerischer Stein, wird dieser geschlagen.
  - Wer eine 6 gewürfelt hat, darf nach dem Ausführen des Zuges **noch einmal würfeln** (beliebig oft wiederholbar, solange 6en fallen).
- **Ziehen & Überspringen:**
  - Steine ziehen im Uhrzeigersinn um die gewürfelte Augenzahl (1–6).
  - Fremde und eigene Steine dürfen auf dem Weg übersprungen werden.
  - Zwei eigene Steine dürfen nicht auf demselben Feld stehen (Blockade).
- **Schlagen & Schlagpflicht:**
  - Endet der Zug auf einem Feld mit einem gegnerischen Stein, wird dieser geschlagen und wandert zurück in seinen Stall.
  - **Schlagen ist freiwillig (Standard seit 31.10.2026, F-003).** Mit der Option **Schlagpflicht** muss geschlagen werden, wenn es geht.
  - *Prioritätenliste bei der Zugauswahl:*
    1. Startfeld belegen (Stein aus dem Stall auf Start setzen bei 6).
    2. Startfeld räumen (wenn blockiert).
    3. Gegnerischen Stein schlagen (bei mehreren Schlägen: freie Auswahl).
    4. Beliebiger anderer legaler Zug.
- **Einzug ins Ziel (Häuschen 1–4):**
  - Vor dem eigenen Startfeld biegt der Stein in die 4 Zielfelder ab.
  - **Genaue Augenzahl (Standard):** Zielfelder müssen mit passender Augenzahl erreicht werden. Höhere Würfe verfallen nicht, sondern der Zug ist unzulässig.
  - Eigene Steine im Zielhaus dürfen nicht übersprungen werden.

## Optionen in der Lobby

| Option | Werte | Standard | Beschreibung |
|---|---|---|---|
| **Regelvariante** | Klassisch, Familie (locker), Flotter Ärger, Teams (2 vs 2) | Klassisch | **Klassisch:** Schlagpflicht aktiv, 3 Versuche bei leerer Strecke, genaues Einrücken ins Ziel.<br/>**Familie:** Schlagen ist freiwillig, Überspringen im Zielhaus erlaubt.<br/>**Flotter Ärger:** Rauskommen auch bei 1 oder 6; 3 Versuche auch bei Blockade.<br/>**Teams:** 2 gegen 2 (Partner sitzen gegenüber, kein Schlagen untereinander, Helfen im Ziel). |
| **Spielbrett** (`board`) | Kreuz für bis zu 4, Stern für bis zu 6 | Kreuz | Klassisches 40-Felder-Kreuzbrett oder Sternbrett mit sechs Armen und 54 Feldern. Ab 5 Spielern gilt immer das Sternbrett (umgesetzt 31.10.2026, W-032). |
| **Schlagpflicht** | Aus, An | Aus | Steuert, ob schlagbare Züge Vorrang vor normalen Zügen haben (bis 30.10.2026 standardmäßig an, `ruleVersion` 2). |
| **Drei Versuche** | Nur wenn Strecke leer, Auch bei Blockade, Nie | Nur wenn Strecke leer | Wann bis zu dreimal gewürfelt werden darf. |
| **Brett drehen** | Zum Spieler am Zug, Fest | Zum Spieler am Zug | Dreht das Brett bei Hot-Seat am Gerät zur jeweiligen Spielerfarbe. |

## Nicht ärgern! zu sechst (W-032, 31.10.2026, `ruleVersion` 3)

Kein eigenes Spiel, sondern ein zweites Brett im selben Modul.

- **Brett:** sechs Arme zu je 9 Feldern (4 hinaus, die Spitze, 4 zurück), zusammen 54 Felder (`SIX_ARM_LENGTH`, `SIX_TRACK_LENGTH`, `trackLengthOf(board)`). Das Startfeld liegt außen auf der Rückspur gleich hinter der Spitze (`arm * 9 + 5`), die Zielfelder führen von der Spitze zur Mitte.
- **Plätze und Arme:** `armOf(seat, seats)` verteilt weniger als sechs Spieler gleichmäßig (zu zweit Arme 0 und 3, zu dritt 0, 2, 4, zu viert 0, 1, 3, 4). Freie Arme bleiben grau.
- **Farben:** zwei neue Farben mit Formsymbol: Lila (◆ Raute) und Türkis (✚ Kreuz). Die Farbe hängt nur am Platz (`colorIndex`), nicht am Brett.
- **Zustand:** `LudoState.board` (`'classic' | 'six'`); fehlt das Feld (ältere Partien), gilt das Kreuzbrett. Regeln und Bot rechnen überall mit `trackLengthOf(state.board)`.
- **Oberfläche:** Die Geometrie beider Bretter steht in `src/ui/geometry.ts` (`geometryOf`, `cornerOf`, `cornerColors`). Das Sternbrett hat eine viewBox von 1360, die Häuschen sitzen als runde Flächen in den Lücken zwischen den Armen; der 3D-Würfel liest die Brettgröße aus `--ludo-size`.

## Spielmodell

```ts
export type Area = 'home' | 'track' | 'goal';

export interface PiecePosition {
  area: Area;
  /**
   * Bei 'home': 0..3 (Stallplatz)
   * Bei 'track': 0..39 (relativer Schritt vom eigenen Startfeld 0 bis 39)
   * Bei 'goal': 0..3 (Zielfeld a..d)
   */
  index: number;
}

export type Phase = 'roll' | 'move';

export interface LudoState {
  seats: number;
  turn: SeatId;
  phase: Phase;
  dice: number | null;
  rollsLeft: number;
  canRollAgain: boolean;
  pieces: PiecePosition[][];           // [seat][pieceIndex 0..3]
  variant: 'classic' | 'family' | 'fast' | 'teams';
  mandatoryCapture: boolean;
  exactGoal: boolean;
  enterOnSixOrOne: boolean;
  threeRollsRule: 'empty_track' | 'blocked' | 'never';
  boardSize: 4 | 6;
  history: string[];
  rng: RngState;
}

export type LudoMove =
  | { type: 'roll' }
  | { type: 'move'; pieceIndex: number }
  | { type: 'pass' };
```

- **Relative Schrittzählung:** Jeder Spieler zählt seine Schritte auf der Laufstrecke von `0` (eigenes Startfeld) bis `39` (letztes Feld vor dem Abbiegen ins Ziel). Die Felder `40..43` repräsentieren die 4 Zielpositionen.
- **Absoluter Feldindex:** `(seatStartOffset(seat) + step) % 40`. Kollisionen auf der Strecke liegen vor, wenn zwei Steine denselben absoluten Index besitzen.

## Bot („Würfelmeister“)

Heuristischer Taktik-Bot in drei Stufen:
- **Leicht (`easy`):**
  - Wählt oft zufällig unter den erlaubten Zügen.
  - Übersieht bei deaktivierter Schlagpflicht gelegentlich Schläge.
  - Lässt Figuren mitunter unnötig lange im Stall warten.
- **Mittel (`medium`):**
  - Strikte Regelhierarchie:
    1. Stein aus dem Stall herausziehen (bei 6).
    2. Startfeld räumen.
    3. Gegnerischen Stein schlagen.
    4. Eigenen Stein ins sichere Zielhaus retten.
    5. Bedrohten Stein aus gegnerischer Reichweite (1–6 Felder vor einem Gegner) ziehen.
    6. Weitesten Stein vorziehen.
- **Schwer (`hard`):**
  - Nutzenfunktion mit Wahrscheinlichkeitsanalyse:
    - **Reuewert:** Bevorzugt Schlagen von gegnerischen Steinen, die bereits einen weiten Weg zurückgelegt haben.
    - **Gefahrenanalyse:** Bewertet das Schutzniveau und die Schlagwahrscheinlichkeit auf Feldern vor gegnerischen Steinen.
    - **Zieloptimierung:** Befüllt das Zielhaus von hinten nach vorne (Feld d vor c vor b vor a), um Blockaden für nachfolgende Steine zu vermeiden.
    - **Lauerpositionen:** Postiert Steine gezielt 1–6 Felder hinter gegnerischen Figuren.

## Zeitlimits

| Voreinstellung | Modell |
|---|---|
| gemütlich | aus |
| normal | 20 s pro Zug |
| schnell | 10 s pro Zug |

**Bei Zeitablauf:** Der Bot würfelt bzw. zieht automatisch den besten heuristischen Zug.

## Oberfläche

- **Layout:** Klassisches 11×11-Kreuzbrett oder sechsarmiges Sternbrett als SVG (skalierbar via `FitBox`, Geometrie in `src/ui/geometry.ts`).
- **Farben & Barrierefreiheit:** Farben nach Okabe-Ito (Gelb, Grün, Rot, Blau). Jede Spielfigur trägt zusätzlich ein klares geometrisches Symbol (● Kreis, ▲ Dreieck, ■ Quadrat, ★ Stern, auf dem Sternbrett dazu Lila ◆ Raute und Türkis ✚ Kreuz) für Menschen mit Farbsehschwäche.
- **Würfelinteraktion:** Plastischer 3D-Würfel in der Mitte des Bretts. Antippen des Würfels (oder Druck auf die Leertaste) löst den Wurf aus.
- **Züge:** Legale Figuren pulsieren sanft (`ludo-pulse`). Ein Antippen oder Ziehen per Pointer Drag & Drop (`usePointerDrag`) führt den Zug aus.
- **Animationen:**
  - Figuren hüpfen Feld für Feld (150 ms je Feld, aus dem Stall in einem hohen Sprung aufs Startfeld; W-011). Umgesetzt in `usePieceAnimation` aus den Ereignissen `entered`, `moved`, `goalEntered`, `goalMoved`; während des Sprungs bleibt der Schatten am Boden.
  - Rauswurf-Animation: Die geschlagene Figur bleibt stehen, bis die ziehende Figur ankommt, und fliegt dann drehend im Bogen zurück in den Stall (650 ms; W-012). Zieht der Nächste schon, laufen beide Animationen nebeneinander. Bei „Bewegung reduzieren“ entfallen die Animationen.
  - Der Sockel der Figuren steht mittig auf dem Feld (`PIECE_DROP` = −7, F-002; vorher 5 Einheiten darunter).
  - Wurf ohne möglichen Zug: Der Würfel wandert nicht zum nächsten Spieler. Die Regeln leeren `dice` beim Zugwechsel und merken den Wurf in `lastRoll`; die Oberfläche zeigt ihn als kleinen durchgestrichenen Würfel in der Farbe dessen, der gewürfelt hat (F-004).
  - Banner bei einer 6: „Nochmal würfeln!“.
- **Klänge:** `wuerfeln` (Würfelwurf), `stein-heraus` (Herausziehen auf Start), `stein-ziehen` (Vorrücken), `stein-schlagen` (Rauswerfen), `stein-setzen` (Einzug ins Ziel), `sieg` (`arcade_level_win`). Musik: Playlist **`spielabend`**.

## Hot-Seat und Online

- **Hot-Seat:** Vollständig transparente Spielinformationen. Option „Brett drehen“ dreht das Brett bei jedem Zugwechsel zum aktuellen Spieler.
- **Online:** Bis zu 6 Spieler. Serverseitiger Zufall (`Rng`), Zeitlimits mit Kulanz, Bot-Ersatz bei Verbindungsabbruch und Revanche-Funktion direkt am Spieltisch.

## Tests

- Korrekte Startaufstellung (alle 4 Steine im Stall, leerer Rundkurs).
- 3 Würfelversuche nur bei leerem Rundkurs; Verfall der Restwürfe bei einer 6.
- Pflicht zum Herausziehen auf das Startfeld bei einer 6 und Pflicht zur Startfeldräumung.
- Korrektes Überspringen fremder und eigener Steine auf der Strecke.
- Schlagen standardmäßig freiwillig; mit Schlagpflicht haben Schläge Vorrang vor normalen Zügen.
- Wurf ohne Zug kurz vor Schluss: Zugwechsel mit leerem Würfel und `lastRoll` (F-004).
- Rauswurf: Geschlagener Stein landet wieder im Stall.
- Einzug ins Zielhaus: Genaue Augenzahl erforderlich, kein Überspringen im Zielhaus.
- Partiegewinn, sobald alle 4 Steine die Zielfelder belegen.
- Sternbrett: Brettwahl nach Spielerzahl und Option, Startfelder je Arm, Felder ohne Überlappung, Einzug ins Ziel nach 54 Feldern, Schlagen über die Arme hinweg.
- Vollständige Plattform-Vertragsprüfungen (`gameContractChecks`, mit 2 und 6 Spielern).
