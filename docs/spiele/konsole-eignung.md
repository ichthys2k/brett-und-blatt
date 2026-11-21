# Controller-Eignung der Spiele (Vorhaben #607, K0)

Maschinelle Vorsortierung, wie gut sich jedes fertige Spiel allein mit dem Controller spielen lässt. Daten: `apps/web/src/lib/controllerGrades.json` (liest `controllerGrade(gameId)` in `apps/web/src/lib/controllerGrade.ts`; das Abzeichen in der Bibliothek der Konsole kommt daher). Plan: [`konsole.md`](konsole.md).

| Stufe | Bedeutung |
|---|---|
| `direct` | Steuerkreuz und A genügen im Bedienmodus „Standard“ |
| `carousel` | nur über den Bedienmodus „Erlaubte Züge“ (Karussell) |
| `cursor` | weder noch; nur mit dem Zeiger (L3/Select) oder gar nicht |

## Verfahren

`scripts/controller-audit.mjs` startet jedes Spiel mit `#/neu/<id>?autostart=1` bei 1280 × 800 mit einem nachgebauten Controller (`scripts/lib/virtual-pad.mjs`). Zufall der Seite und Startwert der Partie sind fest (aus der Spiel-id), und vor jedem Tastendruck wartet das Werkzeug, bis ein Mensch am Gerät dran ist. Erfolg heißt immer: drei angenommene Züge eines Menschen (`data-human-moves` am Spielfeld, über Neustarts hinweg gezählt).

1. **Zufallslauf:** höchstens 250 Drücke, 60 % eine Richtung und 40 % A (nie B, Start, X, Y); liegt der Fokus nicht im Spielfeld, bis zu viermal RB.
2. **Gezielter Lauf** (seit K8, nur wenn 1 scheitert): Jedes Ziel im Spielfeld wird allein mit Steuerkreuz und LB/RB angesteuert (Bestensuche über die Wege der räumlichen Navigation, Rückfall Breitensuche) und mit A ausgelöst. Ändern sich danach die Ziele (eine Auswahl wurde begonnen), geht es bis zu drei Stufen tiefer; Textfelder füllt er über die Bildschirmtastatur. Höchstens 150 s je Spiel.
3. **Karussell** (nur wenn 1 und 2 scheitern): Bedienmodus „Erlaubte Züge“, höchstens 60 Runden aus null bis drei Mal Rechts und A.

„Fokus verloren“ zählt Drücke, vor denen der Fokus auch nach viermal RB nicht im Spielfeld lag; „Verlassen“, wie oft eine Taste den Spieltisch verlassen hat; „Nicht angesteuert“, wie viele Ziele der gezielte Lauf nicht erreicht hat (ein Hinweis, kein Beweis: Stichproben von Hand fanden dort bisher immer einen Weg); „Texteingabe“, ob im Spielfeld ein Textfeld vorkam.

```sh
corepack pnpm build
node scripts/controller-audit.mjs --json apps/web/src/lib/controllerGrades.json [ids …]
```

Die Stufe ist eine maschinelle Vorsortierung. Ob wirklich jede Zugart erreichbar ist, prüft K8 von Hand.

**Verlauf:** Erste Messung vor K7: direct 38, carousel 12, cursor 8. Nach K7 und dem ersten Durchgang von K8: direct 42, carousel 9, cursor 7. Nach dem zweiten Durchgang von K8 (Fenster, Bereiche, Fokus-Rettung) und mit dem gezielten Lauf: siehe unten.

## Von Hand geprüft (21.11.2026, nur Steuerkreuz und A)

