# Grafschaft

*Taktisches Legespiel für 2–5 Spieler: Reihum wählt jeder ein Sechseck-Plättchen vom Jahrmarkt und vergrößert die gemeinsame Grafschaft. Geheime Aufträge von Narrenhof-Höflingen und blühende Dörfer mit bunter Nachbarschaft bringen Ruhm und Punkte.*

> **Eigene Fassung** statt eines Carcassonne-Nachbaus (W-039, Paket C). Von Cornelius am 7.11.2026 freigegeben. Die Spielbalance und Hofaufträge stammen aus der [Bot-Probe](grafschaft-probe.md).

| Steckbrief | |
|---|---|
| Spieler | 2–5 |
| Modi | Solo gegen Bots, Hot-Seat, online |
| Muster | reihum, offene Auslage, geheime Aufträge |
| Ordner | `packages/games/grafschaft` |

## Regeln

- **Plättchen:** 60 sechseckige Landschaftsplättchen:
  - 14 × **Wald** (4 mit Fluss, 4 mit Weg)
  - 12 × **Wiese** (3 mit Fluss, 4 mit Weg)
  - 12 × **Feld** (3 mit Mühle, 4 mit Weg)
  - 8 × **Teich** (4 mit Fluss)
  - 6 × **Berg** (2 mit Weg)
  - 8 × **Dorf** (4 mit Weg)
- **Start:** In der Mitte liegt ein festes Startplättchen (Burg Eichenhain mit Fluss und Weg).
- **Jahrmarkt:** Fünf Plättchen liegen immer offen auf dem Jahrmarkt aus.
- **Zug:** Wer am Zug ist:
  1. Wählt ein Plättchen vom Jahrmarkt.
  2. Legt es an ein beliebiges passendes freies Nachbarfeld der gemeinsamen Karte an (Kanten müssen nicht zueinander passen; jedes Sechseck passt an jeden Nachbarn).
  3. Füllt den leeren Jahrmarktsplatz sofort vom verdeckten Nachziehstapel auf.
- **Dorf-Vielfalt (Sofortpunkte):**
  - Wer ein Dorf-Plättchen legt, erhält sofort **1 Punkt für jede verschiedene Landschaftsart** in dessen direkter Nachbarschaft (Wald, Wiese, Feld, Teich, Berg, Dorf – bis zu 6 Punkte bei voller Vielfalt).
- **Hofaufträge:**
  - Jeder Spieler hält 3 geheime Aufträge von Höflingen des Narrenhofs (z. B. „Die Gans: 3 Teiche zusammen“, „Der Müller: Mühle am Fluss“, „Der Bär: 4 Wälder zusammen“).
  - Sobald eine geforderte Struktur auf dem Brett entsteht (egal durch welchen Spieler), ist der Auftrag erfüllt: Der Spieler deckt ihn auf, erhält die Punkte (2–5 Punkte) und zieht sofort einen neuen geheimen Auftrag vom Stapel nach.
- **Spielende:**
  - Sobald der Nachziehstapel und die Jahrmarktsauslage leer sind (60 Züge gesamt; bei 4 Spielern genau 15 Züge pro Spieler).
  - Wer die meisten Punkte aus Dorf-Vielfalt und Hofaufträgen gesammelt hat, gewinnt die Grafschaft. Bei Gleichstand gewinnt, wer mehr Aufträge erfüllt hat.

## Optionen

- `deckSize`: `60` (Standard, ca. 15 Minuten), `40` (schnelle Runde für zwischendurch).
- `quests`: `geheim` (Standard) oder `offen` (drei gemeinsame Hofaufträge für alle am Tisch).

## Bot „Landvogt“

- **Leicht:** Wählt ein zufälliges Plättchen vom Jahrmarkt und legt es an eine zufällige gültige Stelle.
- **Mittel:** Maximiert die sofortige Dorf-Vielfalt und legt Plättchen an, die eigene Hofaufträge direkt erfüllen.
- **Schwer:** Bewertet Züge mehrdimensional: prüft Teilschritte für offene Aufträge (Verbindungen zu Teichen, Wegen, Wäldern), blockiert gegnerische Vorlagen und optimiert Dorf-Positionen.

## Befunde der Bot-Probe

In 1000 simulierten Partien (Bericht in [`grafschaft-probe.md`](grafschaft-probe.md)):
- **Faire Chancen:** Alle 4 Startplätze liegen zwischen 21,5 % und 25,7 % Siegquote (fair: 25 %).
- **Können entscheidet:** Ein planender Bot schlägt Zufallsspieler in 97,6 % der Partien.
- **Spannung:** Durchschnittlich 4,2 Punkte Abstand zwischen Platz 1 und 2.
