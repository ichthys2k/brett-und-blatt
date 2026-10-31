# Kernschleifen – Plan für befriedigendere Spielabläufe (W-013)

Stand: 31.10.2026. Dieser Plan betrachtet für jedes Spiel die **Kernschleife**: die Handlung, die man immer wieder macht. Er hält fest, was heute passiert, und sammelt Ideen, wie sich diese Handlung mit Animation, Klang und kleinen Rückmeldungen richtig gut anfühlt. Umgesetzt wird danach Spiel für Spiel nach der Rangfolge unten, ein PR je zwei bis vier Spiele.

Klänge sind in allen Spielen schon eingebunden (`gameUi.sounds`). Neue Klänge entstehen nur nach Auswahl durch Cornelius (Klang-Sitzung, siehe `klaenge-alle-spiele.md`); dieser Plan nennt sie deshalb nur als Wunsch.

## Grundsätze

1. **Jede Handlung bekommt eine Antwort in unter 100 ms** – ein Klick ohne sichtbare Reaktion fühlt sich kaputt an. Danach darf die eigentliche Animation laufen.
2. **Animationen erzählen, was passiert ist:** Woher kam der Stein, wohin ging die Karte, wer hat den Stich bekommen? Besonders wichtig bei Zügen der Bots und der Mitspieler online, die man sonst verpasst.
3. **Kurz halten:** Häufige Handlungen höchstens 300 ms, Würfe und Aufdecken bis etwa 1 s, Höhepunkte (Rundensieg, Bingo, Mühle) bis 2 s – und nie das Weiterspielen blockieren.
4. **Steigerung statt Gleichförmigkeit:** Seltene, gute Ereignisse (Sechs, Pasch, Fünferpasch, Mühle, Schneider, lange Wörter) bekommen sichtbar mehr Glanz als gewöhnliche.
5. **Barrierefreiheit:** Bei `prefers-reduced-motion` nur kurze Überblendungen; nichts darf allein über Bewegung oder Klang mitgeteilt werden.
6. **Nur aus Sicht und Ereignissen:** Animationen lesen `events` und die Sicht, nie den vollen Zustand. Geheimes (verdeckte Karten, Würfel unter dem Becher) bleibt geheim.

## Gemeinsame Bausteine

Bausteine, die viele Spiele tragen, kommen zuerst – sonst entsteht dieselbe Arbeit vielfach.

| Baustein | Wo | Für | Stand |
| --- | --- | --- | --- |
| **3D-Würfel** `Die3D` + `useRollCounter` | `packages/ui/src/dice/` | Würfelblock, Mäxle, Nicht ärgern! | ✅ fertig (W-010, Etappe 4) |
| **Siegerehrung** über den ganzen Bildschirm | `apps/web/src/components/Ceremony.tsx` | alle Spiele, online für alle | ✅ fertig (W-008, Etappe 4) |
| Gleiten von Figuren `useGridMoveAnimation` | `packages/ui/src/dnd/` | Schach, Vierer-Schach, Dame | vorhanden; ausweiten auf Mühle, Ultimate, Gomoku (Setzen) |
| Karten-Flug `useSpawnAnimation` | `packages/ui/src/dnd/` | Eins!, Mau-Mau | vorhanden; ausweiten auf Stichspiele, Präsident, Schwarzer Peter |
| **Punkte-Fähnchen** `ScorePop` + `useLatestEvent` | `packages/ui/src/effects/` | Würfelblock, Wortgitter, Farbe & Form; später Domino, Quiz-Spiele, Narrenhof | ✅ fertig (Schritt 2) |
| **Karte in den Stich, Stich zum Gewinner** | `TrickTable` (`bub-trick-in`, `useTrickDisplay` 1 s) | Skat, Schafkopf, Doppelkopf, Binokel; Präsident eigens | ✅ fertig (Schritt 3) |
| **Stein-Plopp** (Klasse `bub-plop`) | `packages/ui/src/ui.css` | Reversi, Farbe & Form, Wortgitter; später Gomoku, Go, Mühle, Teiler-Duell | ✅ fertig (Schritt 2) |
| **Rundenende-Zwischenstand** (Punkte zählen hoch, Rangwechsel gleitet) | neu, ähnlich `Ceremony` | Serien-Spiele: Stichspiele, Tiefflug, Präsident, Kartenblitz, Speed, Mäxle (Leben) | offen – mittel; ergänzt W-008, das nur das Partieende abdeckt |
| Vibration (`navigator.vibrate`) bei Treffern und Fehlern | `apps/web/src/lib/` | Echtzeit- und Würfelspiele | offen – klein, mit Schalter in den Ton-Einstellungen |

## Spiele im Einzelnen

