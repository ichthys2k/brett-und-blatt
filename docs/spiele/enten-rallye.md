# Enten-Rallye (Kopfrechen-Wettrennen)

| Steckbrief | |
|---|---|
| Spieler | 1–30 |
| Dauer | 2–10 Minuten |
| Modi | Solo, Hot-Seat (Splitscreen), online (auch als Klassen-Simultanspiel) |
| Muster | gleichzeitig (`simultaneous`), parallel (`parallel`) |
| Ordner | `packages/games/duck-rally` |

## Regeln

- Jede Spielerin und jeder Spieler steuert eine eigene farbige **Gummiente** 🦆 im Fluss von der Startlinie bis zur Zielflagge 🏁.
- Alle Enten erhalten **denselben Aufgabenpool** (aus dem Partie-Seed erzeugt) in leicht verwürfelten 3er-Blöcken: So ist die Schwierigkeit für alle zu 100 % identisch, aber niemand hat im selben Moment exakt dieselbe Zahl auf dem Bildschirm.
- **Strömung (seit 31.10.2026, W-009):** Alle Enten schwimmen auch ohne Antworten langsam von selbst Richtung Ziel – im Takt von 1 s je 0,02 Etappen (allein 50 s für eine Etappe). Jede richtige Antwort in Folge beschleunigt die Ente um 0,01 Etappen je Takt, höchstens bis zur vierten (dann 0,06); eine falsche Antwort bremst sie mit der Serie wieder auf das Grundtempo. Die Strömung ruht während des Countdowns. Sie gilt überall, auch online (Entscheidung Cornelius, 31.10.2026).
- **Richtige Antwort:** Die Ente erhält einen Schwimm-Schub um eine Etappe vorwärts (`distance + 100`, `solvedCount + 1`), der Serien-Zähler (`streak`) steigt, und sofort erscheint die nächste Aufgabe.
- **Falsche Antwort:** Das Aufgabenfeld schüttelt sich rot, der Fehlerzähler (`mistakes`) steigt um 1, die Serie reißt ab, und für diese Stufe wird sofort eine neue Ersatz-Aufgabe gezogen (Raten durch Ausprobieren bringt dadurch keinen Vorteil).
- **Rennende:** Sobald die erste Ente das Ziel erreicht (Streckenlänge 10, 15 oder 25 Etappen; durch die Strömung braucht man etwas weniger Aufgaben), gewinnt sie das Rennen. Erreichen mehrere im selben Strömungstakt das Ziel, zählt die kleinere Platznummer. Auf dem Siegertreppchen (🥇🥈🥉) werden die Plätze nach zurückgelegter Strecke, dann nach gelösten Aufgaben und bei Gleichstand nach den wenigsten Fehlern vergeben.

### Umsetzung der Strömung

- Strecke `distance` je Ente in Hundertstel-Etappen (Ziel bei `target · 100`), Takte `ticks` im Spielstand; `ruleVersion` 2.
- Die Regeln kennen keine Zeit: Die Strömung ist der Systemzug `{ type: 'drift' }`. `currentPlayers` nennt neben den Enten im Rennen immer `'system'`, und der neue Engine-Haken `GameModule.systemDelayMs` (`systemDelayMs`: erster Takt nach Countdown + 1 s, danach 1 s) lässt die Spielleitung (`LocalSession`) damit warten. Antworten verschieben den Takt nicht; Pause, Rücknahme und Ende halten ihn an. Der Fälligkeitszeitpunkt steht im Schnappschuss (`SessionRuntime.systemDue`), damit der Server-Wecker (`nextDeadline()`) ihn auch nach dem Schlafen findet.
- Online geht damit je Takt ein neuer Stand an alle; Antworten gegen einen etwas älteren Stand nimmt der Raum weiter an (`stillValid`).
- Oberfläche: Die Ente gleitet gleichmäßig über den Takt (`transition: left 1s linear`), ein Schub ist schnell und federnd (`dr-duck-surge`). Anzeige in Prozent der Strecke statt „gelöst/Ziel“. Die Führung (Lied, Ansage, Rahmen) wechselt erst bei 0,2 Etappen Vorsprung, damit die Strömung sie nicht ständig hin- und herreißt.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Aufgabenart (`topic`) | Grundrechenarten (`basic`), Plus & Minus (`addSub`), Einmaleins & Teilen (`mulDiv`), Gleichungen mit $x$ (`algebra`), Prozente & Primzahlen (`percentPrime`), Bunter Mix (`mix`) | `basic` |
| Schwierigkeit (`difficulty`) | Leicht (`easy`), Mittel (`medium`), Schwer (`hard`) | `medium` |
| Streckenlänge (`target`) | Sprint – 10 Aufgaben (`10`), Standard – 15 Aufgaben (`15`), Langstrecke – 25 Aufgaben (`25`) | `15` |

