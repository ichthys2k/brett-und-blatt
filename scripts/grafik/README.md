# Bilderzeugung (scripts/grafik)

Ablauf für gemalte Bilder (Porträts, Tierkarten, Illustrationen); Symbole, Figuren und Icons schreibt man besser direkt als SVG.

1. Manifest anlegen oder ergänzen: `scripts/grafik/manifeste/<name>.json` (Stil-Kopf, Referenzbilder, Motive, Zielordner, Größe).
2. Schlüssel setzen (nie ins Repo): `set -x GEMINI_API_KEY …` (fish). Modelle und Quote prüfen: `node scripts/grafik/erzeugen.mjs --modelle`.
3. Varianten erzeugen (setzt nach Abbruch fort, wartet bei Limits): `node scripts/grafik/erzeugen.mjs scripts/grafik/manifeste/bildkarten.json`.
4. Auswählen: `node scripts/grafik/kontaktbogen.mjs <Manifest>`, dann `grafik-roh/<name>/kontaktbogen.html` im Browser öffnen, anklicken, die unten erzeugte Zeile ausführen (`uebernehmen.mjs`, braucht ImageMagick).
5. Gewählte Bilder landen als WebP im Zielordner. Das **Original in voller Auflösung** legt `uebernehmen.mjs` ins **private Repo** `ichthys2k/brett-und-blatt-grafik` (`../brett-und-blatt-grafik/originale/<Zielordner>/<name>.png`, anderer Ort mit `GRAFIK_ORIGINALE_DIR`); fehlt es, bricht das Skript ab. Nie ein Ordner `original/` im öffentlichen Repo. Im privaten Repo committen und pushen; Quelle und Kennzeichnung als KI-Bild in `THIRD_PARTY.md` ergänzen.

Stil, Verbote, Kartenregeln und Referenzbilder: [`docs/grafik/STILBIBEL.md`](../../docs/grafik/STILBIBEL.md). Ablauf für Antigravity (eingebautes Bildwerkzeug statt API): [`.agent/workflows/grafik-erzeugen.md`](../../.agent/workflows/grafik-erzeugen.md).

## Skripte

| Skript | Zweck |
|---|---|
| `erzeugen.mjs <Manifest>` | Varianten über die Gemini-API erzeugen (braucht `GEMINI_API_KEY`) |
| `kontaktbogen.mjs <Manifest>` | Auswahlseite `grafik-roh/<name>/kontaktbogen.html` bauen |
| `uebernehmen.mjs <Manifest> <id>=<v> …` | WebP schreiben, bei `"freistellen": true` grünen Grund entfernen (`--fuzz=<Prozent>`, Standard 22), Original ins private Repo; ImageMagick 6 (`convert`) oder 7 (`magick`) |
| `originale-pruefen.mjs [--alle]` | WebP ohne Original melden (Altfälle in `originale-fehlen.json`); nicht in der CI |
| `bestand.mjs` | `docs/grafik/BESTAND.md` neu erzeugen |

## Manifeste für das Vorhaben „Taverne überall“ (#306)

Für die Grafik-Pakete G2 bis G10 und G12 liegen fertige Manifeste in `scripts/grafik/manifeste/` (Stand 12.11.2026, noch keine Bilder erzeugt). Sie sind die **maßgebliche Motivliste**; die Issues nennen dieselben Prompts im Klartext.

| Paket | Issue | Manifest(e) |
|---|---|---|
| G2 Drachenspiel-Karten | #309 | `drachenspiel-karten.json` (alle Karten aus `CARDS_DB`) |
| G3 Bot-Porträts | #311 | `bots.json` |
| G4 Avatare | #312 | `avatare.json` |
| G5 Tischflächen | #313 | `tische.json` |
| G6 Kartenrücken | #314 | `kartenruecken.json` |
| G7 Siegerehrung und Pass | #315 | `ehrung.json` |
| G8 Kulissen | #316 | `kulissen-spiele.json` |
| G9 Spielteile | #318 | `grafschaft-land.json`, `grafschaft-auftraege.json`, `marktstaende-waren.json`, `marktstaende-staende.json`, `ruebenacker-teile.json`, `ruebenacker-karten.json` |
| G9a Quartett | #319 | `quartett-tiere.json`, `quartett-dinosaurier.json`, `quartett-weltraum.json`, `quartett-bibel.json` |
| G10 Hauptmenü | #317 | `menue-stationen.json`, `menue-licht.json` |
| G12 Spielfiguren der Brettspiele | #325 | `figuren-<spiel>.json` für `chess`, `four-player-chess`, `checkers`, `mill`, `go`, `reversi`, `four-in-a-row`, `ludo`, `chinese-checkers`, `tic-tac-toe`, `battleship` |

