# Brett & Blatt – Hinweise für Claude

Freie Spielesammlung im Browser (Karten- und Brettspiele für Handy und Desktop): allein gegen Bots, zu mehreren an einem Gerät (Hot-Seat), später online. Live unter **https://spiele.lipponer.de**, Quellcode öffentlich unter **github.com/ichthys2k/brett-und-blatt** (AGPL-3.0, Inhalte CC BY-SA 4.0).

Lies vor größeren Arbeiten [`docs/KONZEPT.md`](docs/KONZEPT.md) (Entscheidungen, Schnittstelle, Fahrplan) und für ein bestimmtes Spiel den Plan unter [`docs/spiele/`](docs/spiele/README.md). [`CONTRIBUTING.md`](CONTRIBUTING.md) erklärt, wie ein neues Spiel angelegt wird.

## Regeln für die Zusammenarbeit

- **Sprache:** Bezeichner im Code englisch; Kommentare, Doku, Commit-Nachrichten und UI-Texte deutsch.
- **Commits und Push nur auf ausdrückliche Anweisung** von Cornelius – jeweils einzeln („Commit“, danach „Hochladen“). Ein Push auf `main` veröffentlicht sofort auf spiele.lipponer.de.
- **Commit-Adresse:** immer `855814+ichthys2k@users.noreply.github.com` (steht in der lokalen Git-Konfiguration des Repos; vor dem ersten Commit auf einem neuen Rechner mit `git config user.email` prüfen).
- **Keine Geheimnisse ins Repo:** keine `.env`, Tokens oder Zugangsdaten. Für Cloudflare später nur `.dev.vars`/Wrangler-Secrets (sind in `.gitignore`).
- **Nichts außerhalb dieses Repos anfassen**, was nicht zur Aufgabe gehört – insbesondere keine Dateien mit Zugangsdaten in anderen Projekten (z. B. im Blog-Repo) lesen.
- Vor dem Abschluss einer Aufgabe: `corepack pnpm check` (Typprüfung, alle Tests, Build) und die Änderung im Browser ansehen.

## Werkzeuge und Befehle

- Node.js ≥ 22, **pnpm 12 über corepack** (`pnpm` ist auf dem Laptop nicht im PATH). Deshalb immer `corepack pnpm …`, z. B.:
  - `corepack pnpm install`
  - `corepack pnpm check` – Typprüfung + Tests + Build
  - `corepack pnpm exec vitest run packages/games/<id>` – Tests eines Spiels
  - `corepack pnpm --filter @brett-und-blatt/web dev` – Dev-Server auf http://localhost:5173
- Die Root-Skripte in `package.json` rufen intern `pnpm` auf; ohne pnpm im PATH funktionieren sie nur, wenn man stattdessen die Befehle oben direkt nutzt.
- Neue Spielordner findet der laufende Dev-Server nicht: **Dev-Server neu starten**, wenn ein Spiel hinzukommt.
- GitHub: `gh` CLI (auf jedem Rechner einmal `gh auth login`). CI: `.github/workflows/ci.yml` prüft jeden Push und veröffentlicht `main` über GitHub Pages (eigene Domain, HTTPS erzwungen).

## Technik in Kürze

- Monorepo mit pnpm-Workspaces: `apps/web` (React 19, Vite 8, Tailwind 4, PWA), `packages/engine` (Spielmodul-Schnittstelle, Zufall, lokale Spielleitung, Uhren, allgemeine Bots, Vertragsprüfungen), `packages/online` (Online-Spielleitung ohne Anbieterbindung: Raum, Nachrichtenformat, Raumcodes), `packages/ui` (Baukasten: GridBoard, NetBoard, FitBox, PlayerChip, Karten), `packages/games/<id>` (ein Ordner pro Spiel), `content/` (Inhaltspakete, z. B. Paare).
- **Spielmodul** `GameModule<S, M, V>`: `info`, `options` (optional mit `when` für bedingte Anzeige), `timePresets`, `setup`, `currentPlayers`, `legalMoves`, `applyMove`, `playerView`, `result`, `bots` u. a. Spielstand ist reines JSON, Zufall nur über den Seed-Rng.
- **Jedes Spiel** hat `src/meta.ts` (mit Pflicht-Kurzanleitung `howToPlay`), `src/rules.ts`, `src/index.ts`, `src/ui/index.tsx` und `test/<id>.test.ts` mit den allgemeinen Prüfungen `gameContractChecks`. Die Web-App findet Spiele automatisch; **Ordnername = `id`**.
- Bots laufen im Web Worker; Tipp-Knopf = Standard-Bot auf Stufe „schwer“ mit 1,5 s Budget.
- Fremdcode: `chess.js` (BSD-2-Clause) – Lizenztext in `THIRD_PARTY.md`. Neue Fremdbibliotheken dort ergänzen.

