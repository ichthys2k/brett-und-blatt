# Controller-Eignung der Spiele (Vorhaben #607, K0)

Maschinelle Vorsortierung, wie gut sich jedes fertige Spiel allein mit dem Controller spielen lässt. Daten: `apps/web/src/lib/controllerGrades.json` (liest `controllerGrade(gameId)` in `apps/web/src/lib/controllerGrade.ts`; das Abzeichen in der Bibliothek der Konsole kommt daher). Plan: [`konsole.md`](konsole.md).

| Stufe | Bedeutung |
|---|---|
| `direct` | Steuerkreuz und A genügen im Bedienmodus „Standard“ |
| `carousel` | nur über den Bedienmodus „Erlaubte Züge“ (Karussell) |
| `cursor` | weder noch; nur mit dem Zeiger (L3/Select) oder gar nicht |

## Verfahren

`scripts/controller-audit.mjs` startet jedes Spiel mit `#/neu/<id>?autostart=1` bei 1280 × 800 mit einem nachgebauten Controller (`scripts/lib/virtual-pad.mjs`). Zufall der Seite und Startwert der Partie sind fest (aus der Spiel-id), und vor jedem Tastendruck wartet das Werkzeug, bis ein Mensch am Gerät dran ist; so ergeben zwei Läufe dieselbe Datei. Durchgang „direkt“: höchstens 250 Drücke, 60 % eine Richtung und 40 % A (nie B, Start, X, Y); liegt der Fokus nicht im Spielfeld, drückt es bis zu viermal RB. Erfolg bei drei angenommenen Zügen eines Menschen (`data-human-moves` am Spielfeld, über Neustarts hinweg gezählt).

Scheitert das, folgt der Durchgang „Karussell“ im Bedienmodus „Erlaubte Züge“: höchstens 60 Runden aus null bis drei Mal Rechts und A. „Fokus verloren“ zählt Drücke, vor denen der Fokus auch nach viermal RB nicht im Spielfeld lag; „Verlassen“ zählt, wie oft eine Taste den Spieltisch verlassen hat (danach geht es auf `#/partie` weiter); „Texteingabe“ heißt, dass im Spielfeld ein Textfeld sichtbar war.

```sh
corepack pnpm build
node scripts/controller-audit.mjs --json apps/web/src/lib/controllerGrades.json [ids …]
```

Die Stufe ist eine maschinelle Vorsortierung. Ob wirklich jede Zugart erreichbar ist, prüft K8 von Hand.

## Ergebnis (21.11.2026, vor K7 und K8)

58 Spiele: **direct 38**, **carousel 12**, **cursor 8**.

