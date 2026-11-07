---
description: Trägt den aktuellen Stand am Ende einer Arbeitssitzung in die Übergabe ein
---

1. `git status` und `git log --oneline -10` ansehen: Was ist neu, was ist noch nicht committet?
2. In `CLAUDE.md` die Abschnitte „Stand“, „Bekannte offene Punkte“ und „Nächste Schritte“ aktualisieren (mit Datum). `CLAUDE.md` ist die gemeinsame Übergabe für alle Agenten – nichts davon in `AGENTS.md` duplizieren.
3. Aufgabenstatus im zugehörigen GitHub-Issue pflegen. Neue Wünsche und Fehler als `status: Idee` eintragen; nur Cornelius setzt `status: Ready`. Agenten übernehmen ausschließlich Ready-Issues und reservieren sie vor Arbeitsbeginn durch einen Kommentar mit Konto und Zweig (keine Assignees oder Labels als Reservierung). Nach der Arbeit `status: Review` setzen; Cornelius schließt nach Prüfung mit `status: Done`.
4. Den Plan des betroffenen Spiels unter `docs/spiele/` nachtragen, ggf. den Fahrplan in `docs/KONZEPT.md`.
5. Nur wenn sich Kernregeln oder der Fahrplan-Stand ändern: `AGENTS.md` kurz anpassen.
6. Arbeitszweig committen, hochladen und den PR (mit `Refs #…`) aktualisieren. Nach `main` nur auf Cornelius' Wort „deploy“.