## Stand (Oktober 2026)

**Fertig und veröffentlicht:** Etappe 1 und 2 sowie Schach (Commit `1cc2d29`). Spielbar: Tic-Tac-Toe, Vier in einer Reihe, Ultimate Tic-Tac-Toe, Reversi, Mühle, Paare finden, Schwarzer Peter, Solitaire (Klondike, FreeCell, Spider, Pyramide), Vierer-Schach, Schach – jeweils mit Bots in drei Stufen, Hot-Seat, Zeitlimits und Kurzanleitung.

**Feinschliff-Runde (fertig und veröffentlicht, Commit `5dd4ded`):**
- Querformat auf dem Handy: eigenes Layout (`flat:`-Variante in `apps/web/src/styles.css`, Spielfeld rechts, Steuerung links) in `Play.tsx`.
- Schwarzer Peter: Kartenfächer liefen auf schmalen Bildschirmen über den Rand (Grid-Spalte jetzt `minmax(0, 1fr)`), Kartengröße richtet sich auch nach der Höhe.
- Schach: Option „Brett drehen“ (zum Spieler am Zug / fest), Leisten mit geschlagenen Figuren und Materialvorsprung, letzter Zug und Partieverlauf in deutscher Notation.
- Solitaire: FreeCell-Löser (`src/solver/freecell.ts`, löst ~98 % in ≤ 1,5 s) und Vorausschau für Klondike/Spider (`src/solver/lookahead.ts`); Spider-Bot deutlich besser, Klondike etwa unverändert. Bedingte Optionen (`when`) im Setup.
- Einheitliche Fokus-Markierung für Tastaturbedienung.

**Kleine offene Punkte (fertig):**
- Vierer-Schach: Lupe (🔍 in der freien Ecke oben rechts, ab Feldern < 36 px) vergrößert das Brett auf 170 % in einem verschiebbaren Ausschnitt; Einstellung je Gerät in `localStorage`. Im Querformat bei drei oder mehr Spielern breitere linke Spalte mit kompakten Spieler-Chips zu zweit (`data-crowded` in `Play.tsx`/`styles.css`) – kein Scrollen mehr.
- Solitaire: Klondike-Löser mit voller Information (`src/solver/klondike.ts`), Stichprobensuche im Bot (~6 von 12 statt 1–2) und Option „Nur lösbare Spiele“ für Klondike und FreeCell (`src/solvable.ts`). Details im Spielplan.

**Bekannte offene Punkte:**
- Solitaire: lösbare Spiele für Spider und Pyramide fehlen.
- Soundeffekte: kommen später – Cornelius sucht passende Effekte aus und gibt sie vor. Nicht eigenmächtig einbauen.
- Datenschutzerklärung muss vor den Online-Partien um Cloudflare ergänzt werden (siehe Konzept, Abschnitt „Datenschutz und Sicherheit“).

## Nächste Schritte

**Etappe 3 – Online** (begonnen am 25.10.2026). Mit Cornelius abgestimmter Ablauf:

