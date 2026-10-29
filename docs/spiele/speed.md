# Speed

*Echtzeit-Kartenspiel für 2 Spieler: Beide legen gleichzeitig Karten, die um eins höher oder niedriger sind.*

> **Name:** „Speed“ ist ein freier, traditioneller Spielname (wie „Mau-Mau“), keine Marke. Er kann bleiben. Die id wäre `speed`.

| Steckbrief | |
|---|---|
| Spieler | 2 (später optional 3–4) |
| Modi | Allein gegen Bot, geteilter Bildschirm am Tablet, online |
| Muster | gleichzeitig (Echtzeit), verdeckt (Hand, Nachziehstapel) |
| Bausteine | `PlayingCard` (französisch/vierfarbig), Echtzeit-Muster von Kartenblitz (`stillValid`, `tooLate`, `delayMs`, geteilter Bildschirm, `usePointerDrag` mit mehreren Fingern) |
| Aufwand | Regeln S, Oberfläche M, Bot S |
| Ordner | `packages/games/speed` |

## Regeln (Grundform)

- **Blatt:** 52 Karten, keine Joker.
- **Austeilen:** Jeder bekommt 20 Karten: 15 als verdeckten **Nachziehstapel**, 5 als **Hand**. In die Mitte kommen zwei **Seitenstapel** zu je 5 Karten (verdeckt) und dazwischen zwei einzelne Karten, die die beiden **Ablagestapel** beginnen. Anordnung von links nach rechts: 5 – 1 – 1 – 5.
- **Start:** Beide decken gleichzeitig die zwei Mittelkarten auf. Ab dann gibt es keine Züge reihum.
- **Legen:** Jeder legt so schnell er kann eine Handkarte auf einen der beiden Ablagestapel, wenn sie **genau einen Rang höher oder niedriger** ist. Farbe egal. Ass ist rund: K–A–2 geht (abschaltbar).
- **Nachziehen:** Wer weniger als 5 Handkarten hat, füllt aus dem eigenen Nachziehstapel auf. Mehr als 5 Handkarten gibt es nie.
- **Festgefahren:** Kann keiner legen, deckt jeder gleichzeitig eine Karte von einem Seitenstapel auf einen Ablagestapel. Sind die Seitenstapel leer, werden die Ablagestapel (ohne die obersten Karten) gemischt und als neue Seitenstapel ausgelegt.
- **Sieg:** Wer zuerst Hand und Nachziehstapel leer hat, ruft „Speed!“ und gewinnt die Runde.

## Optionen

- **Ass rund** (an/aus, Standard an).
- **Spieldauer:** eine Runde, Best of 3, Best of 5.
- **Kartenbild:** französisch, vierfarbig (Turnierbild). Formsymbole helfen Farbenblinden, für Speed ist die Farbe aber ohnehin unwichtig.
- **Nachziehen:** automatisch (Standard, leichter auf dem Handy) oder von Hand (Antippen des Stapels, wie am Tisch).
- Später: Variante **Spit** (je 26 Karten, fünf eigene Auslagestapel 1-2-3-4-5, „Spit!“-Aufdecken) als zweiter Regelsatz.

## Spielmodell

- **Muster:** `simultaneous` wie Kartenblitz. `currentPlayers` liefert in der Legephase beide Plätze, die nicht „festgefahren“ gemeldet haben.
- **Züge:** `play` (Handkarte mit fester Kennung, Ziel Stapel 0 oder 1), `draw` (nur bei Nachziehen von Hand), `stuck` (keine passende Karte), `ready` (nächste Runde).
- **Festgefahren:** Hat ein Platz keinen legalen `play`, kann er nur `stuck` melden; melden beide, deckt `applyMove` sofort zwei Seitenkarten auf (oder mischt neu). Damit hat jeder aktive Platz immer einen Zug. Die Oberfläche kann `stuck` automatisch nach kurzer Pause senden, wenn es nichts zu legen gibt.
- **Gleichzeitige Züge:** Ablagestapel haben feste Nummern; `isLegal` ist großzügig: Passt die Karte nicht mehr auf den gewünschten Stapel, aber auf den anderen, landet sie dort. Sonst meldet der Raum `tooLate` („Zu spät – jemand war schneller.“).
- **Sicht:** Eigene Hand offen, fremde Hand nur als Anzahl (am Tisch hält man die Karten in der Hand), Nachziehstapel und Seitenstapel nur als Anzahl, Ablagestapel offen. `rng` genullt, `sampleHidden` verteilt die unbekannten Karten zufällig.

## Bot

„Flinker Finger“ mit Bedenkpause (`delayMs`), wie bei Kartenblitz:

