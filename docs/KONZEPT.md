# Brett & Blatt – Konzept

Eine freie Spielesammlung im Browser: Karten- und Brettspiele für Handy und Desktop, allein gegen Bots, zu mehreren an einem Gerät (Hot-Seat) oder online.

Stand: 25.10.2026

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Name | Brett & Blatt, Repo `ichthys2k/brett-und-blatt` auf GitHub |
| Adresse | `spiele.lipponer.de` |
| Lizenz Code | AGPL-3.0: Wer eine geänderte Fassung weitergibt oder als Server betreibt, muss den Code offenlegen. |
| Lizenz Inhalte | CC BY-SA 4.0 für Grafiken, Sounds, Kartenmotive, Kartensets und eigene Wortlisten |
| Geld | Immer kostenlos, keine Werbung |
| Zielgruppen | Familie und Freunde, Schülerinnen und Schüler, Öffentlichkeit |
| Spieleserver | Cloudflare Workers mit Durable Objects (Gratis-Tarif, Daten in der EU) |
| Sprache | Bezeichner im Code englisch; Kommentare, Doku und Commits deutsch; Oberfläche deutsch und übersetzbar |
| Hosting Code | Öffentlich auf GitHub von Anfang an |
| Kartenbilder | Modern und gut lesbar, selbst erstellt, als SVG aus Code erzeugt |

## Grundidee

Die **Spielregeln** jedes Spiels sind reiner Code: Sie bekommen einen Spielstand und einen Zug und liefern den neuen Spielstand. Sie wissen nichts von Bildschirm, Uhr oder Netzwerk.

Dadurch unterscheiden sich die Spielarten nur in der **Spielleitung**, die Züge entgegennimmt, prüft und weitergibt:

- **Lokale Spielleitung** (im Browser): Einzelspieler gegen Bots und Hot-Seat
- **Server-Spielleitung** (Cloudflare): Online-Spiele; sie hütet geheime Informationen und misst die Zeit

Regelwerk und Oberfläche sind in allen Fällen dieselben.

## Die Spielmodul-Schnittstelle

Jedes Spiel ist ein Ordner unter `packages/games/<id>/` mit Regeln, Bots und Oberfläche. Die Regeln erfüllen diese Schnittstelle:

```ts
interface GameModule<State, Move, View> {
  info: GameInfo;              // id, Name, Spielerzahl, Modi, Muster, Regelversion, Kurzanleitung
  options: OptionSchema;       // Varianten und Hausregeln, erscheinen als Lobby-Schalter
  timePresets: TimePresets;    // „gemütlich“, „normal“, „schnell“

  setup(seats: number, options: Options, seed: string): State;
  currentPlayers(s: State): SeatId[];          // wer handeln darf, auch mehrere oder 'system'
  legalMoves(s: State, seat: SeatId): Move[];
  applyMove(s: State, seat: SeatId, m: Move): { state: State; events: GameEvent[] };
  playerView(s: State, seat: SeatId | 'spectator'): View;  // blendet Geheimes aus
  result(s: State): Result | null;             // auch kooperativ: alle gewinnen oder verlieren

  timeoutMove?(s: State, seat: SeatId): Move;  // fehlt er, zieht bei Zeitablauf der Bot
  sampleHidden?(v: View, seat: SeatId, rng: Rng): State;  // Pflicht bei Spielen mit Geheimnissen
  evaluate?(s: State, seat: SeatId): number;   // Stellungsbewertung für Suchbots
  bots: BotDefinition[];                       // mindestens einer, der allgemeine Bot zählt
}
```

Regeln für alle Module:

