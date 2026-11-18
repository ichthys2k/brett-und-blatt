# Brett & Blatt 16 – SNES-ROM

Eine Auswahl der Spiele als Super-Nintendo-ROM für Emulatoren (Snes9x, bsnes, Mesen, RetroArch) und echte Hardware mit Flash-Modul. Kein Port, sondern ein Nachbau in C mit [PVSnesLib](https://github.com/alekmaul/pvsneslib); die TypeScript-Spielmodule der Web-App sind der Schiedsrichter in den Tests. Plan und Stand: [`docs/spiele/snes.md`](../../docs/spiele/snes.md), Vorhaben #515, Stufe 0 und 1: #516.

**Stand (Stufe 1):** Titel, Hauptmenü, Spielvorbereitung (Mensch an Controller 1 oder 2, Bot in drei Stufen, Serien aus 1/3/5 Partien, Seitentausch), Anleitung, Pause, Ergebnis, Statistik im Batteriespeicher, Klänge. Ein Spiel: **Tic-Tac-Toe**.

## Bauen

Einmal je Rechner die Werkzeugkette holen und bauen (etwa eine Minute; landet in `~/.cache/brett-und-blatt-snes`, braucht git, make, gcc/g++ und Node):

```bash
eval "$(apps/snes/werkzeuge/werkzeugkette.sh)"
```

Dann das ROM:

```bash
make -C apps/snes
```

Ergebnis: `apps/snes/brett-und-blatt-16.sfc` (256 KB, LoROM, 2 KB SRAM). Das ROM lässt sich in jedem SNES-Emulator öffnen; Controller 1 und 2 sind die ersten beiden Eingabegeräte.

## Prüfen

```bash
corepack pnpm exec vitest run apps/snes --disable-console-intercept
```

Braucht die Umgebungsvariablen aus `werkzeugkette.sh` (sonst werden die Prüfungen übersprungen). Mit `SNES_BILDER=<ordner>` entstehen Bildschirmfotos. Die CI (Job „SNES-ROM bauen und prüfen“) macht dasselbe und legt ROM und Fotos als Artefakt ab.

Die Prüfungen:

- **Zufall:** cyrb128 und sfc32 liefern für dieselben Startwerte dieselben Zahlen wie `packages/engine/src/random.ts`, auch `Rng.int`.
- **Regeln:** 300 Zufallspartien Tic-Tac-Toe Zug für Zug gegen `packages/games/tic-tac-toe` (Stand, erlaubte Züge, Ergebnis, Gewinnreihe), dazu Proben unerlaubter Züge.
- **Bot:** Jede Stufe zieht erlaubt; „schwer“ wählt immer einen bestmöglichen Zug, rechnet höchstens eine Sekunde und verliert gegen keine einzige Zugfolge des Gegners.
- **Bedienung:** Titel mit Umlauten und Klang, Menü, eine Partie zu zweit mit zwei Controllern bis zum Sieg, Statistik im SRAM, auch nach einem Neustart.
- **bsnes:** Dieselben Knopfdrücke ergeben in bsnes dieselben Bilder wie in Snes9x (bsnes gibt über libretro keinen Speicher frei, deshalb nur der Bildvergleich).

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/main.c` | Rahmen: Titel, Menüs, Vorbereitung, Partie, Ergebnis, Statistik |
| `src/spiel.h` | Spielschnittstelle (schlanke C-Fassung von `GameModule`) |
| `src/tic_tac_toe.c` | Regeln, Bot, Darstellung von Tic-Tac-Toe |
| `src/bild.c` | Zwei Hintergrundebenen, Text in UTF-8 mit Umlauten, Tafeln, Übertragung im Bildwechsel |
| `src/eingabe.c` | Knöpfe mit Wiederholung des Steuerkreuzes |
| `src/zufall.c` | cyrb128 und sfc32 wie in der Web-App |
| `src/speicher.c` | Statistik im SRAM mit Kennung und Prüfsumme |
| `src/klang.c` | Klangeffekte (BRR-Samples) über SNESMod |
| `src/pruef.c` | Prüfmodus: Postfach im Arbeitsspeicher für die Tests |
| `werkzeuge/grafik.mjs` | Erzeugt Schrift, Rahmen, Filz, Spielbrett und Titel als Kacheln aus Formeln |
| `werkzeuge/klang.mjs` | Erzeugt die Klangeffekte aus Formeln |
| `werkzeuge/schrift8x8.mjs` | 8×8-Glyphen aus font8x8 (gemeinfrei) |
| `werkzeuge/emu/emu.c` | Prüf-Emulator: libretro-Frontend ohne Fenster |
| `werkzeuge/werkzeugkette.sh` | Holt und baut PVSnesLib 4.7.1, Snes9x 1.63, bsnes und den Prüf-Emulator |
| `test/` | Prüfungen (Vitest) und die Steuerung des Prüf-Emulators |

Grafik und Klänge entstehen beim Bauen; im Repo liegen nur die Erzeuger. Es gibt keine Bilder oder Klänge aus den privaten Repos im ROM.

## Ein neues Spiel anlegen

1. `src/<spiel>.c` mit einem `const Spiel spiel_<id>` nach dem Muster von `tic_tac_toe.c`: Regeln (`aufbauen`, `am_zug`, `zuege`, `ziehen`, `ergebnis`), `bot`, `ausgeben` für den Prüfmodus und die Oberfläche (`zeichnen`, `bedienen`).
2. In `spiel.h` deklarieren, `SPIELE_ANZAHL` erhöhen und in `main.c` in `spiele[]` und ins Hauptmenü eintragen.
3. Kacheln in `werkzeuge/grafik.mjs` ergänzen.
4. In `test/snes.test.ts` Zufallspartien gegen das TypeScript-Modul spielen lassen (Auszug wie bei Tic-Tac-Toe).

## Stolpersteine (816-tcc und PVSnesLib)

- **Variablen ohne Startwert sind nicht null:** Der Startcode von PVSnesLib löscht nur den Variablenbereich der ersten Quelldatei. Jede Datei setzt ihre Variablen deshalb selbst (`variablen_start` in `main.c`, `eingabe_start`, `pruef_start`). Auf echter Hardware steht dort Zufall, im Emulator oft `0x55`.
- **Rückgabe über Funktionszeiger:** `feld[0] = spiel->ergebnis(…)` verlor den Wert. Ergebnisse von Aufrufen über Funktionszeiger erst in eine lokale Variable schreiben.
- **Zweidimensionale `char`-Felder** wie `{"1", "3", "5"}` als `char[3][2]` lieferten Müll; Felder von Zeigern (`const char *const x[]`) gehen.
- **Klänge:** `spcPlaySound(i)` liest den Eintrag `i` ab dem *zuletzt* eingetragenen Sample vorwärts. Darum die Samples rückwärts eintragen. Tonhöhe `n` heißt `n × 2 kHz`; die 16-kHz-Samples brauchen 8.
- **Geschwindigkeit:** Der 65816 mit 816-tcc ist langsam. Die volle Suche für die zweite Antwort im Tic-Tac-Toe brauchte sieben Sekunden; mit Bitmasken, Zugreihenfolge und einer Eröffnungsregel sind es höchstens 0,7 Sekunden.
- **Bildwechsel:** Beide Kachelkarten (je 2 KB) werden nur übertragen, wenn sie sich geändert haben.
