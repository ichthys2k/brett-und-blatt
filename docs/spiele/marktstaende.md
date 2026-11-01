# Marktstände

*Kartenspiel für 2–10 Spieler: Alle wählen gleichzeitig eine Karte, dann legt jeder selbst an einen von vier Ständen. Wer abräumt, füllt seine Vorratskammer, aber jeder Händler lebt nur von einer Ware.*

> **Eigene Fassung** statt eines Nachbaus von 6 nimmt! (W-039, Paket C). Die Wertung stammt aus der [Bot-Probe](marktstaende-probe.md), von Cornelius am 1.11.2026 freigegeben.

| Steckbrief | |
|---|---|
| Spieler | 2–10 |
| Modi | Solo gegen Bots, Hot-Seat, online |
| Muster | gleichzeitig, verdeckt |
| Ordner | `packages/games/market-stalls` |

## Regeln

- **Karten:** 60 Karten, Zahlen 1–60, je 15 in Brot, Käse, Äpfel und Fisch, je Ware 5 × 0, 5 × 1 und 5 × 2 Sterne. Die Zuordnung ist fest (`CARD_TABLE`).
- **Austeilen:** Vier Karten eröffnen die Stände. Handkarten bis 5 Spieler 10, sonst 56 geteilt durch die Spielerzahl (6: 9, 7: 8, 8: 7, 9: 6, 10: 5).
- **Runde:** Alle wählen verdeckt und endgültig eine Karte. Dann wird aufgedeckt und von der kleinsten Zahl an gelegt.
- **Legen:** Erlaubt ist ein leerer Stand, ein Stand mit kleinerer oberster Karte oder einer mit derselben Ware obenauf. Bleibt nur ein Stand, legt das Spiel von selbst.
- **Abräumen:** Die fünfte Karte nimmt alle fünf, der Stand ist leer. Passt die Karte nirgends, wählt man einen Stand, nimmt dessen Karten und eröffnet ihn neu.
- **Markttage:** Nach dem Ausspielen bringt der nächste Markttag alle 60 Karten neu, die Kammern bleiben. Eine Karte kann also mehrmals in Kammern liegen.
- **Wertung:** Nur die eigene stärkste Ware (meiste Karten, bei Gleichstand meiste Sterne, dann die Reihenfolge Brot, Käse, Äpfel, Fisch) zählt plus, wenn man dort die meisten Karten aller Spieler hat; Gleichstand an der Spitze zählt für alle. Alle anderen Sterne zählen minus.
- **Sieg:** Meiste Punkte, bei Gleichstand meiste Sterne der stärksten Ware, sonst geteilt.

## Optionen

- `days`: `3` (Standard), `1` (kurz; in der Probe jede siebte Partie punktgleich).

## Bot „Marktschreier“

Leicht wählt zufällig. Mittel wählt die Karte, die sofort am meisten bringt, und rechnet den Stand durch. Schwer spielt die Runde je Handkarte sechsmal mit vermuteten Karten der anderen durch.

## Offen

- Eigene Klänge (Auswahl durch Cornelius); bisher vorhandene Kartenklänge.
- `SeatRing` (W-020) noch nicht genutzt.
- Probepartien mit Menschen: Spieldauer und Wirkung der häufigen Minuspunkte.
