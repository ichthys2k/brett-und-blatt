# Bilderzeugung (scripts/grafik)

Ablauf für gemalte Bilder (Porträts, Tierkarten, Illustrationen); Symbole, Figuren und Icons schreibt man besser direkt als SVG.

1. Manifest anlegen oder ergänzen: `scripts/grafik/manifeste/<name>.json` (Stil-Kopf, Referenzbilder, Motive, Zielordner, Größe).
2. Schlüssel setzen (nie ins Repo): `set -x GEMINI_API_KEY …` (fish). Modelle und Quote prüfen: `node scripts/grafik/erzeugen.mjs --modelle`.
3. Varianten erzeugen (setzt nach Abbruch fort, wartet bei Limits): `node scripts/grafik/erzeugen.mjs scripts/grafik/manifeste/bildkarten.json`.
4. Auswählen: `node scripts/grafik/kontaktbogen.mjs <Manifest>`, dann `grafik-roh/<name>/kontaktbogen.html` im Browser öffnen, anklicken, die unten erzeugte Zeile ausführen (`uebernehmen.mjs`, braucht ImageMagick).
5. Gewählte Bilder landen als WebP im Zielordner. **Wichtig (Cornelius-Regel):** Das ausgewählte Original-Bild in maximaler Generierungsauflösung wird parallel im Repository archiviert (im Unterordner `original/` neben dem Ziel oder in `assets/originale/`), damit spätere Abwandlungen und Druckauflösungen erhalten bleiben. Quelle und Kennzeichnung als KI-Bild in `THIRD_PARTY.md` ergänzen.

## Manifeste für das Vorhaben „Taverne überall“ (#306)

Für die Grafik-Pakete G2 bis G10 liegen fertige Manifeste in `scripts/grafik/manifeste/` (Stand 12.11.2026, noch keine Bilder erzeugt). Sie sind die **maßgebliche Motivliste**; die Issues nennen dieselben Prompts im Klartext.

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

Zusätze in diesen Manifesten:

- Ein Motiv darf neben `stil`, `ohne`, `format` und `referenzen` auch eine eigene `groesse` tragen (`uebernehmen.mjs` beachtet sie).
- `"freistellen": true` ist ein Hinweis für den Menschen bzw. Agenten: grünen Grund (#00B140) entfernen und als WebP mit Alphakanal ablegen. Das Skript tut das noch nicht.
- `haus`, `gruppe` und `beschreibung` sind nur Erläuterungen.

**Mit Antigravity (ohne API-Schlüssel):** Bilder mit dem eingebauten Bildwerkzeug erzeugen (Prompt = `stil` + `prompt` + „Avoid: “ + `ohne`, Referenzbilder aus `referenzen` mitgeben) und als `grafik-roh/<Manifestname>/<Motiv-id>/v1.png`, `v2.png`, `v3.png` ablegen – genau dort, wo `erzeugen.mjs` sie hinschreibt. Kontaktbogen und Übernahme laufen dann unverändert. Der ausführliche Ablauf kommt mit G0 (#307).
