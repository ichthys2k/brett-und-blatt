# Spieler rund um einen Tisch (W-020) – Umsetzungsplan

Stand 1.11.2026. Der Pilot mit Mau-Mau und Skat ist gebaut und nach Cornelius' erstem Test umgebaut, die übrigen Spiele warten auf Cornelius' Urteil dazu.

## Ziel

Bei genug Platz sitzen die Spieler wie beim Poker um einen Tisch, das Spielgeschehen liegt in der Mitte. Das Handy bleibt, wie es ist.

## Ausgangslage

- `Play.tsx` zeigt alle Spieler als `PlayerChip` in der Spielerleiste, im Querformat links in der Seitenleiste. Das Spielfeld (`ui.Board`) kennt diese Leiste nicht.
- **Poker** hat schon einen eigenen ovalen Tisch (`seatCoordinates` in `packages/games/poker/src/ui/index.tsx`), der eigene Platz sitzt unten.
- **Stichspiele** (Skat, Schafkopf, Doppelkopf, Binokel) legen den Stich über `TrickTable` räumlich in die Mitte, die Plätze ordnen sich schon um den eigenen (`bottomSeat`).
- **Viele Kartenspiele** zeigen die Mitspieler zusätzlich als eigene Reihe im Spielfeld, mit Kartenzahl oder offener Auslage: Mau-Mau (`mau-opponents`), Präsident (`prs-opponents`), Elf zuerst! (`elv-others`), Schwarzer Peter (`bp-others`), Quartett (`qt-others`), Tiefflug (`lf-others`), Eins!. Diese Reihen enthalten Spielwissen, das der allgemeine Chip nicht hat.

Der Spieler erscheint dort also doppelt. Am Tisch darf er nur noch einmal vorkommen.

## Welche Spiele

| Gruppe | Spiele | Tisch? |
| --- | --- | --- |
| Hat schon einen Tisch | Poker | bleibt; später auf den gemeinsamen Baustein umstellen |
| Stichspiele | Skat, Schafkopf, Doppelkopf, Binokel | ja, am einfachsten: die Mitte steht schon |
| Karten und Würfel reihum | Mau-Mau, Eins!, Elf zuerst!, Präsident, Schwarzer Peter, Quartett, Domino, Mäxle, Tiefflug | ja |
| Brett mit festen Plätzen | Nicht ärgern!, Sternhalma, Vierer-Schach, Rübenacker, Marktplatz | nein: das Brett zeigt die Plätze schon |
| Zwei Spieler | Schach, Go, Reversi usw. | nein: kein Gewinn |
| Alle gleichzeitig, bis 30 Plätze | Klassenspiele, Bingo, Bibel-Quiz, Enten-Rallye usw. | nein: passt nicht in einen Ring |
| Eigene Arena | Narrenhof, Drachenspiel, Kartenblitz, Speed, Wortgitter | nein |

## Wege

**A – Der Rahmen setzt die Chips um das Spielfeld, das Spiel bleibt unverändert.** Geringster Aufwand, aber die Mitspieler-Reihen im Spielfeld blieben als Doppelung stehen, und Karten liegen nicht bei ihrem Spieler.

**B – Gemeinsamer Baustein, jedes Spiel füllt seine Plätze (Empfehlung).** Neuer Baustein `SeatRing` in `packages/ui`; das Spiel gibt je Platz seinen Inhalt hinein (etwa den kleinen Kartenfächer), die Mitte bleibt sein Spielgeschehen. Das kostet je Spiel etwas Arbeit, sieht aber aus wie ein echter Tisch und lässt sich Spiel für Spiel einführen.

**C – Jedes Spiel baut seinen Tisch selbst, wie bisher Poker.** Am freiesten, führt aber zu vielen ähnlichen Kopien. Verworfen.

## Bauplan für Weg B

