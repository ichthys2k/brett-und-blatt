# Aufgabenplanung

**GitHub Issues sind die einzige aktuelle Aufgabenliste** für Wünsche, Fehler und Prompts: [Brett & Blatt – Issues](https://github.com/ichthys2k/brett-und-blatt/issues).

- Neue Ideen und Aufgaben als Issue mit `status: Idee` eintragen. Die Vorlagen unter `.github/ISSUE_TEMPLATE/` (Fehler melden, Wunsch oder Idee, Recherche oder Konzept, Vorhaben) geben die Gliederung vor und versehen sie automatisch mit diesem Status.
- **Nur Cornelius** gibt eine Idee nach Prüfung mit `status: Ready` zur Bearbeitung frei. Agenten übernehmen ausschließlich `Ready`-Issues.
- Vor Arbeitsbeginn reserviert der Agent das Issue mit einem Kommentar, z. B. `🔒 Übernehme ich: @konto, zweig-name — 2026-11-06 05:30 UTC`. Der Kommentar ist die gemeinsame Reservierung; keine Assignees oder Labels als Reservierung verwenden.
- Der Agent arbeitet auf einem eigenen Zweig, lädt ihn selbst hoch und öffnet einen PR mit `Refs #…` (nicht `Fixes #…`). Nach `main` geht es nur auf Cornelius' Wort „deploy“.
- Labels: Typ (`wunsch`, `fehler`), Status, Priorität (`prio: …`, setzt Cornelius), Bereich (`bereich: …`) und Spiel (`spiel: <Name>`). Größere Vorhaben: Eltern-Issue `vorhaben` mit Unter-Issues je Schritt. Ablauf mit Befehlen: [`.agent/workflows/issue-bearbeiten.md`](.agent/workflows/issue-bearbeiten.md). Geparkte Ideen tragen `status: Zurückgestellt`. Aufbau eines Issues: Ziel, Stand, „Fertig, wenn“ als Kästchenliste, Links (Einzelheiten in `CLAUDE.md`).
- Nach der Arbeit folgt `status: Review`; Cornelius schließt nach Prüfung mit `status: Done`. Ablauf und Zuständigkeiten stehen in [`CLAUDE.md`](CLAUDE.md) und [`AGENTS.md`](AGENTS.md).

Das vollständige frühere Dokument – einschließlich aller offenen Prompts, erledigten und zurückgestellten Einträge, Referenzen und Vorlagen – liegt unverändert im [Migrationsarchiv #72](https://github.com/ichthys2k/brett-und-blatt/issues/72). Die migrierten offenen Einträge sind jeweils eigene Issues; bereits vorhandene passende Issues wurden wiederverwendet statt dupliziert.
