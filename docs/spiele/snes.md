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

**Stufe 3 umgesetzt (18.11.2026, #520):** acht Würfel-, Rechen- und Familienspiele – Teiler-Duell (`teiler.c`), Würfelblock (`kniffel.c`), Mäxle (`maexle.c`), Paare finden (`paare.c`), Nicht ärgern! (`ludo.c`), Domino (`domino.c`), Rechenmauer (`mauer.c`) und Zielzahl (`zielzahl.c`). 1–6 Spieler, Multitap für bis zu 5 Controller, Puffer in Bank $7F (`ram.asm`), Klänge für Würfeln und Start-Fanfare.

**Stufe 4 umgesetzt (18.11.2026, #522):** zehn Kartenspiele ohne Stiche (jetzt 25 Spiele im ROM):
- **Elf zuerst!** (`elevens.c`): Klondike-Ablage mit 11er-Paaren und JQK-Drillingen.
- **Solitaire** (`solitaire.c`): Klondike 1 und 3 Karten mit Talon, Hilfsstapeln und Fundamenten.
- **Mau-Mau** (`mau_mau.c`): 2–4 Spieler, 7er ziehen/stapeln, 8er aussetzen, Bube-Farbe wünschen, Ass extra.
- **Eins!** (`uno.c`): 2–4 Spieler, Farbkarten, Zieh-2, Richtungswechsel, Aussetzen, Farbwahl, Zieh-4.
- **Schwarzer Peter** (`peter.c`): 2–6 Spieler, Karten ziehen, Paare ablegen, Peter vermeiden.
- **Quartett** (`quartett.c`): 2–6 Spieler, gezieltes Erfragen von Kartenwerten bei Mitspielern.
- **Präsident** (`president.c`): 3–6 Spieler, Rangfolgen (Präsident bis Bettler), Kartentausch, Pasch, Revolution und Super-Revolution.
- **Speed** (`speed.c`): 2 Spieler in Echtzeit über zwei Controller gleichzeitig, Hand auffüllen, Ablegen bei ±1 Wert, gleichzeitiges Ziehen bei Blockade.
- **Kartenblitz** (`ligretto.c`): 2–4 Spieler in Echtzeit (Ligretto), Stapel 1–10 aufsteigend auf der Tischmitte, Hand/Ablagestapel, Ligretto-Ruf bei leerem Ligretto-Stapel.
- **Poker** (`poker.c`): Texas Hold'em (No Limit, Fixed Limit, Pot Limit, Sit&Go-Turnier bis 6 Spieler), 7-Karten-Bewerter, Split Pots, Side Pots, Bots mit Chen-Score und aggressiver Postflop-Einschätzung.
- Gemeinsamer Kartenbaustein `src/karten.c` / `karten.h` und Klang `KLANG_KARTE`.
- Alle 10 Spiele mit 100 % grünem Regel- und Bot-Vergleich in `regeln.test.ts` und `bots.test.ts`.

**Stufe 5, Stufe 6 und 20 Soundtracks umgesetzt (18.11.2026, #524, #527):** Alle 31 Spiele (inkl. Skat, Schafkopf, Doppelkopf, Binokel, Schach, Go) im 1-MB-LoROM mit 32-Spiele-SRAM, Kategorien-Filter, L/R-Blättern sowie **20 eigens komponierten SNESMod-Soundtracks** (`apps/snes/werkzeuge/musik.mjs`) in den vier Stimmungen *Denkraum*, *Kartentisch*, *Patience* und *Spielabend* (je 5 Stücke), automatischer Stimmungszuordnung je Spiel, **Musikbox** im Hauptmenü und Musik-Steuerung im Pausenmenü.

**Dynamische Spiel-Grafik, Battle Chess und Grafikpakete 2–4 umgesetzt (19.11.2026):** Spiele laden beim Start eigene 4bpp-Hintergrundkacheln (`0x100..0x3FF`) und OAM-Sprites (`0x4000`) ins VRAM. **Battle Chess** (`schach_grafik.mjs`, `chess.c`) füllt den Bildschirm mit einem 8×8-Holzbrett (24×24 px je Feld) und sechs pixelanimierten 32×32-Figuren (× 4 Posen) samt animierten Kampfduellen auf dem Schlagfeld. Alle **14 Kartenspiele** (`karten_grafik.mjs`, `karten.c`, `uno.c`, `peter.c`) zeigen 24×16-Bildkarten (Bube/Dame/König), Schmuck-Asse, Filigran-Rücken, Eins!-Aktionssymbole und Schwarzer-Peter-Motive. **Go**, **Domino** und **Mäxle** (`brett_grafik.mjs`) nutzen ein Kaya-Holzbrett mit glänzenden Steinen, Elfenbein-Dominosteine mit Augenpunkten und einen Sattelleder-Würfelbecher.

**Zu prüfen (Cornelius):** das ROM aus dem CI-Artefakt „brett-und-blatt-16“ in Mesen oder RetroArch öffnen, Battle Chess, die neuen Karten-, Go-, Domino- und Mäxle-Grafiken sowie die Musikbox ausprobieren.

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
  - **Umgesetzt als Easter Egg (20.11.2026, #596):** Siebenmal aufs Logo im Hauptmenü tippen startet das ROM mit EmulatorJS im Browser; Einzelheiten in `docs/CHRONIK.md`.

### Stufe 3 – Würfel und Familie (mittel) – erledigt (#520)

- Acht Würfel-, Rechen- und Familienspiele: Teiler-Duell (`teiler.c`), Würfelblock (`kniffel.c`), Mäxle (`maexle.c`), Paare finden (`paare.c`, Sets Tiere/Einmaleins/Englisch, Raster bis 30), Nicht ärgern! (`ludo.c`, Kreuz und Stern), Domino (`domino.c`, Ziehen/Block/Fünfer/Spinner/Teams), Rechenmauer (`mauer.c`, Addition und Multiplikation) und Zielzahl (`zielzahl.c`, Klassisch 24).
- Unterbau: 1 bis 6 Plätze mit Spielerwahl, Controller 1–5 (Super Multitap), `Spiel.zusatz` (Zusatzzüge), `Spiel.erlaubt` (freie Rechnungen wie `isLegal`), `karte_unten` (Kachelkarte auf Ebene 2 unter der Schrift), Puffer in Bank $7F (`ram.asm`).
- ROM-Größe auf 512 KB (16 Bänke LoROM) erweitert, um allen 15 Spielen und künftigen Stufen Platz zu geben.
- Klänge erweitert um Würfeln (`KLANG_WUERFELN`, klackernde Würfel im Becher/auf Filz) und Anfangs-Fanfare (`KLANG_START`); Tracker-Hintergrundstücke (.it) für spätere Stufe vorgemerkt.
- Alle 8 Spiele mit 100% grünem Regelvergleich (`regeln.test.ts`) gegen das jeweilige TypeScript-Modul und Bot-Prüfung (`bots.test.ts`).

### Stufe 4 – Karten ohne Stiche (mittel bis groß) – erledigt (#522)

- Kartenbaustein: Französisches Blatt (Kreuz, Pik, Herz, Karo, 1..13), Eins!-Karten (4 Farben, Aktionen), Tier-Quartette, Ablagen, Fächer und Hilfsstapel.
- Zehn Kartenspiele umgesetzt und getestet: Solitaire, Elf zuerst!, Mau-Mau, Eins!, Schwarzer Peter, Quartett, Präsident, Speed, Kartenblitz, Poker.
- Wechselbildschirm für verdeckte Hände im Hot-Seat; Echtzeit-Handling für Speed und Kartenblitz über zwei Controller gleichzeitig (`eingabe_spieler(p)`).
- Poker (Texas Hold'em) mit Hand-Bewerter (High Card bis Royal Flush), Split Pots, Side Pots, No Limit/Fixed Limit/Pot Limit/Turnier bis 6 Spieler und Chen-Score-Bot.
- Neuer Klang: `KLANG_KARTE` (Kartenabwurf/Kartenziehen).
- Alle 10 Spiele Zug für Zug gegen TypeScript-Module geprüft (`regeln.test.ts`, 25 Spiele gesamt grün).

### Stufe 5 – Stichspiele und Schach (groß) – erledigt (#524)

- Sechs anspruchsvolle Klassiker im ROM (jetzt 31 Spiele gesamt): Skat (`skat.c`), Schafkopf (`schafkopf.c`), Doppelkopf (`doppelkopf.c`), Binokel (`binokel.c`), Schach (`chess.c`), Go 9×9 (`go.c`).
- Neuer Stichspiel-Motor `src/stich.h` / `src/stich.c`: flexibles Reizen/Ansagen (Skat-Reizwerte, Schafkopf-Spiele, Doko-Ansagen Re/Kontra/Keine 90 etc., Binokel-Melden und -Runden), Vorstich- und Fehlfarben-Auswertung, Augenzählung, Schmierkarten-Logik und Heuristik-Bots.
- Schach (`chess.c`): 0x88-Brett-Repräsentation, vollständige Zuggenerierung (inkl. Rochade, En Passant, Bauernumwandlung, Schach/Matt/Patt und 50-Züge-Regel), Minimax-Suche mit Alpha-Beta-Pruning.
- Go (`go.c`): 9×9-Brett, Freiheiten-Zählung mit Flutfüllung (Puffer in Bank $7F ausgelagert, um 816-tcc-Stack-Grenzen einzuhalten), Superko-Historie, automatisches Auszählen (Area Scoring / Tromp-Taylor) nach zweimal Passen.
- ROM-Größe im `Makefile` auf 1 MB (32 Bänke LoROM, `ROMSIZE := 0a`, `ROMBANKS := 32`, `brett-und-blatt-16.sfc`) erweitert.
- Alle 6 Spiele mit 100 % grünem Schiedsrichter- und Bot-Vergleich in `apps/snes/test/regeln.test.ts` und `bots.test.ts`.

### Stufe 6 – Feinschliff und echte Hardware – erledigt (#527)

- **SRAM-Erweiterung:** `SPEICHER_SPIELE` in `src/speicher.h` von 16 auf 32 angehoben (712 Bytes mit Kennung `BB16`, Version 2 und Prüfsumme im 2-KB-Batteriespeicher), sodass alle 31 Spiele eigene Statistiken führen und beim Kaltstart sauber initialisiert werden.
- **Menüführung:** Schnelles seitenweises Blättern mit `L` und `R` im Hauptmenü (mit Seitenanzeige `Seite 1/2`) und in der Statistik; Kategorien-Filter über `◀`/`▶` (*Alle*, *Brettspiele*, *Würfel & Familie*, *Kartenspiele*, *Stich- & Denksport*).
- **Feinschliff & Hardware:** Versionsangabe auf **Version 1.0** angehoben, 1-MB-LoROM-Konfiguration (`ROMSIZE 0a`, `SRAMSIZE 01`, `CARTRIDGETYPE 02`) und Hardware-Hinweise (FXPak Pro, SD2SNES, Super Everdrive) in `apps/snes/README.md` dokumentiert.
- Test auf echtem SNES mit Flash-Modul (FXPak Pro oder Everdrive) durch Cornelius ausstehend.

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
- Stufe 3: [#520](https://github.com/ichthys2k/brett-und-blatt/issues/520).
- Stufe 4: [#522](https://github.com/ichthys2k/brett-und-blatt/issues/522).
- Stufe 5: [#524](https://github.com/ichthys2k/brett-und-blatt/issues/524).
- Stufe 6: [#527](https://github.com/ichthys2k/brett-und-blatt/issues/527).

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