- **Schach:** e2–e4 und Sg1–f3 angenommen. **Vierer-Schach:** e2–e4 und Sj1–i3 angenommen. Beide stehen bei `carousel`, weil der Lauf zwischen Figuren ohne Zug viele Drücke verbraucht; spielbar sind sie direkt.
- **Farbe & Form:** Stein wählen → Feld → „Legen“ angenommen; der Fokus bleibt danach im Spielfeld.
- **Skat:** „Passe“ und „18 sagen“ erreichbar, Passen angenommen.
- **Nicht ärgern!, Rübenacker, Sternhalma, Grafschaft:** Würfeln, Ziehen, Hüpfen und Anlegen angenommen.
- **Eins!:** Wunschfarbe im Fenster mit Steuerkreuz gewählt; B bricht ab.
- **Go:** SGF-Fenster der Vorbereitung bedienbar (Textfeld, Bildschirmtastatur, B schließt).
- **Online aus der Konsole:** Raum anlegen bis zum Zug am Spieltisch.
- **Sonderzüge (Stellung über `?pgn=` vorgegeben, sonst fester Zufall):** Schach Rochade (Ke1–g1), en passant (e5×d6) und Umwandlung (e7–d8, Fenster „Umwandlung wählen“ mit Fokus, Figur gewählt). Skat: 18 sagen, Skat aufnehmen, zwei Karten wählen, drücken, Karo ansagen. Würfelblock: würfeln, zwei Würfel festhalten, nochmal würfeln, Sechser eintragen. Schiffe versenken: drehen, Schiff setzen, zufällig aufstellen, Flotte bestätigen, zweimal schießen. Alles angenommen.

## Grenzen

- **Mehrschrittige Züge:** Wo ein Zug aus mehreren Schritten besteht, schafft auch der gezielte Lauf nicht immer drei Züge in der Zeit; die Einstufung ist dann zu streng (siehe Handprüfung).
- **Texteingabe:** Kategorien-Sprint, Schätzmeister, Beschreib-Duell und Rechenmauer brauchen Eingaben oder genaue Werte; bedienbar über die Bildschirmtastatur bzw. Knöpfe, aber die Messung findet keine gültigen Antworten.
- **Echtzeit:** Enten-Rallye, Fix gefunden!, Ligretto und Speed laufen gegen die Uhr; dort genügt, dass jede Aktion erreichbar ist.

## Ergebnis (21.11.2026, nach K8)

58 Spiele: **direct 49**, **carousel 6**, **cursor 3**.

