> Übernommen aus dem Claude-Dokument https://claude.ai/artifact/Da21BTkDHu4J98HPyYJf1T am 1.11.2026, damit andere Agenten den Plan lesen können. **Diese Datei ist ab jetzt die maßgebliche Fassung.**

# Brett & Blatt – Abarbeitungsplan für PLANUNG.md

Oct 31, 2026 · @Cornelius Lipponer

## Kurzfassung

Stand 31.10.2026 nachmittags (main `ec74754`). Von den acht Etappen sind sechs fertig und veröffentlicht (1–4, 6, 8), die Narrenhof-Etappe 5 ist weitgehend live und läuft mit den Porträts noch nach. Ungestartet ist nur Etappe 7 (Recherchen und Konzepte). Daneben bleiben drei Stränge offen: weitere Kernschleifen-Schritte (Animationen), die Klang-Sitzung und Tests mit mehreren Geräten. Die Liste der Fehler ist leer.

| Etappe | Einträge | Status | PR |
| --- | --- | --- | --- |
| 1 Nicht ärgern! reparieren und beleben | F-002, F-003, F-004, W-011, W-012 | ✅ live | #30 |
| 2 Kartenhand in Eins! und Mau-Mau | F-001, W-019 | ✅ live | #32 |
| 3 Kleine Wünsche | W-015, W-009 | ✅ live | #31 |
| 4 Kernschleifen-Plan, Würfel, Siegerehrung | W-013, W-010, W-008 | ✅ live, Schritte 2 und 3 nachgezogen | #33, #34, #35 |
| 5 Narrenhof | W-016, W-006, W-017, W-018, W-005 | 🟡 großteils live, Porträts in Arbeit | #36, #39 |
| 6 Spieltiefe (Fahrplan E) | W-001, W-002, W-003, W-004 | ✅ live | #38 |
| 7 Recherchen und Konzepte | W-020, W-021, W-024, W-025, W-026, W-027 | ⚪ nicht gestartet | – |
| 8 Lobby und Startseite | W-028, W-029, W-030, W-031 | ✅ gemergt, wird veröffentlicht | #40 |
| außer der Reihe | W-022 Emoji-Clicker-Link, W-023 offene Runden | ✅ live | `45a7f11`, #37 |
| nebenher: Klang-Sitzung | W-005, W-007, W-014 und Klang-Reste | ⚪ wartet auf deine Auswahl | – |

## Etappen im Einzelnen

### 1 Nicht ärgern! reparieren und beleben ✅

Veröffentlicht am 31.10.2026 mit PR #30.

- **F-003** Schlagpflicht ist jetzt standardmäßig aus (`ruleVersion` 2).
- **F-004** Ein Wurf ohne Zug bleibt sichtbar beim Werfer (`lastRoll`), statt scheinbar beim Nächsten zu liegen.
- **F-002** Figuren stehen tiefer im Feld.
- **W-011** Figuren hüpfen Feld für Feld.
- **W-012** Geschlagene Figuren fliegen drehend in den Stall.

### 2 Kartenhand in Eins! und Mau-Mau ✅

Veröffentlicht am 31.10.2026 mit PR #32.

- **F-001** Handkarten liegen bei vielen Karten in bis zu vier überlappenden Reihen, jede Ecke bleibt sichtbar (`CardFan` mit `minStep`).
- **W-019** Mitspieler zeigen ihre Kartenzahl als kleinen verdeckten Fächer.

### 3 Kleine Wünsche ✅

Veröffentlicht am 31.10.2026 mit PR #31.

- **W-015** Bauernumwandlung in jede Figur auch im Vierer-Schach (Option „Umwandlung“).
- **W-009** Enten-Rallye: Eine Strömung trägt alle Enten von selbst voran, Serien beschleunigen; gilt auch online und am geteilten Bildschirm (Systemzug im Sekundentakt über `systemDelayMs`).

### 4 Kernschleifen-Plan, Würfel und Siegerehrung ✅

Veröffentlicht am 31.10.2026 mit PR #33, Schritte 2 und 3 danach mit #34 und #35.

- **W-013** Plan für alle Spiele in `docs/spiele/kernschleifen.md`.
- **W-010** Gemeinsamer 3D-Würfel `Die3D` in Würfelblock, Mäxle und Nicht ärgern!.
- **W-008** Große Siegerehrung am Partieende (Pokal, Treppchen, Konfetti, online für alle).
- **Schritt 2** Punkte-Fähnchen und Stein-Plopp in Farbe & Form, Wortgitter, Würfelblock und Reversi; Tic-Tac-Toe zieht die Gewinnlinie durch.
- **Schritt 3** Karten fliegen in den Stich, der Stich fliegt zum Gewinner (Skat, Schafkopf, Doppelkopf, Binokel, Präsident).

**Noch offen aus dem Kernschleifen-Plan:**

1. **Schritt 4:** Paare finden (Umdrehen), Ultimate Tic-Tac-Toe (Pfeil zum Zielbrett), Mühle (Gleiten).
2. **Schritt 5:** Rundenende-Zwischenstand für Serien-Spiele (Punkte zählen hoch, Rangwechsel gleitet).
3. **Schritt 6:** Der Rest nach der Tabelle im Plan, je zwei bis vier Spiele pro PR, dazu Vibration bei Treffern und Fehlern.

### 5 Narrenhof 🟡

