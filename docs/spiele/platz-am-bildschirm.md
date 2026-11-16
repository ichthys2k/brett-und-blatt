# Platz am Bildschirm

## Ziel

Das Vorhaben [#482](https://github.com/ichthys2k/brett-und-blatt/issues/482) optimiert die Bildschirmnutzung der Spieltische für alle 56 Spiele: Auf Mobilgeräten und Tablets im Hochformat soll das Spielfeld maximalen Platz erhalten, während Menüleisten und sekundäre Elemente in ein kompaktes Menü (☰) wandern. Auf Desktop-Bildschirmen steht reichlich Fläche zur Verfügung, auf der Spieler mit Porträts und Wappenschildern groß zur Geltung kommen. Alle weiteren Schritte von #482 belegen ihr Vorher und Nachher mit dem Messwerkzeug `platz-messen.mjs` ([#483](https://github.com/ichthys2k/brett-und-blatt/issues/483)).

## Die drei Tischzustände

Welcher Layoutzustand gilt, entscheidet eine zentrale Funktion anhand von Fensterbreite, Fensterhöhe, Platzzahl und Spieleigenschaften:

| Zustand | Wann | Aussehen |
|---|---|---|
| **`compact`** (eingeklappt) | Hochformat ohne Sitzring (Handy und Tablet); Querformat mit Höhe unter 600 px | Schmale Leiste (hoch: oben 44 px; quer: links 44 px) mit aktivem Platz, Uhr und Schublade ☰ |
| **`ring`** (Sitzring) | Spiele mit `seatsAround`, freie Fläche ab 680 × 560 px, 3–8 Plätze (Poker 2–10) | Spieler sitzen rund um den Spieltisch, schmale Kopfzeile oben |
| **`side`** (Seitenleiste) | Sonst im Querformat ab 600 px Höhe | Feste Seitenleiste links mit Spielerchips und Steuerknöpfen |

## Messwerkzeug

Das Skript misst für jedes Spiel in vier festen Bildschirmgrößen den Anteil des Spielfelds (`main.bub-table`) am sichtbaren Fenster, Überläufe mit Scrollbalken sowie die Abmessungen von Spielerchips und Porträts:

```sh
corepack pnpm build
node scripts/platz-messen.mjs [--bilder <Ordner>] [--json <Datei>] [Spiel-ids …]
corepack pnpm platz-messen
```

- **Ohne Argumente:** Misst alle fertigen Spiele (56 Spiele) und führt anschließend einen zweiten Durchlauf mit maximaler Platzzahl für eine repräsentative Auswahl durch.
- **`[Spiel-ids …]`:** Misst gezielt nur die angegebenen Spiele.
- **`--bilder <Ordner>`:** Speichert je Spiel und Größe ein Bildschirmfoto (z. B. `chess-1440x900.png`).
- **`--json <Datei>`:** Speichert alle Rohmesswerte strukturiert als JSON-Datei.

## Ausgangswerte (Stand: 16. November 2026)

Gemessen auf dem Stand vor Umsetzung von #484 ff., Voreinstellungen der Partie, Aussehen „Taverne“:

| Spiel | 390×844 | 844×390 | 1024×768 | 1440×900 | Überlauf | Chip (1440×900) | Porträt | Zustand |
|---|---|---|---|---|---|---|---|---|
| battleship | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| bible-quiz | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| bingo | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| binokel | 73 % | 60 % | 91 % | 92 % | - | 168 × 61 px | 22 px | ring |
| black-peter | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| category-sprint | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| checkers | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| chess | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| chinese-checkers | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| color-and-shape | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| color-sorter | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| describe-duel | 73 % | 60 % | 68 % | 77 % | - | 296 × 61 px | 22 px | side |
| dominoes | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| doppelkopf | 73 % | 60 % | 91 % | 92 % | - | 168 × 61 px | 22 px | ring |
| drachenspiel | 95 % | 95 % | 96 % | 97 % | - | - | - | compact |
| duck-rally | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| elevens | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| estimate | 79 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| factor-grid | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| four-in-a-row | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| four-player-chess | 73 % | 60 % | 68 % | 77 % | - | 296 × 61 px | 22 px | side |
| go | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| gomoku | 73 % | 68 % | 71 % | 79 % | 106q / 59t / 63d px | 264 × 61 px | 22 px | side |
| grafschaft | 73 % | 68 % | 71 % | 79 % | 591h / 617q / 256t / 89d px | 264 × 61 px | 22 px | side |
| hangman | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| kniffel | 73 % | 68 % | 71 % | 79 % | 111h / 365q px | 264 × 61 px | - | side |
| ligretto | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| low-flight | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| ludo | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| maexle | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| majority | 79 % | 60 % | 68 % | 77 % | - | 296 × 61 px | 22 px | side |
| market-stalls | 73 % | 68 % | 71 % | 79 % | 126q px | 264 × 61 px | 22 px | side |
| marketplace | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| mau-mau | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| mill | 73 % | 68 % | 71 % | 79 % | 6q px | 264 × 61 px | 22 px | side |
| number-wall | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| pairs | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| poker | 73 % | 92 % | 71 % | 79 % | 30h px | 264 × 61 px | 22 px | ring |
| president | 73 % | 60 % | 91 % | 92 % | - | 168 × 61 px | 22 px | ring |
| quartett | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| reversi | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| schafkopf | 73 % | 60 % | 91 % | 92 % | - | 168 × 61 px | 22 px | ring |
| scrabble | 73 % | 68 % | 71 % | 79 % | 16t px | 264 × 61 px | 22 px | side |
| skat | 73 % | 60 % | 91 % | 92 % | 13q px | 168 × 61 px | 22 px | ring |
| solitaire | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| speed | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| symbol-match | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| target-number | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| tic-tac-toe | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| timeline | 79 % | 68 % | 71 % | 79 % | - | 264 × 61 px | - | side |
| turnip-patch | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| ultimate-tic-tac-toe | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| uno | 73 % | 68 % | 71 % | 79 % | - | 264 × 61 px | 22 px | side |
| who-am-i | 73 % | 60 % | 68 % | 77 % | - | 296 × 61 px | 22 px | side |
| wolves-sheep | 79 % | 60 % | 68 % | 77 % | - | 296 × 61 px | 22 px | side |
| word-salad | 73 % | 68 % | 71 % | 79 % | 269h / 21q px | 264 × 61 px | - | side |
| **Durchschnitt** | **74 %** | **67 %** | **73 %** | **80 %** | | | | |

### Höchste Platzzahl (Auswahl)

| Spiel | Plätze | 390×844 | 844×390 | 1024×768 | 1440×900 | Überlauf | Chip (1440×900) | Zustand |
|---|---|---|---|---|---|---|---|---|
| ludo | 6 | 73 % | 60 % | 68 % | 77 % | - | 296 × 61 px | side |
| uno | 10 | 73 % | 60 % | 68 % | 77 % | - | 296 × 61 px | side |
| wolves-sheep | 19 | 79 % | 60 % | 68 % | 77 % | - | 296 × 61 px | side |
| kniffel | 6 | 73 % | 60 % | 68 % | 77 % | 111h / 365q px | 296 × 61 px | side |
| skat | 4 | 73 % | 60 % | 91 % | 92 % | - | 168 × 61 px | ring |
| doppelkopf | 5 | 73 % | 60 % | 91 % | 92 % | - | 168 × 61 px | ring |
| poker | 10 | 73 % | 92 % | 68 % | 77 % | - | 296 × 61 px | ring |
| maexle | 10 | 73 % | 60 % | 68 % | 77 % | - | 296 × 61 px | side |
| president | 8 | 73 % | 60 % | 91 % | 92 % | - | 168 × 61 px | ring |