- **Deterministisch:** Zufall kommt nur aus dem Seed (Startwert eines Zufallsgenerators), nie aus `Math.random()`. Gleicher Seed und gleiche Züge ergeben immer denselben Spielstand. Darauf beruhen Wiederholung, „Zug zurück“, Wiedereinstieg, Fehlersuche und Schummelprüfung.
- **Getrennte Zufallsströme** je Zweck (z. B. Mischen, Shop, Würfel), damit eine Entscheidung nicht den ganzen folgenden Zufall verschiebt.
- **Serialisierbar:** Der Spielstand ist reines JSON.
- **Ereignisse statt Anzeige-Zustand:** `events` beschreiben, was passiert ist („Karte von Stapel zu Hand“). Die Oberfläche animiert danach. Anzeige-Dinge wie Animationen und Sounds stehen nie im Spielstand.
- **Regelversion:** Jede Partie merkt sich die Regelversion, mit der sie begonnen hat. So gehen gespeicherte und laufende Partien bei Änderungen nicht kaputt.

## Muster

| Muster | Beispiele | Online-Aufgabe des Servers |
|---|---|---|
| Offene Information, Zug um Zug | Mühle, Vier in einer Reihe, Reversi, Go | Züge prüfen |
| Verdeckte Information, Zug um Zug | Skat, Quartett, Schiffe versenken, Mäxle, Paare finden | Geheimnisse hüten, jedem nur seine Sicht schicken |
| Gleichzeitig | Bingo, Aufstellen bei Schiffe versenken | Reihenfolge der Eingänge festlegen |
| Parallele Läufe mit gleichem Seed | Emoji-Sortierer, Solitaire-Wettrennen | Etappen abgleichen, Punkte vergleichen, per Replay prüfen |
| Kooperativ | Feuerwerk, Gedankenlesen | wie oben, Ergebnis gilt für alle |

Ergänzende Bausteine der Spielleitung:

- **Systemzüge:** Die Spielleitung handelt selbst, z. B. Würfeln, Mischen, Bingo-Ziehung, Zeitablauf. Sie stehen als normale Züge in der Zugliste.
- **Gleichzeitige Züge:** `currentPlayers` darf mehrere Spieler liefern.
- **Flüchtige Signale:** Emoji-Reaktionen, „Finger schwebt über Karte“, Live-Punkte. Sie laufen über einen eigenen Kanal und werden nicht gespeichert.
- **Inhaltspakete:** Daten, die ein Spiel bei Bedarf lädt: Paare, Quartett-Sets, Wortlisten, Bingo-Begriffe. Sie liegen unter `content/` und stehen unter CC BY-SA 4.0.

## Spielarten

- **Einzelspieler:** Läuft komplett im Browser, auch offline (PWA, also eine installierbare Web-App). Bots rechnen in einem Web Worker (Hintergrund-Thread).
- **Hot-Seat:** Mehrere Menschen teilen sich ein Gerät. Bei verdeckten Informationen kommt vor jedem Zug ein **Übergabe-Bildschirm** („Gib das Gerät an Anna“). Die Uhr startet erst, wenn er weggetippt ist.
- **Online:** Räume mit Emoji-Code, Link und QR-Code. Dazu Wiedereinstieg nach Verbindungsabbruch, Bot-Ersatz für Abwesende und Zuschauen.
- **Gemischt:** Jeder Platz kann von einem Menschen oder einem Bot besetzt sein.
- **Später:** Fernpartien über Tage, Wohnzimmer- und Klassen-Modus (Beamer zeigt den Tisch, Handys die Hand), Geister-Modus (gegen aufgezeichnete Partien).

## Bots

Jedes Spiel ist gegen Bots spielbar. Das ist Pflicht und wird automatisch geprüft.

1. **Allgemeiner Bot:** Er nutzt nur die Schnittstelle. Die erste Stufe zieht zufällig aus den erlaubten Zügen, die zweite nutzt Monte-Carlo-Baumsuche (MCTS: viele zufällige Partien im Kopf zu Ende spielen).
2. **Eigene Bewertung je Spiel** (`evaluate`) für Minimax mit Alpha-Beta-Schnitt oder für eine gelenkte MCTS.
3. **Spezial-Bots,** wo nötig: Reizen bei Skat, eigene Alpha-Beta-Suche für Schach (Stockfish später denkbar), Wortsuche für Scrabble.

