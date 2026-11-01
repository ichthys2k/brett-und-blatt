# Rübenacker

*Laufspiel für Kinder ab etwa 4 Jahren, 2–6 Spieler: Hasen laufen zur Riesenrübe des Königs, Gärtner Maulwurf gräbt Löcher – aber man sieht vorher, wo.*

> **Name und Herkunft:** eigene Fassung in der Art von „Lotti Karotti“ (Ravensburger); Name, Brett, Drehkarotte und Bilder sind eigen. Arbeitstitel „Rübenacker“, id `turnip-patch` (W-042, Etappe 7 der Planungsliste, Paket A, Entwurf von Cornelius freigegeben am 1.11.2026).

| Steckbrief | |
|---|---|
| Spieler | 2–6 |
| Modi | Solo gegen Bots, Hot-Seat, online |
| Muster | Zug um Zug, offen bis auf die Reihenfolge im Kartenstapel |
| Bausteine | SVG-Beet mit Schlangenweg, Kartenstapel aus dem Seed |
| Aufwand | Regeln S, Oberfläche M, Bot S |
| Ordner | `packages/games/turnip-patch` |

## Regeln

- **Setting:** Im Königsgarten unter der Narrenhof-Burg wächst die Riesenrübe. Hasenfamilien wollen sie als Erste erreichen, Gärtner Maulwurf gräbt unter dem Beet.
- **Weg:** Wiese (Start) → Felder 1 bis 24 als Schlangenweg → Rübe. Zaunpfähle stehen an den Feldern 7, 13 und 19.
- **Hasen:** je Spieler 3 (Option: 2 oder 1), alle auf der Wiese.
- **Karten statt Würfel:** 28 Karten (10 × 1, 7 × 2, 5 × 3, 6 × Maulwurf), gemischt aus dem Seed; ist der Stapel leer, werden die gezogenen Karten neu gemischt.
- **Zahlenkarte:** Ein Hase deiner Wahl hüpft so viele Felder vorwärts. Besetzte Felder werden übersprungen und nicht mitgezählt. Wer über Feld 24 hinauskommt, ist an der Rübe.
- **Maulwurf:** Der Maulwurf taucht am Erdhügel auf. Ein Hase auf diesem Feld purzelt ins Loch und muss zurück zum letzten Zaunpfahl dahinter (Option „streng“: zurück auf die Wiese). Danach wandert der Hügel auf der Maulwurfspur (8 → 3 → 14 → 20 → 5 → 16 → 10 → 22 → 12 → 18 → von vorn) zum nächsten Loch.
- **Eigene Wendung gegenüber dem Vorbild:** Der nächste Hügel ist immer zu sehen (der übernächste blass), und die Zahl der Maulwurfkarten im Stapel steht daneben. Kinder können ausweichen und planen.
- **Sieg:** Wer zuerst einen Hasen an der Rübe hat (Option: alle Hasen).

## Spielmodell

`TurnipState` mit Feld je Hase, Stapel (in der Sicht verdeckt), offenen gezogenen Karten, Stelle des Hügels auf der Spur und gezogener Zahlenkarte. Züge `draw` und `hop` (Hase). `sampleHidden` mischt die noch nicht gezogenen Karten neu.

## Bot „Langohr“

- **leicht:** jedes zweite Mal ein zufälliger Hase, sonst wie mittel (gewinnt gegen „schwer“ etwa 11 %).
- **mittel:** vorderster Hase, aber nicht auf den Erdhügel.
- **schwer:** bewertet Fortschritt und Gefahr am Hügel und am nächsten Hügel nach den Maulwurfkarten im Stapel; gegen Zufall 299 von 300, gegen „mittel“ etwa 52 % (viel Glück im Spiel).

## Oberfläche

Beet von unten (Wiese) nach oben (Rübe), Löcher mit dunklem Rand, Erdhügel als Haufen, gepunktete Spur zum nächsten Hügel. Kartenstapel hüpft, wenn man ziehen muss; die gezogene Karte dreht sich auf. Danach hüpfen die wählbaren Hasen, ihre Ziele leuchten gelb (rot, wenn auf dem Hügel). Der Maulwurf springt aus dem Loch. Klänge `karte-umdrehen`, `stein-ziehen`, `stein-fallen`, `nh-jubel`, `sieg`; Playlist „Spielabend“.

## Offen

- Eigene Klänge (Maulwurf, Hasenhüpfer) nach Auswahl durch Cornelius.
- Endgültiger Name (Arbeitstitel Rübenacker).
