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
- `src/bots.ts` (28.10.2026 neu): Bot in drei Stufen mit Würfelhalten (`toggleHold` über `isLegal`). Leicht hält nur nach dem ersten Wurf und trägt meist die meisten Punkte ein (Schnitt etwa 105). Mittel hält nach Faustregel (Straßen-Lauf oder beste Augenzahl), bewertet Kategorien mit Rücksicht auf den oberen Bonus und die Chance (etwa 175). Schwer prüft alle 32 Halte-Muster per Stichprobe; die Stichprobe hängt nur vom Wurf ab, damit mehrere Halte-Schritte dasselbe Ziel verfolgen (etwa 180).
- `src/ui/index.tsx`, `src/ui/styles.css`: Würfel mit Augen zum Halten antippen, Wertungstafel als Tabelle mit allen Spielern (Spalte des Spielers am Zug hervorgehoben, mögliche Punkte zum Antippen), Farben über Theme-Tokens.
- `test/kniffel.test.ts`: Wertung aller Kategorien, Würfeln, Zugwechsel, `gameContractChecks`.
- Eingetragen im Spieleserver; keine Optionen.

## Offene Punkte

- Name „Kniffel“ ist eine Marke – Umbenennung geplant (Etappe 4 des Korrekturplans).
- Startseite: keiner Rubrik zugeordnet (landet unter *Familie*), keine Playlist.
