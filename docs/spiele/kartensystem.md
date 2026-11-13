# Kartensystem: ein Baustein für alle Karten, bearbeitbar in Anki

Vorhaben [#270](https://github.com/ichthys2k/brett-und-blatt/issues/270) (Teil von #135 „Spielerpass“) · Stand 13.11.2026

Alle Kartenspiele zeichnen ihre Karten über **einen gemeinsamen Baustein**. Karten lassen sich als Anki-Paket (`.apkg`) ausgeben, in Anki ändern und wieder einlesen. Geändert werden können Namen, Bilder, Texte und bei den Spezialkarten auch die Werte, mit denen gespielt wird.

## Bausteine

| Teil | Wo | Issue |
| --- | --- | --- |
| `<GameCard>`, `<CardBack>`, Kartengestaltung (`CardCosmeticsProvider`, `useCardCosmetics`, `useCardOverride`) | `packages/ui/src/cards/` | K1 #271 |
| Kartenrücken im Spielerpass: Katalog, Freischalten, Wahl je Pass | `apps/web/src/lib/cardBacks.ts`, `#/pass` | K2 #272 |
| Laufzeit-Felder (`runtimeFields`, `mediaUrlMap`) und Notiztyp „Klassisches Spielblatt“ | `packages/engine/src/anki/render.ts`, `gameNotetypes.ts` | K3 #273 |
| Notiztypen Kampfkarte, Hof- & Rollenkarte, Quartettkarte; Rundlauf für Drachenspiel, Narrenhof, Quartett, Wölfe; Export in `#/bibliothek` | `gameNotetypes.ts`, `gameConverters.ts`, `apps/web/src/lib/gameCardTemplates.ts` | K4 #274 |
| Klassisches Blatt: Spielblatt-Paket aus der Bibliothek, Kartenhinweise je Spiel (`cardDescription.ts` in Skat, Schafkopf, Doppelkopf, Mau-Mau, Eins!), gleicher Rücken am gemeinsamen Tisch | `packages/ui/src/cards/PlayingCard.tsx`, `sharedCardBack.ts`, `apps/web/src/lib/activeSheetPackage.ts` | K5 #275 |
| Spezialkarten über `<GameCard>`: Drachenspiel, Narrenhof, Quartett, Wölfe im Schafspelz, Tiefflug | jeweils `src/ui/` | K6 #276 |
| Kartenwerte aus Anki im Spiel: Parser mit Grenzen, Prüfsumme, Abzeichen „✨ Anki #…“ und Übersicht | `packages/engine/src/anki/cardSpecParser.ts`, `apps/web/src/components/CustomCardsOverlay.tsx` | K7 #277 |

## So kommt ein eigenes Kartenset ins Spiel (13.11.2026)

1. In `#/bibliothek` ein Paket einlesen, z. B. einen offiziellen Kartensatz („Offizielle Kartensätze … als Anki-Paket exportieren“), der in Anki geändert wurde.
2. Bei einem Paket mit Spezialkarten erscheint **„🎴 Als Kartenset verwenden (n)“**. Die Wahl gilt je Spielerpass (`apps/web/src/lib/activeCardSet.ts`, Speicher `bub-active-card-set-package-<Pass>`). Davon getrennt bleibt **„🃏 Als Spielblatt verwenden“** für das klassische Blatt.
3. **Darstellung:** Die Notizen des Kartensets gehen als `ankiOverrides` (Schlüssel: Kennung, GUID, Kennung ohne Spiel-Präfix) und die Bilder als `mediaUrlMap` in die Kartengestaltung. Drachenspiel, Narrenhof, Quartett und Wölfe zeigen damit geänderte Namen, Bilder und Texte.
4. **Werte, lokal:** `startGame` (`apps/web/src/lib/activeGame.ts`) hängt bei Drachenspiel, Narrenhof und Quartett das Kartenset als Option `customCardCatalog` (JSON-Text) an. Mitgegeben werden **nur die Karten, die sich vom offiziellen Satz unterscheiden** (`changedCatalog`, Vergleich mit den Anki-Vorlagen); so bleibt die Option klein genug für Raum und Spielstand (höchstens 14 000 Zeichen). Die Option ist in den drei Spielen als verborgene Option deklariert, sonst würfe `resolveOptions` sie weg. Die Einstellungsseite nennt die Zahl der geänderten Karten (`CardSetNote`). Bots, Neustart und Fortsetzen rechnen mit denselben Werten.
5. **Werte, online:** Die Raumleitung wählt in der Lobby **„🎴 Eigenes Kartenset … verwenden“** (Nachricht `setCustomCardCatalog`, ebenfalls nur geänderte Karten) oder „Standardkarten verwenden“. Die Raumliste und das Spiel zeigen das Abzeichen mit Prüfsumme.

## Sicherheit der Werte

Ein Kartenset kann von einem fremden Client kommen. Deshalb gilt `sanitizeCustomCardCatalog` (`cardSpecParser.ts`) an zwei Stellen: beim Lesen der Nachricht (`packages/online/src/protocol.ts`) und in `setup()` der drei Spiele. Durchgelassen werden nur:

- **Kampfkarten:** Name, Kosten 0–20, Angriff 0–99, Leben 1–99, bekannte Schlüsselwörter, Bild, Spruch, Regeltext;
- **Hofkarten:** Name, Kaufpreis 0–99, Basiswert 0–999, Multiplikator 1–99, Bild, Text. Narrenhof nimmt nur bekannte Narren.
- **Quartettkarten:** Name, Bild und endliche Zahlen (±10¹²) für die Eigenschaften des Satzes.

Effekte, Kartenart, Zielwahl und unbekannte Felder kommen nie ins Spiel. Höchstens 400 Karten je Verzeichnis werden übernommen. `EffektDatenJSON` bleibt beim Rundlauf nach Anki erhalten, wirkt aber nicht auf die Regeln. Geprüft wird das in `tests/kartenset.test.ts`.

## Offen

- Eigene, neue Karten (nicht nur geänderte vorhandene) sind im Spiel noch nicht spielbar.
- Wölfe im Schafspelz und Tiefflug haben keine Werte, die Anki ändern könnte; dort wirkt nur die Darstellung.
