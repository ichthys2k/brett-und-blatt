# Offene Pläne – Übergabe (Stand 1.11.2026)

Diese Seite fasst zusammen, was geplant, aber noch nicht gebaut ist, damit ein anderer Agent (Claude, Gemini, Codex …) ohne Rückfragen weitermachen kann. Die Einzelheiten stehen in den verlinkten Plänen; die Liste aller Wünsche und Fehler ist [`PLANUNG.md`](../../PLANUNG.md). Alle früheren Claude-Dokumente sind jetzt als Markdown im Repo, **die Dateien hier sind maßgeblich** (die Claude-Dokumente werden nicht mehr gepflegt).

Regeln wie immer (siehe `CLAUDE.md`): eigener Zweig, Eintrag in `PLANUNG.md` vorher auf `in Arbeit (Name, Zweig)`, Tests + `corepack pnpm check` + Rauchtest + Prüfstand, Blick im Browser. Commit, Push und Veröffentlichen nur auf Cornelius' Wort („deploy“). Keine Nachbauten bestimmter Verlagsspiele: eigene Namen, eigene Kernregel.

## 1. Marktplatz (W-041) – veröffentlicht (4817a5e)

Spiel: `packages/games/marketplace`, Plan: [`marktplatz.md`](marktplatz.md), Probe: [`marktplatz-probe.md`](marktplatz-probe.md). Offen: Test online mit zwei Geräten, Narrenhof-Porträts und Sprüche, Feldgrafik, eigene Klänge (Auswahl durch Cornelius).

## 2. Marktstände und Grafschaft (W-039, Paket C) – wartet auf Cornelius' Ja zum Entwurf

Plan: [`umsetzungsplan-pakete-a-b-c.md`](umsetzungsplan-pakete-a-b-c.md), Abschnitte „Reihenbauer wird Marktstände“ und „Landschaftsleger wird Grafschaft“. Eigene Fassungen statt 6 nimmt! und Carcassonne. Offen ist nur die erste Frage im Plan („Sind die eigenen Fassungen so in Ordnung?“). Nach dem Ja: erst Probepartien mit Bots im Prüfstand (Marktstände 1 Tag, Grafschaft 2 Tage), dann Bau (3 bzw. 7 Tage).

Pakete A und B aus diesem Plan sind fertig und veröffentlicht (Nicht ärgern! zu sechst, Elf zuerst!, Sternhalma, Rübenacker; Kategorien-Sprint, Wer bin ich?, Verboten!).

## 3. Fehler (offen in PLANUNG.md)

- **F-010** Drachenspiel: nicht mehr nachstellbar, gleiche Ursache wie F-009; Cornelius bestätigt am Gerät.
- **F-011** Kleine Bildschirme: behoben und veröffentlicht (8e6d2d2), Cornelius prüft am Handy; was bewusst noch rollt, steht in `PLANUNG.md`.

## 4. Kleine Wünsche

- **W-020** Spieler rund um einen Tisch: Pilot mit Mau-Mau und Skat gebaut, übrige Spiele warten auf Cornelius' Urteil; [Plan](spieler-am-tisch.md).
- **W-048** Bildkarten mit Porträts.

## 5. Klang und Musik (brauchen Cornelius' Auswahl)

Ablauf in [`klaenge-alle-spiele.md`](klaenge-alle-spiele.md), Werkzeuge im privaten Klang-Repo. Neue Klänge nur nach seiner Auswahl.

- **W-005** Narrenhof: Sprachaufnahmen der Kombis.
- **W-007** Eins! Flip: eigene Musik je Kartenseite (Code-Teil lässt sich vorab bauen).
- **W-014** weitere Stücke für die Playlists.
- **W-047** Suno-Playlists einbinden.

## 6. Konzepte (Pläne fertig, warten auf Entscheidung)

- **W-020** Spieler rund um einen Tisch (Layout ab Tablet-Breite) – Eintrag in `PLANUNG.md`.
- **W-025/W-026** Taverne-Aussehen und Drachenspiel im Mittelalter: [`taverne-und-drachenspiel.md`](taverne-und-drachenspiel.md) (Schritt 1 und 2 der Taverne sind live).
- **W-027** Spiele für viele Spieler: Welle 1 fertig ([`klassenspiele.md`](klassenspiele.md)), Inhalte warten auf Cornelius' Freigabe; weitere Ideen in [`spiele-fuer-viele.md`](spiele-fuer-viele.md).
- **W-044** Drachenspiel-Ausbau: [`drachenspiel-ausbau.md`](drachenspiel-ausbau.md) (lief in einem anderen Thread, Stand dort nachlesen).

## 7. Zurückgestellt

- **W-024** Discord: [`discord.md`](discord.md). Wichtig: Discord in Deutschland erst ab 16, also nie für Schulklassen.
- **W-040** Zeitband (eigenes Zeitstrahl-Spiel statt Hitster): [`zeitband.md`](zeitband.md). Cornelius denkt noch nach; keine echten Hits, kein Spotify.

## Weitere Unterlagen

- [`abarbeitungsplan.md`](abarbeitungsplan.md) – Etappenplan vom 31.10. (Etappen 1–8, fast alles erledigt; offen dort noch Kernschleifen Schritt 4–6 aus [`kernschleifen.md`](kernschleifen.md) und Tests mit mehreren Geräten).
