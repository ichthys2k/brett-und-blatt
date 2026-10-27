# Zielzahl (24 & Zahlenrunde)

| Steckbrief | |
|---|---|
| Spieler | 1–30 |
| Dauer | 5–15 Minuten |
| Modi | Solo, Hot-Seat, online (auch als Klassen-Simultanspiel) |
| Muster | gleichzeitig (`simultaneous`), mehrrundig |
| Ordner | `packages/games/target-number` |

## Regeln

- In jeder Runde liegen **4 Zahlenkarten** (Klassisch 24), **5 Zahlenkarten** (Zielzahl bis 100) oder **6 Zahlenkarten** (Zielzahl bis 500) offen auf dem Tisch, dazu eine **Zielzahl**.
- Jede Karte darf höchstens einmal verwendet werden. Zwei Karten werden mit einer der erlaubten Grundrechenarten (`+`, `−`, `·`, `:`) zu einer neuen Zwischenergebnis-Karte verrechnet.
- Subtraktionen dürfen nicht negativ werden; Divisionen müssen glatt aufgehen.
- Aus den Rechenschritten baut die Oberfläche automatisch den **mathematisch korrekt geklammerten Rechenterm** (z. B. `(8 − 2) · 4 = 24`).
- **Punktevergabe je Runde:**
  - Zielzahl exakt getroffen und alle Karten genutzt: **12 Punkte**
  - Zielzahl exakt getroffen (mit weniger Karten): **10 Punkte**
  - Abstand ≤ 2: **7 Punkte**
  - Abstand ≤ 5: **5 Punkte**
  - Abstand ≤ 10: **3 Punkte**
  - Sonst: **1 Punkt**
- Sobald alle Mitspieler ihr Ergebnis eingeloggt haben, wird die **Musterlösung** mitsamt den eingereichten Termen aller Mitspieler aufgedeckt.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Modus (`mode`) | Klassisch 24 (4 Karten), Zielzahl bis 100 (5 Karten), Große Zielzahl bis 500 (6 Karten) | Klassisch 24 |
| Rechenarten (`ops`) | `+, −, · und :` (`all`), `Nur +, − und ·` (`addSubMul`) | `all` |
| Runden (`rounds`) | 3, 5, 8, 10 | 5 |

## Bot („Rechenfuchs“)

- Nutzt die Tiefensuche `findCandidateMoves` über alle erlaubten Rechenschritte:
  - **schwer:** findet stets die exakte Lösung (bzw. das bestmögliche Ergebnis).
  - **mittel:** wählt zwischen der besten und zweitbesten Lösung.
  - **leicht:** wählt eine einfache 1- bis 2-Schritt-Rechnung.
