# Super Nintendo: Brett & Blatt als ROM für Emulatoren

18.11.2026 · Recherche und Stufenplan · Vorhaben [#515](https://github.com/ichthys2k/brett-und-blatt/issues/515), Stufe 0 und 1: [#516](https://github.com/ichthys2k/brett-und-blatt/issues/516)

> Wäre es möglich, Brett und Blatt teilweise oder vollständig auf Super Nintendo zu portieren, so dass man es als Image in einem Emulator spielen kann? Recherchiere dazu und entwickle einen Plan, wie so etwas Stück für Stück umzusetzen wäre.

## Kurzfassung

**Teilweise: ja, gut machbar. Vollständig: nein.** Ein eigenes SNES-ROM („Brett & Blatt 16“) mit einer Auswahl von Brett-, Würfel- und Kartenspielen läuft in jedem gängigen Emulator (Mesen, bsnes, Snes9x, RetroArch, auch im Browser über EmulatorJS) und mit einem Flash-Modul sogar auf echter Hardware. Allein gegen Bots, zu zweit mit zwei Controllern, bis zu fünft über den Multitap.

Das ist allerdings **kein Port, sondern ein Nachbau**. Vom heutigen Code läuft auf dem SNES nichts: Er ist TypeScript, React und JSON, das SNES hat einen 16-Bit-Prozessor mit rund 3,58 MHz, 128 KB Arbeitsspeicher und keinen Netzanschluss. Übernehmen lassen sich die **Regeln als Vorlage**, der **Zufallsgenerator** (sfc32, rein 32-Bit-Ganzzahl, auch auf dem 65816 rechenbar) und vor allem die **Prüfwerkzeuge**: Die TypeScript-Spielmodule können als Schiedsrichter dienen, gegen den jedes SNES-Spiel Zug für Zug geprüft wird. Das ist der Hebel, der den Nachbau verlässlich macht.

Nicht aufs SNES kommen: Online-Spiel, Klassen, Turniere, Spielerpass, Wortspiele mit großem Wörterbuch, Quiz mit Freitext, die gemalte Grafik in heutiger Qualität und die ElevenLabs-Klänge (Lizenz). Realistisch sind etwa **20 bis 30 der 56 Spiele**, davon die ersten zehn mit überschaubarem Aufwand.

Empfehlung: zuerst ein **Probelauf** (Stufe 0 und 1, wenige Wochen Abendarbeit), danach entscheiden. Lohnend ist das Vorhaben als Liebhaberstück und Schaufenster („läuft sogar auf dem SNES“), nicht als Weg zu mehr Spielern.

## Stand

**Stufe 0 und 1 umgesetzt (18.11.2026, #516)** in `apps/snes` – Bauen, Prüfen und Aufbau stehen in [`apps/snes/README.md`](../../apps/snes/README.md).

- **Werkzeugkette:** PVSnesLib 4.7.1 wird aus dem Quellcode gebaut (die vorgebauten Archive von GitHub-Releases sind aus der Cloud-Umgebung nicht erreichbar; der Bau dauert 20 s). Snes9x 1.63 und bsnes (fester Commit) als libretro-Kerne, dazu ein eigener Prüf-Emulator ohne Fenster (`werkzeuge/emu/emu.c`, etwa 300 Zeilen C), den die Tests über stdin steuern. Mesen ließ sich ohne Fenster nicht einbinden (braucht .NET); das ROM sollte Cornelius einmal von Hand in Mesen öffnen.
- **ROM:** 256 KB LoROM mit 2 KB SRAM. Titel, Hauptmenü, Vorbereitung, Anleitung (Wortlaut aus `meta.ts`, mit Zeilenumbruch), Partie mit Cursor und Vorschau des Zeichens, Pause, Ergebnis mit Gewinnreihe, Serien, Statistik. Schrift mit Umlauten, Gedankenstrich und Anführungszeichen; fünf Klangeffekte.
- **Prüfungen:** Zufall, Regeln und Bot genau wie in der Web-App (Postfach im Arbeitsspeicher statt Knopfdrücken), Bedienung über zwei Controller, Statistik nach Neustart, gleiche Bilder in Snes9x und bsnes. Gesamtdauer etwa 15 s.
- **Bot:** „leicht“ zieht jeden zweiten Zug zufällig, „mittel“ gewinnt, wehrt ab oder nimmt die Mitte, „schwer“ rechnet vollständig (Negamax mit Bitmasken) und verliert nie. Die erste, einfache Fassung brauchte für die zweite Antwort sieben Sekunden – die heutige höchstens 0,7. Für Stufe 2 heißt das: Bots für größere Bretter brauchen von Anfang an Bitbretter und ein Zeitbudget, voraussichtlich mit Assembler in der innersten Schleife.
- **Erkenntnisse zu 816-tcc:** siehe „Stolpersteine“ in der README (nicht gelöschte Variablen, Rückgabewerte über Funktionszeiger, Klangindex, Tonhöhe).

**Stufe 2 umgesetzt (18.11.2026, #518):** sechs Brettklassiker zusätzlich zu Tic-Tac-Toe – Vier in einer Reihe (alle Brettgrößen, PopOut), Reversi (6/8/10, freie Eröffnung), Gomoku, Ultimate Tic-Tac-Toe (beide Varianten), Mühle (alle Optionen) und Dame (Deutsch, International, Englisch; 8 × 8 und 10 × 10).

- **Unterbau:** Züge sind Bytefolgen je Spiel statt 16-Bit-Zahlen (Mühle mit Wegnehmen, Dame mit Sprungketten). Spiele haben Optionen. Die Bedienung läuft für alle Spiele gleich über Felderfolgen (Stein, Ziel, Sprungfelder, wegzunehmender Stein).
- **Grafik:** Jedes Spiel hat drei eigene Brettpaletten. Gleiche Kacheln werden zusammengelegt (630 Kacheln insgesamt).
- **Prüfungen:** Alle Regeln stimmen in 20 Optionskombinationen Zug für Zug mit der Web-App überein, über mehrere tausend Partien. Alle Bots ziehen erlaubt, rechnen höchstens etwa 2,5 Sekunden, und „schwer“ schlägt einen Zufallsspieler in fast allen Partien. Alle 50 Prüfungen laufen in etwa 4 Minuten.
- **Nicht auf dem SNES:** Remis-Angebote bei Dame (in der Web-App kein Teil von `legalMoves`).
- **„Wölfe im Schafspelz“** stand versehentlich in Stufe 2. Es ist ein Partyspiel für 8–19 Spieler und gehört nicht hierher.

**Zu prüfen (Cornelius):** das ROM aus dem CI-Artefakt „brett-und-blatt-16“ in Mesen oder RetroArch öffnen, jedes Spiel einmal gegen den Bot spielen und Lesbarkeit, Farben und Bedienung ansehen (besonders Mühle und Dame mit mehreren Schritten je Zug).

## Was das SNES kann und was nicht

| Merkmal | SNES | Folge für Brett & Blatt |
| --- | --- | --- |
| Prozessor | Ricoh 5A22 (65C816), 1,79–3,58 MHz, 16 Bit, keine Multiplikation über 8×8 Bit in Hardware hinaus | Regeln problemlos; Bots nur mit kleiner Suchtiefe oder festen Faustregeln. Die heutigen MCTS-Bots (Skat, Doppelkopf …) sind zu teuer. |
| Arbeitsspeicher | 128 KB WRAM | Spielstand muss eng gepackt sein (Bitfelder statt JSON). Für alle geplanten Spiele reicht das. |
| Bildspeicher | 64 KB VRAM, 256 × 224 Bildpunkte, 15-Bit-Farben, Kacheln 8 × 8 mit je 16 Farben, bis 128 Sprites | Karten und Bretter als Kacheln gut darstellbar. Gemalte Porträts nur stark verkleinert und mit 16 Farben je Kachel. Wenig Platz für Text: etwa 32 × 28 Zeichen. |
| Klang | Eigener Klangprozessor SPC700 mit 64 KB Audio-RAM, 8 Stimmen, BRR-Samples | Musik nur als Tracker-Stücke, keine Suno-Lieder. Kurze Effekte gehen. |
| Modul | ROM bis 4 MB (LoROM/HiROM), mehr mit ExHiROM; batteriegepuffertes SRAM 8–128 KB | Platz für viel Text (Bibel-Quiz-Fragen wären möglich), Statistiken und Spielstände im SRAM. |
| Eingabe | Controller mit Steuerkreuz und 8 Knöpfen; Multitap für 5 Spieler; SNES-Maus | Brettspiele per Kreuz-Cursor, wahlweise Maus. Hot-Seat bis 5 am Fernseher. |
| Netz | keins (Satellaview ist Geschichte) | **Kein Online-Spiel**, keine Verbindung zum Spieleserver. Im Emulator geht nur das allgemeine Netplay von RetroArch (Controller über das Netz, nicht unser Protokoll). |

Besonders wichtig für Kartenspiele: Am Fernseher sehen alle alles. Verdeckte Hände brauchen im Hot-Seat einen **Wechselbildschirm** („Controller an Anna weitergeben, dann A drücken“), wie heute in der Web-App. Allein gegen Bots entfällt das.

## Werkzeuge (Stand November 2026)

| Werkzeug | Zweck | Einschätzung |
| --- | --- | --- |
| [PVSnesLib](https://github.com/alekmaul/pvsneslib) | C-Bibliothek und Werkzeugkette (816-tcc, WLA-DX) für SNES-Homebrew, Linux/Windows/macOS, MIT-Lizenz, aktiv gepflegt (Version 4.4, Commits 2026) | **Empfohlen für den Anfang.** C ist für Regeln und Bots deutlich bequemer als Assembler, viele Beispiele, Grafikwandler dabei. Der Compiler erzeugt langsamen Code; heiße Stellen (Bot-Suche) später in Assembler. |
| [libSFX](https://github.com/Optiroc/libSFX) | Assembler-Rahmen auf Basis von ca65 | Gut, wenn viel in Assembler entsteht; höhere Einstiegshürde. |
| Calypsi (65816) | Moderner C-Compiler, besserer Code als 816-tcc | Für SNES-Jams genutzt; Lizenzbedingungen für unser Projekt vorher klären. Ausweichweg, falls 816-tcc zu langsam wird. |
| Terrific Audio Driver / SNESGSS | Musik- und Klangtreiber für den SPC700 | Für eigene Chiptune-Stücke und Effekte. |
| superfamiconv, Grafikwandler von PVSnesLib | PNG → Kacheln und Paletten | Für Karten, Figuren, Schrift mit Umlauten. |
| [Mesen 2](https://github.com/SourMesen/Mesen2) | Sehr genauer Emulator mit Debugger, Lua-Skripten und Testlauf ohne Fenster | **Hauptwerkzeug** zum Entwickeln und für automatische Tests in der CI. |
| bsnes, Snes9x, RetroArch | Weitere Emulatoren zum Gegenprüfen | Snes9x und bsnes unterstützen den Multitap mit 5 Spielern. |
| [EmulatorJS](https://emulatorjs.org/docs/systems/snes) | Emulator im Browser (Snes9x-Kern) | Damit ließe sich das ROM sogar auf spiele.lipponer.de anspielen. Snes9x ist nur für nicht-kommerzielle Nutzung freigegeben – passt zu Brett & Blatt, aber im Auge behalten. |

## Was sich vom heutigen Code übernehmen lässt

1. **Regeln als Vorlage.** `rules.ts` jedes Spiels ist klein und sauber getrennt (Reversi 175 Zeilen, Mau-Mau 490, Würfelblock 390, Skat 935). Sie werden von Hand nach C übertragen, Funktion für Funktion: `setup`, `legalMoves`, `applyMove`, `result`.
2. **Zufall.** `packages/engine/src/random.ts` (cyrb128 + sfc32) nutzt nur 32-Bit-Addition, Xor und Verschiebungen. In C auf dem 65816 nachgebaut, ergeben gleiche Startwerte **dieselben Mischungen und Würfe** wie im Browser.
3. **Die TypeScript-Module als Schiedsrichter.** Ein Prüfskript lässt Mesen ohne Fenster laufen, drückt per Lua-Skript Knöpfe bzw. schreibt Züge in den Speicher, liest nach jedem Zug den gepackten Spielstand und die Liste erlaubter Züge aus dem WRAM und vergleicht beides mit dem TypeScript-Modul bei gleichem Startwert. So prüft der vorhandene Prüfstand (Zufallspartien, unerlaubte Züge) indirekt auch das ROM.
4. **Bots als Faustregel.** Die heutigen Stufen „leicht“ bleiben (Zufall mit Vorlieben), „mittel/schwer“ werden für Brettspiele Minimax mit Tiefe 2–4, für Kartenspiele feste Regeln (höchste Karte, Trumpf sparen, Farben merken).
5. **Texte.** Kurzanleitungen (`howToPlay`), Optionsnamen und Zugtexte (`describeMove`) sind deutsch und kurz – als Vorlage für die Bildschirmtexte. Eine eigene 8×8-Schrift mit ä, ö, ü, ß ist nötig.
6. **Stilbibel als Richtung.** Farben und Wappen lassen sich als 16-Farben-Paletten nachempfinden; die gemalten Bilder selbst passen nicht.

## Welche Spiele passen

**Gut geeignet (Stufe 2–3):** Tic-Tac-Toe, Ultimate Tic-Tac-Toe, Vier in einer Reihe, Gomoku, Reversi, Mühle, Dame, Schiffe versenken (mit Wechselbildschirm), Würfelblock, Mäxle, Nicht ärgern! (4 Spieler über Multitap), Paare finden, Solitaire, Elf zuerst!, Domino, Zielzahl, Rechenmauer, Teiler-Duell.

**Geeignet mit Mehraufwand (Stufe 4–5):** Mau-Mau, Eins!, Schwarzer Peter, Quartett, Präsident, Speed und Kartenblitz (Echtzeit mit zwei Controllern – auf dem SNES sogar besonders schön), Sternhalma, Rübenacker, Bingo, Poker, Skat, Schafkopf, Doppelkopf, Binokel (Bots nur regelbasiert), Schach (Suche in Assembler, Stärke eines Anfängers bis Vereinsspielers), Go auf 9×9.

**Nicht sinnvoll:** alles Online-Gebundene (Turniere, Klassen, Spielersuche, Spielerpass), Scrabble, Wortgitter und Wort-Salat (deutsches Wörterbuch zu groß und zu langsam durchsuchbar; höchstens mit kleiner, eigener Wortliste), Kategorien-Sprint, Verboten!, Wer bin ich?, Mehrheitsfrage, Schätzmeister (Freitext oder Sprache), Vierer-Schach (Brett zu groß für 256 × 224), Drachenspiel, Grafschaft, Marktplatz, Marktstände (leben von Grafik und vielen Karten; später allenfalls als eigene, vereinfachte Fassung). Bibel-Quiz und Zeitstrahl wären technisch möglich (Text passt ins ROM), brauchen aber viel Bildschirmtext.

## Stufenplan

Jede Stufe endet mit einem spielbaren ROM. Danach kann man aufhören, ohne dass Arbeit verloren ist.

### Stufe 0 – Probelauf Werkzeugkette (klein) – erledigt

- Neuer Ordner `apps/snes` mit PVSnesLib, Makefile und einem „Hallo“-ROM: Titelbild, Schrift mit Umlauten, ein Ton.
- Bau in einem Docker-Bild oder per Skript reproduzierbar unter Linux; CI-Schritt, der das ROM baut und in Mesen ohne Fenster 300 Bilder lang laufen lässt und ein Bildschirmfoto vergleicht.
- **Fertig, wenn:** `make` erzeugt `brett-und-blatt.sfc`, es startet in Mesen, Snes9x und bsnes, und die CI baut es.

### Stufe 1 – Rahmen und erstes Spiel (klein bis mittel) – erledigt

- **Rahmen:** Hauptmenü mit Spielauswahl, Optionen (wie `options` im Steckbrief), Platzwahl Mensch/Bot je Controller, Wechselbildschirm für Hot-Seat, Ergebnisbild, Statistik im SRAM.
- **Kleine Spielschnittstelle in C**, angelehnt an `GameModule`: `setup(seed, options)`, `legal_moves(state, out)`, `apply_move(state, move)`, `result(state)`, `bot_move(state, level)`, dazu eine Zeichenfunktion je Spiel. Spielstand als feste Struktur.
- **Zufall** als C-Fassung von cyrb128/sfc32; Startwert aus Bildzähler und Knopfdrücken.
- **Erstes Spiel: Tic-Tac-Toe** (wie die Vorlage im Web).
- **Schiedsrichter-Test:** `apps/snes/test/snes.test.ts` steuert den Prüf-Emulator, spielt Zufallspartien und vergleicht Stand und erlaubte Züge mit `packages/games/tic-tac-toe`.
- **Fertig, wenn:** Tic-Tac-Toe gegen Bot und zu zweit spielbar, Vergleichstest grün in der CI.

### Stufe 2 – Brettklassiker (mittel) – erledigt

- Vier in einer Reihe, Gomoku, Reversi, Mühle, Dame, Ultimate Tic-Tac-Toe.
- Baustein „Raster mit Cursor“ (Gegenstück zu `GridBoard`), optional SNES-Maus.
- Minimax mit Alpha-Beta in C, Zeitbudget je Zug (z. B. 2 s, gemessen in Bildern), heiße Schleifen bei Bedarf in Assembler.
- Erstes ROM-Release (GitHub Release mit `.sfc`), Eintrag auf der Seite „Weitere Spiele“ oder einer eigenen Seite mit EmulatorJS.

### Stufe 3 – Würfel und Familie (mittel) – in Arbeit (#520, Zweig `claude/sleepy-bell-1eoy7r`)

**Stand 18.11.2026 (Übergabe):**

- Fertig und mit Regel- und Bot-Vergleich grün (`SNES_SPIELE=<id> corepack pnpm exec vitest run apps/snes`): Teiler-Duell (`teiler.c`), Würfelblock (`kniffel.c`), Mäxle (`maexle.c`), Paare finden (`paare.c`, nur Sets Tiere/Einmaleins/Englisch, Raster bis 30), Nicht ärgern! (`ludo.c`, Kreuz und Stern), Domino (`domino.c`, ohne Mexican Train und Rechenterme), Rechenmauer (`mauer.c`).
- Unterbau: Plätze 1–6 mit Multitap, `Spiel.zusatz` (Zusatzzüge wie isLegal), `Spiel.platz_farbe` (Name/Farbe je Spielerzahl), `Spiel.erlaubt` (freie Eingaben wie isLegal), `karte_unten` (Kachelkarte auf Ebene 2 unter der Schrift), große Puffer in Bank $7F (`ram.asm`). Tests: `Variante.siege` (nötige Siege bei vielen Mitspielern), `Adapter.pruefen` (freie Eingaben beim Probezug).
- **Offen – Zielzahl:** Entwurf in `apps/snes/entwurf/zielzahl.c` (nur Modus „Klassisch 24“; Kandidatensuche wie `findCandidateMoves`, Bedienung über Zusatzzüge `[10, a, Zeichen, b]`, `[11]` zurück, Abgabe `[0, Schritte, …, Endkarte]`). Er kompiliert, aber der Linker bricht ab (Ursache noch nicht angesehen, vermutlich fehlende 32-Bit-Hilfsroutine wie bei `>> variable`, siehe README). Zum Weitermachen: Datei nach `src/` verschieben, `spiel_zielzahl` in `spiel.h` (SPIELE_ANZAHL 15) und `main.c` (`spiele[]`) eintragen, in `ram.asm` `ziel_kandidaten DSB 9600` ergänzen, `make` und Fehlermeldung lesen; danach Adapter `test/spiele/zielzahl.ts` (nr 14) nach dem Muster von `test/spiele/mauer.ts` mit `pruefen` und `extra`.
- **Offen:** erste Musik, Doku (README Stolpersteine, CHRONIK), `corepack pnpm check`, PR mit `Refs #520`, Issue #520 auf `status: Review`.

- Würfelblock, Mäxle, Nicht ärgern! (Multitap, 4 Plätze), Paare finden, Domino, Zielzahl, Rechenmauer, Teiler-Duell.
- Baustein Würfel (Sprite-Animation) und Spielerleiste für bis zu 5 Plätze.
- Erste Musik: zwei bis drei eigene Tracker-Stücke, Klangeffekte für Würfeln, Ziehen, Sieg.

### Stufe 4 – Karten ohne Stiche (mittel bis groß)

- Kartenbaustein: Französisches und Deutsches Blatt als Kacheln (etwa 24 × 32 Bildpunkte je Karte), Fächer, Ablage, Stapel.
- Solitaire, Elf zuerst!, Mau-Mau, Eins!, Schwarzer Peter, Quartett, Präsident, Speed, Kartenblitz, Poker.
- Wechselbildschirm für verdeckte Hände; Echtzeitspiele mit zwei Controllern gleichzeitig.

### Stufe 5 – Stichspiele und Schach (groß)

- Skat, Schafkopf, Doppelkopf, Binokel mit Reizen bzw. Ansagen; regelbasierte Bots (Spielstärke deutlich unter den heutigen MCTS-Bots, das gehört ehrlich in die Anleitung).
- Schach mit eigener Zuggenerierung (Bitbretter sind auf 16 Bit unhandlich, besser 0x88-Brett) und Suche in Assembler; Go 9×9.
- Prüfung gegen `chess.js`-Modul und die Stichspiel-Module wie in Stufe 1.

### Stufe 6 – Feinschliff und echte Hardware (offen)

- Test auf echtem SNES mit Flash-Modul (FXPak Pro oder Everdrive), Speicherstände im SRAM.
- Wenn gewünscht: kleine Auflage als Modul (Leerplatinen gibt es für Homebrew), Etikett im Taverne-Stil.
- Optional ein SNES-Hauptmenü im Stil der Taverne mit verkleinerten Wappen und Porträts.

## Grober Aufwand

| Stufe | Aufwand (Agent + Prüfung durch Cornelius) |
| --- | --- |
| 0 | 1–3 Sitzungen |
| 1 | 3–6 Sitzungen |
| 2 | je Spiel 1–2 Sitzungen, Bot-Feinschliff extra |
| 3 | je Spiel 1–2 Sitzungen |
| 4 | Kartenbaustein 3–5, je Spiel 1–3 Sitzungen |
| 5 | je Stichspiel 3–6, Schach 5–10 Sitzungen |

Die größten Unsicherheiten: die Geschwindigkeit des C-Compilers (Bots), die Lesbarkeit der Karten bei 256 × 224 auf einem Handy-Emulator und wie gut sich ein Emulator in der CI fernsteuern lässt. Geklärt in Stufe 0: über ein eigenes libretro-Frontend mit Snes9x und bsnes gut, Mesen nur von Hand.

## Recht und Lizenzen

- **Homebrew ist erlaubt.** Eigener Code und eigene Grafik, keine Nintendo-Logos, keine Bibliothek aus dem offiziellen Entwicklerkit. Das ROM-Kopffeld enthält nur unseren Titel. Der Name „Super Nintendo“ nur beschreibend („läuft auf dem SNES“).
- **Lizenz des ROMs:** Code AGPL-3.0 wie das Projekt, Inhalte CC BY-SA 4.0. PVSnesLib (MIT) und die Werkzeuge in `THIRD_PARTY.md` eintragen.
- **Klänge:** Die ElevenLabs-Dateien dürfen nicht ins öffentliche Repo – ein ROM verteilt sie öffentlich, also **nicht verwenden**. Eigene Chiptune-Stücke unter CC BY-SA 4.0 erstellen.
- **Gemalte Bilder:** Abgeleitete Fassungen (verkleinert, 16 Farben) wären CC BY-SA wie die Vorlagen; Originale bleiben im privaten Grafik-Repo.
- **Emulator im Browser:** EmulatorJS ist GPL, sein Snes9x-Kern nur nicht-kommerziell nutzbar. Für eine werbefreie, kostenlose Seite unproblematisch; eine Einbindung in die Web-App selbst würde ich trotzdem auf einer getrennten Unterseite halten.

## Offene Fragen an Cornelius

1. **Lohnt das Vorhaben überhaupt?** Es bindet viel Zeit, die sonst in die Web-App fließt, und bringt kaum neue Spieler – eher Freude und Aufmerksamkeit (Retro-Szene, itch.io, SNES-Jams).
2. ~~Eigenes Repo oder `apps/snes`?~~ Umgesetzt als `apps/snes` mit eigenem CI-Job (18.11.2026).
3. **Welche drei Spiele zuerst** nach Tic-Tac-Toe? Vorschlag: Vier in einer Reihe, Reversi, Würfelblock.
4. **Name des ROMs:** vorläufig „Brett & Blatt 16“.
5. **Echte Hardware** als Ziel oder nur Emulatoren?

## Issues

- Vorhaben [#515](https://github.com/ichthys2k/brett-und-blatt/issues/515) mit den Stufen 0–6.
- Stufe 0 und 1: [#516](https://github.com/ichthys2k/brett-und-blatt/issues/516).
- Stufe 2: [#518](https://github.com/ichthys2k/brett-und-blatt/issues/518).

## Quellen

- PVSnesLib: <https://github.com/alekmaul/pvsneslib> und Wiki <https://github.com/alekmaul/pvsneslib/wiki>
- libSFX: <https://github.com/Optiroc/libSFX>
- tcc-65816 (Compiler aus dem SNES-SDK): <https://git.applefritter.com/6502/tcc-65816>
- font8x8 (gemeinfrei): <https://github.com/dhepper/font8x8>
- Snes9x: <https://github.com/snes9xgit/snes9x>, bsnes für libretro: <https://github.com/libretro/bsnes>
- Erfahrungsbericht SNES-Entwicklung: <https://therealmjp.github.io/posts/adventures-in-retro-development-snes-edition>
- Celeste-Demake (nutzt Calypsi/VBCC): <https://john-smit.itch.io/celeste-snes-demake>
- Multitap: <https://snes.nesdev.org/wiki/Multitap>, Mesen-S und Multitap: <https://docs.libretro.com/library/mesen-s/>
- Mehrere Multitaps in Homebrew (N-Warp Daisakusen): <https://retropie.org.uk/forum/post/258415>
- EmulatorJS SNES: <https://emulatorjs.org/docs/systems/snes>, Snes9x-Lizenz: <https://ftp.netbsd.org/pub/NetBSD/NetBSD-current/pkgsrc/licenses/snes9x-license>
- Emulatoren-Übersicht: <https://emulation.gametechwiki.com/index.php/SNES_emulators>
