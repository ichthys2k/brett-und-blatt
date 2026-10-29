# Tiefflug (Skyjo-artig)

*Familien-Kartenspiel für 2–8 Spieler: zwölf verdeckte Karten im Raster, tauschen, aufdecken, Spalten abräumen – die niedrigste Summe gewinnt.*

> **Name:** „Skyjo“ ist eine Marke von Magilano. Arbeitsname **„Tiefflug“** (wer am tiefsten fliegt, gewinnt), id `low-flight`.

| Steckbrief | |
|---|---|
| Spieler | 2–8 |
| Modi | Solo gegen Bots, Hot-Seat, online |
| Muster | Zug um Zug, verdeckt (auch für den Besitzer!) |
| Bausteine | eigene Zahlenkarten (Farbe nach Wert), Kartenraster 3×4, Serien-Abrechnung wie bei Würfelblock/Kartenblitz |
| Aufwand | Regeln S, Oberfläche M, Bot M |
| Ordner | `packages/games/low-flight` |

## Regeln (Grundspiel)

- **Karten:** 150 Stück: −2 (5×), −1 (10×), 0 (15×), 1 bis 12 (je 10×). Farbe nach Wert (dunkelblau für negativ, hellblau 0, grün 1–4, gelb 5–8, rot 9–12), dazu die Zahl groß – lesbar ohne Farbe.
- **Austeilen:** Jeder bekommt 12 Karten verdeckt als Raster mit 3 Zeilen und 4 Spalten. Eine Karte beginnt den Ablagestapel, der Rest ist Nachziehstapel.
- **Start:** Jeder deckt **zwei** eigene Karten auf (gleichzeitig). Wer die höhere Summe hat, beginnt; in späteren Runden beginnt, wer die letzte beendet hat.
- **Zug:** entweder
  - die **oberste Ablagekarte** nehmen und gegen eine beliebige eigene Karte (offen oder verdeckt) tauschen – die getauschte kommt offen auf die Ablage; oder
  - eine Karte vom **Nachziehstapel** ziehen und dann entweder gegen eine eigene tauschen oder abwerfen und dafür eine eigene verdeckte Karte aufdecken.
- **Spalte abräumen:** Zeigen alle drei Karten einer Spalte offen denselben Wert, kommen sie auf die Ablage und zählen nicht mehr.
- **Rundenende:** Hat jemand alle Karten offen, ist jeder andere noch genau einmal dran. Dann werden alle Karten aufgedeckt (Spalten werden auch jetzt noch abgeräumt) und summiert.
- **Verdopplung:** Hat der Spieler, der die Runde beendet hat, nicht *allein* die niedrigste Summe und ist seine Summe positiv, zählt sie doppelt.
- **Partieende:** Sobald jemand 100 Punkte oder mehr hat. Es gewinnt die niedrigste Gesamtsumme.

## Varianten (Optionen)

- **Partielänge:** bis 100 (Standard), bis 50, feste Rundenzahl (3/5).
- **Verdopplung** an/aus.
- **Zeilen abräumen:** auch vier gleiche Werte in einer Zeile verschwinden (beliebte Hausregel).
- **Diagonalen abräumen** (Hausregel, eher Spielerei; nur wenn einfach).
- **Gedächtnis-Modus:** Ausgetauschte Karten auf der Ablage sind nur kurz zu sehen; für Fortgeschrittene.
- **Junior:** eigener, vereinfachter Regelsatz für Kinder (siehe unten).

## Junior

Die offiziellen Regeln von Skyjo Junior sind im Netz kaum zu finden. Bekannt ist: Fruchtkarten mit Werten 1–5 (je mehr Früchte, desto mehr wert), 12 verdeckte Karten im Raster 3×4, pro Zug eine Karte aufdecken und behalten oder tauschen, drei gleiche Karten in einer Spalte „sichern“ Punkte. Uneinheitlich angegeben ist, ob die höchste oder die niedrigste Summe gewinnt.

**Vorschlag für eine eigene Kinderfassung** (bis Cornelius die Originalregeln bestätigt):