1. ✅ **Phase 1 – Fundament** (ohne Cloudflare): gemeinsame Schnittstelle `GameSession` (Engine, `Play.tsx` nutzt nur sie); neues Paket `packages/online` mit Nachrichtenformat (`protocol.ts`, jede Browser-Nachricht wird geprüft), Raum (`room.ts`: Lobby, Plätze, Start, Züge mit Versionsprüfung, Sicht je Platz, `eventView`-Filter, Server-Uhr mit 1 s Kulanz, Bot-Ersatz nach 20 s ohne Verbindung, Wiedereinstieg per geheimer Geräte-Kennung, Raumleitung wechselt nach 60 s, Entfernen, Emoji-Reaktionen und Schnellnachrichten, Speichern/Wiederherstellen), Emoji-Raumcodes (4 aus 64) und Spitznamen-Filter. `LocalSession` hat dafür `graceMs`, `botBudgetMs`, `nextDeadline()`, `markAway()`. **Der Seed geht nie an Browser.**
2. **Phase 2 – Cloudflare-Adapter** `apps/server` (lokal mit `wrangler dev`, kein Konto nötig): Worker + Durable Object pro Raum, WebSockets (Hibernation, Verbindung ↔ Mitglied per Attachment, `Room.reattach`), Alarm auf `room.nextWakeup()`, Speichern per `room.snapshot()`, `jurisdiction('eu')`. **Messen, wie viel Rechenzeit Bots auf dem Gratis-Tarif bekommen** (Doku widersprüchlich: 10 ms vs. 30 s); notfalls knappe `botBudgetMs` oder Bots im Browser der Raumleitung.
3. **Phase 3 – Online in der Web-App:** Raum erstellen/beitreten (Emoji-Auswahl, Link, QR-Code), Lobby, `OnlineSession` als zweite `GameSession`, Reaktionsleiste; erst mit vorhandenen Spielen testen.
4. **Phase 4 – Veröffentlichen** (braucht Cornelius): Cloudflare-Konto, Datenschutzerklärung ergänzen, ggf. GitHub-Secret. `lipponer.de` liegt bei **Strato** → der Server läuft zunächst unter `….workers.dev` (eigene Adresse ginge nur mit DNS bei Cloudflare).
5. **Phase 5 – neue Spiele:** Mäxle, Schiffe versenken, Quartett (Werte recherchiert Cornelius), Bingo (Plan fehlt noch).

Entscheidungen: erst Infrastruktur mit vorhandenen Spielen, dann neue Spiele; höchstens 10 Plätze (Bingo später mehr), bis 40 Mitglieder inkl. Zuschauer, Räume nach 24 h ohne Aktivität löschen.

Ursprüngliche Eckpunkte: Cloudflare Workers mit Durable Objects (ein Objekt pro Raum, Daten in der EU per `jurisdiction('eu')`, Gratis-Tarif), neues Paket `apps/server` mit dünnem Cloudflare-Adapter, Räume mit Emoji-Code/Link/QR, Wiedereinstieg, Bot-Ersatz für Abwesende, Server-Uhr, flüchtige Signale. Erste Online-Spiele: Schiffe versenken, Quartett, Mäxle, Bingo (Klassen-Modus). Details im Konzept (Fahrplan, Muster, Zeitlimits) und in den Spielplänen. Für Cloudflare braucht es ein Konto von Cornelius – Anmeldung und Zugangsdaten macht er selbst.

Danach laut Fahrplan: Etappe 4 (Go, Domino, Farbe & Form), 5 (Skat, Schafkopf, Doppelkopf), 6 (Emoji-Sortierer, Emojistone). Seine Originalspiele liegen in `~/code/4playerchess` und `~/code/emojiclicker/minigames/` (nur als Vorlage lesen).

## Hinweise zum Rechnerwechsel

Cornelius arbeitet am Laptop (`FES-MD-377`) und am Desktop (`cornelius-desktop`; in Syncthing heißt das Gerät `cornelius-cachyOS`); welcher läuft, zeigt `hostname`.

- **Über GitHub (empfohlen):** Am neuen Rechner `gh repo clone ichthys2k/brett-und-blatt ~/code/brett-und-blatt`, später `git pull`. Nicht committete Änderungen kommen so nicht mit – sie müssen vorher am anderen Rechner committet und hochgeladen sein.
- **Über eine Ordner-Synchronisation (Syncthing o. Ä.):** **`node_modules/` nicht mitsynchronisieren** (pnpm nutzt rechnerabhängige Verknüpfungen) und nie gleichzeitig auf beiden Rechnern arbeiten, sonst kann der `.git`-Ordner beschädigt werden.
- In beiden Fällen am neuen Rechner zuerst: `node --version` (≥ 22), `corepack pnpm install`, `git status`, `git log --oneline -5`, `git fetch` (mit GitHub abgleichen), `git config user.email` prüfen, dann `corepack pnpm check`.
- `.claude/` (lokale Einstellungen wie `launch.json` für den Dev-Server) ist absichtlich nicht im Repo.
