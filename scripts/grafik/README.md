# Bilderzeugung (scripts/grafik)

Ablauf für gemalte Bilder (Porträts, Tierkarten, Illustrationen); Symbole, Figuren und Icons schreibt man besser direkt als SVG.

1. Manifest anlegen oder ergänzen: `scripts/grafik/manifeste/<name>.json` (Stil-Kopf, Referenzbilder, Motive, Zielordner, Größe).
2. Schlüssel setzen (nie ins Repo): `set -x GEMINI_API_KEY …` (fish). Modelle und Quote prüfen: `node scripts/grafik/erzeugen.mjs --modelle`.
3. Varianten erzeugen (setzt nach Abbruch fort, wartet bei Limits): `node scripts/grafik/erzeugen.mjs scripts/grafik/manifeste/bildkarten.json`.
4. Auswählen: `node scripts/grafik/kontaktbogen.mjs <Manifest>`, dann `grafik-roh/<name>/kontaktbogen.html` im Browser öffnen, anklicken, die unten erzeugte Zeile ausführen (`uebernehmen.mjs`, braucht ImageMagick).
5. Gewählte Bilder landen als WebP im Zielordner; Quelle und Kennzeichnung als KI-Bild in `THIRD_PARTY.md` ergänzen. Rohbilder (`grafik-roh/`) bleiben außerhalb von Git.
