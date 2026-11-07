---
trigger: always_on
---

# Projektregeln Brett & Blatt

Lies vor jeder Aufgabe `AGENTS.md` und die ausführliche Übergabe `CLAUDE.md` im Wurzelordner. Aufgaben und Fehler stehen in den [GitHub Issues](https://github.com/ichthys2k/brett-und-blatt/issues); `PLANUNG.md` ist der Wegweiser mit fertigen Filter-Links und dem Projekt-Link. Neue Ideen bleiben `status: Idee`; ausschließlich Cornelius gibt sie durch `status: Ready` frei. Zu Beginn jeder Sitzung die Issues mit `status: Ready` und `status: Review` abrufen und kurz nennen. Ablauf Schritt für Schritt: `.agent/workflows/issue-bearbeiten.md`. Agenten bearbeiten nur Ready-Issues und reservieren sie mit einem Kommentar mit Konto und Zweig. Keine Assignees oder Labels zur Reservierung verwenden. Diese Regeln gelten immer:

- Antworte auf Deutsch. Code-Bezeichner englisch, Kommentare, Doku, Commit-Nachrichten und UI-Texte deutsch.
- Zeige zuerst einen Vorschlag und warte auf Zustimmung, bevor du Größeres änderst.
- Arbeite immer auf einem eigenen Zweig. Den eigenen Arbeitszweig darfst du selbstständig committen und hochladen und einen PR mit `Refs #…` öffnen (nicht `Fixes #…`). Kein Force-Push, keine fremden Zweige verändern.
- **Mergen oder pushen nach `main` nur auf Cornelius' ausdrückliches Wort „deploy“:** Jeder Push auf `main` veröffentlicht sofort Spieleserver und Web-App.
- Vor dem Hochladen muss `corepack pnpm check` grün sein; die Änderung im Browser ansehen.
- Immer `corepack pnpm …` statt `pnpm …`. Keine `minimumReleaseAgeExclude`-Ausnahmen.
- Keine Geheimnisse ins Repo. Klänge (MP3) aus dem privaten Repo `brett-und-blatt-klaenge` nie ins öffentliche Repo kopieren.