Grundsätze:

- **Ehrlich:** Bots bekommen nur die `playerView`. Unbekanntes raten sie über `sampleHidden`. Das heißt **Determinisierung**: viele denkbare Kartenverteilungen durchrechnen.
- **Schwierigkeit** über Denkzeit, gelegentliche Absicht-Fehler, begrenztes Wissen und begrenztes Gedächtnis.
- **Natürliches Tempo:** Bots „überlegen“ sichtbar 0,5–2 Sekunden.
- Bots laufen im Browser und auf dem Server, mit demselben Code.

## Zeitlimits

Die Uhr gehört zur Spielleitung, nicht zum Regelwerk. Zeitmodelle, wählbar in der Lobby:

| Modell | Beschreibung | Typisch für |
|---|---|---|
| Aus | keine Uhr | Solo, Familie |
| Zugzeit | feste Zeit pro Zug | Kartenspiele |
| Zugzeit + Zeitbank | pro Zug plus persönliche Reserve für die Partie | lockere Runden (Standard) |
| Schachuhr | Gesamtzeit pro Spieler, optional mit Zuschlag pro Zug | Mühle, Reversi |
| Byo-yomi | Hauptzeit, danach Perioden mit fester Zugzeit | Go |
| Phasen-Timer | Zeit für eine Phase, in der alle gleichzeitig handeln | Aufstellen, Shop, Bingo |
| Fernpartie | Tage pro Zug, mit Erinnerung | Go, Scrabble |

Bei Zeitablauf greift der `timeoutMove` des Spiels, sonst zieht der Bot. Wer dreimal in Folge die Zeit überschreitet, gilt als abwesend; ein Bot übernimmt, bis die Person zurückkommt.

Weitere Regeln zur Uhr:

- Online misst der Server die Zeit und gleicht die Netzverzögerung aus (Kulanz etwa 1 Sekunde).
- Zeit-Ausgleich je Spieler ist möglich, z. B. ×1,5.

Was den Spielfluss außerdem beschleunigt: automatische Pflichtzüge, Vorab-Züge, einstellbares Animationstempo und hervorgehobene erlaubte Züge.

## Oberfläche

- React 19, Vite, TypeScript, Tailwind 4, als PWA.
- Darstellung mit HTML/SVG und CSS-Animationen; einzelne Spiele dürfen ein eigenes Canvas mitbringen.
- **Bedienung:** Antippen und dann das Ziel antippen funktioniert überall; Ziehen per Drag & Drop gibt es zusätzlich. Tippflächen sind mindestens 44 px groß, erlaubte Züge werden hervorgehoben.
- **Hochformat:** eigene Hand unten, Gegner kompakt oben. **Quer/Desktop:** Tisch in der Mitte, Gegner ringsum, Seitenleiste mit Protokoll.
- **Baukasten:**
  - Karten: Karte, Hand (Fächer), verdeckter Fächer zum Ziehen, Stapel, Ablage, Stich-Anzeige
  - Bretter: Gitterbrett, Netzbrett, zoombares Brett
  - Würfel und Becher
  - Spielrahmen: Spielerleiste mit Uhr-Ring, Übergabe-Bildschirm, Ergebnis- und Listenansicht
- **Kartenblätter:** Französisch (32, 48 und 52 Karten, wahlweise vierfarbig wie das Skat-Turnierbild), Deutsch/Bayerisch (32 und 24 Karten), später Württembergisch. Alle werden aus Daten als SVG erzeugt: scharf, klein, im Dunkelmodus nutzbar und lizenzrechtlich sauber.
- **Barrierearm:** Farben immer zusätzlich mit Symbolen unterschieden, Koordinaten als Text, Vorlesen optional.

