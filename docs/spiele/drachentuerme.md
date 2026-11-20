# Drachentürme

Eigene Fassung der Mechanik von **Kamisado** (Peter Burley, Burley Games 2008). Name, Brett- und Turmgestaltung sind eigene; die Spielmechanik ist übernommen. Issue #591.

## Steckbrief

| | |
|---|---|
| Spiel-id | `dragon-towers` |
| Spieler | 2 (Schwarz beginnt, Gold) |
| Muster | offen, keine Zufallselemente |
| Bausteine | Gitterbrett, `useGridMoveAnimation`, `usePointerDrag`, Alpha-Beta |
| Modi | allein gegen Bot, Hot-Seat, online |

## Regeln (Einzelrunde)

- 8 × 8 Felder in acht Farben (Orange, Blau, Lila, Rosa, Gelb, Rot, Grün, Braun), jede Farbe einmal je Reihe und Spalte, um 180° drehsymmetrisch (`BOARD_COLORS` in `src/rules.ts`). Jede Grundreihe läuft aus Sicht ihres Spielers von Braun (links) bis Orange (rechts).
- Je acht Türme pro Spieler, einer pro Farbe, jeder startet auf dem Feld seiner Farbe in der eigenen Grundreihe.
- Ziehen: beliebig weit gerade oder schräg vorwärts, nie über andere Türme, nie auf ein besetztes Feld. Kein Schlagen.
- Schwarz wählt den ersten Turm frei. Danach muss der Gegner den Turm in der Farbe des Feldes ziehen, auf dem der letzte Turm gelandet ist.
- Eingesperrt: Kann der Pflicht-Turm nicht ziehen, setzt der Spieler aus (Zug `pass`, ein Zug der Länge null). Der Gegner zieht dann den Turm in der Farbe des Feldes, auf dem der eingesperrte Turm steht.
- Blockade: Wiederholt sich die Folge des Aussetzens (gleicher Spieler muss wieder dieselbe Farbe ziehen, ohne dass dazwischen ein echter Zug kam), verliert, wer den letzten echten Zug gemacht hat (`passChain` im Spielstand).
- Sieg: Ein Turm erreicht die gegnerische Grundreihe.
- Jede Partie endet: Türme ziehen nur vorwärts (höchstens 96 echte Züge), und zwischen zwei echten Zügen kann es nur endlich viele Aussetz-Lagen geben.

## Optionen

- `board`: Brett zum Spieler am Zug drehen (Standard) oder fest – wie bei Dame.

## Spielmodell

`DragonTowersState`: `towers` (64 Felder, Turm = Platz + Farbe), `turn`, `required` (Pflichtfarbe, `null` beim ersten Zug), `lastMove`, `lastMover`, `passChain`, `plies`, `winner`, `end` (`goal`/`deadlock`), `rotate`. Züge: `{ type: 'move', from, to }` oder `{ type: 'pass' }`. Ereignisse: `moved` (mit `distance`), `passed`, `win`, `deadlock`.

## Bot

„Vorausrechner“ (`src/bots.ts`): Alpha-Beta aus der Engine mit Zugsortierung (Zielzug, dann Züge, die dem Gegner keinen bedrohenden Turm aufzwingen). Bewertung: Türme mit freier Bahn ins Ziel (40), Vorrücken (2 je Reihe), Pflicht-Turm mit Siegzug (5000). Leicht: 1 Zug tief und 35 % Zufall, mittel: 3 Züge, schwer: bis 7 Züge, höchstens 1,2 s. Einen sofortigen Sieg nimmt er auf jeder Stufe.

## Zeitlimits

Entspannt ohne Uhr, normal 30 s je Zug, schnell Schachuhr 3 min + 2 s.

## Oberfläche

- Statuszeile über dem Brett: wer welchen Turm ziehen muss (mit Farbfeld), bei eingesperrtem Turm der Knopf „Aussetzen“.
- Der Pflicht-Turm ist sofort gewählt und pulsiert; Zielfelder zeigen weiße Punkte. Antippen oder Ziehen (Drag & Drop).
- Türme: Achteck in Schwarz oder Gold mit farbiger Kappe (CSS, keine Bilder).
- **Gleiten:** `useGridMoveAnimation` (FLIP: der Turm steht schon im Zielfeld und wird per `transform` vom Startfeld her zurückgeschoben). Die Dauer wächst mit dem Weg: `glideMs(felder) = 160 + 75 × felder` (1 Feld 235 ms, 7 Felder 685 ms). Gleichzeitig hebt sich der Turm über `scale` und einen größeren Schatten kurz an und setzt wieder auf (`dt-lift`) – `scale` und `transform` stören sich nicht. Aussetzen verschiebt den Animationsschlüssel nicht. Bei `prefers-reduced-motion` entfällt beides.

## Hot-Seat und Online

Im Server (`apps/server/src/games.ts`) und im VR-Katalog (`apps/xr/src/catalog.ts`, 2D-Fenster ohne eigenen 3D-Tisch) eingetragen. Keine Geheimnisse, Sicht = Spielstand.

## Tests

`test/dragon-towers.test.ts`: Brett (lateinisches Quadrat, Symmetrie), Aufstellung, Zugrichtungen und Hindernisse, Farbregel, Sieg, Aussetzen, Blockade, Bot nimmt Sieg, Vertragsprüfungen.

## Offene Punkte

- **Match mit Sumo-Türmen** (Standard 3, lang 7, Marathon 15 Punkte): Drachenzähne, kürzere Reichweite (5/3/1), Schieben, Neuaufstellung nach links oder rechts aufgefüllt. Eigenes Issue.
- **Wappen:** `apps/web/src/wappen/dragon-towers.webp` ist ein gezeichneter Platzhalter (Quelle `docs/grafik/platzhalter/dragon-towers-wappen.svg`); ein gemaltes Wappen nach Stilbibel kostet Credits und braucht Cornelius' Freigabe.
- Eigener Klang für das Gleiten (derzeit `stein-ziehen`) und ein 3D-Tisch in der VR-App.
