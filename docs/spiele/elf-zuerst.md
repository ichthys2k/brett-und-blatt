# Elf zuerst! (Elfer raus)

*Familien-Anlegespiel für 2–6 Spieler: Jede Farbe beginnt mit ihrer Elf, danach wird nach oben und unten angelegt. Wer zuerst keine Karten mehr hat, gewinnt.*

> **Name:** „Elfer raus!“ ist ein Spieltitel von Ravensburger. Eigener Name **„Elf zuerst!“**, id `elevens` (W-033, Etappe 7 der Planungsliste, Paket A).

| Steckbrief | |
|---|---|
| Spieler | 2–6 |
| Modi | Solo gegen Bots, Hot-Seat, online |
| Muster | Zug um Zug, verdeckt |
| Bausteine | eigene Zahlenkarten 1–20 in vier Farben, Auslage als 4×20-Raster, `CardFan` |
| Aufwand | Regeln S, Oberfläche M, Bot S |
| Ordner | `packages/games/elevens` |

## Regeln

- **Karten:** 80 Stück, die Zahlen 1 bis 20 in Rot, Gelb, Grün und Blau.
- **Austeilen:** Zu zweit je 20 Karten, sonst 60 Karten gleichmäßig (3: 20, 4: 15, 5: 12, 6: 10). Der Rest ist der verdeckte Stapel.
- **Eröffnung:** Wer die rote Elf hat, beginnt und muss sie legen. Liegt sie im Stapel, eröffnet die gelbe, dann die grüne, dann die blaue Elf (Option „freier Start“: Platz 1 beginnt, jede Elf eröffnet).
- **Anlegen:** Eine Farbe beginnt mit ihrer Elf; danach passen nur die Zahl direkt unter der niedrigsten und direkt über der höchsten Karte der Reihe.
- **Zug:** Wer kann, muss mindestens eine Karte legen und darf danach weitere legen oder „Fertig“ sagen. Wer nicht kann, zieht – je nach Option bis zu drei Karten (Standard), eine Karte oder so lange, bis eine passt. Passt danach nichts, ist der Nächste dran.
- **Ende:** Wer zuerst keine Karten mehr hat, gewinnt.

## Optionen

- `draw`: `3` (Standard), `1`, `match` (ziehen bis passend).
- `start`: `red` (mit der roten Elf, Standard), `free`.

## Spielmodell

`ElevensState` mit Händen, Stapel, Reihen als `{ low, high }` je Farbe, `played`/`drawn` für den laufenden Zug und `opening` für die Pflicht-Elf. Fremde Hände und der Stapel sind in der Sicht `?`; `sampleHidden` verteilt die unbekannten Karten neu. Der Zug endet von selbst, wenn nichts mehr geht.

## Bot „Zahlenzwerg“

- **leicht:** legt zufällig, hört manchmal früh auf.
- **mittel:** legt zuerst Karten, auf die eigene folgen (längste eigene Kette).
- **schwer:** hält Karten zurück, die nur den anderen eine Reihe öffnen, sobald er schon gelegt hat; muss er so eine Karte legen, nimmt er die, hinter der seine nächste eigene Karte am nächsten liegt. In 200 Partien: gegen Zufall 64 %, gegen „mittel“ zu zweit 78 %, gegen drei „mittel“ 64 %. Das Spiel ist stark glücksabhängig; im Prüfstand mit 8 Partien schwankt das Ergebnis (zuletzt 4/8).

## Oberfläche

Oben die vier Reihen als 4×20-Raster (gelegte Karten farbig, anlegbare Felder hervorgehoben und antippbar, Elfen gestrichelt), darunter Statuszeile, „Ziehen (n/3)“ und „Fertig“/„Weitergeben“, unten die Hand im `CardFan` (passende Karten hervorgehoben). Klänge `karte-legen`, `karte-ziehen`; Playlist „Kartentisch“.

## Offen

- Eigene Klänge (z. B. Ausruf beim Gewinn) nach Auswahl durch Cornelius.