Spalten: **Kernhandlung** – was man immer wieder tut. **Heute** – was dabei zu sehen und zu hören ist. **Ideen** – was die Handlung befriedigender macht. **W/A** – Wirkung je Aufwand (★★★ = viel Wirkung für wenig Arbeit). Die Spalte „Heute“ beruht auf einem Durchgang durch Oberflächen-Code, Klangtabellen und CSS-Animationen; vor der Umsetzung je Spiel im Browser nachsehen.

### Brett und Strategie

| Spiel | Kernhandlung | Heute | Ideen | W/A |
| --- | --- | --- | --- | --- |
| Tic-Tac-Toe | Zeichen setzen | Zeichen zeichnen sich mit Strich-Animation, Klang; Gewinnlinie wird durchgezogen (Schritt 2) | fertig | – |
| Vier in einer Reihe | Stein einwerfen | Fall-Animation, Klang | Aufprall mit kleinem Nachfedern, Gewinnreihe leuchtet nacheinander auf | ★★ |
| Ultimate Tic-Tac-Toe | Zeichen setzen, Zielfeld wechselt | Hervorhebung, Klang bei gewonnenem Kleinfeld | Pfeil/Gleiten vom gesetzten Feld zum Zielbrett, gewonnenes Kleinfeld klappt zum großen Zeichen um | ★★★ |
| Reversi | Stein setzen, Steine drehen | Steine drehen nacheinander (60 ms Versatz), gesetzter Stein ploppt ein (Schritt 2) | Welle nach Abstand vom gesetzten Stein statt nach Reihenfolge, Klang pro Stein leiser | ★ |
| Mühle | Setzen, Ziehen, Schlagen | Klang, kaum Bewegung | Gleiten mit `useGridMoveAnimation` (NetBoard), Mühle leuchtet als Linie auf, geschlagener Stein fliegt zur Seite | ★★ |
| Gomoku | Stein setzen | Klang | Stein-Plopp, Fünferreihe mit Lichtlauf | ★★ |
| Go | Stein setzen, Gefangene nehmen | Klang | Gefangene schrumpfen und fliegen in die Gefangenenschale, Zähler hüpft | ★★ |
| Schach | Figur ziehen, schlagen | Gleiten, fliegende Figuren, Schach-Hinweise | weitgehend fertig; Klang für Schach und Rochade unterscheiden | ★ |
| Vierer-Schach | Figur ziehen | Gleiten, Trophäenecken | fertig; Ausscheiden einer Farbe mit Verblassen ihrer Figuren | ★ |
| Dame | Stein ziehen, Mehrfachschlag | Gleiten | Mehrfachschlag Sprung für Sprung, Dame-Umwandlung mit Krönchen-Animation | ★★ |
| Teiler-Duell | Zahl wählen, Teiler gehen an Gegner | Klang | Teiler fliegen sichtbar zum Gegner, Punktefähnchen | ★★ |
| Nicht ärgern! | Würfeln, Figur ziehen | 3D-Würfel, Hüpfen Feld für Feld, Flug in den Stall (Etappe 1 und 4) | fertig; Sechs mit goldenem Aufleuchten | – |

### Karten

| Spiel | Kernhandlung | Heute | Ideen | W/A |
| --- | --- | --- | --- | --- |
| Skat, Schafkopf, Doppelkopf, Binokel | Karte in den Stich legen, Stich einsammeln | Karte fliegt vom Platz des Spielers herein, voller Stich bleibt 1 s mit Sieger sichtbar und fliegt dann zu ihm (Schritt 3), Klänge | Augenzähler zählt hoch | ★ |
| Präsident | Karten ausspielen, passen | Karten fliegen von unten bzw. oben herein (Schritt 3), Klänge | „Stich weg“-Animation, Rangtitel am Rundenende mit kleiner Krone | ★ |
| Eins!, Mau-Mau | Karte legen, ziehen | Flug-Animationen, Aufprall, Richtungswechsel (Etappe 2) | fertig; Kartenzahl-Fächer der Mitspieler (W-019) | – |
| Schwarzer Peter | Karte ziehen, Paare ablegen | Klang | Karte wandert sichtbar von Hand zu Hand, Paar fliegt zusammen auf den Ablagestapel | ★★ |
| Quartett | Wert vergleichen | Aufdecken, Klang | Werte erscheinen nacheinander mit kurzem Trommelwirbel, Siegerkarte rutscht zum Gewinner | ★★ |
| Solitaire | Karte verschieben | Drag & Drop, Klang | Fertiger Stapel mit Funkeln, **Gewinn-Kaskade** (Karten springen über den Bildschirm) am Ende | ★★ |
| Kartenblitz, Speed | Karte auf Mittelstapel klatschen | Flug, Klatsch-Klang | Wackeln des Stapels beim Treffer, Zähler „noch 3“ auf dem Blitzstapel, Vibration | ★★ |
| Tiefflug | Karte ziehen, tauschen, aufdecken | Klänge | 3D-Umdrehen, Spalte abräumen mit Sog-Effekt, Punktefähnchen | ★★ |
| Poker | Setzen, Aufdecken | Klänge, Chip-Kaskade | Chips gleiten in die Mitte und am Ende zum Gewinner, Board-Karten nacheinander umdrehen | ★★ |
| Drachenspiel | Karte spielen, angreifen | Angriffe, Treffer, Tierstimmen | weitgehend fertig; Schadenszahlen als Fähnchen | ★ |
| Narrenhof | Hand werten | Spruchbänder, Klänge | Witz × Lachen zählt hoch, Applaus-Zahl springt; wird in Etappe 5 mitbetrachtet | ★ |
| Paare finden | zwei Karten aufdecken | Klang | 3D-Umdrehen, Paar fliegt zum Spieler, Fehlversuch mit kurzem Schütteln | ★★★ |

