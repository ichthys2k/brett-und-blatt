# Speed

*Echtzeit-Kartenspiel für 2 Spieler: Beide legen gleichzeitig Karten, die um eins höher oder niedriger sind.*

> **Name:** „Speed“ ist ein freier, traditioneller Spielname (wie „Mau-Mau“), keine Marke. Er kann bleiben. Die id wäre `speed`.

| Steckbrief | |
|---|---|
| Spieler | 2–4 |
| Modi | Allein gegen Bot, geteilter Bildschirm am Tablet (zu zweit), online |
| Muster | gleichzeitig (Echtzeit), verdeckt (Hand, Nachziehstapel) |
| Bausteine | `PlayingCard` (französisch/vierfarbig), Echtzeit-Muster von Kartenblitz (`stillValid`, `tooLate`, `delayMs`, geteilter Bildschirm, `usePointerDrag` mit mehreren Fingern) |
| Aufwand | Regeln S, Oberfläche M, Bot S |
| Ordner | `packages/games/speed` |

## Regeln (Grundform)

- **Blatt:** 52 Karten (1 Deck zu zweit; 104 Karten / 2 Decks zu dritt und viert).
- **Austeilen (Speed):** Jeder bekommt 20 Karten: 15 als verdeckten **Nachziehstapel**, 5 als **Hand**. In die Mitte kommen zwei **Seitenstapel** zu je 5 Karten (verdeckt) und dazwischen die **Ablagestapel** (2 Stapel zu zweit, 4 Stapel zu dritt und viert).
- **Start:** Beide decken gleichzeitig die Mittelkarten auf. Ab dann gibt es keine Züge reihum.
- **Legen:** Jeder legt so schnell er kann eine Handkarte auf einen der Ablagestapel, wenn sie **genau einen Rang höher oder niedriger** ist. Farbe egal. Ass ist rund: K–A–2 geht (abschaltbar).
- **Nachziehen:**
  - `drawMode: 'auto'` (Standard): Wer weniger als 5 Handkarten hat, füllt sofort aus dem eigenen Nachziehstapel auf.
  - `drawMode: 'manual'`: Nachziehen geschieht per Antippen des eigenen Nachziehstapels, solange man weniger als 5 Karten auf der Hand hat.
- **Festgefahren:** Kann keiner legen, deckt jeder gleichzeitig eine Karte von einem Seitenstapel auf einen Ablagestapel. Sind die Seitenstapel leer, werden die Ablagestapel (ohne die obersten Karten) gemischt und als neue Seitenstapel ausgelegt.
- **Sieg:** Wer zuerst Hand und Nachziehstapel leer hat, ruft „Speed!“ und gewinnt die Runde.

## Variante Spit

- Jeder Spieler erhält 5 Tableau-Spalten mit 1, 2, 3, 4, 5 Karten. Die oberste Karte liegt jeweils offen (`hand`), die darunter liegenden verdeckt (`spitDown`).
- Die restlichen 11 Karten (zu zweit) bilden den persönlichen Spit-Vorrat (`draw`).
- Wird eine Karte aus einer Spalte abgelegt, deckt die oberste verdeckte Karte dieser Spalte automatisch auf. Ist eine Spalte ganz leergeräumt, verringert sich die Kartenauslage.
- Sitzen alle Spieler fest, wird von allen Spielern synchron eine Karte aus dem persönlichen Spit-Vorrat in die Mitte aufgedeckt („Spit!“).

## Optionen

- **Spielvariante:** Speed (`speed`, Standard) oder Spit (`spit`).
- **Nachziehen:** Automatisch (`auto`, Standard) oder von Hand (`manual`, Klick auf den Nachziehstapel).
- **Ass rund:** an/aus (Standard an).
- **Spieldauer:** eine Runde, Best of 3 (Standard), Best of 5.
- **Kartenbild:** französisch, vierfarbig (Turnierbild).

## Spielmodell

- **Muster:** `simultaneous` wie Kartenblitz. `currentPlayers` liefert in der Legephase alle Plätze, die nicht „festgefahren“ gemeldet haben.
- **Züge:** `play` (Handkarte mit Kennung, Ziel-Ablagestapel), `draw` (nur bei `drawMode: 'manual'`), `stuck` (keine passende Karte), `ready` (nächste Runde).
- **Festgefahren:** Hat ein Platz keinen legalen `play` (und kann nicht nachziehen), kann er `stuck` melden; melden alle aktiven Plätze `stuck`, deckt `applyMove` neue Karten auf (oder mischt die Ablagestapel um).
- **Gleichzeitige Züge:** Ablagestapel haben feste Nummern; `isLegal` ist großzügig: Passt die Karte nicht mehr auf den gewünschten Stapel, aber auf einen anderen, weicht sie dorthin aus.
- **Sicht:** Eigene Hand offen, fremde Hand offen (`privateViews: false`, für geteilten Bildschirm am Tablet); verdeckt bleiben Nachzieh- und Seitenstapel sowie verdeckte Spit-Karten.

## Bot

„Flinker Finger“ mit Bedenkpause (`delayMs`), wie bei Kartenblitz:

- **leicht:** 2,2–3,6 s je Karte, übersieht manchmal (30 %) eine passende Karte.
- **mittel:** 1,4–2,3 s, übersieht selten (10 %).
- **schwer:** 0,8–1,3 s, plant Ketten (legt bevorzugt Karten, nach denen weitere Handkarten passen; bei Spit mit Fokus auf hohe Tableau-Stapel) und zieht bei manuellem Nachziehen zügig nach.

## Umsetzung (29.10.2026, Update 10.11.2026 #247)

- `src/rules.ts`: Speed und Variante Spit; manuelles und automatisches Nachziehen (`drawMode: 'auto' | 'manual'`); Unterstützung für 2 bis 4 Spieler (bei 3–4 Spielern 104 Karten aus 2 Decks und 4 Ablagestapel); Optionen Spieldauer, Ass rund und Kartenbild.
- `src/bots.ts`: Bot „Flinker Finger“ unterstützt manuelles Nachziehen, 4 Ablagestapel und Spit-Stapel-Priorisierung.
- `src/ui/`: Geteilter Bildschirm für 2 Spieler am Tablet, Mehrspieler-Gegnerzeile für 3–4 Spieler, anklickbarer Nachziehstapel bei manuellem Nachziehen, Badges für verdeckte Spit-Karten, Ausweichlogik bei gleichzeitigen Zügen.
- `test/speed.test.ts`: Vertragsprüfungen, Tests für Austeilen, Spit, manuelles Nachziehen, 4-Spieler-Partien und Bot-Simulationen.

## Offene Punkte

- Keine – Varianten und Spielerweiterung aus #247 sind vollständig umgesetzt.
