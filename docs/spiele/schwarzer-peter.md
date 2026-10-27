# Schwarzer Peter

| Steckbrief | |
|---|---|
| Spieler | 2–6 |
| Dauer | 3–8 Minuten |
| Modi | Solo gegen Bots, Hot-Seat, gemischt; online ab Etappe 3 |
| Muster | verdeckt (Hände), Zug um Zug |
| Bausteine | Karten-Baukasten (Fächer, verdeckter Fächer), Übergabe-Bildschirm, Inhaltspakete (Paare) |
| Aufwand | Regeln S, Oberfläche M, Bot S |
| Etappe | 2, erstes Kartenspiel |

## Regeln

- **Karten:** Paare (z. B. Tiere) und eine einzelne Karte, der Schwarze Peter (🐈‍⬛).
- **Austeilen:** Alle Karten werden reihum verteilt. Jeder legt seine Paare sofort offen ab.
- **Ziehen:** Reihum zieht man eine verdeckte Karte aus der Hand des nächsten Spielers, der noch Karten hat. Ergibt sie ein Paar, wird es offen abgelegt.
- **Ausscheiden:** Wer keine Karten mehr hat, ist fertig.
- **Ende:** Wer zum Schluss den Schwarzen Peter behält, verliert; alle anderen gewinnen.
- **Mischen:** Wer an der Reihe ist, darf vor dem Ziehen seine eigene Hand mischen. So weiß niemand, wo der Peter steckt.

## Optionen

| Option | Werte | Standard |
|---|---|---|
| Kartenset | Tiere, Kleines Einmaleins, Großes Einmaleins, Potenzen & Rechengesetze, Größen & Einheiten, Teiler, ggT & kgV, Brüche, Komma & Prozent, Negative Zahlen, Englisch | Tiere |
| Anzahl Paare | 8, 12, 16 | 12 |

## Spielmodell

```ts
type BlackPeterMove = { type: 'draw'; index: number } | { type: 'shuffle' };
```

- **Geheim:** Jeder sieht nur seine eigene Hand. Öffentlich sind die Kartenzahlen und die abgelegten Paare. Das Mischen nutzt den Zufallsstrom im Spielstand.
- **Paarregel:** Zusammengehörige Karten haben dieselbe Paar-Kennung. Das funktioniert für gleiche Bilder ebenso wie für Lernpaare.

## Bot

- Zieht zufällig.
- Mischt die eigene Hand gelegentlich (häufiger, wenn er den Peter hat).

## Oberfläche

- Eigene Hand als Fächer unten.
- Die Hand des Nachbarn verdeckt oben; antippen zieht die Karte.
- Abgelegte Paare in der Mitte.
- Beim Hot-Seat kommt vor jedem Zug der Übergabe-Bildschirm.

## Tests

- Austeilen: jede Karte genau einmal, Paare sofort abgelegt.
- Ziehen nur vom richtigen Nachbarn, auch wenn Spieler ausgeschieden sind.
- Spielende: Der Peter bleibt beim Verlierer.
- `playerView` zeigt keine fremden Handkarten.
