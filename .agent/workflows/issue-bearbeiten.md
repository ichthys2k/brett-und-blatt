---
description: Bearbeitet ein freigegebenes GitHub-Issue von der Reservierung bis zur Abnahme
---

Gilt für alle Agenten (Claude Code, Antigravity/Gemini, Codex …). Aufgaben stehen ausschließlich in den [GitHub Issues](https://github.com/ichthys2k/brett-und-blatt/issues); `PLANUNG.md` ist nur noch ein Wegweiser mit Filter-Links.

## 0. Zu Beginn jeder Sitzung

1. `git pull` (bzw. `git fetch` und neuen Zweig von `origin/main`).
2. Anstehende Issues abrufen und Cornelius kurz nennen:
   ```sh
   gh issue list --label "status: Ready"
   gh issue list --label "status: Review"
   ```
   Hat Cornelius schon einen klaren anderen Auftrag gegeben, genügt ein Satz am Ende.

## 1. Issue auswählen und prüfen

- **Nur Issues mit `status: Ready`** bearbeiten. Diesen Status setzt ausschließlich Cornelius. `status: Idee` und `status: Zurückgestellt` sind keine Arbeitsfreigabe, auch wenn der Text nach einem Auftrag klingt.
- Ohne Vorgabe von Cornelius: zuerst `prio: hoch`, dann `prio: mittel`, dann `prio: niedrig`.
- `gh issue view <Nr> --comments` lesen. Gibt es schon einen 🔒-Kommentar ohne späteres „🔓 Freigegeben“, ist das Issue vergeben – Finger weg und Cornelius fragen.

## 2. Reservieren

1. Zweig anlegen: `git switch -c <agent>/<kurzname> origin/main` (z. B. `claude/f017-narrenkorb`, `gemini/f016-chat`).
2. Kommentar als Reservierung (Uhrzeit in UTC):
   ```sh
   gh issue comment <Nr> --body "🔒 Übernehme ich: <Agent/Konto>, Zweig <zweig> — 2026-11-07 10:00 UTC"
   ```
   Keine Assignees und keine Labels als Reservierung.
3. Status umstellen:
   ```sh
   gh issue edit <Nr> --remove-label "status: Ready" --add-label "status: In progress"
   ```

## 3. Umsetzen

- Den Abschnitt **„Fertig, wenn“** im Issue als Maßstab nehmen; Pläne unter **„Links“** lesen.
- Regeln aus `AGENTS.md`/`CLAUDE.md`: Tests, `corepack pnpm check`, bei Spielen `corepack pnpm rauchtest` und `PRUEFSTAND=1 PRUEFSTAND_SPIELE=<id> corepack pnpm pruefstand`, Blick im Browser.
- Doku nachziehen (Spielplan unter `docs/spiele/`, ggf. Stand in `CLAUDE.md`).

## 4. Hochladen und PR

- Den **eigenen Arbeitszweig** selbstständig committen und hochladen (`git push -u origin HEAD`), keine fremden Zweige, kein Force-Push.
- PR öffnen und mit **`Refs #<Nr>`** auf das Issue verweisen – **nicht** `Fixes`/`Closes`, sonst schließt GitHub das Issue beim Mergen vor Cornelius' Prüfung:
  ```sh
  gh pr create --base main --title "…" --body "… Refs #<Nr>"
  ```
- **Nie selbst nach `main` mergen oder pushen.** Das geschieht nur auf Cornelius' ausdrückliches Wort „deploy“; jeder Push auf `main` veröffentlicht sofort auf spiele.lipponer.de.

## 5. Zur Prüfung übergeben

1. Im Issue kommentieren: was geändert wurde, PR-Link, und wie Cornelius es prüfen kann (Gerät, Schritte). Erledigte Kästchen unter „Fertig, wenn“ abhaken.
2. Status umstellen:
   ```sh
   gh issue edit <Nr> --remove-label "status: In progress" --add-label "status: Review"
   ```
3. Cornelius prüft, sagt „deploy“ und schließt das Issue mit `status: Done`. Agenten schließen Issues nicht selbst.

## Abbrechen oder abgeben

Kann ein Agent nicht weitermachen: Stand ins Issue schreiben, „🔓 Freigegeben: <Grund>“ kommentieren und wieder `status: Ready` setzen. Der Zweig bleibt auf GitHub, damit der Nächste anknüpfen kann.

## Neue Wünsche und Fehler

Taucht im Gespräch etwas Neues auf, ein Issue anlegen – immer mit `status: Idee`, Typ, Bereich und ggf. Spiel; die Priorität setzt Cornelius:

```sh
gh issue create --title "Narrenhof: Kurztitel" --label "wunsch,status: Idee,spiel: Narrenhof" --body-file text.md
```

Aufbau des Texts: **Ziel** (bei Fehlern: **Fehler** mit Schritten, Erwartet, Tatsächlich, Gerät), **Stand**, **Fertig, wenn** als Kästchenliste, **Links**. Rechercheaufträge behalten Cornelius' Wortlaut als Zitat.

**Vorlagen auf GitHub** (`.github/ISSUE_TEMPLATE/`, gleiche Gliederung, setzen Typ und `status: Idee` selbst): `1-fehler.yml` (Fehler melden), `2-wunsch.yml` (Wunsch oder Idee), `3-recherche.yml` (Recherche oder Konzept – Ergebnis ist ein Bericht, gebaut wird erst nach Entscheidung), `4-vorhaben.yml` (Eltern-Issue mit Schritten). Die Felder „Spiel“ und „Bereich“ setzen **keine** Labels (GitHub-Formulare können das nicht); wer ein über die Vorlage gemeldetes Issue sichtet, übersetzt sie in `spiel: …` und `bereich: …`. Bei einem Vorhaben werden die Zeilen unter „Schritte“ nach Cornelius' Zustimmung als Unter-Issues angelegt.

## Größere Vorhaben (mehrere Issues)

- Ein **Eltern-Issue** mit Label `vorhaben` beschreibt das Ganze: Ziel, Reihenfolge, Entscheidungen, Link zum ausführlichen Plan unter `docs/spiele/`.
- Jeder Schritt ist ein eigenes Issue und wird als **Unter-Issue** angehängt; GitHub zeigt im Eltern-Issue dann eine Fortschrittsleiste:
  ```sh
  gh issue create --title "…" --label "wunsch,status: Idee,…" --body-file schritt.md
  gh issue edit <Eltern-Nr> --add-sub-issue <Nr>        # oder beim Schritt: --parent <Eltern-Nr>
  gh issue edit <Nr> --add-blocked-by <Vorgänger-Nr>    # wenn ein Schritt auf einen anderen warten muss
  ```
- Freigegeben (`status: Ready`) wird **jeder Schritt einzeln**, nicht das Eltern-Issue. Das Eltern-Issue bleibt offen, bis Cornelius alle Schritte abgenommen hat.

## GitHub-Projekt

Das Projekt [„Brett & Blatt – Planung“](https://github.com/users/ichthys2k/projects/3) und die Labels werden **in beide Richtungen** abgeglichen; die jüngere Änderung gewinnt. Status, Priorität und Bereich lassen sich also am Issue (Label) **oder** im Projekt (Feld, Board-Spalte) setzen. Neue Issues kommen von selbst ins Projekt.

- **Label am Issue geändert:** Das Projekt folgt sofort (Lauf je Issue).
- **Feld im Projekt geändert:** Das Label folgt beim nächsten Lauf, **spätestens nach etwa 5 Minuten** (GitHub meldet Projekt-Änderungen nicht an Actions; geplante Läufe starten teils verspätet). Agenten sehen die Änderung erst danach – zum Prüfen immer die Labels lesen.
- **Status „Fertig“ im Projekt** schließt das Issue; ein anderer Status an einem geschlossenen Issue öffnet es wieder. „Fertig“ setzt nur Cornelius.
- **Feld leeren** im Projekt wirkt nicht – das Feld wird aus dem Label wieder gefüllt. Zum Entfernen das Label abnehmen.
- **Bereich:** Das Feld zeigt bei mehreren Bereichs-Labels nur das erste; ändert man es im Projekt, wird genau dieses Label ersetzt.

Technik: Die Action `.github/workflows/projekt-abgleich.yml` (Skript `scripts/projekt-abgleich.mjs`) läuft bei jeder Label-Änderung und alle 5 Minuten. Sie vergleicht je Achse den Zeitpunkt des Feldwerts (`updatedAt`) mit der letzten Label-Änderung dieser Achse (bei Status auch Schließen/Öffnen). Für das Projekt braucht sie das Repo-Secret `PROJECT_TOKEN` (klassischer Personal Access Token nur mit dem Recht `project`) und die Repo-Variable `PROJECT_NUMBER` (= 3); Labels schreibt sie mit dem eingebauten `GITHUB_TOKEN`. Von Hand: `PROJECT_TOKEN=$(gh auth token) ISSUES_TOKEN=$(gh auth token) PROJECT_NUMBER=3 node scripts/projekt-abgleich.mjs [Nr]` (mit `PROJEKT_PROBE=1` nur anzeigen).

Fertige Filter-Links für die Issue-Liste stehen in [`PLANUNG.md`](../../PLANUNG.md).

## Labels auf einen Blick

| Achse | Labels | Wer setzt |
|---|---|---|
| Typ | `wunsch`, `fehler`, `recherche` (zusätzlich zu `wunsch`, nur erkunden), `vorhaben` (Eltern-Issue mit Unter-Issues); `context` nur fürs Archiv #72 | wer anlegt |
| Status | `status: Idee` → `Ready` → `In progress` → `Review` → `Done`; `status: Zurückgestellt` (im Projekt auch als Spalte) | `Ready`, `Done`, `Zurückgestellt`: nur Cornelius |
| Priorität | `prio: hoch`, `prio: mittel`, `prio: niedrig` | Cornelius |
| Bereich | `bereich: Online`, `Klang & Musik`, `Oberfläche`, `Neues Spiel`, `Technik`; `barrierefreiheit` | wer anlegt |
| Spiel | `spiel: <Name>` je Spiel (z. B. `spiel: Narrenhof`, `spiel: Eins!`); Beschreibung nennt die Spiel-id | wer anlegt |

Ein neues Spiel bekommt beim Anlegen sein Label: `gh label create "spiel: <Name>" --color <Farbe der Rubrik> --description "Spiel-id <id> · Rubrik <Rubrik>"` (Farben: Strategie & Brett `c5def5`, Karten & Stich `f9d0c4`, Familie & Gesellschaft `fef2c0`, Mathe `c2e0c6`).
