---
trigger: always_on
---

# Projektregeln Brett & Blatt

Lies vor jeder Aufgabe `AGENTS.md` und die ausführliche Übergabe `CLAUDE.md` im Wurzelordner. Diese Regeln gelten immer:

- Antworte auf Deutsch. Code-Bezeichner englisch, Kommentare, Doku, Commit-Nachrichten und UI-Texte deutsch.
- Zeige zuerst einen Vorschlag und warte auf Zustimmung, bevor du Größeres änderst.
- Commit, Push und Merge nur, wenn Cornelius es ausdrücklich sagt – jeweils einzeln. Nie selbstständig auf `main` pushen: Jeder Push auf `main` veröffentlicht sofort Spieleserver und Web-App.
- Vor jedem Commit muss `corepack pnpm check` grün sein; die Änderung im Browser ansehen.
- Immer `corepack pnpm …` statt `pnpm …`. Keine `minimumReleaseAgeExclude`-Ausnahmen.
- Keine Geheimnisse ins Repo. Klänge (MP3) aus dem privaten Repo `brett-und-blatt-klaenge` nie ins öffentliche Repo kopieren.