1. **`SeatRing` (`packages/ui`).** Rechnet die Plätze auf einem Oval aus (Formel aus Poker), der eigene Platz sitzt unten, die Mitte ist ein freier Bereich. Reihenfolge im DOM bleibt die Sitzfolge, damit Tastatur und Vorleser ihr folgen können.
2. **Wann der Tisch gilt.** `Play.tsx` misst die Spielfläche mit `useElementSize`: gemessen am freien Platz, nicht am Gerät, mindestens 680 × 560 px und 3 bis 8 Spieler (`seatRingFits`, ausprobiert: damit gilt der Tisch ab 1024 × 768 im Querformat und auf Tablets im Hochformat). Sonst zeigt das Spiel seine bisherige Reihe. So ist „nicht auf dem Handy“ von selbst erfüllt, auch beim gedrehten Tablet.
3. **`GameUi.seatsAround` und `BoardProps.table`.** Das Spiel meldet, dass es am Tisch selbst die Plätze zeigt; passt der Tisch, bekommt es `table.seatChip` und setzt `SeatRing`. `Play.tsx` blendet dann die Spielerleiste aus; Kopfzeile, Status und Knöpfe bleiben in der Seitenleiste. Der Chip selbst (Name, Uhr, „ist dran“, abwesend, Punkte) wird im Platz wiederverwendet, nichts davon geht verloren.
4. **Blickrichtung.** Unten sitzt der eigene Platz, online und allein gegen Bots. Zuschauer sehen Platz 0 unten. Am selben Gerät dreht der Tisch mit dem Spieler am Zug: Unten liegt seine Hand, `TrickTable` dreht ebenso, und der Übergabe-Bildschirm trennt die Wechsel. Im Pilot so entschieden; ein fester Tisch hätte die eigene Hand vom eigenen Platz getrennt.
5. **Pilot: Mau-Mau und Skat.** Je ein Spiel mit und ohne `TrickTable`. Danach gemeinsam ansehen, bevor es weitergeht.
6. **Ausrollen.** Erst die übrigen Stichspiele, dann Elf zuerst!, Präsident, Schwarzer Peter, Eins!, zuletzt Quartett, Domino, Mäxle, Tiefflug. Am Ende Poker auf `SeatRing` umstellen.

## Prüfung

- Der Rauchtest läuft bisher im Handy-Hochformat. Dazu kommt ein Durchlauf mit Tisch-Maßen (1280 × 800) und höchster Platzzahl je umgestelltem Spiel: nichts überlappt, nichts ragt heraus, die Seite rollt nicht.
- Die Regel aus F-011 bleibt: Die Knöpfe unter dem Spielfeld sind erreichbar.
- Im Hochformat ändert sich nichts; das zeigen die Bilder des Rauchtests vor und nach dem Umbau.
- Geheimnisse sind nicht betroffen, weil nur die vorhandene Sicht anders angeordnet wird. Die Spielregeln und `ruleVersion` bleiben unverändert.

## Risiken

- **Enge bei acht Plätzen.** Eins! geht bis 10 Plätze, die obere Grenze für den Tisch ist deshalb 8; darüber bleibt die Reihe.
- **Flug-Animationen.** Mau-Mau und Eins! lassen Karten fliegen. Die Start- und Zielpunkte müssen zum neuen Platz passen.
- **Rollendes `main`.** Der Tisch darf nicht mitrollen, er braucht die volle Höhe der Spielfläche.

## Aufwand

Baustein und Rahmen etwa ein Arbeitsgang, die beiden Pilotspiele ein weiterer. Jedes weitere Spiel ist deutlich kleiner, die Stichspiele am kleinsten.

## Stand des Piloten

- Gebaut: `packages/ui/src/SeatRing.tsx`, Rahmen in `Play.tsx`, Mau-Mau und Skat. Weg B; der Tisch gilt bei genug Platz immer, ohne Schalter (Vorschlag, Cornelius hat nicht widersprochen).
- Der Rauchtest prüft Mau-Mau zu fünft und Skat zu viert bei 1024 × 768, 1280 × 800 und auf dem Handy.
- Nebenbei behoben: `TrickTable` legte am Vierertisch Karten falsch, wenn ein Platz aussetzte; Übergabe- und Pausenbildschirm lagen in Mau-Mau hinter der Tischmitte und ließen sich dort nicht antippen; die Spielerzeichen von Mau-Mau waren hell auf hell.

## Nach Cornelius' Test (1.11.2026)

Rückmeldung zu Mau-Mau am Desktop: Die Mitte soll größer sein, die linke Leiste soll entfallen. Umgesetzt:

- Am Tisch gibt es keine Seitenleiste mehr. Darüber liegt nur eine Kopfzeile: Zurück, Name, Raumcode, Zug zurück, Tipp, Menü „⋯“ (Neu starten, Aufgeben, Lobby), Hilfe, Ton, Pause. Online-Reaktionen liegen unter dem Tisch.
- „Du bist dran“ und der Status stehen neben dem eigenen Platz (`BoardProps.table.status`, `SeatRing.status`).
- Ob der Tisch gilt, misst `Play.tsx` am ganzen Fenster abzüglich Kopfzeile, nicht am Spielfeld: Das wächst durch den Wegfall der Leiste selbst und ließe das Layout sonst springen.
- Die Tischmitte ist ein Größen-Container: Spiele bemessen ihre Mitte mit `cqw`/`cqh`. Mau-Mau-Stapel wachsen bei 1280 × 800 von 88 auf 121 px, in Full HD auf etwa 220 px; die Handkarten wachsen am Tisch mit der Fensterhöhe.

Spiele ohne `seatsAround` behalten ihre Leiste.

## Offene Frage an Cornelius

Gefällt der Tisch so, dass die übrigen Spiele (Schritt 6) folgen sollen?
