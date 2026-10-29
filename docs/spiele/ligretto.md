# Ligretto

> **Name:** Seit 28.10.2026 heißt das Spiel in der App **Kartenblitz** (Blitzstapel statt Ligretto-Stapel), weil „Ligretto“ eine Marke ist. Die id `ligretto` bleibt.

*Echtzeit-Kartenspiel für 2–8 Spieler – alle legen gleichzeitig.*

## Überblick

Jeder Spieler hat ein eigenes Blatt mit 40 Karten (Rot, Gelb, Grün, Blau, je 1–10). Alle spielen gleichzeitig und legen Karten auf gemeinsame Stapel in der Mitte. Wer als Erster seinen Ligretto-Stapel los ist, beendet die Runde.

## Regeln (wie im Original)

- **Auslage je Spieler:** Ligretto-Stapel mit 10 Karten (die oberste liegt offen), eine offene **Reihe** (bei 2 Spielern 5 Karten, bei 3 Spielern 4, ab 4 Spielern 3) und der Rest als verdeckte **Hand** (25–27 Karten).
- **Hand und Talon:** Die Hand wird in Dreierschritten auf den eigenen Talon umgeblättert; nur die oberste Talon-Karte ist spielbar. Ist die Hand leer, wird der Talon wieder umgedreht.
- **Mitte:** Jeder Stapel beginnt mit einer **1** und wächst in derselben Farbe bis **10**. Volle Stapel werden abgeräumt. Jeder darf auf jeden Stapel legen.
- **Spielbar** sind die oberste Ligretto-Karte, jede Karte der Reihe und die oberste Talon-Karte. Eine Lücke in der Reihe füllt sich sofort mit der obersten Ligretto-Karte.
- **Rundenende:** Wer seinen Ligretto-Stapel leer hat, beendet die Runde („Ligretto!“).
- **Wertung:** +1 Punkt je eigener Karte in der Mitte, −2 je Karte, die noch im eigenen Ligretto-Stapel liegt.
- **Stillstand:** Kommt niemand mehr weiter, legen alle ihre oberste Ligretto-Karte unter den Stapel (und die oberste Talon-Karte unter die Hand).

## Umsetzung in Brett & Blatt

Neu geschrieben am 28.10.2026 (Regelversion 2); die erste Fassung hatte keine Reihe, keinen Talon, mischte immer gleich und konnte festhängen.

- **Muster:** `simultaneous`. `currentPlayers` liefert in der Spielphase alle, die nicht „festgefahren“ sind, beim Rundenende alle, die noch nicht bereit sind.
- **Züge:** `play` (Quelle `ligretto` / `row` mit `slot` / `talon`, Ziel `pile` = Stapelkennung oder `null` für einen neuen Stapel mit einer 1), `flip` (umblättern bzw. Talon umdrehen), `stuck` („Festgefahren“), `ready` (nächste Runde).
- **Gleichzeitige Züge:** Mittelstapel haben feste Kennungen (`nextPileId`), abgeräumte Stapel verschieben nichts. `isLegal` ist großzügiger als `legalMoves`: Ist der gewünschte Stapel inzwischen weitergelegt, landet die Karte auf einem anderen passenden Stapel; erst wenn sie nirgends mehr passt, wird der Zug abgelehnt. Online greift dazu `stillValid` im Raum.
- **Festgefahren:** Wer `stuck` meldet, scheidet aus `currentPlayers` aus, bis eine Karte in die Mitte kommt (dann werden alle Markierungen gelöscht). Melden alle, greift die Stillstandsregel (`unjam`). So hat jeder aktive Platz immer mindestens einen Zug.
- **Sicht:** Am echten Tisch liegt fast alles offen. `playerView` zeigt deshalb allen dasselbe (`privateViews: false`): oberste Ligretto-Karte und Anzahl, Reihe, oberste Talon-Karte, Anzahl der Handkarten. Verdeckt bleiben nur die Reihenfolgen und der Zufallsstand. `sampleHidden` füllt mit den fehlenden Karten des jeweiligen Blatts auf.
- **Optionen:** Spieldauer (1/3/5 Runden, bis 50/99 Punkte; Standard 3 Runden) und Umblättern (je drei, klassisch, oder einzeln, leichter).
- **Zeit:** Gemütlich ohne Uhr; Normal 60 s, Schnell 30 s – die Uhr misst nur, wie lange jemand gar nichts tut, dann zieht der Bot einmal für ihn.
- **Modi:** Allein gegen Bots und online. Kein Hot-Seat (Echtzeit an einem Gerät geht nicht reihum).
- **Bot „Flinke Hand“:** reagiert mit Bedenkpause (`delayMs`): Legen leicht 2,3–3,9 s, mittel 1,5–2,5 s, schwer 0,85–1,45 s; Umblättern schneller. Bevorzugt Ligretto-Karte vor Reihe vor Talon, übersieht auf „leicht“ (35 %) und „mittel“ (12 %) manchmal eine Karte und meldet „Festgefahren“, wenn er die Hand einmal ohne Änderung in der Mitte durchgeblättert hat. Simuliert dauert eine Runde mit zwei schweren Bots 30–80 s.
- **Oberfläche:** Eigene farbige Zahlenkarten mit Formsymbol je Farbe (● ▲ ■ ★) für Farbenblinde; Tippen legt auf den ersten passenden Stapel, Ziehen (`usePointerDrag`) auf einen bestimmten. Gelegte Karten fliegen von ihrer Quelle (bzw. vom Mitspieler-Chip) in die Mitte, volle Stapel blitzen beim Abräumen auf. Mitspieler als wischbare Leiste mit oberster Ligretto-Karte und Restzahl. Kartengröße über Container-Abmessungen (`cqi`/`cqh`), damit Handy hoch/quer und Desktop passen. Rundenende als Tabelle (+, −, Runde, Gesamt) mit „Nächste Runde“.

- **Klänge** (`gameUi.sounds`): Karte legen `karte-legen`, Umblättern `karte-ziehen`, Talon umdrehen / Stillstand / neue Runde `mischen`, voller Stapel `stapel-fertig`, „Ligretto!“ `muehle` (Marimba). **Musik:** Playlist „Spielabend“ (fröhlich und verspielt).
- **Wettrennen online:** Nimmt der Raum einen Zug mit älterer Version an (`stillValid`), der jetzt nicht mehr passt, meldet er `tooLate` („Zu spät – jemand war schneller.“) statt `illegalMove`. Die Web-App zeigt das 1,5 s als neutralen Hinweis (`notice` in `apps/web/src/lib/online.ts`), nicht als rote Fehlermeldung.

## Offene Punkte

- ✅ **Geteilter Bildschirm** (29.10.2026): Mehrere Menschen an einem Gerät (Modus `hotseat`) bekommen je einen eigenen Bereich (`PlayerZone` in `src/ui/index.tsx`, eigene Zieh-Logik, eigene Züge über `BoardProps.humanSeats`). Die erste Hälfte sitzt oben und ist um 180° gedreht (Spieler gegenüber am Tablet), die anderen unten, die Mitte dazwischen; Bots erscheinen als kleine Einträge. Im gedrehten Bereich wird die Ziehrichtung umgekehrt. Am Rundenende hat jeder Mensch seinen eigenen „Nächste Runde“-Knopf. Gut spielbar bis vier Spieler (dann Karten etwa 33 px breit auf einem 1024er-Tablet). Dafür unterscheidet `usePointerDrag` jetzt Finger (`pointerId`), damit gleichzeitiges Ziehen sich nicht stört.
