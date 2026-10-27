# Rechenmauer (Zahlenmauer)

| Steckbrief | |
|---|---|
| Spieler | 1–30 |
| Dauer | 5–15 Minuten |
| Modi | Solo, Hot-Seat, online (auch als Klassen-Simultanspiel) |
| Muster | gleichzeitig (`simultaneous`), mehrrundig |
| Ordner | `packages/games/number-wall` |

## Regeln

- Eine Pyramide aus **3 Stufen (6 Steine)** oder **4 Stufen (10 Steine)**.
- Jeder Stein oberhalb der Basisreihe ist die **Summe** (bzw. im Modus *Einmaleins-Mauer* das **Produkt**) der beiden Steine direkt darunter.
- In jeder Mauer sind genau so viele Steine nach einem schrittweise lösbaren Dreiecksmuster vorgegeben, dass sich alle übrigen Steine eindeutig durch **Vorwärtsrechnen** und **Rückwärtsrechnen (Umkehraufgabe)** bestimmen lassen.
- **Punktevergabe:**
  - **2 Punkte** je richtig berechnetem leeren Stein.
  - **+4 Bonuspunkte** für eine komplett fehlerfreie Mauer.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Zahlenbereich (`numbers`) | Natürliche Zahlen (`natural`), Ganze Zahlen mit Minus (`integers`), Dezimalzahlen (`decimals`), Einmaleins-Mauer (`products`) | Natürliche Zahlen |
| Mauerhöhe (`height`) | 3 Stufen (6 Steine), 4 Stufen (10 Steine) | 4 Stufen |
| Runden (`rounds`) | 3, 5, 8 Mauern | 5 Mauern |

## Bot („Mauerbaumeister“)

- Löst die Mauer über den deterministischen Dreieckslöser `solveWallFromGivens` (schwer = immer fehlerfrei, mittel/leicht = gelegentlich 1–2 Rechenfehler).
