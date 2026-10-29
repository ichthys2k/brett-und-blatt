# Gomoku – Fünf in einer Reihe

## Überblick
- **ID:** `gomoku`
- **Ordner:** `packages/games/gomoku/`
- **Spieler:** 2
- **Modi:** Solo (gegen Bot), Hotseat, Online
- **Brett:** 15 × 15
- **Ziel:** Als erster fünf Steine in einer Reihe platzieren (horizontal, vertikal, diagonal)
- **Besonderheiten:** Klassisches Freigomoku, keine Renju-Verbote

## Regeln
1. Schwarz beginnt, dann abwechselnd Weiß/Schwarz.
2. Pro Zug wird ein Stein auf ein leeres Feld gesetzt.
3. Sieger ist, wer zuerst eine ununterbrochene Reihe von fünf eigenen Steinen in eine der vier Richtungen bildet.
4. Falls das Brett voll ist, ohne dass jemand gewonnen hat, endet die Partie unentschieden.

## Umsetzung

### Paket
- `packages/games/gomoku/package.json`, `tsconfig.json`
- `src/meta.ts` – Steckbrief
- `src/types.ts` – `GomokuState`, `GomokuMove`
- `src/rules.ts` – `setup`, `legalMoves`, `applyMove`, `result`, `evaluate`, Siegprüfung
- `src/bots.ts` – Bots in drei Stufen (Anfänger, Fortgeschritten, Meister)
- `src/index.ts` – `GameModule`-Export
- `src/ui/index.tsx`, `src/ui/styles.css` – Spieloberfläche
- `test/gomoku.test.ts` – Regeln + `gameContractChecks`

### Integration
- In `apps/server/src/games.ts` und `apps/server/package.json` für Online-Partien eingetragen.
- Web-App findet das Spiel automatisch über den Ordner unter `packages/games/`.

### Bot
- **Anfänger:** Bevorzugt Zentrum, sonst zufällig
- **Fortgeschritten:** Sucht sofortigen Gewinn, blockiert gegnerischen Gewinnzug, sonst heuristische Bewertung nach Reihenlängen
- **Meister:** Wie Fortgeschritten, aber prüft nur vielversprechende Kandidaten (Nähe zu bestehenden Steinen)
- **Leistung (29.10.2026):** `findWinLine` prüft nur noch Linien durch den gesetzten Stein statt das ganze Brett; die Bots beschränken sich auf Kandidatenfelder (≤ 2 Steine entfernt) und klonen den Zustand nicht mehr per JSON. Vertragsprüfung 10 s → 2,2 s, Prüfstand grün.

## UI
- Holzbrett-Optik (15×15)
- Schwarze und weiße Steine
- Gewinnreihe wird goldfarben hervorgehoben
- Wie bei Tic-Tac-Toe/GridBoard implementiert

## Tests
- `corepack pnpm exec vitest run packages/games/gomoku/test/gomoku.test.ts` – 9 Tests (3 Gewinnmuster + 6 allgemeine Prüfungen), alle grün
- `gameContractChecks` wird ausgeführt (`randomGames: 8, botMoveLimit: 60`)

## Status
Fertig – spielbar lokal (Solo/Hotseat) und online. Bot-Prüfung beschleunigt (s. CLAUDE.md).