- ✅ **W-016** 29 neue eigene Narren, 81 insgesamt (PR #36).
- ✅ **W-006** Späte Ziele ab Hoftag 5 gesenkt, der schwere Bot gewinnt 24 % statt 2–4 % der Läufe (PR #36).
- 🟡 **W-017** Gegner mit Porträts: 30 Herrschaften in drei Stimmungen live (PR #36), Grundbilder für alle 38 Höflinge live (PR #39). **In Arbeit:** die Lach-Stufen, also die weiteren Stimmungen der Höflinge. Canva erzeugt nur etwa ein Bild alle 4–5 Minuten.
- 🟡 **W-018** Fortschritt geräteübergreifend sichern: Vergleich fertig (in `docs/spiele/farbensortierer.md`), Empfehlung Sync-Code mit Verschlüsselung. Die Umsetzung wartet auf deine Entscheidung.
- ⚪ **W-005** Sprachaufnahmen der Kombis mit den Narrenhof-Namen, siehe Klang-Sitzung.

### 6 Spieltiefe (Fahrplan E) ✅

Veröffentlicht am 31.10.2026 mit PR #38.

- **W-001** Vierer-Schach-Bot mit Vorausschau über eine Runde (schwer gewinnt 40 % statt 25 %).
- **W-002** Binokel zu viert: Geber setzt aus oder Kreuzbinokel 2 gegen 2.
- **W-003** Doppelkopf-Pflichtsolo mit Vorführung.
- **W-004** Drachenspiel mit neun eigenen Zauberkarten (Option, Standard an). Ein eigener Zauberklang fehlt noch (Klang-Sitzung).

### 7 Recherchen und Konzepte ⚪

Nur Pläne und Dokumente, kein Code. Noch nicht gestartet. Vorgeschlagene Reihenfolge nach deiner Priorität:

1. **W-027 Spiele für viele Spieler** (hoch): 20–40 Spielideen ab 4, besser 8 bis 30 Spielern mit kurzer Beschreibung, als Doc. Passt zusammen mit W-021.
2. **W-021 Werwolf:** Rollen und Ablauf als eigenes Spiel mit eigenem Namen, geheime Rollen über `playerView`, Nacht- und Tagphasen, Spielleitung durch das Spiel.
3. **W-026 Taverne** (mittel) und **W-025 Drachenspiel im Mittelalter:** ein gemeinsames Gestaltungskonzept, das an den Narrenhof anknüpft.
4. **W-024 Discord:** Vergleich der Wege (Discord Activity in Brett & Blatt, Bot mit Raum-Links, Sprachchat neben dem Spiel).
5. **W-020 Spieler rund um den Tisch:** Plan für ein Tisch-Layout ab Tablet-Breite, aufbauend auf `TrickTable` und den Seitenleisten-Layouts.

### 8 Lobby und Startseite ✅

Am 31.10.2026 mit PR #40 gemergt (main `ec74754`), die Veröffentlichung läuft.

- **W-028** Startseite filtert nach Spielerzahl („Wie viele spielt ihr?“).
- **W-030** Name und Emoji in der Lobby ändern.
- **W-029** Raumleitung nimmt Abwesende vom Platz, Zuschauer übernehmen ihn.
- **W-031** Raumleitung legt Namen und Emojis fest und kann das Umbenennen sperren.

### Außer der Reihe ✅

- **W-022** Emoji-Clicker als Link-Kachel unter „Weitere Spiele“ (`45a7f11`).
- **W-023** Offene Runden live unter „Online spielen“ und auf der Startseite (PR #37).

## Offene Stränge neben den Etappen

### Klang-Sitzung ⚪

Alles hängt an deiner Auswahl mit den Werkzeugen im Klang-Repo. Ich bereite Kandidaten und Katalogeinträge vor.

- **W-005** Narrenhof: Kombi-Ansagen neu aufnehmen.
- **W-014** Mehr Lieder in den Playlists: 16 weitere Musikstücke.
- **W-007** Eins! Flip: eigene Musik je Kartenseite (der Code-Teil lässt sich vorab bauen).
- Klänge für Bingo, für den Narrenhof und für die Zauberkarten im Drachenspiel.
- Neue Effekte aus dem Kernschleifen-Plan (z. B. Trommelwirbel für Mäxle und Quartett, Gewinn-Kaskade).

### Tests mit mehreren Geräten ⚪

Brauchen dich mit zwei oder mehr echten Geräten:

- Enten-Rallye mit Strömung online (W-009).
- Offene Runden live: erscheinen und verschwinden Räume auf beiden Geräten sofort (W-023)?
- Neu dazu: Lobby-Funktionen aus Etappe 8 (Umbenennen, vom Platz nehmen, Platz übernehmen).

## Was du entscheiden kannst

- [ ] Etappe 7 starten, am besten mit W-027 und W-021 zusammen.
- [ ] Kernschleifen Schritt 4 (Paare finden, Ultimate Tic-Tac-Toe, Mühle) als nächste Code-Etappe.
- [ ] W-018: Sync-Code mit Verschlüsselung umsetzen oder liegen lassen.
- [ ] Termin für die Klang-Sitzung.
- [ ] Mehrgeräte-Test für Enten-Rallye, offene Runden und Lobby.

Bereits entschieden (31.10.2026): Reihenfolge der Etappen, Narrenhof läuft hier mit, Porträts per KI-Bilddienst (Lizenz passend zu CC BY-SA), die Enten-Strömung gilt überall, Etappe 8 Lobby.

Beim Start einer Etappe setze ich die Einträge in `PLANUNG.md` auf „in Arbeit“ mit Zweig und nach dem Merge auf „erledigt“.
