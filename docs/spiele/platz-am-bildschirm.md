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

## D4: Sitzring am Desktop (16.11.2026, #494)

- Stufen (Fläche des Rings selbst, etwa Fenster − 48 × − 144 px): bis 4 Plätze `large` ab 1312 × 716, `medium` ab 1132 × 576; 5 Plätze `large` ab 1580 breit, `medium` ab 1312 × 716; 6 Plätze `medium` ab 1312 × 716; 7–8 Plätze `medium` ab 1800 × 900. Die Startwerte des Issues (1360 × 820 usw.) rechneten mit dem Fenster; bei 5 und mehr Plätzen rücken Nachbarn auf dem festen Oval so nah, dass breitere Schilder früher einander überlappen. Die Werte sind mit dem Rauchtest (1440 × 900, 1920 × 1080) bestätigt.
- Gemessen bei 1440 × 900 (Tischmitte vorher → nachher): Skat zu dritt 838 × 531 → 758 × 488, Mau-Mau zu fünft 912 × 352 → 880 × 286, Quartett zu sechst 850 × 590 → 818 × 505, also etwa 17–21 % weniger Fläche statt der angestrebten höchstens 10 %. Größere Schilder kosten Mitte; ein Rückschritt auf kleinere Stufen wäre in `seatRingScale` und den Variablen in `ui.css` zu stellen.
- Schild 80 px breit ergibt ein Medaillon von etwa 54 px (≥ 50 px), `medium` mit 56 px etwa 38 px.
