# Schiffe versenken

| Steckbrief | |
|---|---|
| Spieler | 2 |
| Dauer | 10–20 Minuten |
| Modi | Solo gegen Bot, Hot-Seat, online |
| Muster | verdeckt (Flotten), dazu eine **gleichzeitige** Aufstellphase |
| Bausteine | Gitterbrett, Phasen-Timer |
| Aufwand | Regeln M, Oberfläche M, Bot M |
| Etappe | 3, braucht online den Server, weil die Flotten geheim sind |

## Regeln (Standard: deutsche Papierversion)

- **Meer:** 10×10 Felder, Spalten A–J, Reihen 1–10. Jeder hat ein eigenes Meer und schießt auf das gegnerische.
- **Flotte:** 10 Schiffe:

| Anzahl | Schiff | Größe |
|---|---|---|
| 1 | Schlachtschiff | 5 Felder |
| 2 | Kreuzer | 4 Felder |
| 3 | Zerstörer | 3 Felder |
| 4 | U-Boot | 2 Felder |

- Schiffe liegen gerade (waagerecht oder senkrecht) und **dürfen sich nicht berühren**, auch nicht über Eck.
- **Ablauf:**
  1. **Aufstellen:** Beide stellen gleichzeitig auf.
  2. **Schießen:** abwechselnd, mit der Antwort „Wasser“, „Treffer“ oder „versenkt“.
- **Nach einem Treffer** darf man noch einmal schießen.
- Gewonnen hat, wer zuerst alle gegnerischen Schiffe versenkt.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Flotte | deutsche Papierversion (10 Schiffe, kein Berühren), kleine Flotte (5, 4, 3, 3, 2 Felder, Berühren erlaubt) | Papierversion |
| Nach Treffer weiter | an, aus | an |
| Salvenmodus | aus, an (so viele Schüsse pro Runde wie eigene Schiffe übrig) | aus |
| Komfort | Wasser um versenkte Schiffe automatisch markieren (folgt aus dem Berührverbot) | an |

## Umsetzung (Oktober 2026)

Umgesetzt in `packages/games/battleship`, lokal und online. Abweichungen und Präzisierungen gegenüber dem Plan:

- **Aufstellen als ein Zug, geprüft mit `isLegal`:** Aufstellungen lassen sich nicht aufzählen. Dafür gibt es in der Engine die optionale Funktion `isLegal(state, actor, move)`; `legalMoves` liefert in der Aufstellphase nur eine Beispiel-Aufstellung (für Zufallstests und die allgemeine Spielleitung). `isLegalMove`, die Spielleitung und `OnlineSession` nutzen `isLegal`, wenn ein Spiel es hat.
- **Aufstellzeit:** `perMove` hat jetzt `firstMoveMs` – eine eigene Zeit für den ersten Zug jedes Platzes (normal 90 s, schnell 45 s; danach 10 s bzw. 5 s pro Schuss). Bei Zeitablauf stellt der Bot zufällig auf; einzelne von Hand gesetzte Schiffe gehen dabei verloren, weil der Server Zwischenstände nicht kennt.
- **Gleichzeitig online:** Ein Zug mit älterer Versionsnummer gilt jetzt, wenn der Platz seitdem nicht selbst gezogen hat (`Room.stillValid`). Sonst würde beim gleichzeitigen Aufstellen der Zweite als „veraltet“ abgewiesen.
- **Salvenmodus ohne `shootSalvo`:** Jeder Schuss der Salve ist ein eigener Zug `shoot` und wird nur anvisiert (`aim`); aufgelöst wird, wenn alle Schüsse der Salve gesetzt sind. Danach ist immer der andere dran.
- **Aufstellen per Antippen** statt Ziehen: Schiff in der Leiste wählen, Feld antippen (Vorschau beim Überfahren mit der Maus), gesetztes Schiff antippen hebt es auf, ein zweites Antippen dreht es. Dazu „waagerecht/senkrecht“, „Zufällig“ und „Fertig“; Schiffe, die sich berühren, werden rot.
- **Hot-Seat:** Übergabe-Bildschirm vor jedem Zug (wie bei anderen Spielen mit eigener Sicht). Danach sind Zielmeer groß und eigene Flotte klein zu sehen.
- **Bot:** Die Wahrscheinlichkeitskarte zählt die möglichen Lagen der übrigen Schiffe direkt (mit Berührverbot und offenen Treffern), statt über `sampleHidden` zu ziehen. `sampleHidden` gibt es trotzdem für die allgemeinen Werkzeuge. Schüsse bis zum Sieg über 100 zufällige Flotten (Papierversion, ohne Weiterschießen gezählt): leicht ≈ 68, mittel ≈ 52, schwer ≈ 47.

