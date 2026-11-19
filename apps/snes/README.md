# Brett & Blatt 16 – SNES-ROM

Eine Auswahl der Spiele als Super-Nintendo-ROM für Emulatoren (Snes9x, bsnes, Mesen, RetroArch) und echte Hardware mit Flash-Modul (FXPak Pro, SD2SNES, Super Everdrive). Kein Port, sondern ein Nachbau in C mit [PVSnesLib](https://github.com/alekmaul/pvsneslib); die TypeScript-Spielmodule der Web-App sind der Schiedsrichter in den Tests. Plan und Stand: [`docs/spiele/snes.md`](../../docs/spiele/snes.md), Vorhaben #515, Stufen 0–6: #516, #518, #520, #522, #524, #527.

**Stand (Version 1.0 · Stufe 6):** Titel, Hauptmenü mit **Kategorien-Filter** (Alle, Brettspiele, Würfel & Familie, Kartenspiele, Stich- & Denksport über `◀`/`▶`) und **seitenweisem Blättern** (`L`/`R`), Spielvorbereitung (1–6 Plätze, Mensch an Controller 1–5 mit Multitap, Bot in drei Stufen, Serien aus 1/3/5 Partien, Seitentausch, Spieloptionen), Anleitung, Pause, Ergebnis, Statistik für alle 31 Spiele im batteriegepufferten 2-KB-SRAM, sieben Klangeffekte. Einunddreißig Spiele: **Tic-Tac-Toe, Vier in einer Reihe** (alle Brettgrößen, PopOut), **Reversi** (6/8/10, freie Eröffnung), **Gomoku, Ultimate Tic-Tac-Toe** (beide Varianten), **Mühle** (alle Optionen), **Dame** (Deutsch, International, Englisch; 8 × 8 und 10 × 10), **Teiler-Duell** (Steuer- und Kettenspiel), **Würfelblock** (1–6 Spieler), **Mäxle** (2–6 Spieler, normal/blind/Strafpunkte), **Paare finden** (1–6 Spieler, bis 30 Paare, 32 Tiermotive), **Nicht ärgern!** (Kreuz- und Sternplan, bis 6 Spieler), **Domino** (Ziehen, Block, Fünfer, Spinner, Teams), **Rechenmauer** (3–4 Stufen, Addition und Multiplikation), **Zielzahl** (Klassisch 24), **Elf zuerst!** (Klondike-Ablage mit 11er-Paaren und JQK), **Solitaire** (Klondike 1 und 3 Karten), **Mau-Mau** (2–4 Spieler, Strafkarten stapeln, Bube auf Bube, Ziehen bis passend, Ass extra), **Eins!** (2–4 Spieler, Zieh-2, Richtungswechsel, Aussetzen, Farbwahl, Zieh-4), **Schwarzer Peter** (2–6 Spieler), **Quartett** (2–6 Spieler, Quartette aus vier Werten), **Präsident** (3–6 Spieler, Revolution, Super-Revolution, Pasch), **Speed** (2 Spieler, Echtzeit an getrennten Controllern), **Kartenblitz** (2–4 Spieler, Ligretto-Regeln in Echtzeit), **Poker** (Texas Hold'em: No Limit, Fixed Limit, Pot Limit, Turnier bis 6 Spieler), **Skat** (3 Spieler, Reizen, Grand, Farbe, Null), **Schafkopf** (4 Spieler, Sauspiel, Wenz, Farbsolo), **Doppelkopf** (4 Spieler, Re/Kontra, Ansagen), **Binokel** (3–4 Spieler, Reizen, Melden, Dabb), **Schach** (vollständige Regeln, Alpha-Beta-Bot) und **Go** (9 × 9, Tromp-Taylor-Wertung).

## Bauen

Einmal je Rechner die Werkzeugkette holen und bauen (etwa eine Minute; landet in `~/.cache/brett-und-blatt-snes`, braucht git, make, gcc/g++ und Node):

```bash
eval "$(apps/snes/werkzeuge/werkzeugkette.sh)"
```

Dann das ROM:

```bash
make -C apps/snes
```

Ergebnis: `apps/snes/brett-und-blatt-16.sfc` (**1 MB**, 32 Bänke LoROM, 2 KB batteriegepuffertes SRAM, `CARTRIDGETYPE 02`, `SRAMSIZE 01`, `ROMSIZE 0a`).

## Echte Hardware und Emulatoren

- **Emulatoren:** Snes9x, bsnes, Mesen 2 und RetroArch (PAL und NTSC). Controller 1 und 2 sind die ersten beiden Eingabegeräte, bis zu 5 Controller über Multitap (Super Multitap / MultiPlayer 5).
- **Flash-Module (FXPak Pro / SD2SNES, Super Everdrive):** `brett-und-blatt-16.sfc` direkt auf die SD-Karte kopieren. Das ROM nutzt Standard-LoROM ohne Zusatzchips und 2 KB batteriegepuffertes SRAM (`BB16`, Version 2, mit Prüfsumme); beim ersten Start oder leerer Batterie wird das SRAM automatisch sauber initialisiert.
- **Bedienung im Hauptmenü:** `▲`/`▼` Eintrag wählen, `◀`/`▶` Kategorie wechseln, `L`/`R` seitenweise blättern (auch in der Statistik), `A`/`Start` öffnen, `B` zurück zum Titel.

## Prüfen

```bash
corepack pnpm exec vitest run apps/snes --disable-console-intercept
```

Braucht die Umgebungsvariablen aus `werkzeugkette.sh` (sonst werden die Prüfungen übersprungen). Mit `SNES_BILDER=<ordner>` entstehen Bildschirmfotos. Die CI (Job „SNES-ROM bauen und prüfen“) macht dasselbe und legt ROM und Fotos als Artefakt ab.

Die Prüfungen:

- **Zufall** (`snes.test.ts`): cyrb128 und sfc32 liefern für dieselben Startwerte dieselben Zahlen wie `packages/engine/src/random.ts`, auch `Rng.int`.
- **Regeln** (`regeln.test.ts`): Jedes Spiel spielt in jeder geprüften Optionskombination Zufallspartien Zug für Zug gegen sein TypeScript-Modul. Nach jedem Zug müssen Ergebnis, Platz am Zug, die erlaubten Züge (als Menge) und der Spielstand gleich sein; verfälschte Züge werden abgelehnt. Die Übersetzung von Zügen und Stand steht je Spiel in `test/spiele/<spiel>.ts`. Mit `SNES_SPIELE=reversi,mill` nur einzelne Spiele.
- **Bots** (`bots.test.ts`): Jede Stufe zieht erlaubt und bleibt im Zeitbudget (höchstens etwa 2,5 Sekunden); „schwer“ schlägt einen Zufallsspieler fast immer. Für Tic-Tac-Toe zusätzlich: „schwer“ zieht immer bestmöglich und verliert gegen keine Zugfolge.
- **Bedienung:** Titel mit Umlauten und Klang, Menü, eine Partie zu zweit mit zwei Controllern bis zum Sieg, Statistik im SRAM, auch nach einem Neustart.
- **bsnes:** Dieselben Knopfdrücke ergeben in bsnes dieselben Bilder wie in Snes9x (bsnes gibt über libretro keinen Speicher frei, deshalb nur der Bildvergleich).

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/main.c` | Rahmen: Titel, Menüs, Vorbereitung, Partie, Ergebnis, Statistik |
| `src/spiel.h` | Spielschnittstelle (schlanke C-Fassung von `GameModule`) |
| `src/karten.c`, `karten.h` | Gemeinsamer Kartenbaustein: Kartensymbole, Werte, Farben, Ziehen und Stapel |
| `src/tic_tac_toe.c`, `vier.c`, `reversi.c`, `gomoku.c`, `uttt.c`, `muehle.c`, `dame.c`, `teiler.c`, `kniffel.c`, `maexle.c`, `paare.c`, `ludo.c`, `domino.c`, `mauer.c`, `zielzahl.c` | Regeln, Bot und Darstellung der Brett- und Familienspiele |
| `src/elevens.c`, `solitaire.c`, `mau_mau.c`, `uno.c`, `peter.c`, `quartett.c`, `president.c`, `speed.c`, `ligretto.c`, `poker.c` | Regeln, Bot und Darstellung der Kartenspiele |
| `src/bild.c` | Zwei Hintergrundebenen, dynamisches Nachladen von Spiel-Kacheln (`0x100..0x3FF`) und OAM-Hardware-Sprites (`VRAM_OBJ = 0x4000`), Bildschirm-Wackeln, UTF-8-Text, Tafeln |
| `src/eingabe.c` | Knöpfe mit Wiederholung des Steuerkreuzes |
| `src/zufall.c` | cyrb128 und sfc32 wie in der Web-App |
| `src/speicher.c` | Statistik im SRAM mit Kennung und Prüfsumme |
| `src/klang.c` | Klangeffekte (7 BRR-Samples) und 20 Hintergrund-Soundtracks in 4 Stimmungen über SNESMod |
| `src/pruef.c` | Prüfmodus: Postfach im Arbeitsspeicher für die Tests |
| `werkzeuge/grafik.mjs` | Erzeugt Schrift, Rahmen, Filz, Spielbrett und Titel als Kacheln aus Formeln |
| `werkzeuge/schach_grafik.mjs` | Erzeugt das 24×24-Holzbrett und 6 pixelanimierte 32×32-Battle-Chess-Figuren (× 4 Posen) plus Kampfeffekte |
| `werkzeuge/klang.mjs` | Erzeugt die Klangeffekte aus Formeln |
| `werkzeuge/musik.mjs` | Erzeugt 20 mehrstimmige Impulse-Tracker-Soundtracks (`.it`) in 4 Stimmungen (Denkraum, Kartentisch, Patience, Spielabend) |
| `werkzeuge/schrift8x8.mjs` | 8×8-Glyphen aus font8x8 (gemeinfrei) |
| `werkzeuge/emu/emu.c` | Prüf-Emulator: libretro-Frontend ohne Fenster |
| `werkzeuge/werkzeugkette.sh` | Holt und baut PVSnesLib 4.7.1, Snes9x 1.63, bsnes und den Prüf-Emulator |
| `test/` | Prüfungen (Vitest), Steuerung des Prüf-Emulators (`emu.ts`) und des Prüfmodus (`pruefmodus.ts`), Adapter je Spiel (`spiele/`) |

Grafik und Klänge entstehen beim Bauen; im Repo liegen nur die Erzeuger. Es gibt keine Bilder oder Klänge aus den privaten Repos im ROM.

## Ein neues Spiel anlegen

1. `src/<spiel>.c` mit einem `const Spiel spiel_<id>` nach dem Muster der vorhandenen Spiele:
   - Regeln: `aufbauen` (mit Optionen), `am_zug`, `zuege`, `ziehen`, `ergebnis`.
   - Ein Zug ist eine kurze Bytefolge (`Zug`), deren Form das Spiel festlegt.
   - Dazu `bot`, `ausgeben` für den Prüfmodus und die Oberfläche: `gitter`, `feld_an`, `felder` (die Felderfolge, mit der man einen Zug wählt) und `zeichnen`.
2. In `spiel.h` deklarieren, `SPIELE_ANZAHL` erhöhen und in `main.c` in `spiele[]` eintragen. Hauptmenü und Statistik übernehmen das Spiel von selbst.
3. Bilder und drei Brettpaletten in `werkzeuge/grafik.mjs` ergänzen (`karte(…)`, `farben(…)`).
4. Einen Adapter `test/spiele/<spiel>.ts` schreiben und in `test/spiele/alle.ts` eintragen. Er übersetzt Züge und Stand der Web-App in die Bytes des ROMs.

## Stolpersteine (816-tcc und PVSnesLib)

- **Variablen ohne Startwert sind nicht null:** Der Startcode von PVSnesLib löscht nur den Variablenbereich der ersten Quelldatei. Jede Datei setzt ihre Variablen deshalb selbst (`variablen_start` in `main.c`, `eingabe_start`, `pruef_start`). Auf echter Hardware steht dort Zufall, im Emulator oft `0x55`.
- **Rückgabe über Funktionszeiger:** `feld[0] = spiel->ergebnis(…)` verlor den Wert. Ergebnisse von Aufrufen über Funktionszeiger erst in eine lokale Variable schreiben.
- **Funktionsaufrufe in `&&` und `||`:** `if (a || !f(…))` übersetzte 816-tcc falsch (Reversi listete besetzte Felder als erlaubt). Solche Bedingungen in getrennte `if` aufteilen.
- **Compilerabsturz „ICE 2“** bei `s->feld[f(…)] = …`: den Index erst in eine lokale Variable schreiben.
- **Zweidimensionale `char`-Felder** wie `{"1", "3", "5"}` als `char[3][2]` lieferten Müll; Felder von Zeigern (`const char *const x[]`) gehen.
- **Klänge:** `spcPlaySound(i)` liest den Eintrag `i` ab dem *zuletzt* eingetragenen Sample vorwärts. Darum die Samples rückwärts eintragen. Tonhöhe `n` heißt `n × 2 kHz`, wobei `digi_rates[]` in PVSnesLib nur `1..6` (bis 12 kHz) kennt – höhere Werte lesen außerhalb der Tabelle und lassen kurze Effekte in einer Endlosschleife hängen.
- **Geschwindigkeit:** Der 65816 mit 816-tcc ist langsam. Die volle Suche für die zweite Antwort im Tic-Tac-Toe brauchte sieben Sekunden; mit Bitmasken, Zugreihenfolge und einer Eröffnungsregel sind es höchstens 0,7 Sekunden.
- **Bildwechsel:** Beide Kachelkarten (je 2 KB) werden nur übertragen, wenn sie sich geändert haben. Die Paletten kommen zuerst: CGRAM darf nur in der Austastlücke beschrieben werden.
- **Bots:** Alle Suchen arbeiten mit wachsender Tiefe und einem Zeitbudget in Bildern (`BILDER()`); die Bewertung wird möglichst nachgeführt statt neu berechnet (Vier in einer Reihe). Große Zuglisten je Suchtiefe kosten viel Arbeitsspeicher – darum sind sie in Mühle und Dame begrenzt.
- **32-Bit-Werte (s32/u32):** Vergleiche mit `s32` innerhalb von `&&`/`||` (auch im `for`-Kopf) übersetzt 816-tcc falsch – in einzelne `if` aufteilen (Rechenmauer). Ein `s8`-Wert wird bei `(s32)` nicht richtig erweitert. Schiebe um eine Variable (`v >> (j * 8)`) braucht eine fehlende Hilfsroutine (`tcc__lshrdi3`); feste Schiebeweiten gehen.
- **Feldindex aus Funktionsaufruf:** `a[f(x)] = …` und `x = a[f(y)]` führen zu „ICE 2“ – Index erst in eine Variable.
- **Zuweisung an Zeiger/Array aus Funktionsaufruf (Stack-Displacement-Bug):** In `ptr->arr[0] = func(...)` berechnet 816-tcc die Zieladresse, schiebt sie auf den Stack, pusht Argumente, ruft `func` auf und stellt den Stack wieder her, adressiert die gespeicherte Zieladresse aber mit einem Versatz-Fehler (`sta -36 ... lda -40`). Daher Rückgabewerte komplexer Funktionsaufrufe immer erst in einer lokalen Variable zwischenspeichern (`u8 v = func(...); ptr->arr[0] = v;`).
- **Stack-Begrenzung 255 Byte:** Große lokale Felder (z. B. `Zug liste[16]` = 384 Bytes) auf dem Stack sprengen den 8-Bit-Stackframe von `wla-65816` (`INPUT_NUMBER: Out of 8-bit range`). Solche Felder gehören in den globalen Pufferbereich (`zugliste` in Bank $7F) statt auf den Stack.
- **Wiederholungsregeln** (Vier in einer Reihe mit PopOut, Mühle, Dame): Die Liste der Stellungen wird nach jedem unumkehrbaren Zug (Schlagen, Steinzug) geleert – frühere Stellungen können nie wiederkehren, so bleibt die Liste kurz und die Regel trotzdem genau.
- **ROM-Größe und wlalink-Bänke:** Standardmäßig legt `snes_rules` 256 KB LoROM (8 Bänke zu 32 KB) fest. Mit 15 Spielen passten die superfreien Funktionsabschnitte nicht mehr in Bank 0 (`INSERT_SECTIONS: No room for section…`). Das `Makefile` exportiert darum `ROMSIZE := 09` und `ROMBANKS := 16` für 512 KB (16 Bänke LoROM).
- **Große Puffer in Bank $7F (`ram.asm`):** Spielstand (`spielstand`), Zugliste (`zugliste`) und große Zwischenspeicher wie `ziel_kandidaten` (für die Kandidatensuche in Zielzahl) liegen im oberen 64-KB-Arbeitsspeicher in Bank $7F, um den normalen Nullseiten-/Direktseiten-RAM frei zu halten.