| Spiel-id | Name | Stufe | Drücke | Fokus verloren | Verlassen | Nicht angesteuert | Texteingabe | Anmerkung |
|---|---|---|---|---|---|---|---|---|
| `battleship` | Schiffe versenken | carousel | 6 | 0 | 0 | 0 | – |  |
| `bible-quiz` | Bibel-Quiz | direct | 11 | 0 | 0 | 0 | – |  |
| `bingo` | Bingo | direct | 47 | 0 | 0 | 0 | – |  |
| `binokel` | Binokel | direct | 35 | 2 | 1 | 0 | – |  |
| `black-peter` | Schwarzer Peter | direct | 9 | 0 | 0 | 0 | – |  |
| `category-sprint` | Kategorien-Sprint | cursor | – | 246 | 0 | 0 | ja |  |
| `checkers` | Dame | direct | 40 | 0 | 0 | 0 | – |  |
| `chess` | Schach | carousel | 6 | 0 | 0 | 7 | – |  |
| `chinese-checkers` | Sternhalma | direct | 63 | 0 | 0 | 0 | – |  |
| `color-and-shape` | Farbe & Form | carousel | 11 | 0 | 0 | 7 | – |  |
| `color-sorter` | Narrenhof | direct | 61 | 0 | 0 | 0 | – |  |
| `describe-duel` | Verboten! | carousel | 13 | 249 | 0 | 4 | ja |  |
| `dominoes` | Domino | direct | 10 | 0 | 0 | 0 | – |  |
| `doppelkopf` | Doppelkopf | direct | 67 | 0 | 0 | 0 | – |  |
| `drachenspiel` | Drachenspiel | direct | 12 | 0 | 0 | 0 | – |  |
| `dragon-towers` | Drachentürme | carousel | 8 | 0 | 1 | 6 | – |  |
| `duck-rally` | Enten-Rallye | direct | 288 | 0 | 0 | 0 | – |  |
| `elevens` | Elf zuerst! | direct | 58 | 0 | 0 | 0 | – |  |
| `estimate` | Schätzmeister | cursor | – | 192 | 0 | 0 | ja |  |
| `factor-grid` | Teiler-Duell | direct | 9 | 0 | 0 | 0 | – |  |
| `four-in-a-row` | Vier in einer Reihe | direct | 16 | 0 | 0 | 0 | – |  |
| `four-player-chess` | Vierer-Schach | carousel | 9 | 0 | 0 | 8 | – |  |
| `go` | Go | direct | 18 | 0 | 0 | 0 | – |  |
| `gomoku` | Gomoku | direct | 6 | 0 | 0 | 0 | – |  |
| `grafschaft` | Grafschaft | direct | 41 | 0 | 0 | 0 | – |  |
| `hangman` | Galgenmännchen | direct | 9 | 0 | 0 | 0 | – |  |
| `kniffel` | Würfelblock | direct | 7 | 0 | 0 | 0 | – |  |
| `ligretto` | Kartenblitz | direct | 137 | 14 | 5 | 0 | – |  |
| `low-flight` | Tiefflug | direct | 6 | 0 | 0 | 0 | – |  |
| `ludo` | Nicht ärgern! | direct | 10 | 0 | 0 | 0 | – |  |
| `maexle` | Mäxle | direct | 5 | 0 | 0 | 0 | – |  |
| `majority` | Mehrheitsfrage | direct | 181 | 1 | 0 | 0 | – |  |
| `market-stalls` | Marktstände | direct | 30 | 0 | 0 | 0 | – |  |
| `marketplace` | Marktplatz | direct | 506 | 0 | 0 | 0 | – |  |
| `mau-mau` | Mau-Mau | direct | 17 | 0 | 0 | 0 | – |  |
| `mill` | Mühle | direct | 9 | 0 | 0 | 0 | – |  |
| `mole-tunnels` | Maulwurfsgänge | direct | 23 | 0 | 0 | 0 | – |  |
| `number-wall` | Rechenmauer | cursor | – | 0 | 0 | 1 | – |  |
| `pairs` | Paare finden | direct | 6 | 0 | 0 | 0 | – |  |
| `poker` | Poker | direct | 72 | 0 | 0 | 0 | – |  |
| `president` | Präsident | direct | 113 | 0 | 0 | 0 | – |  |
| `quartett` | Quartett | direct | 87 | 0 | 0 | 0 | – |  |
| `reversi` | Reversi | direct | 5 | 0 | 0 | 0 | – |  |
| `schafkopf` | Schafkopf | direct | 53 | 0 | 0 | 0 | – |  |
| `scrabble` | Wortgitter | direct | 42 | 0 | 0 | 0 | – |  |
| `skat` | Skat | direct | 91 | 0 | 0 | 0 | – |  |
| `solitaire` | Solitaire | direct | 243 | 0 | 0 | 0 | – |  |
| `speed` | Speed | direct | 44 | 4 | 3 | 0 | – |  |
| `symbol-match` | Fix gefunden! | direct | 8 | 0 | 0 | 0 | – |  |
| `target-number` | Zielzahl | direct | 29 | 0 | 0 | 0 | – |  |
| `tic-tac-toe` | Tic-Tac-Toe | direct | 10 | 0 | 0 | 0 | – |  |
| `timeline` | Zeitstrahl | direct | 159 | 0 | 0 | 0 | – |  |
| `turnip-patch` | Rübenacker | direct | 5 | 0 | 0 | 0 | – |  |
| `ultimate-tic-tac-toe` | Ultimate Tic-Tac-Toe | direct | 10 | 0 | 0 | 0 | – |  |
| `uno` | Eins! | direct | 10 | 0 | 0 | 0 | – |  |
| `who-am-i` | Wer bin ich? | direct | 40 | 0 | 0 | 0 | – |  |
| `wolves-sheep` | Wölfe im Schafspelz | direct | 22 | 0 | 0 | 0 | – |  |
| `word-salad` | Wort-Salat | direct | 58 | 0 | 0 | 0 | – |  |
