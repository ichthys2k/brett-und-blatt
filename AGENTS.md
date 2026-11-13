# Brett & Blatt – Hinweise für KI-Agenten

Diese Datei ist für Agenten außer Claude Code gedacht (Google Antigravity/Gemini, Codex, Cursor u. a.). **Die ausführliche Übergabe steht in [`CLAUDE.md`](CLAUDE.md) – lies sie vor jeder Aufgabe ganz.** Sie gilt für alle Agenten gleich, auch wenn sie nach Claude benannt ist. Hier stehen nur die Kernregeln und Wegweiser; bei Widersprüchen gilt `CLAUDE.md`. Neue Regeln und Technik-Erkenntnisse gehören nach `CLAUDE.md`, **neuer Stand gehört in die Chronik [`docs/CHRONIK.md`](docs/CHRONIK.md)** (nicht hierher), damit es je Sache nur eine Quelle gibt.

Freie Spielesammlung im Browser (Karten- und Brettspiele für Handy und Desktop): allein gegen Bots, zu mehreren an einem Gerät, online. Live unter https://spiele.lipponer.de, Spieleserver auf Cloudflare unter https://brett-und-blatt.lipponer.workers.dev. Lizenz AGPL-3.0, Inhalte CC BY-SA 4.0.

## Kernregeln

