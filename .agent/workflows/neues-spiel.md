---
description: Legt ein neues Spiel aus der Vorlage Tic-Tac-Toe an
---

1. `CONTRIBUTING.md`, `docs/KONZEPT.md` (Spielmodul-Schnittstelle) und den Plan des Spiels unter `docs/spiele/` lesen. Gibt es keinen Plan, zuerst einen nach der Gliederung in `docs/spiele/README.md` vorschlagen.
2. Kennung (`id`, englisch, kebab-case) und deutschen Namen mit Cornelius abstimmen.
3. `corepack pnpm neues-spiel <id> "<Name>"` und danach `corepack pnpm install`.
4. Regeln in `src/rules.ts`, Kurzanleitung `howToPlay` in `src/meta.ts`, Oberfläche in `src/ui/index.tsx`, Tests mit `gameContractChecks` in `test/<id>.test.ts`.
5. Bei 2 oder mehr Plätzen: in `apps/server/src/games.ts` (`onlineGames`) und als Abhängigkeit in `apps/server/package.json` eintragen, `corepack pnpm install`. Bei eigenem Bot `BOT_STEP_MS` in `apps/server/src/bots.ts` prüfen.
6. GitHub-Label anlegen: `gh label create "spiel: <Name>" --color <Rubrikfarbe> --description "Spiel-id <id> · Rubrik <Rubrik>"` (Farben in `issue-bearbeiten.md`).
7. Dev-Server neu starten, Spiel im Browser durchspielen, dann den Workflow `/pruefen`.
8. Spielplan („Umsetzung“) und Stand in `CLAUDE.md` nachtragen. Auf dem eigenen Zweig committen und hochladen, PR öffnen; nach `main` nur auf „deploy“.
