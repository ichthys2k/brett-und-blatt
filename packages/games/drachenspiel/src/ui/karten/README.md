# Kartenbilder des Drachenspiels (#309)

Gemalte Bilder als `bub-ds-<Karten-id>.webp` (Karten-ids aus `../../cards.ts`). Ein Bild erscheint auf der Karte, sobald die Datei hier liegt (`../cardArt.ts`); ohne Bild bleibt das Emoji. `tests/drachenspiel-kartenbilder.test.ts` prüft, dass jede Datei zu einer Karte gehört. Originale nur im privaten Grafik-Repo.

Nach neuen Bildern lokal `node_modules/.vitest-cache` löschen: Der Modulcache von Vitest merkt sich das Ergebnis von `import.meta.glob` und sieht neue Dateien sonst nicht.
