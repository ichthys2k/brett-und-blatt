# Aufgabenplanung

**GitHub Issues sind die einzige aktuelle Aufgabenliste** für Wünsche, Fehler und Prompts: [Brett & Blatt – Issues](https://github.com/ichthys2k/brett-und-blatt/issues).

- Neue Ideen und Aufgaben als Issue mit `status: Idee` eintragen. Die Vorlagen unter `.github/ISSUE_TEMPLATE/` (Fehler melden, Wunsch oder Idee, Recherche oder Konzept, Vorhaben) geben die Gliederung vor und versehen sie automatisch mit diesem Status.
- **Nur Cornelius** gibt eine Idee nach Prüfung mit `status: Ready` zur Bearbeitung frei. Agenten übernehmen ausschließlich `Ready`-Issues.
- Vor Arbeitsbeginn reserviert der Agent das Issue mit einem Kommentar, z. B. `🔒 Übernehme ich: @konto, zweig-name — 2026-11-06 05:30 UTC`. Der Kommentar ist die gemeinsame Reservierung; keine Assignees oder Labels als Reservierung verwenden.
- Der Agent arbeitet auf einem eigenen Zweig, lädt ihn selbst hoch und öffnet einen PR mit `Refs #…` (nicht `Fixes #…`). Nach `main` geht es nur auf Cornelius' Wort „deploy“.
- Labels: Typ (`wunsch`, `fehler`), Status, Priorität (`prio: …`, setzt Cornelius), Bereich (`bereich: …`) und Spiel (`spiel: <Name>`). Größere Vorhaben: Eltern-Issue `vorhaben` mit Unter-Issues je Schritt. Ablauf mit Befehlen: [`.agent/workflows/issue-bearbeiten.md`](.agent/workflows/issue-bearbeiten.md). Geparkte Ideen tragen `status: Zurückgestellt`. Aufbau eines Issues: Ziel, Stand, „Fertig, wenn“ als Kästchenliste, Links (Einzelheiten in `CLAUDE.md`).
- Nach der Arbeit folgt `status: Review`; Cornelius schließt nach Prüfung mit `status: Done`. Ablauf und Zuständigkeiten stehen in [`CLAUDE.md`](CLAUDE.md) und [`AGENTS.md`](AGENTS.md).

## Ansichten

Fertige Filter für die Issue-Liste – am besten als Lesezeichen speichern (gehen auch am Handy). Sortieren nach Priorität kann die Issue-Liste nicht, deshalb gibt es je Priorität einen eigenen Link. Mit Board und Sortierung: das [GitHub-Projekt](#github-projekt).

| Ansicht | Wofür | |
|---|---|---|
| **🟢 Freigegeben** | Was Agenten gerade tun dürfen | [öffnen](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+Ready%22) |
| **🔵 In Arbeit** | Wer woran sitzt (🔒-Kommentar) | [öffnen](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+In+progress%22) |
| **🟣 Wartet auf mich** | Prüfliste für Cornelius | [öffnen](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+Review%22) |
| **📥 Ungesichtet** | Neu gemeldet, noch ohne Priorität – einordnen und Labels setzen | [öffnen](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+-label%3A%22prio%3A+hoch%22+-label%3A%22prio%3A+mittel%22+-label%3A%22prio%3A+niedrig%22) |
| **🔥 Hohe Priorität** | Alles Dringende, egal welcher Status | [öffnen](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22prio%3A+hoch%22) |
| **🐞 Fehler** | Offene Fehler | [alle](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3Afehler) · [hoch](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3Afehler+label%3A%22prio%3A+hoch%22) · [mittel](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3Afehler+label%3A%22prio%3A+mittel%22) · [niedrig](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3Afehler+label%3A%22prio%3A+niedrig%22) |
| **💡 Ideen-Backlog** | Wo als Nächstes etwas freigegeben werden kann | [alle](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+Idee%22+-label%3Arecherche) · [hoch](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+Idee%22+-label%3Arecherche+label%3A%22prio%3A+hoch%22) · [mittel](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+Idee%22+-label%3Arecherche+label%3A%22prio%3A+mittel%22) · [niedrig](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+Idee%22+-label%3Arecherche+label%3A%22prio%3A+niedrig%22) |
| **🔎 Recherche-Aufträge** | Erkunden und Konzepte, noch nichts bauen | [öffnen](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3Arecherche) |
| **🧭 Vorhaben** | Größere Vorhaben mit Unter-Issues | [öffnen](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3Avorhaben) |
| **⏸️ Zurückgestellt** | Geparkt, Cornelius entscheidet später | [öffnen](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22status%3A+Zur%C3%BCckgestellt%22) |
| **Nach Bereich** | Querschnittsthemen | [Online](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22bereich%3A+Online%22) · [Klang & Musik](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22bereich%3A+Klang+%26+Musik%22) · [Oberfläche](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22bereich%3A+Oberfl%C3%A4che%22) · [Neues Spiel](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22bereich%3A+Neues+Spiel%22) · [Technik](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aopen+label%3A%22bereich%3A+Technik%22) |
| **Nach Spiel** | Alle Spiel-Labels; ein Klick auf ein Label zeigt dessen Issues | [Labels „spiel:“](https://github.com/ichthys2k/brett-und-blatt/labels?q=spiel%3A) |
| **✅ Zuletzt erledigt** | Geschlossene Issues, neueste zuerst | [öffnen](https://github.com/ichthys2k/brett-und-blatt/issues?q=is%3Aissue+is%3Aclosed+sort%3Aupdated-desc+-label%3Acontext) |

## GitHub-Projekt

Das Projekt [„Brett & Blatt – Planung“](PROJEKT_URL) zeigt dieselben Issues als Board und als sortierbare Tabellen. **Die Labels bleiben führend:** Status und Priorität werden immer am Issue als Label gesetzt; die Action `.github/workflows/projekt-abgleich.yml` trägt sie in die Projekt-Felder „Status“, „Priorität“ und „Bereich“ ein (bei jeder Label-Änderung und alle 30 Minuten zur Sicherheit). Karten im Board zu ziehen ändert die Labels nicht – dort nur schauen.

Das vollständige frühere Dokument – einschließlich aller offenen Prompts, erledigten und zurückgestellten Einträge, Referenzen und Vorlagen – liegt unverändert im [Migrationsarchiv #72](https://github.com/ichthys2k/brett-und-blatt/issues/72). Die migrierten offenen Einträge sind jeweils eigene Issues; bereits vorhandene passende Issues wurden wiederverwendet statt dupliziert.