## Datenschutz und Sicherheit

Die Plattform richtet sich auch an Kinder, Schülerinnen, Schüler und Fremde. Deshalb:

- **Keine Konten** in den ersten Etappen: nur Spitzname und Emoji-Avatar, dazu eine zufällige lokale Kennung für den Wiedereinstieg.
- **Kein freier Chat:** nur Emoji-Reaktionen und vorgefertigte Schnellnachrichten („Gut gespielt!“).
- **Spitznamen-Filter;** die Raumleitung kann Spieler entfernen. Öffentliche Räume mit Fremden kommen erst später und bekommen eine Melden-Funktion. Standard sind private Räume per Code.
- **Daten in der EU** (Durable Objects mit `jurisdiction('eu')`), kurze Speicherdauer (inaktive Räume werden gelöscht), keine Tracker, keine Werbung.
- **Impressum und Datenschutzerklärung** auf `spiele.lipponer.de` (`#/impressum`, `#/datenschutz`); das Impressum verweist auf die Anbieterangaben auf lipponer.de. Vor Online-Partien wird die Datenschutzerklärung um Cloudflare ergänzt.
- **Schule:** Vor dem Einsatz im Unterricht mit dem schulischen Datenschutz abstimmen. Dank Datensparsamkeit ist das wenig Aufwand.
- **Repo:** Keine Geheimnisse im Repo (Zugangsdaten nur als GitHub-Secrets), keine Schülerdaten in Code oder Issues. Commits laufen über die noreply-Adresse von GitHub.

## Rechtliches

- Spielmechaniken sind frei, Markennamen nicht. Darum heißen die Spiele z. B. „Vier in einer Reihe“, „Paare finden“ und „Reversi“. Für Uno, Kniffel, Malefiz, Monopoly, Catan, Scrabble, Qwirkle usw. braucht es eigene Namen.
- Fremder Code und fremde Daten nur mit verträglicher Lizenz, z. B. Stockfish (GPL-3), Wortliste igerman98 (GPL-2/3). Die Quelle steht in `THIRD_PARTY.md`.
- Musik und Tierlaute aus Emojistone sind mit bezahltem Suno-Abo erstellt und dürfen unter CC BY-SA ins Repo (Nennung: „Cornelius Lipponer, erstellt mit Suno“).
- Poker nur mit Spielgeld; Mäxle mit Leben statt Getränken.

## Technik und Repo-Aufbau

```
brett-und-blatt/
  apps/web/            PWA (React, Vite)
  apps/server/         Cloudflare Worker mit Durable Objects (ein Objekt pro Raum)
  packages/engine/     Schnittstelle, Zufall, Spielleitung, Zeitmodelle, allgemeine Bots
  packages/ui/         Baukasten (Karten, Bretter, Würfel, Spielrahmen)
  packages/games/<id>/ ein Ordner pro Spiel (rules, bots, ui, tests)
  content/             Inhaltspakete (CC BY-SA 4.0)
  docs/                Konzept, Spielpläne, Anleitungen
```

- **Werkzeuge:** pnpm-Workspaces (mehrere Pakete in einem Repo), Vitest für Tests, Wrangler für Cloudflare.
- **Neue Spiele:** Die Plattform findet Spielordner automatisch (`import.meta.glob`) und lädt ein Spiel erst, wenn man es öffnet (Code-Splitting). Vorlage: `pnpm neues-spiel <id> "<Name>"`, Lehrbeispiel ist Tic-Tac-Toe (siehe [CONTRIBUTING.md](../CONTRIBUTING.md)).
- **Server neutral:** Die Server-Spielleitung ist ein eigenes Paket mit dünnem Cloudflare-Adapter. Ein Node-Adapter für warpdrive oder einen gemieteten Server ist jederzeit möglich.

**GitHub:**

