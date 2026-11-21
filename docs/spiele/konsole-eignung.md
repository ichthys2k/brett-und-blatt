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

**Verlauf:** Erste Messung vor K7: direct 38, carousel 12, cursor 8. Nach K7 (Fokus bei Zugbeginn) und dem ersten Durchgang von K8 (SVG-Bretter, Würfel bei Nicht ärgern!): siehe unten.

## Grenzen

- **Mehrschrittige Züge:** Wo ein Zug aus mehreren Schritten besteht (Schiff setzen und bestätigen, Stein und Feld wählen, mehrere Karten), schafft der Zufallslauf oft keine drei Züge, obwohl jedes Ziel ein Knopf ist. Solche Spiele stehen bei `carousel`, sind aber mit Steuerkreuz und A spielbar.
- **Gleichzeitige Runden und Texteingabe:** Spiele ohne Zug-Rahmen (alle geben zugleich ab) und Spiele mit freier Eingabe (Kategorien-Sprint, Schätzmeister, Beschreib-Duell) brauchen die Bildschirmtastatur; der Zufallslauf tippt nicht.
- **Echtzeit:** Enten-Rallye, Fix gefunden!, Ligretto und Speed laufen gegen die Uhr; dort genügt, dass jede Aktion erreichbar ist.
- **Suche nach Teilen ohne Fokus (21.11.2026):** In allen 58 Spielen ist im Startzustand jedes anklickbare Teil fokussierbar oder die Verdopplung eines fokussierbaren Ziels.

## Ergebnis (21.11.2026, nach K7 und dem ersten Durchgang von K8)

58 Spiele: **direct 42**, **carousel 9**, **cursor 7**.

| Spiel-id | Name | Stufe | Drücke | Fokus verloren | Verlassen | Texteingabe | Anmerkung |
|---|---|---|---|---|---|---|---|
| `battleship` | Schiffe versenken | carousel | 6 | 0 | 0 | – |  |
| `bible-quiz` | Bibel-Quiz | cursor | – | 21 | 0 | – |  |
| `bingo` | Bingo | cursor | – | 182 | 0 | – |  |
| `binokel` | Binokel | direct | 34 | 2 | 1 | – |  |
| `black-peter` | Schwarzer Peter | direct | 10 | 0 | 0 | – |  |
| `category-sprint` | Kategorien-Sprint | cursor | – | 246 | 0 | ja |  |
| `checkers` | Dame | direct | 77 | 0 | 0 | – |  |
| `chess` | Schach | direct | 273 | 0 | 0 | – |  |
| `chinese-checkers` | Sternhalma | direct | 72 | 0 | 0 | – |  |
| `color-and-shape` | Farbe & Form | carousel | 11 | 0 | 0 | – |  |
| `color-sorter` | Narrenhof | direct | 112 | 0 | 0 | – |  |
| `describe-duel` | Verboten! | carousel | 9 | 249 | 0 | ja |  |
| `dominoes` | Domino | direct | 10 | 0 | 0 | – |  |
| `doppelkopf` | Doppelkopf | direct | 16 | 0 | 0 | – |  |
| `drachenspiel` | Drachenspiel | direct | 98 | 10 | 0 | – |  |
| `dragon-towers` | Drachentürme | carousel | 8 | 0 | 1 | – |  |
| `duck-rally` | Enten-Rallye | cursor | – | 0 | 0 | – |  |
| `elevens` | Elf zuerst! | direct | 59 | 0 | 0 | – |  |
| `estimate` | Schätzmeister | cursor | – | 233 | 0 | ja |  |
| `factor-grid` | Teiler-Duell | direct | 11 | 0 | 0 | – |  |
| `four-in-a-row` | Vier in einer Reihe | direct | 16 | 0 | 0 | – |  |
| `four-player-chess` | Vierer-Schach | direct | 106 | 0 | 0 | – |  |
| `go` | Go | direct | 15 | 0 | 0 | – |  |
| `gomoku` | Gomoku | direct | 6 | 0 | 0 | – |  |
| `grafschaft` | Grafschaft | direct | 41 | 0 | 0 | – |  |
| `hangman` | Galgenmännchen | direct | 10 | 0 | 0 | – |  |
| `kniffel` | Würfelblock | direct | 7 | 0 | 0 | – |  |
| `ligretto` | Kartenblitz | direct | 187 | 14 | 8 | – |  |
| `low-flight` | Tiefflug | direct | 6 | 0 | 0 | – |  |
| `ludo` | Nicht ärgern! | direct | 10 | 0 | 0 | – |  |
| `maexle` | Mäxle | direct | 16 | 0 | 0 | – |  |
| `majority` | Mehrheitsfrage | carousel | 8 | 236 | 0 | – |  |
| `market-stalls` | Marktstände | direct | 26 | 0 | 0 | – |  |
| `marketplace` | Marktplatz | carousel | 8 | 0 | 0 | – |  |
| `mau-mau` | Mau-Mau | direct | 14 | 0 | 0 | – |  |
| `mill` | Mühle | direct | 11 | 0 | 0 | – |  |
| `mole-tunnels` | Maulwurfsgänge | direct | 14 | 0 | 0 | – |  |
| `number-wall` | Rechenmauer | cursor | – | 0 | 0 | – |  |
| `pairs` | Paare finden | direct | 7 | 0 | 0 | – |  |
| `poker` | Poker | direct | 57 | 0 | 0 | – |  |
| `president` | Präsident | direct | 113 | 0 | 0 | – |  |
| `quartett` | Quartett | carousel | 6 | 6 | 0 | – |  |
| `reversi` | Reversi | direct | 5 | 0 | 0 | – |  |
| `schafkopf` | Schafkopf | carousel | 6 | 0 | 0 | – |  |
| `scrabble` | Wortgitter | direct | 42 | 0 | 0 | – |  |
| `skat` | Skat | carousel | 10 | 0 | 0 | – |  |
| `solitaire` | Solitaire | direct | 243 | 0 | 0 | – |  |
| `speed` | Speed | direct | 49 | 5 | 3 | – |  |
| `symbol-match` | Fix gefunden! | direct | 10 | 0 | 0 | – |  |
| `target-number` | Zielzahl | direct | 29 | 0 | 0 | – |  |
| `tic-tac-toe` | Tic-Tac-Toe | direct | 10 | 0 | 0 | – |  |
| `timeline` | Zeitstrahl | cursor | – | 237 | 0 | – |  |
| `turnip-patch` | Rübenacker | direct | 5 | 0 | 0 | – |  |
| `ultimate-tic-tac-toe` | Ultimate Tic-Tac-Toe | direct | 10 | 0 | 0 | – |  |
| `uno` | Eins! | direct | 10 | 0 | 0 | – |  |
| `who-am-i` | Wer bin ich? | direct | 30 | 0 | 0 | – |  |
| `wolves-sheep` | Wölfe im Schafspelz | direct | 24 | 0 | 0 | – |  |
| `word-salad` | Wort-Salat | direct | 133 | 0 | 0 | – |  |
