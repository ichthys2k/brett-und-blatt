# Vier in einer Reihe

| Steckbrief | |
|---|---|
| Spieler | 2 |
| Dauer | 2–5 Minuten |
| Modi | Solo gegen Bot, Hot-Seat, online |
| Muster | offen, Zug um Zug |
| Bausteine | Gitterbrett, Minimax mit Alpha-Beta |
| Aufwand | Regeln S, Oberfläche S, Bot S |
| Etappe | 1, **erster Durchstich** durch alle Schichten der Plattform |

Das bekannte Spiel mit den fallenden Steinen. „Vier gewinnt“ ist eine Marke, deshalb der freie Name.

## Warum als erstes Spiel

Die Regeln sind klein, also steckt die Arbeit in der Plattform selbst. An diesem Spiel entstehen und werden geprüft:

- die Schnittstelle
- die lokale Spielleitung
- das Gitterbrett
- Minimax als erster Suchbot
- Hot-Seat
- die Zugzeit
- PWA und Offline-Betrieb
- die automatischen Prüfungen bei GitHub

## Regeln (Standard)

- Brett mit 7 Spalten und 6 Reihen. Die Spieler werfen abwechselnd einen Stein in eine Spalte; er fällt auf den untersten freien Platz.
- Wer zuerst vier eigene Steine in einer Reihe hat (waagerecht, senkrecht oder diagonal), gewinnt. Ist das Brett voll, endet das Spiel unentschieden.
- Der Startspieler wechselt von Partie zu Partie.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Brettgröße | 6×5, 7×6, 8×7, 9×7 | 7×6 |
| PopOut | aus, an (statt zu werfen darf man einen eigenen Stein unten herausziehen) | aus |

## Spielmodell

```ts
type ConnectMove =
  | { type: 'drop'; column: number }
  | { type: 'pop'; column: number };   // nur mit PopOut
```

- **Zustand:** Raster (Spalten mit Höhen), aktiver Spieler, Zugliste.
- Für den Bot zusätzlich eine schnelle **Such-Darstellung**: ein Zahlenfeld, auf dem Züge gesetzt und wieder zurückgenommen werden, dazu vorberechnete Vierer-Fenster je Feld. Echte Bitboards gehen in JavaScript nur mit 32 Bit; für 9×7-Bretter reicht das nicht, und BigInt wäre langsamer.
- **PopOut-Sonderregeln** (so umgesetzt): Entsteht beim Herausziehen ein Vierer für beide, gewinnt, wer gezogen hat. Unentschieden bei dreifacher Stellungswiederholung, nach 200 Zügen oder wenn niemand mehr ziehen kann.
- **Ereignisse:** `stoneDropped` (Spalte, Zielreihe), `win` (die vier Felder) für die Animation.

## Bot

- **Minimax mit Alpha-Beta-Schnitt:** Der Bot rechnet Züge voraus und schneidet aussichtslose Zweige ab.
  - Iterative Vertiefung: erst 1 Zug tief, dann 2, 3 …, bis die Zeit um ist.
  - Mittlere Spalten werden zuerst untersucht.
  - Eine Merktabelle (Transpositionstabelle) speichert schon bewertete Stellungen.
- **Bewertung:** offene Dreier und Zweier, Steine in der Mitte, Drohungen auf ungeraden bzw. geraden Reihen (Zugzwang-Idee).

| Stufe | Verhalten |
|---|---|
| leicht | sieht 2 Züge voraus, macht manchmal Fehler |
| mittel | 6–8 Züge tief |
| schwer | so tief wie die Zeit erlaubt; nahezu fehlerfrei (das Standardbrett ist gelöst, der Anziehende gewinnt bei perfektem Spiel) |

## Zeitlimits

| Voreinstellung | Pro Zug |
|---|---|
| gemütlich | aus |
| normal | 10 s |
| schnell | 5 s |

**Bei Zeitablauf** zieht der Bot.

## Oberfläche

- **Brett** als SVG, passt sich der Breite an.
- **Bedienung:** Tippen irgendwo in eine Spalte wirft den Stein. Am Desktop zeigt ein Schatten-Stein über der Spalte, wo er landet.
- **Animation:** Fallen mit kleinem Aufprall; die Gewinnreihe leuchtet.
- **Farben** Rot und Gelb, zusätzlich mit Symbolen (Kreis und Stern) für Farbenblinde.

## Hot-Seat und Online

Keine Geheimnisse, also keine Übergabe nötig. Online prüft der Server nur die Züge.

## Tests

- Vierer in allen Richtungen, auch am Rand; volles Brett unentschieden.
- Volle Spalte nicht erlaubt; PopOut nur mit eigenem untersten Stein.
- **Bot:** gewinnt einen sofort möglichen Sieg immer (ab mittel), blockiert eine sofortige Niederlage immer (ab mittel).
- **Plattform-Tests:** Zufallspartien, Wiederholbarkeit, Zeitablauf-Partien.
