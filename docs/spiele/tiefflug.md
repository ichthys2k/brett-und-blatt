# Tiefflug (Skyjo-artig)

*Familien-Kartenspiel für 2–8 Spieler: zwölf verdeckte Karten im Raster, tauschen, aufdecken, Spalten abräumen – die niedrigste Summe gewinnt.*

> **Name:** „Skyjo“ ist eine Marke von Magilano. Eigener Name **„Tiefflug“** (wer am tiefsten fliegt, gewinnt; von Cornelius bestätigt 29.10.2026), id `low-flight`.

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

## Umsetzung (29.10.2026)

- **Regeln** (`src/rules.ts`):
  - Grundspiel wie oben, 150 Karten.
  - Abweichung: Zu Rundenbeginn wird **reihum** statt gleichzeitig aufgedeckt (einfacher für Hot-Seat und online; verrät nichts, weil verdeckte Karten für alle verdeckt sind).
  - Runde 1 beginnt, wer die höchste offene Summe zeigt, später wer die vorige Runde beendet hat.
  - Ist der Stapel leer, wird die Ablage ohne oberste Karte gemischt.
  - Abgeräumte Spalten gehen auf die Ablage; auch beim Aufdecken am Rundenende wird abgeräumt.
  - Verdopplung nur, wenn die Summe des Beenders positiv ist und er nicht allein die niedrigste hat.
- **Optionen:** Spielart Klassisch/Junior, Spieldauer bis 100 (Standard) oder 50 Punkte, 3 Runden oder eine Runde. Verdopplung an/aus, Zeilen abräumen.
- **Junior** (eigene Fassung, entschieden 29.10.2026): Obstkarten 1–5 (🍒 🍓 🍋 🍎 🍉, je 18 = 90 Karten, Früchte zum Abzählen auf der Karte), Raster 3 × 3, eine Karte zu Beginn aufdecken. Die niedrigste Summe gewinnt wie im Grundspiel, keine Verdopplung, 3 Runden (oder eine).
- **Sicht:** Verdeckte Werte sind für alle `null`, auch für den Besitzer (`privateViews: false`, darum kein Übergabe-Bildschirm). Die gezogene Karte und die ganze Ablage sind offen, der Stapel nur als Anzahl. `sampleHidden` verteilt die ungesehenen Werte auf Raster und Stapel.
- **Bot „Wolkenspringer“** (`src/bots.ts`):
  - leicht: Ablage nur bei ≤ 2, tauscht gegen die höchste offene Karte, wirft hohe Karten ab.
  - mittel: bewertet jede Platzierung danach, wie stark die Spaltensumme sinkt; abgeräumte Spalten zählen mit. Verdeckte Karten setzt er mit dem Erwartungswert der ungesehenen Karten minus 1,5 an (in Probepartien am besten), dazu kommt ein Bonus für den Aufbau gleicher Spalten.
  - schwer: zusätzlich Vorsicht beim Rundenende – deckt die letzte Karte nur auf, wenn die eigene Summe klar unter der geschätzten der anderen liegt (sonst droht die Verdopplung).
  - Gemessen in 80 Partien zu zweit: mittel gewinnt 60 gegen leicht, schwer 67 gegen leicht und 46 gegen mittel.
- **Oberfläche** (`src/ui/`, Präfix `lf-`):
  - Himmel-Hintergrund (Junior gelb), Mitspieler-Raster verkleinert oben mit Summe der offenen Karten, Stapel – gezogene Karte – Ablage in der Mitte, eigenes Raster unten.
  - Antippen: Stapel oder Ablage, dann ein Feld zum Tauschen. Zum Abwerfen die Ablage oder „Abwerfen & aufdecken“ antippen, dann eine verdeckte Karte.
  - Karten nach Wert gefärbt, die Zahl groß darauf (lesbar ohne Farbe). Aufdeck-Animation, Tipp-Hervorhebung, Rundenende-Tabelle mit hervorgehobener Verdopplung.
- **Klänge** aus dem Katalog: `aufdecken`, `karte-ziehen`, `karte-legen`, `paar` (Spalte abgeräumt), `ansage` (letzte Runde), `mischen`. Playlist „Spielabend“, Rubrik Familie, online eingetragen.

## Offene Punkte

- Gedächtnis-Modus (Ablage nur kurz sichtbar).
- Diagonalen abräumen.
- Skyjo Action (Aktionskarten) als spätere Erweiterung?
- Junior mit Originalregeln abgleichen, falls Cornelius sie nachliefert.
