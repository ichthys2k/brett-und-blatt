# Farbe & Form

| Steckbrief | |
|---|---|
| Spieler | 2–4 |
| Dauer | 20–40 Minuten |
| Modi | Solo gegen Bot, Hot-Seat (mit Übergabe), online |
| Muster | verdeckt (Bänkchen und Beutel), Zug um Zug |
| Etappe | 4 |
| Ordner | `packages/games/color-and-shape` |

## Regeln (Qwirkle-artig)

- 108 Steine: 6 Farben × 6 Formen (Kreis, Quadrat, Raute, Stern, Kreuz, Kleeblatt), je dreimal. Jeder zieht 6.
- Es beginnt, wer die größte Gruppe gleicher Farbe oder Form ohne Doppelte hat (bei Gleichstand der frühere Platz).
- Ein Zug: einen oder mehrere Steine in **eine** gerade, lückenlose Reihe anlegen, oder 1–6 Steine mit dem Beutel tauschen (nur, wenn der Beutel genug hat), oder passen, wenn beides nicht geht. Danach auf 6 auffüllen.
- Jede Reihe hat dieselbe Farbe oder dieselbe Form, ohne Doppelte, höchstens 6 Steine.
- Punkte: Jede Reihe (ab 2 Steinen), die der Zug berührt, zählt ihre Länge; eine Sechserreihe zählt 6 extra. Ein einzelner erster Stein zählt 1.
- Ende: Beutel leer und jemand legt seinen letzten Stein (+6), oder alle passen nacheinander. Die meisten Punkte gewinnen.

## Umsetzung (Oktober 2026)

- Getauschte Steine kommen unten in den Beutel, gezogen wird oben – so braucht `applyMove` keinen Zufall.
- `placements` sucht alle Legezüge: von jedem freien Nachbarfeld aus Stein für Stein in beide Richtungen verlängern, gleiche Arten nur einmal.
- Sicht: eigenes Bänkchen, von den anderen und vom Beutel nur die Anzahl; `eventView` verrät gezogene Steine nur dem Ziehenden.
- Bot: leicht (oft zufällig), mittel (gierig), schwer (Punkte + Wert des Rest-Bänkchens, vermeidet Fünferreihen für den Gegner, tauscht ein schlechtes Bänkchen).
- Farben nach Okabe-Ito, zusätzlich durch die Form unterscheidbar.
- Steuerung: Steine auf der Bank können angetippt oder per Drag & Drop direkt auf gültige Rasterfelder des Bretts gezogen werden.

## Offen

- Bot mit Determinisierung und Vorausschau auf die Antwort des Gegners.
