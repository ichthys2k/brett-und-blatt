# Mitmachen bei Brett & Blatt

Schön, dass du mitmachen willst! Hier steht, wie du das Projekt startest, wie es aufgebaut ist und wie du ein neues Spiel hinzufügst. Hintergründe und Entscheidungen stehen im [Konzept](docs/KONZEPT.md), die Pläne der einzelnen Spiele unter [docs/spiele](docs/spiele/README.md).

## Loslegen

Du brauchst Node.js 22 oder neuer und pnpm. pnpm bekommst du z. B. über `corepack enable` (wird mit Node.js geliefert) oder über die Paketverwaltung deines Systems.

```bash
pnpm install     # Abhängigkeiten installieren
pnpm dev         # Web-App starten: http://localhost:5173
pnpm test        # alle Tests, inklusive der Prüfungen für jedes Spiel
pnpm typecheck   # TypeScript-Typprüfung
pnpm check       # alles zusammen: Typprüfung, Tests, Build
```

## Aufbau

```
apps/web/              Web-App (React, Vite, Tailwind, PWA)
apps/server/           Spieleserver: dünner Cloudflare-Adapter (Worker + Durable Object pro Raum)
packages/engine/       Spielmodul-Schnittstelle, Zufall, Spielleitung, Uhren, allgemeine Bots, Prüfungen
packages/online/       Online-Spielleitung ohne Anbieterbindung (Raum, Nachrichtenformat, Raumcodes, OnlineSession)
packages/ui/           Baukasten für die Oberfläche (Gitterbrett, Netzbrett, Spielerleiste mit Uhr-Ring, Karten)
packages/games/<id>/   ein Ordner pro Spiel
content/               Inhaltspakete, z. B. Paare (CC BY-SA 4.0)
docs/                  Konzept und Spielpläne
```

Ein Spiel besteht aus:

| Datei | Inhalt |
|---|---|
| `src/meta.ts` | Steckbrief (Name, Emoji, Spielerzahl, Kurzanleitung „So geht's“) – für das Menü, wird sofort geladen |
| `src/rules.ts` | die Regeln als reine Funktionen |
| `src/bots.ts` | der Standard-Bot |
| `src/index.ts` | das Spielmodul (`gameModule`) – fügt alles zusammen |
| `src/ui/index.tsx` | die Oberfläche (`gameUi`) |
| `test/<id>.test.ts` | Regeltests und die allgemeinen Prüfungen |

Die Web-App findet neue Spiele automatisch. Der Ordnername muss dabei der `id` im Steckbrief entsprechen.

Für Online-Partien muss ein Spiel für mehrere Personen zusätzlich im Spieleserver eingetragen werden: in `apps/server/src/games.ts` (Liste `onlineGames`) und als Abhängigkeit in `apps/server/package.json`, danach `pnpm install`. Ein Test im Server-Paket schlägt fehl, solange das fehlt. Spiele für eine Person (wie Solitaire) laufen nur im Browser.

## Ein neues Spiel hinzufügen

```bash
pnpm neues-spiel muehle "Mühle"
pnpm install
```

Das legt eine Kopie der Vorlage Tic-Tac-Toe an. Die Kopie ist sofort spielbar und besteht alle Prüfungen, sobald sie wie oben im Spieleserver eingetragen ist. Danach ersetzt du Schritt für Schritt Regeln, Bot und Oberfläche. Die Vorlage [`packages/games/tic-tac-toe`](packages/games/tic-tac-toe) ist ausführlich kommentiert.

### Regeln für Spielmodule

- **Rein:** Regelfunktionen verändern ihre Eingaben nie und geben neue Spielstände zurück.
- **Wiederholbar:** Zufall nur über `Rng` aus dem Seed, nie `Math.random()`. Gleicher Seed und gleiche Züge müssen denselben Spielstand ergeben.
- **Reines JSON:** Spielstand, Züge und Sicht enthalten keine Klassen, Funktionen, `Map` oder `Set`.
- **Geheimnisse:** Was ein Spieler nicht sehen darf, blendet `playerView` aus. Spiele mit Geheimnissen brauchen `sampleHidden` für die Bots.
- **Anleitung ist Pflicht:** `howToPlay` im Steckbrief erklärt die wichtigsten Regeln in wenigen kurzen Sätzen. Sie erscheint beim Einrichten und im Spiel hinter dem „?“-Knopf.
- **Bots sind Pflicht:** Jedes Spiel ist gegen den Computer spielbar. Der erste Bot in `bots` ist der Standard; die allgemeinen Bots (`generalBots()`) funktionieren mit jedem Spiel.
- **Prüfungen:** Jeder Spieltest bindet `gameContractChecks(gameModule)` ein. Sie spielen viele Zufalls- und Bot-Partien und prüfen dabei die Regeln oben.

## Konventionen

- Bezeichner im Code auf Englisch, Kommentare, Doku und Commit-Nachrichten auf Deutsch.
- Oberflächentexte stehen in `apps/web/src/i18n.ts`.
- Markennamen fremder Spiele nicht verwenden („Vier in einer Reihe“ statt des Markennamens).

## Lizenzen

Mit einem Beitrag stimmst du zu, dass Code unter der [AGPL-3.0](LICENSE) und Inhalte (Grafiken, Sounds, Kartensets, Wortlisten) unter CC BY-SA 4.0 veröffentlicht werden. Fremde Inhalte bitte nur mit verträglicher Lizenz und mit Quellenangabe.