## Spielmodell

```ts
type BattleshipMove =
  | { type: 'placeFleet'; ships: ShipPlacement[] }   // Aufstellphase, gleichzeitig
  | { type: 'shoot'; cell: number }
  | { type: 'shootSalvo'; cells: number[] };          // nur im Salvenmodus
```

- **Aufstellphase:** `currentPlayers` liefert beide Spieler. Jeder schickt seine komplette Flotte in einem Zug; geprüft werden Grenzen, Anzahl und Berührverbot. Erst wenn beide fertig sind, beginnt das Schießen. Ein „Zufällig aufstellen“-Knopf erzeugt in der Oberfläche eine gültige Aufstellung.
- **Zustand:** Flotten (geheim), Schüsse beider Seiten mit Ergebnis, versenkte Schiffe, aktiver Spieler.
- **Geheim (`playerView`):** Das eigene Meer siehst du vollständig, mit Schiffen und gegnerischen Schüssen. Vom gegnerischen Meer siehst du nur deine Schussergebnisse und die Umrisse versenkter Schiffe; nicht versenkte Schiffe erscheinen nie.

## Bot

- **Aufstellen:** zufällig und gültig. Der schwere Bot vermeidet typische Muster wie „alles am Rand“ und streut die Schiffe gleichmäßig.
- **Schießen:**

| Stufe | Verfahren |
|---|---|
| leicht | zufällige freie Felder, nach einem Treffer manchmal die Nachbarn |
| mittel | **Jagen und Zielen:** Schachbrettmuster (jedes zweite Feld, denn das kleinste Schiff ist 2 lang), nach einem Treffer die Nachbarn absuchen und der Linie folgen |
| schwer | **Wahrscheinlichkeitskarte:** Für jedes Feld wird gezählt, wie viele gültige Lagen der restlichen Schiffe es abdecken (passend zu allen Treffern, Fehlschüssen und dem Berührverbot). Geschossen wird auf das wahrscheinlichste Feld. |

- `sampleHidden`: erzeugt eine gegnerische Flotte, die zu allem Bekannten passt. Die Wahrscheinlichkeitskarte nutzt dieselbe Funktion.

## Zeitlimits

| Voreinstellung | Aufstellen (Phasen-Timer) | Pro Schuss |
|---|---|---|
| gemütlich | aus | aus |
| normal | 90 s | 10 s |
| schnell | 45 s | 5 s |

**Bei Zeitablauf:** Beim Aufstellen werden die übrigen Schiffe zufällig gültig ergänzt; beim Schießen schießt der Bot.

## Oberfläche

- **Hochformat:** Das gegnerische Meer ist groß (dorthin schießt man). Das eigene Meer erscheint als kleine Karte darunter und vergrößert sich per Antippen.
- **Desktop:** beide Meere nebeneinander.
- **Aufstellen:**
  - Schiffe aus einer Leiste ins Meer ziehen.
  - Tippen dreht ein Schiff.
  - Ungültige Lagen leuchten rot.
  - Dazu die Knöpfe „Zufällig“ und „Fertig“.
- **Schießen:** Feld antippen, dann Wasserspritzer bzw. Explosion. „Versenkt“ zeigt den Schiffsumriss, und die Flottenleiste streicht das Schiff.
- **Barrierearm:** Koordinaten (A1–J10) an den Rändern und als Text vorgelesen.

## Hot-Seat und Online

- **Hot-Seat:**
  - Aufstellen nacheinander mit Übergabe-Bildschirm.
  - Beim Schießen zeigt der Bildschirm **nur das Zielmeer**, denn das eigene Meer mit den Schiffen würde der Mitspieler sehen.
  - Die eigene Flotte lässt sich nur hinter dem Übergabe-Bildschirm ansehen.
- **Online:** Der Server hält beide Flotten und beantwortet die Schüsse.

## Tests

- Aufstellung: Grenzen, Anzahl je Größe, Berührverbot (auch über Eck), kleine Flotte mit Berühren.
- Wasser, Treffer, versenkt; Weiterschießen nach Treffer an und aus; Salvenmodus.
- Komfort-Markierung nur bei aktivem Berührverbot.
- Sieg beim letzten Schiff.
- `playerView` enthält nie gegnerische Schiffe, die noch nicht versenkt sind.
- **Bot:** Der schwere Bot braucht im Schnitt deutlich weniger Schüsse als der mittlere (statistischer Test).
