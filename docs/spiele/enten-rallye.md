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
- **Richtige Antwort:** Die Ente erhält einen Schwimm-Schub um eine Etappe vorwärts (`solvedCount + 1`), der Serien-Zähler (`streak`) steigt, und sofort erscheint die nächste Aufgabe.
- **Falsche Antwort:** Das Aufgabenfeld schüttelt sich rot, der Fehlerzähler (`mistakes`) steigt um 1, die Serie reißt ab, und für diese Stufe wird sofort eine neue Ersatz-Aufgabe gezogen (Raten durch Ausprobieren bringt dadurch keinen Vorteil).
- **Rennende:** Sobald die erste Ente die eingestellte Streckenlänge (10, 15 oder 25 gelöste Aufgaben) erreicht, gewinnt sie das Rennen. Auf dem Siegertreppchen (🥇🥈🥉) werden die Plätze nach gelösten Aufgaben und bei Gleichstand nach den wenigsten Fehlern vergeben.

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
