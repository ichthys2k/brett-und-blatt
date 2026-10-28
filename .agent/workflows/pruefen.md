---
description: Prüft das ganze Repo (Typprüfung, Tests, Build) vor einem Commit
---

1. `corepack pnpm install` ausführen, falls sich `package.json` oder `pnpm-lock.yaml` geändert haben.
2. `corepack pnpm check` ausführen (Typprüfung beider Konfigurationen, alle Tests, Build).
3. `corepack pnpm rauchtest` ausführen (startet jedes Spiel im Browser; einmal je Rechner vorher `corepack pnpm exec playwright install chromium`). Bei geänderten Spielen zusätzlich `PRUEFSTAND=1 PRUEFSTAND_SPIELE=<id> corepack pnpm pruefstand`.
4. Bei Fehlern: Ursache beheben, keine Tests überspringen oder abschwächen, dann Schritt 2 und 3 wiederholen.
5. Den Dev-Server starten (`corepack pnpm --filter @brett-und-blatt/web dev`) und die Änderung unter http://localhost:5173 im Browser ansehen.
6. Ergebnis zusammenfassen. Nicht committen – Commit und Push nur auf Cornelius' ausdrückliches Wort.
