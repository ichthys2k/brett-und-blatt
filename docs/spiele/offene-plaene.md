# Offene Pläne – Übergabe (Stand 1.11.2026)

Diese Seite enthält fachliche Übergaben und Links zu Detailplänen, aber **keinen maßgeblichen Aufgabenstatus**. Wünsche, Fehler, Prompts und Freigaben werden ausschließlich als [GitHub Issues](https://github.com/ichthys2k/brett-und-blatt/issues) verwaltet; [`PLANUNG.md`](../../PLANUNG.md) ist der Wegweiser mit fertigen Filter-Links; die frühere Liste liegt im Archiv #72. Alle früheren Claude-Dokumente sind jetzt als Markdown im Repo.

Vor der Arbeit ein von Cornelius auf `status: Ready` gesetztes Issue auswählen und im Issue mit Konto und Zweig kommentierend reservieren; keine Assignees oder Labels als Reservierung. Nur Cornelius erteilt Ready-Freigaben. Tests + `corepack pnpm check` + Rauchtest + Prüfstand und Blick im Browser bleiben Pflicht. Den eigenen Arbeitszweig committen und hochladen Agenten selbst (PR mit `Refs #…`); nach `main` und damit veröffentlicht wird nur auf Cornelius' Wort „deploy“. Keine Nachbauten bestimmter Verlagsspiele: eigene Namen, eigene Kernregel.

## 1. Marktplatz (W-041) – veröffentlicht (4817a5e)

Spiel: `packages/games/marketplace`, Plan: [`marktplatz.md`](marktplatz.md), Probe: [`marktplatz-probe.md`](marktplatz-probe.md). Verbleibende optionale Abschlussarbeiten sind in [Issue #73](https://github.com/ichthys2k/brett-und-blatt/issues/73); Status und Freigabe ausschließlich dort.

## 2. Grafschaft (W-039, Paket C; Marktstände ist fertig) – Spielmodul umgesetzt

**Stand 10.11.2026:** Das Spielmodul `packages/games/grafschaft` ist vollständig umgesetzt (Sechseck-Legespiel, 20 Hofaufträge, Bot „Landvogt“, SVG-Oberfläche mit Tavernen-Look, Server-Registrierung). Alle Tests, Vertragsprüfungen, Prüfstand und Rauchtests sind grün (PR für Issue #57).

Pakete A und B aus diesem Plan sind fertig und veröffentlicht (Nicht ärgern! zu sechst, Elf zuerst!, Sternhalma, Rübenacker; Kategorien-Sprint, Wer bin ich?, Verboten!).

## 3. Fehler

- **F-011** Kleine Bildschirme: die Grundkorrektur ist veröffentlicht. Verbliebene Enge und Handy-Abnahme sind in [Issue #68](https://github.com/ichthys2k/brett-und-blatt/issues/68) dokumentiert.

## 4. Kleine Wünsche

- **W-020** Spieler rund um einen Tisch: Pilot ausgerollt; verbleibender Umfang und Prüfung stehen in [Issue #53](https://github.com/ichthys2k/brett-und-blatt/issues/53) und im [Plan](spieler-am-tisch.md).
- W-048 Bildkarten mit Porträts ist erledigt; der historische Eintrag bleibt im [Migrationsarchiv #72](https://github.com/ichthys2k/brett-und-blatt/issues/72).

## 5. Klang und Musik (brauchen Cornelius' Auswahl)

Ablauf in [`klaenge-alle-spiele.md`](klaenge-alle-spiele.md), Werkzeuge im privaten Klang-Repo. Neue Klänge nur nach seiner Auswahl.

- **W-005** Narrenhof: Sprachaufnahmen der Kombis ([Issue #50](https://github.com/ichthys2k/brett-und-blatt/issues/50)).
- **W-007** Eins! Flip: eigene Musik je Kartenseite ([Issue #51](https://github.com/ichthys2k/brett-und-blatt/issues/51)).
- **W-014** weitere Stücke für die Playlists ([Issue #52](https://github.com/ichthys2k/brett-und-blatt/issues/52)).
- **W-047** Suno-Playlists einbinden ([Issue #59](https://github.com/ichthys2k/brett-und-blatt/issues/59)).

## 6. Konzepte (Pläne fertig, warten auf Entscheidung)

- **W-025/W-026** Taverne-Aussehen und Drachenspiel im Mittelalter: [Issue #55](https://github.com/ichthys2k/brett-und-blatt/issues/55), [Issue #56](https://github.com/ichthys2k/brett-und-blatt/issues/56), [`taverne-und-drachenspiel.md`](taverne-und-drachenspiel.md).
- **W-027** Spiele für viele Spieler: Welle 1 fertig ([`klassenspiele.md`](klassenspiele.md)); weitere Themen in [`spiele-fuer-viele.md`](spiele-fuer-viele.md) sind Referenzen, keine Arbeitsfreigaben. Vor einer Umsetzung braucht jedes Thema ein eigenes Issue und Cornelius’ Ready-Freigabe.
- **W-044** Drachenspiel-Ausbau abgeschlossen: [`drachenspiel-ausbau.md`](drachenspiel-ausbau.md); historischer Eintrag im [Migrationsarchiv #72](https://github.com/ichthys2k/brett-und-blatt/issues/72).
- **Turniere (W-053):** [Issue #62](https://github.com/ichthys2k/brett-und-blatt/issues/62) enthält den Prüfstatus; [`turnier.md`](turnier.md) bleibt die fachliche Referenz.
- **Spielerpass (Vorhaben #135, 8.11.2026):** Fortschritt, Familie an einem Gerät, Klassen mit Profilen, Klassenausweise, PIN/Passwort, Google/Microsoft und Lernen hinter dem Spielerausweis; Plan in [`spielerpass.md`](spielerpass.md), Schritte #136–#159 sowie #101 und #103.
- **Anki-kompatible Lernpakete (#101):** Schritte L1 bis L8 (#218 bis #225) sind umgesetzt und warten auf Cornelius' Prüfung, ebenso der Rundlauf mit echten Anki-Paketen und die Einrichtung von R2; Stand und Dateien in [`spielerpass.md`](spielerpass.md) (Abschnitte „Stand #101"), Bericht und Entscheidungen in [`anki-recherche.md`](anki-recherche.md). Folge: einheitliches Kartensystem (#270).
- **Web Push für Turniere und Fernpartien (#242):** Fragen entschieden am 10.11.2026, Schritt-für-Schritt-Fahrplan zur Übergabe an einen anderen Agenten in [`web-push.md`](web-push.md); steht auf `status: Ready` (freigegeben am 10.11.2026), begonnen ist es noch nicht. Die Kalenderdatei (#243) ist fertig.
- **Turniersoftware (W-058):** Recherche und Gesamtkonzept für Online- und Vor-Ort-Turniere in [`turniersoftware.md`](turniersoftware.md) ([Issue #63](https://github.com/ichthys2k/brett-und-blatt/issues/63)). Stufe 0–2 fertig; Stufe 3 ([Issue #127](https://github.com/ichthys2k/brett-und-blatt/issues/127)): Teil 1 Turnierabend, Teil 2 Spieleabend (#129), Teil 3 Tischrunden und Teil 5 Best of N (#131) fertig, offen nur Teil 4 Teams (Übergabe-Hinweise im Konzept). Danach Stufe 4–6.

## 7. Zurückgestellt

- **W-024** Discord: zurückgestellt in [Issue #54](https://github.com/ichthys2k/brett-und-blatt/issues/54); [`discord.md`](discord.md). Wichtig: Discord in Deutschland erst ab 16, also nie für Schulklassen.
- **W-040** Zeitband (eigenes Zeitstrahl-Spiel statt Hitster): zurückgestellt in [Issue #58](https://github.com/ichthys2k/brett-und-blatt/issues/58); [`zeitband.md`](zeitband.md). Keine echten Hits, kein Spotify.

## Weitere Unterlagen

- [`abarbeitungsplan.md`](abarbeitungsplan.md) – historischer Etappenstand vom 31.10.; nicht mehr maßgeblich für offene Aufgaben oder Freigaben.
