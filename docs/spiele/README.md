# Spielpläne

Hier steht für jedes geplante Spiel ein eigener Plan. Grundlage ist das [Konzept](../KONZEPT.md), vor allem die Spielmodul-Schnittstelle, die Muster, Bots und Zeitlimits.

Jeder Plan folgt derselben Gliederung: Steckbrief, Regeln, Optionen, Spielmodell, Bot, Zeitlimits, Oberfläche, Hot-Seat und Online, Tests, offene Punkte.

## Übersicht

Aufwand: S = klein, M = mittel, L = groß, XL = sehr groß.

| Spiel | Spieler | Muster | Bausteine | Regeln | Oberfläche | Bot | Etappe |
|---|---|---|---|---|---|---|---|
| [Vier in einer Reihe](vier-in-einer-reihe.md) | 2 | offen | Gitterbrett | S | S | S | 1 |
| [Ultimate Tic-Tac-Toe](ultimate-tic-tac-toe.md) | 2 | offen | Gitterbrett | S | S | S | 2 |
| [Mühle](muehle.md) | 2 | offen | Netzbrett | S | M | M | 2 |
| [Reversi](reversi.md) | 2 | offen | Gitterbrett | S | S | M | 2 |
| [Paare finden](paare-finden.md) | 1–6 | verdeckt | Gitterbrett, Inhaltspakete | S | M | S | 2 |
| [Schwarzer Peter](schwarzer-peter.md) | 2–6 | verdeckt | Karten-Baukasten, Übergabe, Inhaltspakete | S | M | S | 2 |
| [Solitaire](solitaire.md) | 1 | verdeckt, Einzelspieler | Spielkarten, Stapel, Tipps | M | L | M | 2 |
| Schach | 2 | offen | Gitterbrett, chess.js | – | M | M | 2 |
| Vierer-Schach (Übernahme) | 4 | offen | Gitterbrett (Kreuzform) | – | M | – | 2 |
| [Schiffe versenken](schiffe-versenken.md) | 2 | verdeckt, gleichzeitig | Gitterbrett | M | M | M | 3 |
| [Quartett](quartett.md) | 2–6 | verdeckt | Karten, Inhaltspakete | M | M | M | 3 |
| [Mäxle](maexle.md) | 2–10 | verdeckt | Würfel und Becher | S | M | M | 3 |
| [Go](go.md) | 2 | offen | Gitterbrett, zoombares Brett | M | L | L | 4 |
| [Skat](skat.md) | 3–4 | verdeckt | Stich-Kern, Serie, Kartenblätter | L | L | XL | 5 |
| [Schafkopf](schafkopf.md) | 4 | verdeckt | Stich-Kern, Serie, Kartenblätter | L | L | XL | 5 |
| [Doppelkopf](doppelkopf.md) | 4–5 | verdeckt | Stich-Kern, Serie, Kartenblätter | XL | L | XL | 5 |

## Gemeinsame Bausteine

Die zwölf Spiele teilen sich wenige Bausteine. Jeder davon entsteht beim ersten Spiel, das ihn braucht, und wird danach wiederverwendet.

| Baustein | Paket | Nutzen | Zuerst gebaut für |
|---|---|---|---|
| **Gitterbrett:** Rechteckraster mit Antippen, Hervorheben, Koordinaten, Animationen | `packages/ui` | Vier in einer Reihe, UTTT, Reversi, Go, Schiffe versenken, Paare finden | Vier in einer Reihe |
| **Netzbrett:** Felder als Knoten, Verbindungen als Kanten, frei angeordnet | `packages/ui` | Mühle, später Mensch ärgere dich nicht, Sternhalma, Backgammon | Mühle |
| **Zoombares Brett** mit Lupe und Bestätigen-Knopf | `packages/ui` | Go 19×19, später Scrabble, Domino | Go |
| **Karten-Baukasten:** Karte, Fächer, Stapel, verdeckter Fächer, Übergabe-Bildschirm | `packages/ui` | Quartett, Stichspiele, Schwarzer Peter | Schwarzer Peter |
| **Kartenblätter** als SVG aus Daten: französisch, vierfarbig, deutsch/bayerisch | `packages/ui/cards` | Skat, Schafkopf, Doppelkopf | Skat |
| **Stich-Kern:** Bedienpflicht, Trumpf, Stichsieger, Augen zählen | `packages/engine/tricks` | Skat, Schafkopf, Doppelkopf, später Binokel, Herz, Sechsundsechzig | Skat |
| **Serien-Rahmen:** Geberwechsel, Spielliste, Abrechnung über viele Spiele | `packages/engine/series` | Skat, Schafkopf, Doppelkopf | Skat |
| **Würfel und Becher:** Systemzug „würfeln“, verdecktes Anschauen | `packages/engine`, `packages/ui` | Mäxle, später Yacht, Backgammon, Mensch ärgere dich nicht | Mäxle |
| **Inhaltspakete:** Paare und Kartensets mit Werten und Quellen | `content/` | Paare finden, Quartett, später Schwarzer Peter, Bingo | Paare finden |
| **Minimax mit Alpha-Beta**, iterative Vertiefung, Zeitgrenze | `packages/engine/bots` | Vier in einer Reihe, Mühle, Reversi | Vier in einer Reihe |
| **MCTS** (Monte-Carlo-Baumsuche) | `packages/engine/bots` | UTTT, Go, allgemeiner Bot | UTTT |
| **Determinisierte MCTS** für verdeckte Informationen | `packages/engine/bots` | Stichspiele, Quartett | Skat |

## Reihenfolge und Begründung

1. **Vier in einer Reihe:** der erste vollständige Durchlauf durch alle Schichten: Regeln, Bot, Oberfläche, Hot-Seat, Zeitlimit, Tests. Die Regeln sind klein, so steckt die Arbeit im Fundament.
2. **UTTT, Mühle, Reversi:** weitere offene Spiele. Sie bringen MCTS, das Netzbrett und eine richtige Stellungsbewertung.
3. **Paare finden:** erstes Spiel mit verdeckter Information und mit Inhaltspaketen. Es läuft trotzdem noch komplett offline.
4. **Schiffe versenken, Quartett, Mäxle:** brauchen online den Server, weil Flotte, Karten und Würfel geheim sind. Sie testen gleichzeitige Phasen, Mitschrift-Logik und Bluff-Bots.
5. **Go:** großes Brett auf dem Handy, Byo-yomi, Auszählphase mit Einigung, Fernpartie.
6. **Skat, dann Schafkopf, dann Doppelkopf:** Skat hat die einheitlichsten Regeln (Internationale Skatordnung) und baut Stich-Kern und Serien-Rahmen. Schafkopf ergänzt den geheimen Partner, Doppelkopf die geheimen Teams und Vorbehalte.

## Inhalte, die erstellt werden müssen

- **Kartenblätter:** französisch, vierfarbig und deutsch/bayerisch als Vorlage mit Bildkarten. Das ist Gestaltungsarbeit in Etappe 5.
- **Quartett-Sets** mit je 32 Karten und Quellenangaben: Tiere, Weltraum und Planeten, Biblische Personen, Dinosaurier.
- **Paare-Sets:** Emojis, Tiere mit Lauten, Lernpaare wie Einmaleins oder Vokabeln.
- **Tierlaute** aus Emojistone für Quartett und Paare finden (Suno-Abo, CC BY-SA).
