# Mühle

| Steckbrief | |
|---|---|
| Spieler | 2 |
| Dauer | 5–15 Minuten |
| Modi | Solo gegen Bot, Hot-Seat, online |
| Muster | offen, Zug um Zug |
| Bausteine | **Netzbrett** (neu), Minimax mit Alpha-Beta |
| Aufwand | Regeln S, Oberfläche M, Bot M |
| Etappe | 2, baut das Netzbrett für spätere Spiele wie Mensch ärgere dich nicht oder Sternhalma |

## Regeln (Standard)

- **Brett:** 24 Punkte auf drei ineinanderliegenden Quadraten, an den Seitenmitten verbunden. Jeder Spieler hat 9 Steine; Weiß beginnt.
- **Phasen:**
  1. **Setzen:** Abwechselnd setzt jeder seine 9 Steine auf freie Punkte.
  2. **Ziehen:** Ein Stein zieht entlang einer Linie auf einen freien Nachbarpunkt.
  3. **Springen:** Wer nur noch 3 Steine hat, darf auf jeden freien Punkt springen.
- **Mühle:** Wer drei eigene Steine in einer Linie bildet, nimmt dem Gegner einen Stein. Steine in einer Mühle sind geschützt, außer alle gegnerischen Steine stehen in Mühlen.
- **Verloren** hat, wer weniger als 3 Steine hat oder nicht mehr ziehen kann.
- **Unentschieden:** dreifache Stellungswiederholung oder 50 Züge (je Spieler) ohne Mühle.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Springen | an, aus | an |
| Schlagen aus Mühlen | nur wenn nichts anderes geht, immer erlaubt | nur wenn nichts anderes geht |
| Doppelmühle | ein Stein, zwei Steine nehmen | ein Stein |
| Remis-Regel | 50 Züge, 30 Züge, aus | 50 Züge |

## Spielmodell

**Netzbrett:** Die 24 Punkte sind Knoten, die Linien Kanten, dazu eine Liste der 16 möglichen Mühlen. Die Lage der Punkte auf dem Bildschirm steht in den Brettdaten, nicht in den Regeln. So lassen sich später andere Netzbretter mit derselben Darstellung bauen.

```ts
type MillMove =
  | { type: 'place'; to: Point; remove?: Point }
  | { type: 'move'; from: Point; to: Point; remove?: Point };   // auch Springen
```

- **Ein Zug enthält das Schlagen gleich mit** (`remove`). `legalMoves` liefert alle Kombinationen. Das macht die Bot-Suche einfacher. Die Oberfläche sammelt das Schlagen als zweiten Schritt ein, sobald eine Mühle entsteht.
- **Zustand:** Belegung, Steine im Vorrat je Spieler, aktiver Spieler, Zähler ohne Mühle, Stellungsverlauf (für die Wiederholungs-Prüfung).

## Bot

**Minimax mit Alpha-Beta-Schnitt** und iterativer Vertiefung. Die Bewertung zählt:

- Steine auf dem Brett und im Vorrat
- geschlossene Mühlen
- offene Zweier
- Zwickmühlen (eine Mühle, die sich bei jedem Zug öffnet und schließt)
- Beweglichkeit und blockierte Steine
- in der Springphase eigene Gewichte

| Stufe | Tiefe |
|---|---|
| leicht | 2 Halbzüge, manchmal zufällig |
| mittel | 4–6 Halbzüge |
| schwer | so tief wie die Zeit erlaubt |

Mühle ist gelöst (bei perfektem Spiel unentschieden). Eine Endspiel-Datenbank brauchen wir nicht.

## Zeitlimits

| Voreinstellung | Modell |
|---|---|
| gemütlich | aus |
| normal | 20 s pro Zug |
| schnell | Schachuhr 3 Minuten + 2 s pro Zug |

**Bei Zeitablauf:** Bei Zugzeit zieht der Bot. Bei der Schachuhr ist die Partie verloren; wahlweise zieht der Bot.

## Oberfläche

- **Brett** als SVG; die Punkte sind große Tippflächen, auch wenn sie klein gezeichnet sind.
- **Setzen:** freien Punkt antippen.
- **Ziehen:** Stein antippen; erlaubte Ziele leuchten.
- **Schlagen:** Bildet sich eine Mühle, blitzt sie kurz auf. Die schlagbaren gegnerischen Steine pulsieren, ein Antippen nimmt einen davon.
- **Anzeige:** Vorrat je Spieler (Steinreihen am Rand), Phase („Setzen“, „Ziehen“, „Springen“).

## Hot-Seat und Online

Keine Geheimnisse, also keine Übergabe nötig.

## Tests

- Alle 16 Mühlen werden erkannt.
- Schlagen: geschützte Steine; Ausnahme, wenn alle in Mühlen stehen; alle Optionen.
- Phasenwechsel; Springen erst mit genau 3 Steinen.
- Niederlage durch zu wenige Steine und durch Blockade; Remis durch Wiederholung und Zugzähler.
- Erster Zug hat genau 24 Möglichkeiten.
- **Bot:** Ab mittel schließt er eine sofort mögliche Mühle bzw. verhindert die des Gegners.
