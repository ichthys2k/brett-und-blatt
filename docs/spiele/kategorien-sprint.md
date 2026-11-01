# Kategorien-Sprint (Stadt-Land-Fluss-artig)

*Schreibspiel für 1–30 Spieler: Zu einem Buchstaben in jeder Kategorie ein passendes Wort finden – schnell, aber richtig.*

> **Name:** „Stadt, Land, Fluss“ ist ein freies Volksspiel; der eigene Name **„Kategorien-Sprint“** passt besser zu den vielen Kategorienpaketen (Tiere, Bibel, Mathe). id `category-sprint`, W-036.

| Steckbrief | |
|---|---|
| Spieler | 1–30 (Klassen-Modus) |
| Modi | Allein gegen Bots, Hot-Seat mit Übergabe, online, Tafelansicht für Zuschauer |
| Muster | gleichzeitig (`privateViews`), verdeckte Bögen bis zur Auflösung |
| Bausteine | neu: `WordInput`, `words.ts` (Normalisierung, Tippfehler, Filter), `vote.ts` (Abstimmung), `loadCatalog` |
| Ordner | `packages/games/category-sprint`, Wortlisten in `content/wortspiele/kategorien.json` |

## Regeln

- Jede Runde bekommt einen Buchstaben (aus dem Seed, ohne Wiederholung; „leicht“ lässt Q, X, Y weg). Alle schreiben gleichzeitig in jede Kategorie ein Wort mit diesem Anfangsbuchstaben.
- **Stopp:** „Wer zuerst fertig ist“ (Standard) – wer alle Felder gefüllt hat, ruft „Stopp!“ und beendet die Runde für alle; oder „Bis alle abgegeben haben“.
- **Prüfen:** Eine Antwort, die in der Wortliste steht (auch mit einem Tippfehler ab 5 Buchstaben), gilt sofort. Für den Rest gibt es drei Regeln:
  - *Abstimmen* (Standard): Die anderen stimmen geheim ab, die eigene Stimme zählt nicht; Gleichstand gilt als angenommen. Allein (ohne Mitspieler) zählt nur die Liste.
  - *Nur Wortliste*: Was fehlt, gilt nicht.
  - *Vertrauen*: Alles mit dem richtigen Buchstaben gilt.
- **Punkte je Kategorie:** 20, wenn nur einer eine gültige Antwort hat; 10 für eine eigene Antwort; 5, wenn andere dasselbe Wort haben (gleich ist, was nach Normalisierung bzw. Listenwort übereinstimmt).
- Freitext ist auf 30 Zeichen begrenzt und läuft durch den Filter (`isBlockedText`); es gibt keinen freien Chat.

## Optionen

Kategorienpaket (Klassisch, Allgemein, Tiere, Bibel, Mathe Kl. 5/6), Anzahl Kategorien (3–6), Runden (3/5/8), Buchstaben (leicht/alle), Stopp, Prüfen.

## Spielmodell und Geheimnisse

Phasen `write` → `review` → (nächste Runde) → `done`. Züge `answer`, `finish`, `review` (Stimmzettel). Während des Schreibens sieht jeder nur den eigenen Bogen und von den anderen nur die Zahl gefüllter Felder; künftige Buchstaben sind verborgen (`sampleHidden` füllt sie auf). Fremde Stimmen erscheinen erst, wenn alle abgestimmt haben.

## Bot „Wortflitzer“

Nimmt Wörter aus der Liste (leicht: wenige, mittel: die meisten, schwer: fast alle und seltene), mit Tipp-Pausen (`delayMs`); stimmt Zweifelsfällen zu, wenn sie mindestens drei Buchstaben haben und mit dem richtigen Buchstaben beginnen.

## Oberfläche

Großer Buchstabe, Schreibbogen mit `WordInput` (prüft den Anfangsbuchstaben schon beim Tippen, speichert beim Verlassen des Feldes), Fortschritt der anderen, Auflösung je Kategorie mit 👍/👎 und Rundentabelle. Zuschauer sehen eine Tafelansicht (Beamer). Klassenpräfix `ks-`.

## Umsetzung (1.11.2026)

Regeln, Bot, Oberfläche, Tests (`test/category-sprint.test.ts`, Vertragsprüfungen), Prüfstand. Die Wortlisten (4 Pakete, 27 Kategorien, rund 1700 Wörter) sind ein **Entwurf** (`"status": "entwurf"`) und warten auf Cornelius' Durchsicht. Sie kommen vom Spieleserver (`GET /wortspiele/kategorien`), Rückfall ist die mitgelieferte Datei `wortspiele/kategorien.json`.

## Offene Punkte

- Wortlisten durchsehen und erweitern (Cornelius).
- Klänge sind aus dem vorhandenen Katalog gewählt; eigene Klänge nur nach Auswahl.
