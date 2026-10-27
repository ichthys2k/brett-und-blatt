# Teiler-Duell (Steuereintreiber & Teiler-Kette)

| Steckbrief | |
|---|---|
| Spieler | 1–2 |
| Dauer | 5–15 Minuten |
| Modi | Solo, Hot-Seat, online |
| Muster | Zug um Zug (`turnBased`), vollständige Information |
| Ordner | `packages/games/factor-grid` |

## Regeln

Auf dem Zahlenbrett liegen die Zahlen `1` bis `20`, `30` oder `50`.

### 1. Variante „Steuereintreiber“ (`taxman`)
- Wer am Zug ist, wählt eine noch freie Zahl $n$, die **mindestens einen noch freien echten Teiler** ($d < n$ mit $d \mid n$) auf dem Brett besitzt.
- Der Wählende erhält $n$ Punkte; alle noch freien echten Teiler von $n$ gehen automatisch an das Gegenüber (im Solo-Modus an den „Steuereintreiber“).
- **Spielende:** Sobald keine freie Zahl mehr einen freien echten Teiler besitzt, endet die Partie. Im Solo-Modus kassiert der Steuereintreiber zudem alle übrig gebliebenen Zahlen. Wer mehr Punkte hat, gewinnt.

### 2. Variante „Teiler & Vielfache“ (`chain`, Juniper Green)
- Der erste Zug muss eine **gerade Zahl** sein.
- Danach wählen beide Seiten abwechselnd eine noch freie Zahl, die ein **Teiler oder ein Vielfaches** der unmittelbar zuvor gewählten Zahl ist.
- Wer keinen gültigen Zug mehr hat, verliert (bzw. im Solo-Modus gilt als Ziel, mindestens die Hälfte aller Zahlen des Bretts in einer Kette zu verbinden).

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Variante (`variant`) | Steuereintreiber (`taxman`), Teiler & Vielfache (`chain`) | Steuereintreiber |
| Zahlenraum (`gridSize`) | 1 bis 20, 1 bis 30, 1 bis 50 | 1 bis 30 |

## Bot („Zahlengenie“)

- **leicht:** zufälliger erlaubter Zug.
- **mittel:** maximiert den direkten Netto-Ertrag ($n - \sum \text{Teiler}$) bzw. minimiert im Kettenmodus die Antwortmöglichkeiten des Gegners.
- **schwer:** berücksichtigt zusätzlich die stärkste Antwort des Gegners im Folgezug (2-Halbzug-Vorausschau) und erkennt sofortige Gewinnzüge im Kettenmodus.
