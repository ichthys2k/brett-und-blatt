# Wort-Raten / Galgenmännchen

| Steckbrief | |
|---|---|
| Spieler | 1–30 |
| Dauer | 3–10 Minuten |
| Modi | Solo, Hot-Seat, online (auch als Klassenrunde) |
| Muster | verdeckt (`hidden`), gleichzeitig (`simultaneous`) oder reihum |
| Ordner | `packages/games/hangman` |

## Regeln

- Gesucht wird in jeder Runde ein geheimes Wort aus dem gewählten Themenpaket. Zusammengesetzte Begriffe zeigen Bindestriche oder Leerzeichen von Anfang an; `ß` wird als `SS` geschrieben, Umlaute (`Ä`, `Ö`, `Ü`) haben eigene Tasten.
- **Zwei Spielmodi (`mode`):**
  - **Reihum / Gemeinsam (`coop`):** Alle raten gemeinsam bzw. abwechselnd am selben Wortbrett. Jeder Treffer bringt **2 Punkte pro aufgedecktem Buchstaben** (plus **5 Punkte** für den letzten Buchstaben des Wortes).
  - **Wettrennen (`race`):** Alle raten gleichzeitig auf ihrem eigenen Wortbrett durch dieselbe Wortfolge. Wer ein Wort löst, erhält **10 Punkte + 2 Punkte je übrigem Fehlversuch** (plus 1 Punkt je gefundenem Buchstaben).
- **Drei Darstellungen (`theme`):**
  - **Klassischer Galgen (`gallows`):** Strichzeichnung wie an der Schultafel.
  - **Schmelzender Schneemann (`snowman`):** Kinderfreundliche Winter-Variante – bei jedem Fehlversuch schmilzt ein Teil des Schneemanns weg.
  - **Blumenblätter (`flower`):** Freundliche Sommer-Variante – bei jedem Fehlversuch verliert die Blume ein Blütenblatt.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Themenpaket (`category`) | Bunter Mix (`alltag`), Tiere & Natur (`tiere`), Knifflige Wörter (`knifflig`), Mathe & Geometrie Kl. 5/6 (`mathe`) | `alltag` |
| Spielweise (`mode`) | Reihum am selben Wort (`coop`), Wettrennen – jeder für sich (`race`) | `coop` |
| Motiv (`theme`) | Schneemann ⛄ (`snowman`), Blume 🌼 (`flower`), Klassischer Galgen (`gallows`) | `snowman` |
| Fehlversuche (`maxMistakes`) | Leicht – 10 Versuche (`10`), Normal – 8 Versuche (`8`), Schwer – 6 Versuche (`6`) | `8` |
| Wörter (`rounds`) | 3 Wörter (`3`), 5 Wörter (`5`), 6 Wörter (`6`) | `3` |

## Bot („Buchstabenfuchs“)

- Arbeitet ehrlich ausschließlich auf der öffentlichen Sicht (`maskedWord` und `guessedLetters`):
  - **schwer:** Filtert alle noch zum Muster passenden Wörter der Wortliste und wählt den Buchstaben mit der höchsten Trefferwahrscheinlichkeit.
  - **mittel:** Mischt Muster-Abgleich mit der allgemeinen deutschen Buchstabenhäufigkeit (`E, N, I, S, R, A, T ...`).
  - **leicht:** Rät nach allgemeiner Häufigkeit mit gelegentlichen Streuungen.