| Spiel-id | Name | Stufe | Drücke | Fokus verloren | Verlassen | Texteingabe | Anmerkung |
|---|---|---|---|---|---|---|---|
| `battleship` | Schiffe versenken | carousel | 6 | 0 | 0 | – |  |
| `bible-quiz` | Bibel-Quiz | cursor | – | 27 | 0 | – |  |
| `bingo` | Bingo | cursor | – | 182 | 0 | – |  |
| `binokel` | Binokel | direct | 36 | 2 | 1 | – |  |
| `black-peter` | Schwarzer Peter | direct | 12 | 0 | 0 | – |  |
| `category-sprint` | Kategorien-Sprint | cursor | – | 246 | 0 | ja |  |
| `checkers` | Dame | direct | 79 | 0 | 0 | – |  |
| `chess` | Schach | direct | 274 | 0 | 0 | – |  |
| `chinese-checkers` | Sternhalma | carousel | 6 | 0 | 0 | – |  |
| `color-and-shape` | Farbe & Form | carousel | 11 | 0 | 0 | – |  |
| `color-sorter` | Narrenhof | direct | 111 | 0 | 0 | – |  |
| `describe-duel` | Verboten! | carousel | 9 | 249 | 0 | ja |  |
| `dominoes` | Domino | direct | 12 | 0 | 0 | – |  |
| `doppelkopf` | Doppelkopf | direct | 18 | 0 | 0 | – |  |
| `drachenspiel` | Drachenspiel | direct | 100 | 10 | 0 | – |  |
| `dragon-towers` | Drachentürme | carousel | 8 | 0 | 1 | – |  |
| `duck-rally` | Enten-Rallye | cursor | – | 0 | 0 | – |  |
| `elevens` | Elf zuerst! | direct | 61 | 0 | 0 | – |  |
| `estimate` | Schätzmeister | cursor | – | 242 | 0 | ja |  |
| `factor-grid` | Teiler-Duell | direct | 11 | 0 | 0 | – |  |
| `four-in-a-row` | Vier in einer Reihe | direct | 18 | 0 | 0 | – |  |
| `four-player-chess` | Vierer-Schach | direct | 106 | 0 | 0 | – |  |
| `go` | Go | direct | 17 | 0 | 0 | – |  |
| `gomoku` | Gomoku | direct | 8 | 0 | 0 | – |  |
| `grafschaft` | Grafschaft | carousel | 12 | 0 | 0 | – |  |
| `hangman` | Galgenmännchen | direct | 10 | 0 | 0 | – |  |
| `kniffel` | Würfelblock | direct | 7 | 0 | 0 | – |  |
| `ligretto` | Kartenblitz | direct | 187 | 14 | 8 | – |  |
| `low-flight` | Tiefflug | direct | 8 | 0 | 0 | – |  |
| `ludo` | Nicht ärgern! | carousel | 3 | 250 | 101 | – |  |
| `maexle` | Mäxle | direct | 18 | 0 | 0 | – |  |
| `majority` | Mehrheitsfrage | carousel | 8 | 157 | 0 | – |  |
| `market-stalls` | Marktstände | direct | 28 | 0 | 0 | – |  |
| `marketplace` | Marktplatz | carousel | 8 | 0 | 0 | – |  |
| `mau-mau` | Mau-Mau | direct | 16 | 0 | 0 | – |  |
| `mill` | Mühle | direct | 13 | 0 | 0 | – |  |
| `mole-tunnels` | Maulwurfsgänge | direct | 14 | 0 | 0 | – |  |
| `number-wall` | Rechenmauer | cursor | – | 0 | 0 | – |  |
| `pairs` | Paare finden | direct | 7 | 0 | 0 | – |  |
| `poker` | Poker | direct | 61 | 0 | 0 | – |  |
| `president` | Präsident | direct | 115 | 0 | 0 | – |  |
| `quartett` | Quartett | direct | 91 | 0 | 0 | – |  |
| `reversi` | Reversi | direct | 7 | 0 | 0 | – |  |
| `schafkopf` | Schafkopf | carousel | 6 | 0 | 0 | – |  |
| `scrabble` | Wortgitter | direct | 42 | 0 | 0 | – |  |
| `skat` | Skat | carousel | 10 | 0 | 0 | – |  |
| `solitaire` | Solitaire | direct | 243 | 0 | 0 | – |  |
| `speed` | Speed | direct | 49 | 5 | 3 | – |  |
| `symbol-match` | Fix gefunden! | direct | 10 | 0 | 0 | – |  |
| `target-number` | Zielzahl | direct | 29 | 0 | 0 | – |  |
| `tic-tac-toe` | Tic-Tac-Toe | direct | 12 | 0 | 0 | – |  |
| `timeline` | Zeitstrahl | cursor | – | 249 | 0 | – |  |
| `turnip-patch` | Rübenacker | carousel | 10 | 0 | 0 | – |  |
| `ultimate-tic-tac-toe` | Ultimate Tic-Tac-Toe | direct | 12 | 0 | 0 | – |  |
| `uno` | Eins! | direct | 12 | 0 | 0 | – |  |
| `who-am-i` | Wer bin ich? | direct | 31 | 0 | 0 | – |  |
| `wolves-sheep` | Wölfe im Schafspelz | cursor | – | 245 | 0 | – |  |
| `word-salad` | Wort-Salat | direct | 133 | 0 | 0 | – |  |