## Bot („Renn-Ente“)

- Nutzt `BotDefinition.delayMs`, damit Computer-Enten kontinuierlich und in natürlichem Tempo mitschwimmen:
  - **leicht:** ca. 4,5–7,5 s pro Aufgabe, ~15 % Tippfehler
  - **mittel:** ca. 2,8–4,8 s pro Aufgabe, ~5 % Tippfehler
  - **schwer:** ca. 1,5–2,8 s pro Aufgabe, fehlerfrei

## Oberfläche

- **Enten-Fluss oben:** Animierter Wellen-Hintergrund mit Start- und Ziellinie, 3D-Gummienten-SVGs (`RubberDuckSVG` aus *Der Große Preis*) in barrierefreien Okabe-Ito-Farben und Boost-Wellen.
- **Aufgaben-Cockpit unten:**
  - **Solo & Online:** Großes Aufgabenfeld mit Touch-Ziffernblock (`0–9`, `⌫`, `GO!`), voller Tastaturunterstützung und 2×3-Auswahlkacheln bei Primzahl-Aufgaben.
  - **Hot-Seat (bis 4 Spieler am selben Gerät / Smartboard):** Gleichzeitige Splitscreen-Ansicht mit eigenem Ziffernblock pro Ente.
- **Siegertreppchen:** Podest für Platz 1–3 mit gelösten Aufgaben, Serien-Rekord und Fehlerquote.

## Ton (28.10.2026)

Wie im Original aus „Großer Preis“ (`KopfrechenArena.jsx`), umgesetzt in `src/ui/audio.ts` (`RallyAudio`, eigener AudioContext mit Musik- und Stimmweg, Begrenzer):

- **Keine allgemeine Playlist:** `meta.ownMusic = true`; die App spielt dann keine Playlist-Musik und zeigt im Lautsprecher-Menü keine Playlist. Lautstärken kommen über `BoardProps.audio` aus den Ton-Einstellungen (online nur bei der Raumleitung, wie die übrige Musik).
- **Lied der führenden Ente** (gelb, rot, blau, grün; ab der fünften Farbe „war drum“), mit 1 s Überblendung; bei Gleichstand bleibt das bisherige Lied.
- **Ansager:** Countdown „3, 2, 1, los!“ zu Beginn (Eingabe gesperrt, Bots warten 3 s länger), Führungswechsel (`lead_team_*`), Fortschritt der vordersten Ente bei 50, 75 und 90 % (`progress_*`), Sieger (`winner_team_*`, sonst `outro_winner`). Während einer Ansage wird die Musik leiser; die Ansagen wurden im Klang-Repo auf etwa −14 LUFS angehoben (vorher rund 9 dB leiser als die Musik).
- **Quaken** bei jeder richtigen Antwort (`ente_variante_6`).
- **Siegesmusik** „Victory Lap“; sie und alles andere stoppt, wenn man das Spiel verlässt, und eine Revanche startet wieder mit Countdown.
- Dateien im privaten Klang-Repo unter `duck-rally/`. Offline: Bei eingeschaltetem Ton lädt das Spiel alle Dateien einmal ganz vor (`RallyAudio.prefetch`), der Service Worker legt sie im Speicher `enten-rallye` ab und bedient daraus auch die Stück-Anfragen von `<audio>`.