### Familie, Lege- und Wortspiele

| Spiel | Kernhandlung | Heute | Ideen | W/A |
| --- | --- | --- | --- | --- |
| Würfelblock | Würfeln, halten, eintragen | 3D-Würfel, gestaffelt, gehaltene bleiben liegen (Etappe 4); eingetragener Wert mit Punkte-Fähnchen (Schritt 2) | Wert fliegt aus den Würfeln in die Zeile, Bonus +35 mit Fähnchen | ★ |
| Mäxle | Würfeln, schauen, ansagen | Becher klappert, 3D-Würfel beim Schauen (Etappe 4) | Aufdecken mit Trommelwirbel; Lüge mit rotem, Wahrheit mit grünem Aufleuchten | ★★ |
| Domino | Stein anlegen | Klack-Klang | Stein gleitet an die Kette und rastet mit kleinem Einfedern ein, Fünfer-Punkte als Fähnchen | ★★ |
| Farbe & Form | Plättchen legen | Klang; gelegte Steine ploppen ein, Punkte-Fähnchen, golden bei voller Reihe (Schritt 2) | „Sechser-Reihe“ mit Lichtlauf | ★ |
| Wortgitter | Wort legen | Vorschau mit Punkten; Steine federn nacheinander ein, Punkte-Fähnchen, 50er-Prämie golden (Schritt 2) | Prämienfelder blitzen auf | ★ |
| Bingo | Kugel ziehen, stempeln | Kugel, Stempel, viele Animationen | fertig; Reihe mit Lichtlauf vor dem „Bingo!“ | ★ |
| Schiffe versenken | Schuss | Zielen, Treffer, Versenken mit Klang | Wasserfontäne bzw. Explosion auf dem Feld, versenktes Schiff wird sichtbar | ★★ |
| Galgenmännchen | Buchstabe raten | Klang, Bild wächst | Buchstabe fliegt ins Wort und erscheint an allen Stellen nacheinander | ★★ |
| Wort-Salat | Wort einreichen | Klang | Kacheln fliegen in die Wortliste, ⭐ bei Exklusiv-Funden | ★★ |
| Fix gefunden! | Symbol antippen | Klang | Gefundenes Symbol pulsiert auf beiden Karten, Karte fliegt zum Finder | ★★ |
| Bibel-Quiz | Antwort wählen | Klänge, Auflösung | Richtige Antwort leuchtet auf, Serie-Bonus mit Flamme | ★ |
| Enten-Rallye | Aufgabe lösen | Enten schwimmen, Ansager | fertig (Strömung W-009, Etappe 3) | – |
| Zielzahl, Rechenmauer | Term bauen, Stein füllen | Klang | Mauer füllt sich mit Einrasten, gelöste Zielzahl mit Funkeln | ★ |

## Rangfolge der Umsetzung

Nach Wirkung je Aufwand und danach, wie viele Spiele ein Schritt trägt:

1. ✅ **Würfel und Siegerehrung** (Etappe 4).
2. ✅ **Punkte-Fähnchen und Stein-Plopp** als Bausteine, eingesetzt in Farbe & Form, Wortgitter, Würfelblock und Reversi; Tic-Tac-Toe-Gewinnlinie. (Strich-Animation in Tic-Tac-Toe und Dreh-Welle in Reversi gab es schon.)
3. ✅ **Stich einsammeln und Karten-Flug** im `TrickTable` für Skat, Schafkopf, Doppelkopf, Binokel und Präsident.
4. **Paare finden, Ultimate Tic-Tac-Toe, Mühle** (Umdrehen, Zielbrett-Pfeil, Gleiten).
5. **Rundenende-Zwischenstand** für Serien-Spiele.
6. Der Rest nach dieser Tabelle, je zwei bis vier Spiele pro PR.

Neue Klänge (z. B. Trommelwirbel für Mäxle und Quartett, Lichtlauf-Klang, Gewinn-Kaskade) sammelt die Klang-Sitzung.
