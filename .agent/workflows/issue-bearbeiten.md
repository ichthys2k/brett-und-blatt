---
description: Bearbeitet ein freigegebenes GitHub-Issue von der Reservierung bis zur Abnahme
---

Gilt für alle Agenten (Claude Code, Antigravity/Gemini, Codex …). Aufgaben stehen ausschließlich in den [GitHub Issues](https://github.com/ichthys2k/brett-und-blatt/issues); `PLANUNG.md` ist nur noch ein Verweis.

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

## Größere Vorhaben (mehrere Issues)

- Ein **Eltern-Issue** mit Label `vorhaben` beschreibt das Ganze: Ziel, Reihenfolge, Entscheidungen, Link zum ausführlichen Plan unter `docs/spiele/`.
- Jeder Schritt ist ein eigenes Issue und wird als **Unter-Issue** angehängt; GitHub zeigt im Eltern-Issue dann eine Fortschrittsleiste:
  ```sh
  gh issue create --title "…" --label "wunsch,status: Idee,…" --body-file schritt.md
  gh issue edit <Eltern-Nr> --add-sub-issue <Nr>        # oder beim Schritt: --parent <Eltern-Nr>
  gh issue edit <Nr> --add-blocked-by <Vorgänger-Nr>    # wenn ein Schritt auf einen anderen warten muss
  ```
- Freigegeben (`status: Ready`) wird **jeder Schritt einzeln**, nicht das Eltern-Issue. Das Eltern-Issue bleibt offen, bis Cornelius alle Schritte abgenommen hat.

## Labels auf einen Blick

| Achse | Labels | Wer setzt |
|---|---|---|
| Typ | `wunsch`, `fehler`, `vorhaben` (Eltern-Issue mit Unter-Issues); `context` nur fürs Archiv #72 | wer anlegt |
| Status | `status: Idee` → `Ready` → `In progress` → `Review` → `Done`; `status: Zurückgestellt` | `Ready`, `Done`, `Zurückgestellt`: nur Cornelius |
| Priorität | `prio: hoch`, `prio: mittel`, `prio: niedrig` | Cornelius |
| Bereich | `bereich: Online`, `Klang & Musik`, `Oberfläche`, `Neues Spiel`, `Technik`; `barrierefreiheit` | wer anlegt |
| Spiel | `spiel: <Name>` je Spiel (z. B. `spiel: Narrenhof`, `spiel: Eins!`); Beschreibung nennt die Spiel-id | wer anlegt |

Ein neues Spiel bekommt beim Anlegen sein Label: `gh label create "spiel: <Name>" --color <Farbe der Rubrik> --description "Spiel-id <id> · Rubrik <Rubrik>"` (Farben: Strategie & Brett `c5def5`, Karten & Stich `f9d0c4`, Familie & Gesellschaft `fef2c0`, Mathe `c2e0c6`).