- Karten 1–5 als Obst (🍒 1, 🍓 2, 🍋 3, 🍎 4, 🍉 5 – Früchte zum Abzählen auf der Karte), nur Zählen, keine negativen Zahlen.
- Raster 3×3 statt 3×4 (kürzere Runden), am Anfang eine Karte aufdecken.
- Zug wie im Grundspiel.
- Drei gleiche Früchte in einer Spalte werden **zur Sammlung** gelegt und bringen ihren Wert als *Pluspunkte*; am Ende gewinnt, wer **die meisten Früchte gesammelt** und **die wenigsten offen liegen** hat? – oder einfacher: niedrigste Summe wie im Grundspiel. **Muss mit Cornelius entschieden werden.**
- Keine Verdopplung, eine Runde oder drei Runden.
- Bot leicht als Standard, Hinweise („Diese Spalte hat schon zwei 🍎“).

## Spielmodell

- **Phasen:** `reveal` (gleichzeitig zwei Karten aufdecken), `turn` (`takeDiscard` bzw. `drawPile`, dann `swap` oder `discardAndReveal`), `lastRound`, `roundEnd` (`ready`), `gameEnd`.
- **Sicht:** Verdeckte Rasterkarten sind für **alle** unbekannt (auch für den Besitzer) und erscheinen als `null`; offen sind Rasterkarten, Ablage, gezogene Karte (die sieht im Original nur der Ziehende – kurz danach liegt sie aber ohnehin offen). Nachziehstapel und `rng` verdeckt. `sampleHidden` verteilt die unbekannten Karten auf Raster und Stapel.
- Zustand reines JSON: Raster als 12 Felder `{ value, open } | null` (null = abgeräumt).

## Bot

„Wolkenspringer“:

- **leicht:** nimmt Ablage nur bei Werten ≤ 2, tauscht sonst mit der höchsten offenen Karte, deckt zufällig auf.
- **mittel:** Erwartungswert der verdeckten Karten aus den bekannten Restkarten (Kartenzählen), baut gezielt Spalten, vermeidet, hohe Karten für den Nachbarn auf die Ablage zu legen, wenn dieser damit eine Spalte schließt.
- **schwer:** wie mittel, plus Rundenende-Taktik: beendet die Runde nur, wenn die eigene Summe sicher genug unter der geschätzten Gegnersumme liegt (Verdopplung), und spielt in der letzten Runde auf minimale Summe statt Aufbau.

## Zeitlimits

Gemütlich (ohne Uhr), Normal 30 s je Zug, Schnell 15 s.

## Oberfläche

- Eigenes Raster unten groß, Mitspieler-Raster verkleinert darüber (wischbar ab 4 Spielern), Stapel und Ablage in der Mitte.
- Ablauf in zwei Tipps: Quelle wählen (Ablage oder Stapel), dann Zielfeld (oder „Abwerfen“ und verdeckte Karte antippen). Ziehen per Drag & Drop ebenso.
- Animation: Karte umdrehen (3D-Flip), Tausch fliegt, abgeräumte Spalte fällt weg. Zwischensumme der offenen Karten neben jedem Raster.
- Rundenende-Tabelle mit Verdopplung hervorgehoben.
- Klänge: `karte-ziehen`, `karte-legen`, `mischen`, Spalte abgeräumt ein fröhlicher Effekt (Auswahl durch Cornelius). Playlist „Spielabend“, Rubrik Familie.

## Hot-Seat und Online

- Hot-Seat ohne Übergabe-Bildschirm möglich, weil niemand etwas Geheimes sieht (verdeckt ist verdeckt für alle). Nur die frisch gezogene Karte ist kurz privat – akzeptabel.
- Online-Eintrag in `apps/server/src/games.ts` und `apps/server/package.json`.

## Tests

- Kartenzahl 150, Austeilen, Startspieler, beide Zugarten, Spalte (und Zeile) abräumen, letzte Runde, Verdopplung (allein niedrigste vs. Gleichstand), Partieende bei 100.
- Junior-Regelsatz eigens.
- `gameContractChecks`, Prüfstand, Bot schwer gegen Zufall.

## Offene Punkte

- Endgültiger Name („Tiefflug“, „Minus-Mix“, „Zwölferraster“?).
- Junior-Regeln mit Cornelius klären (Originalschachtel?).
- Skyjo Action (Aktionskarten) als spätere Erweiterung?
