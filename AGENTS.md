# Brett & Blatt – Hinweise für KI-Agenten

Diese Datei ist für Agenten außer Claude Code gedacht (Google Antigravity/Gemini, Codex, Cursor u. a.). **Die ausführliche Übergabe steht in [`CLAUDE.md`](CLAUDE.md) – lies sie vor jeder Aufgabe ganz.** Sie gilt für alle Agenten gleich, auch wenn sie nach Claude benannt ist. Hier stehen nur die Kernregeln und Wegweiser; bei Widersprüchen gilt `CLAUDE.md`, und neue Erkenntnisse gehören dorthin (nicht hierher), damit es nur eine Quelle gibt.

Freie Spielesammlung im Browser (Karten- und Brettspiele für Handy und Desktop): allein gegen Bots, zu mehreren an einem Gerät, online. Live unter https://spiele.lipponer.de, Spieleserver auf Cloudflare unter https://brett-und-blatt.lipponer.workers.dev. Lizenz AGPL-3.0, Inhalte CC BY-SA 4.0.

## Kernregeln

- **Sprache:** Cornelius schreibt Deutsch – antworte Deutsch. Bezeichner im Code englisch; Kommentare, Doku, Commit-Nachrichten und UI-Texte deutsch.
- **Erst Vorschlag, dann Änderung:** Bei allem, was über eine kleine, klar beauftragte Änderung hinausgeht, zuerst den Plan bzw. Vorschlag zeigen und auf Zustimmung warten.
- **Commit, Hochladen (Push) und Merge nur auf Cornelius' ausdrückliches Wort** – jeweils einzeln, **oder komplett in einem Schritt durch den Befehl „deploy“** (committen, nach `main` mergen und pushen). Ein „Commit“ alleine erlaubt noch keinen Push.
- **Jeder Push auf `main` veröffentlicht sofort:** Die CI (`.github/workflows/ci.yml`) prüft, veröffentlicht dann den Spieleserver auf Cloudflare und danach die Web-App über GitHub Pages. Arbeite auf einem eigenen Zweig.
- **Vor jedem Commit:** `corepack pnpm check` (Typprüfung, alle Tests, Build) muss grün sein, und die Änderung im Browser ansehen (`corepack pnpm --filter @brett-und-blatt/web dev`, http://localhost:5173).
- **Ein Spiel gilt erst als fertig,** wenn seine Tests die Vertragsprüfungen wirklich ausführen (`for (const check of gameContractChecks(gameModule)) it(check.name, check.run)`), `corepack pnpm rauchtest` (Browser) und `PRUEFSTAND=1 PRUEFSTAND_SPIELE=<id> corepack pnpm pruefstand` grün sind und man es selbst im Browser gegen den Bot gespielt hat. Unfertige Spiele bekommen `draft: true` im Steckbrief und bleiben so von Startseite und Server fern. CSS-Klassen immer mit eigenem Spielpräfix.
- **Commit-Adresse:** `855814+ichthys2k@users.noreply.github.com` (vorher mit `git config user.email` prüfen).
- **GitHub ist die einzige gemeinsame Quelle:** Repo-Ordner nicht per Synology Drive o. Ä. synchronisieren; jeder Arbeitsgang beginnt mit `git pull` und endet mit Commit und Push (auf Cornelius' Wort). Vor dem Bearbeiten eines Eintrags aus `PLANUNG.md` Name/Konto und Zweig dort eintragen und hochladen.
- **Keine Geheimnisse ins Repo** (`.env`, Tokens, Zugangsdaten). Nichts außerhalb dieses Repos anfassen, was nicht zur Aufgabe gehört.
- **Klänge:** Die MP3s liegen im **privaten** Repo `ichthys2k/brett-und-blatt-klaenge` (ElevenLabs-Lizenz) und dürfen nie ins öffentliche Repo kopiert werden. Nur die CI holt sie per Secret. Lokal läuft alles auch ohne – fehlende Klänge sind dann nur ein Hinweis. Neue Klänge nur nach Auswahl durch Cornelius – Werkzeuge im Klang-Repo (`tools/erzeugen.mjs`, `stimme.mjs`, `hoerprobe.mjs`, `uebernehmen.mjs`), Stand in `docs/spiele/klaenge-alle-spiele.md`. Dateinamen dort mit Unterstrichen, Katalognamen mit Bindestrichen, Sprachausrufe `ruf-…`; in Worktrees `KLAENGE_DIR=$HOME/code/brett-und-blatt-klaenge` setzen.
- **Abhängigkeiten:** pnpm 12 nur über corepack (`corepack pnpm …`, `pnpm` ist nicht im PATH). pnpm hat eine Wartefrist für neue Paketversionen – **keine `minimumReleaseAgeExclude`-Ausnahmen**, sondern ältere Versionen wählen. Neue Fremdbibliotheken in `THIRD_PARTY.md` eintragen.

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

- [`CLAUDE.md`](CLAUDE.md) – Übergabe: Regeln, Technik, aktueller Stand, nächste Schritte.
- [`PLANUNG.md`](PLANUNG.md) – gemeinsame Liste der Wünsche (`W-…`) und Fehler (`F-…`) mit Status. Zu Beginn lesen, Einträge nur auf Auftrag in Arbeit nehmen, Erledigtes markieren und nach „Erledigt“ verschieben.
- [`docs/KONZEPT.md`](docs/KONZEPT.md) – Entscheidungen, Spielmodul-Schnittstelle, Muster, Fahrplan.
- [`docs/spiele/`](docs/spiele/README.md) – ein Plan pro Spiel (Regeln, Optionen, Bot, Oberfläche, Umsetzungsstand), Übersicht im README.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) – wie ein neues Spiel angelegt wird.
- Code: `apps/web` (React-App), `apps/server` (Cloudflare-Worker), `packages/engine`, `packages/online`, `packages/ui`, `packages/games/<id>` (Ordnername = Spiel-`id`), `content/`.

## Fahrplan-Stand (Oktober 2026)

- ✅ Etappe 1 Fundament, ✅ Etappe 2 Offline-Sammlung, ✅ Etappe 3 Online (Schiffe versenken, Quartett, Mäxle, Bingo), ✅ Etappe 4 Großes Brett (Go, Domino, Farbe & Form).
- ✅ Etappe 5 Stichspiele (Skat, Schafkopf, Doppelkopf): Stich-Kern und Serien-Rahmen in der Engine, 4-Farben- und Bayerisch/Deutsches Blatt, Skat (ISkO, Seeger-Fabian), Schafkopf (Sauspiel, Wenz, Solo, Ramsch), Doppelkopf (DDV, Soli, Hochzeit, Ansagen).
- ✅ Etappe 6 Eigene Spiele: abgeschlossen – Farbensortierer und Drachenspiel (Emojistone) sind live.
- ✅ Etappe 7: **Eins!** (Uno), **Mau-Mau**, **Dame** (Checkers), **Nicht ärgern!** (Ludo), **Poker** (Texas Hold'em), **Wortgitter/Scrabble**, sowie **Bibel-Quiz**, **Galgenmännchen**, **Wort-Salat**. **Binokel** und **Wortgitter** wurden am 28.10. neu geschrieben und sind spielbar.
- ✅ Weitere Spiele: **Gomoku** (Fünf in einer Reihe), **Kartenblitz** (früher Ligretto, Reaktionsspiel), **Würfelblock** (früher Kniffel). Mathe-Übungen für Klasse 5 & 6 (Zielzahl, Teiler-Duell, Rechenmauer, Enten-Rallye) und erweiterte Mathe-Modi in Klassikern umgesetzt.

- Korrekturplan aus dem Prüfbericht (28.10.2026): ✅ Etappe 1 Lecks, ✅ Etappe 2 Prüfnetz, ✅ Etappe 3 Reparaturen (Stichspiele, Bots für Skat, Schafkopf, Doppelkopf, Kniffel; Wortgitter und Binokel neu), ✅ Etappe 4 Rechtliches (Umbenennungen, freies Wörterbuch, Enten-Rallye-Klänge im privaten Klang-Repo). Details in `CLAUDE.md`.

- Nachträge 28.10.2026: Sonderspiele der Stichspiel-Bots (Null, Tout, Bettel, Durch), Schafkopf-Ansagen und -Abrechnung korrigiert, Bibel-Quiz-Lösung in der Sicht verborgen, PWA lädt vorab nur ~6 MB, Git-Geschichte von den Enten-Rallye-MP3s bereinigt (andere Rechner: `git fetch && git reset --hard origin/main`).
- Fahrplan ab 29.10.2026: A Doku-Abgleich → B Schach (Remis, PGN, Eröffnungsbuch) → C Stichspiele (Schafkopf-Frühende, Skat-Ansagen, PIMC-Bot) → D Klassenzimmer (Kartenblitz geteilter Bildschirm) → E Spieltiefe → F neue Spiele (Speed ✅, Präsident ✅, Tiefflug ✅, Fix gefunden! ✅; Pläne in `docs/spiele/`). Details unter „Nächste Schritte“ in `CLAUDE.md`.

Kleinere Punkte zu vorhandenen Spielen (Go-Fernpartie, SGF-Import, Domino-Spinner, lösbare Spiele für Spider/Pyramide) sind umgesetzt; alle 20 Musikstücke sind eingetragen. Offene Punkte und nächste Schritte stehen in `CLAUDE.md`.

## Zum Abschluss einer Aufgabe

Wenn sich am Stand etwas ändert, den Abschnitt „Stand“ bzw. „Nächste Schritte“ in `CLAUDE.md` und den Plan des Spiels in `docs/spiele/` nachtragen – als Teil des Vorschlags, nicht ungefragt committen.
