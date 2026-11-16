# Platz am Bildschirm (Vorhaben #482)

Grundsatz (Cornelius, 16.11.2026): Jeder Spieler wird durch genau ein Bild dargestellt – sein Porträt im Wappenschild; Menschen und Computergegner gleich. Das Platzzeichen des Spiels bleibt als kleine Plakette am Schild. Die Schritte stehen als Unter-Issues von [#482](https://github.com/ichthys2k/brett-und-blatt/issues/482).

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

## Umgesetzte Schritte

### D1 – Spielerschild (#491, umgesetzt 16.11.2026)

- `PlayerCrest` (`packages/ui/src/crest/PlayerCrest.tsx`): optional `portrait`, `portraitEmoji`, `ring`. Medaillon-Maße je Schildform in `PORTRAIT_MEDALLION` (klassisch/rund/rolle Mitte y 80, Radius 34; spitz y 70, Radius 30 – gerechnet gegen die Schildkontur).
- `PlayerShield` (`packages/ui/src/PlayerShield.tsx`): Avatar + Wappenbeschreibung + Uhr + Platzzeichen; Medaillon nie über 192 px (`shieldWidth`).
- `PlayerChip size="card"` mit `crest` und `shieldSize` (Vorgabe 72); kompakt unverändert.
- Gemalte Bilder nur im Aussehen „Taverne“; „Schlicht“ und erhöhter Kontrast zeigen das Emoji (Entscheidung 4 in #482).
- Einsatz folgt in D3 (Leiste links), D4 (Sitzring) und D5 (Lobby).

### D2 – Porträt und Wappenschild für jeden Platz (#492, umgesetzt 16.11.2026)

- `seatIdentity` (`apps/web/src/lib/seatIdentity.ts`): liefert für jeden Platz `avatar` und `crest`.
- Bots bekommen das gemalte Porträt ihres Spiels (`botAvatar`) und ein Standardschild (`defaultCrest(index)`).
- Menschen ohne gewählten Avatar bekommen ein festes gemaltes Bild je Platz (`defaultAvatar(index)`) aus 42 unterscheidbaren Tier-Avataren.
- Menschen ohne Wappen oder mit „im Raum verbergen“ bekommen ein Standardschild (`defaultCrest(index)` mit 8 kontrastreichen Farbkombinationen aus `crest-colors.ts`).
- Lokal gilt das eigene Profil nur bei genau einem menschlichen Spieler am Gerät; bei mehreren Plätzen greifen die Standardwerte je Platz.
- `OnlineTableProps` transportiert `crests` (`Display.tsx`, `Room.tsx` über Hilfsfunktion `seatMember`), `seatChip` und Siegerehrung (`Ceremony`) nutzen `seatIdentity`.

### D3 – Leiste links am Desktop (#493, umgesetzt 16.11.2026)

- `packages/ui/src/tableLayout.ts` (`sideBarWidth`, `sideShieldSize`, `tableLayout` mit `mode`, `collapsed`, `landscape`, `crowded`, `sideWidth`; Tests in `packages/ui/test/table-layout.test.ts`):
  - Leistenbreite im Zustand `side`: `< 1100 px` → `288 px` (`320 px` ab 3 Plätzen), `≥ 1100 px` → `320 px`, `≥ 1400 px` → `352 px`.
  - Schildbreite `sideShieldSize(seats, sideHeight)` aus verfügbarer Höhe (`sideHeight − 56 − 60 − 170`) geteilt durch Platzzahl: `≥ 170` → `96 px`, `≥ 124` → `72 px`, `≥ 88` → `52 px`, sonst `0` (kompakter Chip).
- `PlayerShield.tsx`: Containerhöhe bei `width < CREST_ORNAMENT_MIN_SIZE` (`56 px`) auf `(width * 106) / 80` korrigiert.
- `packages/ui/src/ui.css`: `.bub-players .bub-chip[data-size='card']` über volle Breite, `.bub-chip-text` füllt den Platz rechts neben dem Schild.
- `apps/web/src/screens/Play.tsx`: nutzt `tableLayout` und `sideShieldSize`, setzt `size={sideShield > 0 ? 'card' : 'compact'}` und `shieldSize={sideShield}` in `seatChip` sowie `style={{ width: layout.sideWidth }}` im Zustand `side`.
- `scripts/platz-messen.mjs`: zählt nun auch `.bub-chip .bub-crest-portrait` (SVG-`<image>`) zur Porträtmessung.
- Messwerte bei `1440 × 900` (Aussehen „Taverne“):
  - `chess`, `checkers`, `go`, `reversi`, `ludo`, `bingo` (2 Plätze): Chip `328 × 164 px`, Porträt-Medaillon `61 px` (vorher `22 px`), Brett-Höhe unverändert `872 px`, Spielfeld-Anteil `75 %` (vorher `79 %`, `-4` Prozentpunkte).
  - `four-player-chess` (4 Plätze): Chip `328 × 128 px`, Porträt-Medaillon `46 px`, Brett-Höhe unverändert `872 px`, Anteil `75 %` (vorher `77 %`).
  - `wolves-sheep` (8 Plätze): kompakte Chips `328 × 61 px`, Porträt `22 px`, Anteil `75 %` (vorher `77 %`).

### D5 – Lobby: Mitspieler als Porträt im Wappenschild (#495, umgesetzt 16.11.2026)

- `MemberRow` (`apps/web/src/screens/Room.tsx`): links `PlayerShield` (36 px am Handy, 56 px ab `wide:` bzw. 900 px Breite) mit `seatIdentity` (`avatar` + `crest`); ab `wide:` Name größer und Zusätze (👑, 🙋, 🔒, offline) als Marken darunter, Knöpfe rechts.
- Mitgliederliste (`Room.tsx`): ab 1100 px Breite zweispaltig bei mehr als 4 Mitgliedern (`Page` ab 1100 px `max-w-4xl`).
- `SeatRow` und Turnier-Warteraum (`Room.tsx`): zeigen ebenfalls `PlayerShield` (28–34 px) statt Emoji-Text bzw. reinem Avatar (Bots mit Bot-Porträt im Standardschild).

### G1 – Layout-Entscheidung als reine Funktion (#484, umgesetzt 16.11.2026)

- `tableLayout` (`packages/ui/src/tableLayout.ts`) rechnet aus Breite, Höhe, Platzzahl und `seatsAround`, `seatsOnBoard`, `fullBleed` den Zustand `ring` · `side` · `stack` · `rail` · `bar` (`compact` oben = `rail` quer, `bar` hoch); `Play.tsx` leitet seine Layout-Werte nur daraus ab, `TABLE_BAR_HEIGHT` kommt aus `packages/ui`. Gelandet zusammen mit D3 (#493).
- Regeln: `ring` bei `seatsAround` und `seatRingFits(seats, width, height − 56)`; sonst `rail`/`bar` bei `fullBleed` oder (`seatsOnBoard`, quer, Höhe ≤ 540); sonst `side` (quer) bzw. `stack` (hoch); ungemessen immer `stack`.
- Tests in `packages/ui/test/table-layout.test.ts` mit Tabelle der Grenzfälle. Messung vorher/nachher mit `platz-messen.mjs`: Anteil, `ring`, `menu`, Chipgrößen unverändert.
