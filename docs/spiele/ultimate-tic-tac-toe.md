# Ultimate Tic-Tac-Toe

| Steckbrief | |
|---|---|
| Spieler | 2 |
| Dauer | 5–10 Minuten |
| Modi | Solo gegen Bot, Hot-Seat, online |
| Muster | offen, Zug um Zug |
| Bausteine | Gitterbrett, MCTS |
| Aufwand | Regeln S, Oberfläche S, Bot S |
| Etappe | 2, bringt MCTS in die Plattform |

Tic-Tac-Toe im Tic-Tac-Toe. Das normale **Tic-Tac-Toe** ist die offizielle **Vorlage für neue Spiele** (Etappe 1) und lebt als eigenes, ausführlich kommentiertes Lehrbeispiel unter `packages/games/tic-tac-toe/`.

## Regeln (Standard)

- Ein großes 3×3-Feld, in dem jedes Feld ein kleines Tic-Tac-Toe ist.
- **Hinschicken:** Wo man im kleinen Feld setzt, bestimmt das große Feld, in dem der Gegner als Nächstes spielen muss. Setzt man z. B. oben rechts, muss der Gegner im großen Feld oben rechts spielen.
- Ist dieses Feld schon entschieden (gewonnen oder voll), darf der Gegner in jedem offenen Feld spielen.
- Ein kleines Feld gewinnt, wer dort drei in einer Reihe hat. Das ganze Spiel gewinnt, wer drei große Felder in einer Reihe hat. Ist keine Reihe mehr möglich, endet es unentschieden.
- Der erste Zug ist frei.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Entschiedene Felder | gesperrt, weiter bespielbar (solange nicht voll) | gesperrt |
| Unentschiedenes kleines Feld | zählt für niemanden, zählt für beide | niemanden |

## Spielmodell

```ts
type UltimateMove = { type: 'place'; board: number; cell: number }; // je 0–8
```

- **Zustand:** 9 kleine Felder mit je 9 Zellen, Status je kleinem Feld, erlaubte großes Feld(er), aktiver Spieler.
- **Ereignisse:** `placed`, `smallBoardWon`, `win`.

## Bot

**MCTS** (Monte-Carlo-Baumsuche) ist hier ideal. Das Spiel ist ein klassisches Übungsfeld für dieses Verfahren, und eine eigene Bewertungsfunktion ist schwierig. Der Bot spielt im Kopf viele zufällige Partien zu Ende und wählt den Zug mit der besten Gewinnquote. Kleine Hilfen für die Zufallspartien:

- sofort mögliche Siege nehmen
- sofortige Verluste vermeiden

| Stufe | Durchläufe pro Zug |
|---|---|
| leicht | ca. 200 |
| mittel | ca. 5.000 |
| schwer | so viele, wie in 2 Sekunden gehen |

Der hier gebaute MCTS-Kern wird zum **allgemeinen Bot** der Plattform.

## Zeitlimits

| Voreinstellung | Pro Zug |
|---|---|
| gemütlich | aus |
| normal | 15 s |
| schnell | 7 s |

**Bei Zeitablauf** zieht der Bot.

## Oberfläche

- **9×9 Zellen** mit deutlich dickeren Linien zwischen den großen Feldern. Im Hochformat sind die Zellen etwa 38 px groß, das passt.
- **Hervorhebung:** Das Feld (bzw. die Felder), in dem gespielt werden muss, leuchtet; alle anderen sind gedämpft.
- **Entschiedene kleine Felder** zeigen ein großes X oder O; die Zellen darunter bleiben schwach sichtbar.
- **Tic-Tac-Toe-Vorlage:** dieselbe Darstellung mit 3×3.

## Hot-Seat und Online

Keine Geheimnisse, also keine Übergabe nötig.

## Tests

- Hinschicken: Pflichtfeld richtig; freie Wahl, wenn das Ziel gewonnen oder voll ist.
- Gewinn klein und groß, Unentschieden, beide Optionen.
- **Bot:** Der schwere Bot gewinnt gegen den Zufallsbot fast immer.
- **Tic-Tac-Toe-Vorlage:** Der schwere Bot verliert nie (Tic-Tac-Toe ist bei perfektem Spiel unentschieden).