- **Actions** testen bei jedem Push. Für jedes Spiel laufen Hunderte Bot-gegen-Bot- und Zufallspartien mit; geprüft werden Absturzfreiheit, Spielende, Wiederholbarkeit, dass keine Geheimnisse in `playerView` landen und Partien mit ständigem Zeitablauf.
- **Deployment:** Die Web-App läuft über GitHub Pages unter `spiele.lipponer.de`. Der Workflow „Prüfungen“ veröffentlicht nach jedem Push auf `main` – aber nur, wenn alle Prüfungen bestanden sind. Der Worker kommt später über Wrangler.
- **Mitmachen:** Issue-Vorlagen („Spielidee“, „Fehler gefunden“) und das Label „good first issue“ für kleine Spiele.

## Fahrplan

| Etappe | Inhalt | Spiele |
|---|---|---|
| 1 Fundament ✅ | Monorepo, Schnittstelle, lokale Spielleitung, Gitterbrett, allgemeine Bots, lokale Zeitlimits, PWA, CI | Tic-Tac-Toe (Vorlage), Vier in einer Reihe |
| 2 Offline-Sammlung ✅ | Netzbrett, Karten-Baukasten, Übergabe-Bildschirm, Inhaltspakete | Ultimate Tic-Tac-Toe, Mühle, Reversi, Paare finden, Schwarzer Peter, Solitaire, Vierer-Schach (Port), Schach |
| 3 Online | Cloudflare-Server, Räume, Wiedereinstieg, Bot-Ersatz, Server-Uhr, flüchtige Signale | Schiffe versenken, Quartett, Mäxle, Bingo (Klassen-Modus) |
| 4 Großes Brett | Zoombares Brett, Byo-yomi, Auszählphase, Fernpartie, Bänkchen für Steine | Go, Domino, Farbe & Form (Qwirkle-artig) |
| 5 Stichspiele | Stich-Kern, Serien-Rahmen, Reizen und Ansagen | Skat, Schafkopf, Doppelkopf |
| 6 Eigene Spiele | Parallel-Modus mit Match-Engine | Emoji-Sortierer, Emojistone |
| danach | | Scrabble, Uno-artig, Poker, Binokel, Dame, Mensch ärgere dich nicht und die Ideenliste |

Die Pläne der einzelnen Spiele stehen in [`spiele/`](spiele/README.md).

## Vorgemerkt: Farbe & Form (Qwirkle-artig)

Legespiel für 2–4 Personen mit 108 Steinen (6 Farben × 6 Formen, je dreimal). Jeder hat 6 Steine auf dem Bänkchen und legt Reihen, in denen alle Steine dieselbe Farbe oder dieselbe Form haben, ohne Doppelte. Punkte gibt es für jede berührte Reihe, für eine volle Sechserreihe zusätzlich 6.

- **Muster:** verdeckt (Bänkchen und Beutel), Zug um Zug
- **Bausteine:** zoombares, nach allen Seiten wachsendes Brett; Bänkchen (auch für Scrabble und Domino)
- **Bot:** gierig (meiste Punkte), stärker mit Determinisierung (was der Gegner haben könnte)
- **Etappe:** 4, eigener Plan folgt

## Ideenliste

Weitere passende Spiele aus dem Brainstorming:

- **Kartenspiele:** Sechsundsechzig, Herz, Pik, Stiche raten, Rommé, Canasta, Gin Rommé, Präsident, Mogeln, Sieben legen, Durak, Krieg, Feuerwerk (kooperativ), Gedankenlesen (kooperativ, Echtzeit), Speed (Echtzeit)
- **Brettspiele:** Gomoku, Hex, Mancala, Hnefatafl, Backgammon, Sternhalma, Barrikade, Leiterspiel, Polyomino-Legespiel, Straßenhandel, Inselsiedler, Verdeckte Armeen, Yacht

## Offene Punkte

- Kartenblätter und Quartett-Sets gestalten bzw. recherchieren
- Wortliste für Scrabble (vor Etappe „danach“)