- **Sprache:** Cornelius schreibt Deutsch – antworte Deutsch. Bezeichner im Code englisch; Kommentare, Doku, Commit-Nachrichten und UI-Texte deutsch.
- **Erst Vorschlag, dann Änderung:** Bei allem, was über eine kleine, klar beauftragte Änderung hinausgeht, zuerst den Plan bzw. Vorschlag zeigen und auf Zustimmung warten.
- **Eigener Zweig – selbstständig; `main` – nur auf „deploy“:** Arbeite immer auf einem eigenen Zweig. Den eigenen Arbeitszweig committest und lädst du ohne einzelne Anweisung hoch und öffnest einen PR mit `Refs #…` (nicht `Fixes #…`, damit das Issue erst nach Cornelius' Prüfung geschlossen wird). Kein Force-Push, keine fremden Zweige verändern. **Mergen oder pushen nach `main` nur auf Cornelius' ausdrückliches Wort „deploy“.**
- **Jeder Push auf `main` veröffentlicht sofort:** Die CI (`.github/workflows/ci.yml`) prüft, veröffentlicht dann den Spieleserver auf Cloudflare und danach die Web-App über GitHub Pages.
- **Vor dem Hochladen:** `corepack pnpm check` (Typprüfung, alle Tests, Build) muss grün sein, und die Änderung im Browser ansehen (`corepack pnpm --filter @brett-und-blatt/web dev`, http://localhost:5173).
- **Ein Spiel gilt erst als fertig,** wenn seine Tests die Vertragsprüfungen wirklich ausführen (`for (const check of gameContractChecks(gameModule)) it(check.name, check.run)`), `corepack pnpm rauchtest` (Browser) und `PRUEFSTAND=1 PRUEFSTAND_SPIELE=<id> corepack pnpm pruefstand` grün sind und man es selbst im Browser gegen den Bot gespielt hat. Unfertige Spiele bekommen `draft: true` im Steckbrief und bleiben so von Startseite und Server fern. CSS-Klassen immer mit eigenem Spielpräfix.
- **Commit-Adresse:** `855814+ichthys2k@users.noreply.github.com` (vorher mit `git config user.email` prüfen).
- **GitHub ist die einzige gemeinsame Quelle:** Repo-Ordner nicht per Synology Drive o. Ä. synchronisieren; jeder Arbeitsgang beginnt mit `git pull` und endet mit Commit und Push des Arbeitszweigs (nach `main` nur auf „deploy“). Aufgaben und Ideen liegen als GitHub Issues; neue Ideen stehen auf `status: Idee`, nur Cornelius setzt sie auf `status: Ready`. Zu Beginn jeder Sitzung die Issues mit `status: Ready` und `status: Review` abrufen (`gh issue list --label "status: Ready"`) und kurz nennen. Agenten bearbeiten nur Ready-Issues und reservieren sie vorab durch Kommentar mit Konto und Zweig (🔒); keine Assignees oder Labels für die Reservierung verwenden.
- **Keine Geheimnisse ins Repo** (`.env`, Tokens, Zugangsdaten). Nichts außerhalb dieses Repos anfassen, was nicht zur Aufgabe gehört.
- **Klänge:** Die MP3s liegen im **privaten** Repo `ichthys2k/brett-und-blatt-klaenge` (ElevenLabs-Lizenz) und dürfen nie ins öffentliche Repo kopiert werden. Nur die CI holt sie per Secret. Lokal läuft alles auch ohne – fehlende Klänge sind dann nur ein Hinweis. Neue Klänge nur nach Auswahl durch Cornelius – Werkzeuge im Klang-Repo (`tools/erzeugen.mjs`, `stimme.mjs`, `hoerprobe.mjs`, `uebernehmen.mjs`), Stand in `docs/spiele/klaenge-alle-spiele.md`. Dateinamen dort mit Unterstrichen, Katalognamen mit Bindestrichen, Sprachausrufe `ruf-…`; in Worktrees `KLAENGE_DIR=$HOME/code/brett-und-blatt-klaenge` setzen.
- **Abhängigkeiten:** pnpm 12 nur über corepack (`corepack pnpm …`, `pnpm` ist nicht im PATH). pnpm hat eine Wartefrist für neue Paketversionen – **keine `minimumReleaseAgeExclude`-Ausnahmen**, sondern ältere Versionen wählen. Neue Fremdbibliotheken in `THIRD_PARTY.md` eintragen.
- **Originale der gemalten Bilder nur im privaten Repo:** Jedes generierte Bild wird in **maximaler Original-Auflösung** archiviert, ausschließlich im privaten Repo `ichthys2k/brett-und-blatt-grafik` (`../brett-und-blatt-grafik/originale/<Zielordner>/<name>.png`); ins öffentliche Repo kommt nur die WebP-Fassung, nie ein Ordner `original/` oder ein PNG über 1 MB. `scripts/grafik/uebernehmen.mjs` legt das Original ab und bricht ohne das private Repo ab. Bilder erzeugen nach [`.agent/workflows/grafik-erzeugen.md`](.agent/workflows/grafik-erzeugen.md) und der Stilbibel [`docs/grafik/STILBIBEL.md`](docs/grafik/STILBIBEL.md).

## Arbeitsablauf mit GitHub Issues

Ausführlich mit allen Befehlen: [`.agent/workflows/issue-bearbeiten.md`](.agent/workflows/issue-bearbeiten.md). Kurzfassung:

1. **Sitzungsbeginn:** `git pull`, dann `gh issue list --label "status: Ready"` und `--label "status: Review"` – Cornelius kurz nennen, was ansteht.
2. **Nur `status: Ready` bearbeiten** (setzt allein Cornelius), nach Priorität `prio: hoch` → `mittel` → `niedrig`. Vorher die Kommentare prüfen: Ein 🔒 ohne späteres 🔓 heißt „vergeben“.
3. **Reservieren:** eigener Zweig `<agent>/<kurzname>` von `origin/main`, Kommentar `🔒 Übernehme ich: <Agent/Konto>, Zweig <zweig> — <Datum Uhrzeit UTC>`, Status auf `status: In progress`.
4. **Umsetzen** nach „Fertig, wenn“ im Issue; Tests, `corepack pnpm check`, bei Spielen Rauchtest und Prüfstand, Blick im Browser.
5. **Hochladen:** eigenen Zweig pushen, PR mit `Refs #<Nr>` (nicht `Fixes`). **Nie selbst nach `main`** – das geschieht nur auf Cornelius' Wort „deploy“.
6. **Übergabe:** im Issue zusammenfassen, wie man prüft, Status auf `status: Review`. Schließen (`status: Done`) tut Cornelius.

Neue Wünsche und Fehler als Issue mit `status: Idee`, Typ (`wunsch`/`fehler`), `bereich: …` und ggf. `spiel: <Name>` anlegen; Größeres als Eltern-Issue `vorhaben` mit Unter-Issues je Schritt.

## Wichtige Befehle

```sh
corepack pnpm install
corepack pnpm check                                   # Typprüfung + Tests + Build
corepack pnpm exec vitest run packages/games/<id>     # Tests eines Spiels
corepack pnpm neues-spiel <id> "<Name>"               # neues Spiel aus der Vorlage
corepack pnpm --filter @brett-und-blatt/web dev       # Web-App, http://localhost:5173
corepack pnpm --filter @brett-und-blatt/server dev    # Spieleserver, http://127.0.0.1:8787
node apps/server/scripts/smoke.mjs                    # Rauchtest gegen den lokalen Server
corepack pnpm rauchtest                               # nach dem Build: jedes Spiel im Browser starten
PRUEFSTAND=1 corepack pnpm pruefstand                 # gründlicher Prüfstand (PRUEFSTAND_SPIELE=<id> für einzelne)
```

Neue Spielordner findet ein laufender Dev-Server erst nach einem Neustart. Mehrspieler-Spiele (ab 2 Plätzen) zusätzlich in `apps/server/src/games.ts` und `apps/server/package.json` eintragen.

## Wo was steht

- [`CLAUDE.md`](CLAUDE.md) – Übergabe: Regeln, Werkzeuge, Technik, Rechnerwechsel.
- [`docs/CHRONIK.md`](docs/CHRONIK.md) – Chronik: was wann umgesetzt wurde, mit Dateipfaden (früher „Stand“, „Nächste Schritte“ und „Rückblick“ in `CLAUDE.md`). Neuer Stand gehört hierher.
- [`PLANUNG.md`](PLANUNG.md) – Wegweiser: fertige Filter-Links (Ansichten), Projekt-Board, Archiv #72; die Aufgabenliste selbst sind [GitHub Issues](https://github.com/ichthys2k/brett-und-blatt/issues).
- [`docs/spiele/offene-plaene.md`](docs/spiele/offene-plaene.md) – Übergabe: offene Pläne mit nächstem Auftrag (zuerst Marktplatz-Probe nur mit Bots, Paket C wartet auf Ja), Fehler, Konzepte.
- [`docs/KONZEPT.md`](docs/KONZEPT.md) – Entscheidungen, Spielmodul-Schnittstelle, Muster, Fahrplan.
- [`docs/spiele/`](docs/spiele/README.md) – ein Plan pro Spiel (Regeln, Optionen, Bot, Oberfläche, Umsetzungsstand), Übersicht im README.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) – wie ein neues Spiel angelegt wird.
- [`docs/grafik/STILBIBEL.md`](docs/grafik/STILBIBEL.md) – Stil, Verbote und Regeln für gemalte Bilder; Ablauf zum Erzeugen in [`.agent/workflows/grafik-erzeugen.md`](.agent/workflows/grafik-erzeugen.md), Bestand in [`docs/grafik/BESTAND.md`](docs/grafik/BESTAND.md).
- Code: `apps/web` (React-App), `apps/server` (Cloudflare-Worker), `packages/engine`, `packages/online`, `packages/ui`, `packages/games/<id>` (Ordnername = Spiel-`id`), `content/`.

## Zum Abschluss einer Aufgabe

Wenn sich am Stand etwas ändert, die Chronik `docs/CHRONIK.md` (neuer Stand gehört in die Chronik, nicht nach `CLAUDE.md`) und den Plan des Spiels in `docs/spiele/` nachtragen – mit auf dem Arbeitszweig, damit es im PR sichtbar ist.
