# Kniffel

| Steckbrief | |
|---|---|
| Spieler | 1–6 |
| Modi | Solo, Hot-Seat, online |
| Muster | offen (alle sehen alle Würfel und Tafeln) |
| Bausteine | Würfel, Wertungstafel |
| Ordner | `packages/games/kniffel` |

Nachträglich angelegt (28.10.2026) aus dem vorhandenen Code.

## Regeln

- Wer am Zug ist, hat bis zu drei Würfe mit fünf Würfeln. Zwischen den Würfen können Würfel gehalten werden (`hold`, `unhold`, `toggleHold`).
- Danach wird das Ergebnis in eine freie Kategorie eingetragen (`score`), notfalls mit 0 Punkten.
- **Obere Sektion:** Einser bis Sechser (Summe der jeweiligen Augen). Ab 63 Punkten gibt es 35 Punkte Bonus.
- **Untere Sektion:** Dreierpasch und Viererpasch (Summe aller Augen), Full House 25, Kleine Straße 30, Große Straße 40, Kniffel 50, Chance (Summe aller Augen).
- Nach 13 Runden gewinnt die höchste Gesamtsumme.

## Umsetzung

- `src/rules.ts`: Zustand mit `phase` (`roll`/`score`), `rollsLeft`, Würfeln und Tafeln je Spieler; `calculateScore` je Kategorie; Würfeln über den Seed-Rng im Zustand.
- `src/bots.ts`: Bot in drei Stufen. Leicht trägt zufällig ein, mittel nimmt die höchste Punktzahl, schwer bevorzugt Kniffel und Straßen und streicht bei 0 Punkten eine obere Kategorie. Der Bot würfelt immer alle drei Male und hält keine Würfel.
- `src/ui/index.tsx`, `src/ui/styles.css`: Würfel zum Halten antippen, Wertungstafel mit Vorschau.
- `test/kniffel.test.ts`: Wertung aller Kategorien, Würfeln, Zugwechsel, `gameContractChecks`.
- Eingetragen im Spieleserver; keine Optionen.

## Offene Punkte

- `playerView` gibt den Zustand samt `rng` an die Browser. Online lässt sich damit vorhersagen, was als Nächstes fällt. Lösung wie bei Mäxle: `rng` in der Sicht ausblenden und `sampleHidden` ergänzen.
- Bot: Würfel halten (z. B. nach erwartetem Wert je Kategorie).
- Startseite: keiner Rubrik zugeordnet (landet unter *Familie*), keine Playlist.
