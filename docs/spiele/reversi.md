# Reversi

| Steckbrief | |
|---|---|
| Spieler | 2 |
| Dauer | 5–15 Minuten |
| Modi | Solo gegen Bot, Hot-Seat, online |
| Muster | offen, Zug um Zug |
| Bausteine | Gitterbrett, Minimax mit Alpha-Beta |
| Aufwand | Regeln S, Oberfläche S, Bot M |
| Etappe | 2 |

„Othello“ ist eine Marke; „Reversi“ ist der freie, ältere Name.

## Regeln (Standard)

- **Brett:** 8×8. Zu Beginn liegen vier Steine über Kreuz in der Mitte. Schwarz beginnt.
- **Zug:** Ein Stein muss so gesetzt werden, dass er in mindestens einer der acht Richtungen eine lückenlose Reihe gegnerischer Steine zwischen sich und einem eigenen Stein einschließt. Alle eingeschlossenen Steine werden umgedreht.
- Kann ein Spieler nicht setzen, muss er **passen**. Können beide nicht, endet das Spiel.
- Gewonnen hat, wer am Ende mehr Steine hat.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Brettgröße | 6×6, 8×8, 10×10 | 8×8 |
| Eröffnung | Kreuzstellung, freie Eröffnung (die ersten vier Steine frei in die Mitte, die alte Reversi-Regel) | Kreuzstellung |
| Zughilfe | erlaubte Felder zeigen, aus | an |

## Spielmodell

```ts
type ReversiMove =
  | { type: 'place'; cell: number }
  | { type: 'pass' };          // nur erlaubt, wenn kein anderer Zug geht
```

- **Passen als Pflichtzug:** Ist `pass` der einzige erlaubte Zug, führt die Spielleitung ihn automatisch aus (Spielfluss).
- **Zustand:** Belegung, aktiver Spieler, Passen in Folge.
- **Ereignisse:** `placed`, `flipped` (Reihenfolge der Steine je Richtung, für die Kettenanimation).

## Bot

**Minimax mit Alpha-Beta-Schnitt**, iterativer Vertiefung und Zugsortierung (Ecken zuerst). Die Bewertung berücksichtigt:

- **Ecken:** sehr wertvoll, denn sie lassen sich nie mehr umdrehen.
- **X- und C-Felder** (die Felder neben den Ecken) sind gefährlich, solange die Ecke frei ist.
- **Beweglichkeit:** eigene mögliche Züge gegenüber denen des Gegners.
- **Stabile Steine,** die nicht mehr umgedreht werden können.
- **Steinzahl** zählt erst am Ende. Vorher ist „wenige Steine“ oft besser.
- **Endspiel:** Die letzten 10–14 Züge rechnet der schwere Bot exakt durch.

| Stufe | Verhalten |
|---|---|
| leicht | gierig (dreht so viele Steine wie möglich), 1–2 Züge tief |
| mittel | Bewertung, 4–6 Züge tief |
| schwer | volle Bewertung, so tief wie die Zeit erlaubt, perfektes Endspiel |

Starke freie Programme (z. B. Edax, GPL-3) gibt es. Für unser Ziel genügt ein eigener Bot.

## Zeitlimits

| Voreinstellung | Modell |
|---|---|
| gemütlich | aus |
| normal | 15 s pro Zug |
| schnell | Schachuhr 3 Minuten + 2 s pro Zug |

**Bei Zeitablauf:** Bei Zugzeit zieht der Bot. Bei der Schachuhr ist die Partie verloren; wahlweise zieht der Bot.

## Oberfläche

- **Brett:** 8×8 passt auf jedes Handy.
- **Erlaubte Felder** sind mit einem kleinen Punkt markiert. Am Desktop und bei langem Drücken zeigt eine Vorschau, welche Steine umgedreht würden.
- **Umdrehen** als Kette: Die Steine kippen nacheinander, von innen nach außen.
- **Steinzähler** für beide Seiten, Hinweis bei Passen („Weiß muss passen“).

## Hot-Seat und Online

Keine Geheimnisse, also keine Übergabe nötig.

## Tests

- Umdrehen in allen acht Richtungen, auch mehrere Richtungen auf einmal.
- Kein Zug ohne Einschließen; Passen als einziger Zug; Spielende bei doppeltem Passen und bei vollem Brett.
- Freie Eröffnung; alle Brettgrößen.
- **Bot:** Der schwere Bot gewinnt gegen den gierigen Bot fast immer; im Endspiel stimmt seine exakte Rechnung mit einer vollständigen Suche überein.