Zusätze in diesen Manifesten:

- Ein Motiv darf neben `stil`, `ohne`, `format` und `referenzen` auch eine eigene `groesse` tragen (`uebernehmen.mjs` beachtet sie).
- `"freistellen": true` (am Motiv oder am Manifest): `uebernehmen.mjs` entfernt den grünen Grund (#00B140), glättet die Kante und schreibt WebP mit Alphakanal.
- `haus`, `gruppe`, `satz` und `beschreibung` sind nur Erläuterungen.
- Figuren (G12): Motiv-id `<satz>-<figur>[-<seite>]` mit den Sätzen `wood`, `metal`, `fable` und den Seiten `w` (hell), `b` (dunkel), `n` (neutraler Meister, wird in die Platzfarben eingefärbt). Zieldatei ist `figuren/<Motiv-id>.webp`.

**Mit Antigravity (ohne API-Schlüssel):** Bilder mit dem eingebauten Bildwerkzeug erzeugen (Prompt = `stil` + `prompt` + „Avoid: “ + `ohne`, Referenzbilder aus `referenzen` mitgeben) und als `grafik-roh/<Manifestname>/<Motiv-id>/v1.png`, `v2.png`, `v3.png` ablegen – genau dort, wo `erzeugen.mjs` sie hinschreibt. Kontaktbogen und Übernahme laufen dann unverändert. Der ausführliche Ablauf kommt mit G0 (#307).

## Vergleichsprobe Gemini gegen Cloudflare Workers AI

`manifeste/vergleich-pilot.json` hat sechs Motive aus sechs Bildarten (Porträt, Tischtextur, Kulisse, Gegenstand, Wappen, Spielfigur). Nichts davon wird übernommen; es geht nur darum, ob ein kostenloser Anbieter für einzelne Bildarten reicht.

```bash
set -x GEMINI_API_KEY …                 # nur wenn Gemini mitlaufen soll
set -x CLOUDFLARE_ACCOUNT_ID …          # Cloudflare-Konto-ID
set -x CLOUDFLARE_API_TOKEN …           # API-Token mit Berechtigung „Workers AI“
node scripts/grafik/erzeugen.mjs scripts/grafik/manifeste/vergleich-pilot.json --anbieter=cloudflare --varianten=2
node scripts/grafik/erzeugen.mjs scripts/grafik/manifeste/vergleich-pilot.json --varianten=2   # Gemini, nur wenn gewünscht
node scripts/grafik/kontaktbogen.mjs scripts/grafik/manifeste/vergleich-pilot.json
```

Ergebnis: `grafik-roh/vergleich-pilot/kontaktbogen.html`, je Motiv Gemini- und Cloudflare-Bilder nebeneinander. Cloudflare bekommt nur Stil und Motiv-Prompt (keine Referenzbilder, keine Verbote, festes Format); darauf achten, wenn die Bilder verglichen werden.

### Gemini-Schlüssel: gratis und bezahlt getrennt

Zwei Umgebungsvariablen, nie im Repo: `GEMINI_API_KEY_GRATIS` und `GEMINI_API_KEY_BEZAHLT`. `erzeugen.mjs` nimmt standardmäßig den Gratis-Schlüssel; `--schluessel=bezahlt` nimmt den kostenpflichtigen und fragt vorher nach der Zahl der Bilder (`--ja` überspringt die Frage). Bei einem Limit wird nie selbst auf den bezahlten Schlüssel gewechselt. Der alte Name `GEMINI_API_KEY` gilt nur, wenn keine der beiden neuen Variablen gesetzt ist, und dann als gratis.

**Mit Antigravity (ohne API-Schlüssel):** Bilder mit dem eingebauten Bildwerkzeug erzeugen (Prompt = `stil` + `prompt` + „Avoid: “ + `ohne`, Referenzbilder aus `referenzen` mitgeben) und als `grafik-roh/<Manifestname>/<Motiv-id>/v1.png`, `v2.png`, `v3.png` ablegen – genau dort, wo `erzeugen.mjs` sie hinschreibt. Kontaktbogen und Übernahme laufen dann unverändert. Ausführlich: [`.agent/workflows/grafik-erzeugen.md`](../../.agent/workflows/grafik-erzeugen.md).