- **leicht:** 1,8–3 s je Karte, übersieht manchmal (30 %) eine passende Karte.
- **mittel:** 1,1–1,8 s, übersieht selten (10 %).
- **schwer:** 0,6–1,0 s, plant Ketten (legt zuerst die Karte, nach der die meisten weiteren Handkarten passen) und hält sich nicht mit Stapeln auf, auf die der Gegner gerade spielt.

## Zeitlimits

Keine Partieuhr. Wie bei Kartenblitz misst eine Leerlauf-Uhr (Normal 60 s, Schnell 30 s), wie lange jemand gar nichts tut; dann zieht der Bot einmal.

## Oberfläche

- Hochformat: Gegner oben (Handkarten verdeckt, Nachziehstapel mit Zahl), Mitte als Reihe Seitenstapel – Ablage – Ablage – Seitenstapel, eigene Hand unten groß.
- Tippen legt auf den ersten passenden Stapel, Ziehen auf einen bestimmten. Passende Handkarten leicht hervorgehoben (abschaltbar für „Profis“).
- Flug-Animationen beim Legen, Aufdeck-Animation in der Mitte beim Festfahren, Countdown „3 – 2 – 1 – Los!“ zum Rundenbeginn.
- **Geteilter Bildschirm:** Zwei Menschen am Tablet gegenüber, obere Hälfte um 180° gedreht – wie bei Kartenblitz (`PlayerZone`).
- Klänge aus dem Katalog: `karte-legen`, `karte-ziehen`, `mischen`; „Speed!“ eventuell eigener Klang (Auswahl durch Cornelius). Playlist „Kartentisch“.

## Hot-Seat und Online

- Kein Hot-Seat reihum, stattdessen geteilter Bildschirm.
- Online wie Kartenblitz über `stillValid`; Server-Eintrag in `apps/server/src/games.ts`.

## Tests

- Austeilen 20/20/5/5/2, Rangabstand mit und ohne „Ass rund“, Auffüllen auf 5, Festfahren mit und ohne Seitenstapel, Neumischen, Sieg.
- Gleichzeitige Züge auf denselben Stapel (zweiter weicht aus oder ist `tooLate`).
- `gameContractChecks`, Prüfstand mit `PRUEFSTAND_SPIELE=speed`.

## Umsetzung (29.10.2026)

- `src/rules.ts`: wie oben beschrieben; Optionen Spieldauer (eine Runde, Best of 3 = Standard, Best of 5), Ass rund (Standard an) und Kartenbild (französisch, vierfarbig). Nachziehen geschieht immer automatisch, die Option „von Hand“ ist (noch) nicht gebaut.
- **Abweichung vom Plan – offene Hände:** Am geteilten Bildschirm bekommt die Oberfläche nur *eine* Sicht für beide Spieler. Darum liegen die Hände offen (`privateViews: false`, wie bei Kartenblitz); verdeckt bleiben Nachzieh- und Seitenstapel (nur als Anzahl) und der Zufallsstand. Für ein Tempo-Spiel verrät die fremde Hand wenig.
- `stuck` ist immer erlaubt (wer eine Karte übersieht, verliert nur Zeit). Die Oberfläche meldet es von selbst, wenn 1,5 s lang keine Karte passt; melden beide, kommen zwei Seitenkarten in die Mitte, sind die Seitenstapel leer, wird vorher neu gemischt (Ereignisse `flipped`, `reshuffled`).
- Bot „Flinker Finger“ (`src/bots.ts`): leicht 2,2–3,6 s, mittel 1,4–2,3 s, schwer 0,8–1,3 s je Karte; leicht (30 %) und mittel (10 %) bemerken eine passende Karte manchmal 1,8 s später. Schwer legt die Karte, nach der die meisten weiteren Handkarten passen.
- Oberfläche (`src/ui/`): grüner Filz, Gegnerleiste oben (oder am geteilten Bildschirm der gedrehte Bereich des zweiten Spielers), Mitte 5 – 1 – 1 – 5, eigene Hand mit Nachziehstapel und „Festgefahren“; Tippen legt auf den ersten passenden Stapel, Ziehen auf einen bestimmten; Flug-Animationen; Rundenende mit Rest-Karten und Siegen. Klänge aus dem Katalog: `karte-legen`, `karte-ziehen`, `mischen`, „Speed!“ `muehle`.
- Startseite: Rubrik *Karten- & Stichspiele*, Playlist „Kartentisch“, Spieleserver eingetragen.
- `test/speed.test.ts`: Austeilen, Rangabstand, Auffüllen, Ausweichen bei gleichzeitigen Zügen, Festfahren und Neumischen, Rundenende, Sicht, Bot-Runden, `gameContractChecks`.

## Offene Punkte

- Nachziehen von Hand als Option.
- Variante Spit.

- Mit 3–4 Spielern (zwei Decks, vier Ablagestapel)? Erst nach der Zweierfassung.
