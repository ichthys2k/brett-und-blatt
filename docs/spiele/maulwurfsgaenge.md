# Maulwurfsgänge

*Vorhaben [#457](https://github.com/ichthys2k/brett-und-blatt/issues/457). Schiebe-Labyrinth für 2–4 Spieler ab etwa 6 Jahren: Hasen suchen Rüben in einem Tunnelsystem, das sich bei jedem Zug verschiebt. Gärtner Maulwurf sitzt in einem Gang und versperrt den Weg.*

> **Name und Herkunft:** eigene Fassung in der Art von „Das verrückte Labyrinth“ (Ravensburger); Name, Bilder und Kernregel sind eigen (Regel des Projekts: keine Nachbauten bestimmter Verlagsspiele). Arbeitstitel „Maulwurfsgänge“, id `mole-tunnels`. **Die eigene Kernregel:** Die Rüben liegen **offen** auf dem Brett (keine verdeckten Schatzkarten), wer zuerst die vereinbarte Zahl geerntet hat, gewinnt; geerntete Rüben wachsen woanders nach; ein Maulwurf-Marker sperrt ein Teil. Verdeckte Aufträge nach Art des Vorbilds sind ausdrücklich **nicht** im Umfang (siehe „Entscheidungen“).

| Steckbrief | |
|---|---|
| Spieler | 2–4 (Startecken) |
| Modi | Solo gegen Bots, Hot-Seat, online |
| Muster | Zug um Zug, **offen** (kein Übergabe-Bildschirm im Hot-Seat) |
| Bausteine | eigenes Brett mit beweglichen Teilen (kein `GridBoard`, wegen der Schiebe-Animation), `PlayerChip`, Hasen/Rübe/Maulwurf aus Rübenacker, Acker-Kulisse |
| Aufwand | Regeln M, Oberfläche L, Bot M |
| Ordner | `packages/games/mole-tunnels` |
| Anlegen | `corepack pnpm neues-spiel mole-tunnels "Maulwurfsgänge"`, danach `corepack pnpm install`; bis zur Freigabe `draft: true` im Steckbrief |

## Regeln

**Brett.** Ein Raster aus 7 × 7 Teilen (Option 5 × 5). Jedes Teil ist ein Gang: **Gerade** (I), **Kurve** (L) oder **Abzweig** (T). Die Teile auf Feldern mit geraden Zeilen- *und* Spaltennummern (0, 2, 4, 6) sind **fest**, alle anderen **beweglich**; dazu kommt **ein Freiteil** neben dem Brett.

| Brett | feste Teile | bewegliche Teile (inkl. Freiteil) | Schiebestellen |
|---|---|---|---|
| 7 × 7 | 16 (4 Kurven in den Ecken, 8 Abzweige am Rand, 4 Abzweige innen) | 34 = 13 Gerade + 15 Kurven + 6 Abzweige | 12 (Zeilen/Spalten 1, 3, 5 von allen vier Seiten) |
| 5 × 5 | 9 (4 Kurven, 4 Abzweige am Rand, 1 Abzweig in der Mitte) | 17 = 7 Gerade + 7 Kurven + 3 Abzweige | 8 (Zeilen/Spalten 1, 3) |

Feste Ecken sind nach innen geöffnet, feste Randabzweige zeigen nach innen; die Ausrichtung der inneren festen Abzweige würfelt `setup` aus dem Seed. Die beweglichen Teile werden gemischt und zufällig gedreht.

**Rüben und Maulwurf.** Auf dem Brett liegen gleichzeitig 6 Rüben (Option 4 / 6 / 8), je auf einem Teil, nie in einer Startecke. Die Rübe gehört zum Teil und wandert beim Schieben mit. Der Maulwurf sitzt auf einem beweglichen Teil (nicht Startecke, ohne Rübe) und wandert ebenfalls mit seinem Teil (Option „ohne Maulwurf“).

**Start.** Jeder Spieler hat einen Hasen in einer Ecke: Platz 0 oben links, 1 unten rechts, 2 oben rechts, 3 unten links (zu zweit also gegenüber). Reihenfolge reihum.

**Ein Zug hat zwei Schritte, beide macht derselbe Spieler:**

1. **Schieben.** Das Freiteil nach Wunsch drehen und an einer Schiebestelle ins Brett schieben. Die ganze Zeile bzw. Spalte rutscht um ein Feld weiter, das Teil am anderen Ende fällt heraus und wird das neue Freiteil. Alles, was auf den Teilen liegt (Rüben, Maulwurf, Hasen), rutscht mit. Wird ein Hase mit hinausgeschoben, setzt er sich auf das Teil, das gerade neu hineingekommen ist. **Verboten** ist nur, den Schub des Vorgängers sofort rückgängig zu machen (gleiche Zeile/Spalte, Gegenseite).
2. **Laufen.** Der eigene Hase darf zu jedem Feld laufen, das durch zusammenhängende Gänge erreichbar ist (zwei Teile sind verbunden, wenn beide Öffnungen zueinander zeigen), oder stehen bleiben. Kommt er auf einem Feld mit Rübe an, **erntet** er sie (nur am Ziel, nicht unterwegs). Mehrere Hasen dürfen auf einem Feld stehen.

**Maulwurf.** Ein Feld mit Maulwurf darf nicht betreten und nicht durchquert werden. Steht ein Hase auf dem Feld, weil das Teil unter ihn geschoben wurde, darf er es normal verlassen. Eine Rübe unter dem Maulwurf lässt sich erst ernten, wenn das Teil weitergeschoben ist.

**Nachwachsen.** Wird eine Rübe geerntet, wächst sofort eine neue auf einem zufälligen Teil ohne Rübe (nicht unter dem Maulwurf, nicht in einer Startecke). Zufall nur über den Seed-Rng im Spielstand. Es liegen also immer gleich viele Rüben aus.

**Sieg.** Wer zuerst 5 Rüben hat (Option 3 / 5 / 8). Spätestens nach 40 Zügen je Spieler endet die Partie: die meisten Rüben gewinnen, bei Gleichstand teilen sich die Spitzenreiter den Sieg (`result` mit Rangfolge).

## Optionen (`OptionSpec`)

| id | Auswahl | Standard |
|---|---|---|
| `size` | 7 × 7 (Standard) / 5 × 5 (kurz, für kleine Bildschirme) | 7 |
| `goal` | 3 / 5 / 8 Rüben zum Sieg | 5 |
| `turnips` | 4 / 6 / 8 Rüben liegen aus (bei 5 × 5 höchstens 6) | 6 |
| `mole` | Maulwurf an / aus | an |
| `reach` | Erreichbare Felder markieren: an / aus (Profi). Nur Anzeige, ändert keine Regel – am besten als Gerätevorliebe statt als Spieloption, dann bleibt die Partie fair | an |

`timePresets`: `relaxed` keine Uhr, `normal` 45 s je Zug, `fast` 20 s (ein Zug = beide Schritte; Zeitablauf = `timeoutMove`).

## Spielmodell (`src/rules.ts`)

Reines JSON, Zufall nur über den Seed-Rng (Muster `turnip-patch`).

```ts
type Side = 'top' | 'bottom' | 'left' | 'right';
type Kind = 'I' | 'L' | 'T';
interface Tile { id: number; kind: Kind; rot: 0 | 1 | 2 | 3; turnip: boolean; mole: boolean }

interface MoleState {
  size: 5 | 7;
  cells: Tile[];            // Zeile für Zeile, size × size; feste Teile tragen `fixed` implizit über die Lage
  spare: Tile;              // Freiteil
  lastPush: { side: Side; index: number } | null;
  hares: [row: number, col: number][];  // je Platz
  turnips: number[];        // geerntete Rüben je Platz
  phase: 'push' | 'walk';
  turn: number;             // wer ist dran
  moves: number;            // Zähler für das Zuglimit
  options: { goal: number; turnips: number; mole: boolean };
  rng: unknown;             // Seed-Rng-Zustand, in der Sicht auf null setzen
}

type MoleMove =
  | { type: 'push'; side: Side; index: number; rot: 0 | 1 | 2 | 3 }  // rot = zusätzliche Vierteldrehungen im Uhrzeigersinn
  | { type: 'walk'; to: [row: number, col: number] };                // to = eigenes Feld bedeutet „stehen bleiben“
```

- **Stabile Teil-`id`:** Jedes Teil behält seine Nummer ein Leben lang. Nur so kann die Oberfläche das Schieben als echte Bewegung animieren.
- **Öffnungen** als Bitmaske N = 1, E = 2, S = 4, W = 8. Grundlage (Drehung 0): Gerade = N+S (5), Kurve = N+E (3), Abzweig = N+E+W (11). Eine Vierteldrehung im Uhrzeigersinn: `((m << 1) | (m >> 3)) & 15`. Zwei Nachbarn sind verbunden, wenn die zugewandten Öffnungen beider gesetzt sind.
- **Eindeutige Zugliste:** Gerade haben nur 2 verschiedene Drehungen (`rot` 0–1), Kurve und Abzweig 4. Bei 7 × 7 sind das höchstens 12 × 4 = 48 Schübe minus des verbotenen Rückschubs; die Laufzüge sind höchstens 49 (Breitensuche über freie, verbundene Felder; `to` = eigenes Feld ist immer erlaubt).
- **Schiebe-Algorithmus** (für alle vier Seiten dieselbe Funktion mit Richtungsvektor): Teil am Ende der Reihe merken, Reihe um 1 verschieben, Freiteil (nach `rot` gedreht) am Anfang einsetzen, das gemerkte Teil wird `spare`; Hasen auf den verschobenen Teilen werden mitgerechnet, ein Hase auf dem herausfallenden Teil kommt auf das neu eingesetzte Feld.
- `currentPlayers`: derselbe Platz in beiden Phasen; `applyMove` wechselt `push` → `walk` und `walk` → nächster Spieler (`phase: 'push'`).
- `result`: Sieger bei erreichtem Ziel; Zuglimit nach `moves >= 40 × Plätze`.
- `timeoutMove`: im Schritt „Schieben“ der erste erlaubte Schub ohne Drehung, im Schritt „Laufen“ stehen bleiben.
- `playerView`: alles offen; nur `rng` auf `null` setzen. `hiddenInformation: false`, `patterns: ['open']`; `hints: true`. `sampleHidden` ist dann nicht nötig – die Vertragsprüfung in `packages/engine/src/testing/contract.ts` ist maßgeblich, ob etwas zusätzlich verlangt wird.
- `describeMove` (Pflicht, `src/describe.ts`): z. B. „Gang von oben in Spalte 4 einschieben, 1× gedreht (Kurve)“, „Zu Zeile 3, Spalte 6 laufen und Rübe ernten“, „Stehen bleiben“. Nur Dinge aus der Sicht, je Zugliste eindeutig (die Drehung gehört in den Text).

## Bots (`src/bots.ts`, Name „Wühlmaus“)

Weil der Zugraum klein ist (≤ 48 × 49), reicht Aufzählen statt MCTS; allgemeine Bots (`generalBots()`) bleiben zusätzlich in der Liste.

- **leicht:** zufälliger erlaubter Schub; danach mit 50 % zur nächsten erreichbaren Rübe, sonst zufällig.
- **mittel (Standard):** Für jeden Schub die Erreichbarkeit rechnen. Kann eine Rübe geerntet werden: nehmen (Sieg zuerst). Sonst das erreichbare Feld mit dem kürzesten Abstand (Manhattan) zur nächsten Rübe; Schübe abwerten, die einem Gegner mit seinem heutigen Standort eine Rübe in Reichweite bringen. Zufällige Wahl unter Gleichständen über den Bot-Rng.
- **schwer:** wie mittel, aber die besten ~6 Schub-Lauf-Kombinationen zusätzlich mit einem Zug Vorausschau der Gegner prüfen (kann ein Gegner nach seinem besten Schub eine Rübe ernten? Gegenzug mit Schub, der den Weg abschneidet, bevorzugen); Beschneidung auf Rübenfelder und deren Nachbarn, damit die Rechenzeit klein bleibt. Rechenzeit messen und `BOT_STEP_MS['mole-tunnels']` in `apps/server/src/bots.ts` eintragen.
- **Prüfstand-Ziele:** schwer schlägt Zufall in ≥ 95 % der Partien, mittel schlägt leicht deutlich, kein Bot braucht über 1,5 s je Zug (Tipp-Knopf = Standard-Bot auf „schwer“ mit 1,5 s Budget).

## Oberfläche (`src/ui/index.tsx`, `src/ui/styles.css`, Klassenpräfix `mt-`)

CSS-Klassen tragen **`mt-`** (Maulwurfsgänge; die Präfixe `mkt-`, `mst-`, `rub-` usw. sind schon vergeben – `tests/repo.test.ts` prüft Doppelungen).

- **Brett:** Alle Teile liegen absolut positioniert in einem Quadrat (`FitBox`, Größen-Container). Position per `transform: translate(…)`, Schlüssel = Teil-`id`; so läuft das Schieben als CSS-Übergang (Dauer ca. 220 ms, mit `prefers-reduced-motion` sofort). Das herausfallende Teil rutscht ein Feld aus dem Brett und wird zum Freiteil, das Freiteil rutscht hinein. Für Hasen gleiches Prinzip (Hase ist Kind seines Teils).
- **Schiebestellen:** 12 Pfeil-Knöpfe in einem Randstreifen von einem halben Teil; Trefferfläche mindestens 44 px (`::after`). Der gesperrte Pfeil (Rückschub) ist ausgegraut mit Schloss-Symbol.
- **Freiteil:** unter dem Brett (Hochformat) bzw. rechts daneben (Querformat). Tippen aufs Teil oder der Knopf „↻“ dreht um 90°, Taste `R` auch. Am Desktop zeigt der überfahrene Pfeil eine halbtransparente **Vorschau** des eingeschobenen Teils; am Handy erst Pfeil antippen (Vorschau), dann „Einschieben ✓“ bzw. Pfeil erneut – so schiebt kein Versehen.
- **Phasenanzeige:** „1 Schieben“ / „2 Laufen“ im Statusbereich mit klarer Handlung, ein „Bleiben“-Knopf im Laufschritt.
- **Laufen:** erreichbare Felder leuchten sanft (Option `reach`); Antippen läuft los. Der Hase hüpft den kürzesten Weg ab (Weg rechnet die Oberfläche aus der Breitensuche, der Zug enthält nur `to`), höchstens 700 ms insgesamt. Geerntete Rübe: „Plopp“ und Zähler springt; die neue Rübe wächst mit kleiner Pop-Animation.
- **Spielerleiste:** `PlayerChip` je Platz mit Hasenbild in der Spielerfarbe und Zähler „🥕 n / Ziel“, Uhr-Ring wie bei den anderen Spielen. Sitzring (`seatsAround`) nicht nötig.
- **Großansicht:** Rübe, Maulwurf und Hasen sind Bilder auf Teilen; wer sie groß zeigen will, nur über `CardInspect` (Regel aus #418), sonst nichts.
- **Handy:** Bei 360 px Breite sind 7 Teile plus halber Randstreifen etwa 41 px je Teil – Ziele ≥ 44 px über Trefferflächen sichern; die Lobby weist bei kleinen Geräten auf „5 × 5“ hin. Der Rauchtest (Handy-Hochformat) darf keine zu hohe Seite melden.
- **Barrierefreiheit:** jedes Zugziel und jede Schiebestelle ein Knopf mit `aria-label` aus `describeMove` (`moveLabels` vom Server nutzen); Teile tragen zusätzlich ein Symbol je Ausrichtung nicht nur Farbe; Tastatur: Pfeiltasten wählen Feld bzw. Schiebestelle, `Enter` bestätigt, `R` dreht, `Esc` bricht die Vorschau ab; Rüben und Maulwurf sind Bild **und** Symbol (Kontrast-Modus).

## Bestandsbilder und Klänge (nichts Neues malen oder aufnehmen)

| Bedarf | Bestand | Hinweis |
|---|---|---|
| Hasen in Spielerfarben | `packages/games/turnip-patch/src/ui/teile/hase-{rot,blau,gruen,gelb}.webp` | Platz 0–3; `lila`/`tuerkis` bleiben für mehr Plätze später |
| Rübe, Maulwurf, Erdhügel | `…/teile/ruebe.webp`, `maulwurf.webp`, `erdhuegel.webp` | Erdhügel als Zierde auf festen Teilen oder Maulwurfs-Schatten |
| Hintergrund | `apps/web/src/assets/kulissen/acker.webp` | in `apps/web/src/lib/sceneTable.ts` die Zeile `'mole-tunnels': 'acker'` ergänzen |
| Gänge | **SVG/CSS** im Spiel selbst: Erdtunnel (hell) auf Erdgrund (dunkel), Öffnungen als dicke abgerundete Striche | kein neues Bild in der ersten Fassung |

**Wiederverwendung über Spielgrenzen:** Das Rübenacker-Paket exportiert nur `.`, `./meta`, `./ui`. Empfohlen: in `packages/games/turnip-patch/package.json` einen Export `"./teile": "./src/ui/bilder.ts"` ergänzen und in `mole-tunnels/package.json` abhängen (`@brett-und-blatt/game-turnip-patch`). Wenn `tests/repo.test.ts` oder `tests/spielteile-bilder.test.ts` das nicht mögen, Alternative: die vier Hasen, Rübe und Maulwurf in einen gemeinsamen Ordner unter `packages/ui` verschieben – die Originale liegen im privaten Grafik-Repo, **dort nichts ändern**.

**Klänge (vorläufig, Katalog `packages/ui/src/audio/catalog.json`; Cornelius wählt endgültig):** Schieben `stein-schiefer`, Laufen `ruebenacker-hopps`, Ernte `punkte-sammeln`, Maulwurf-Treffer `ruebenacker-maulwurf`, Zugwechsel `dein-zug`. Sieg, Niederlage, Zeit vertont die Plattform. **Musik:** `mole-tunnels` in `packages/ui/src/audio/music.json` zur Playlist `spielabend` (Liste `games`) hinzufügen.

## Anbindung (Checkliste für die Freischaltung)

- `apps/server/src/games.ts` (`onlineGames`) und `apps/server/package.json` (`@brett-und-blatt/game-mole-tunnels: workspace:*`), danach `corepack pnpm install`; `apps/server/test/games.test.ts` muss grün sein.
- `apps/xr/src/catalog.ts` (`['mole-tunnels', 'Maulwurfsgänge']`), Zeilen für die Spieltafel in `apps/xr/src/scene/tafel-lines.ts`, Eingaben in `input-spec.ts`; `tests/xr-karten.test.ts` prüft.
- `apps/server/src/bots.ts`: `BOT_STEP_MS` nach Messung.
- Spiel-Label `spiel: Maulwurfsgänge` (Beschreibung „Spiel-id mole-tunnels · Rubrik Familie & Gesellschaft“).
- Doku: Tabellenzeile in `docs/spiele/README.md`, Eintrag in `docs/CHRONIK.md`, bei neuen Bildern `THIRD_PARTY.md`.
- `draft: true` aus `meta.ts` entfernen erst, wenn alles grün ist und Cornelius es freigibt.

## Tests

`packages/games/mole-tunnels/test/mole-tunnels.test.ts` mit den allgemeinen Prüfungen (`for (const check of gameContractChecks(gameModule)) it(check.name, check.run)`) und eigenen Regeltests:

- Zusammensetzung nach `setup`: 34 / 17 bewegliche Teile in der richtigen Verteilung, feste Teile an den richtigen Stellen, Startecken frei von Rüben und Maulwurf, Rübenzahl stimmt.
- Schieben aus allen vier Richtungen: Teil fällt heraus, Freiteil kommt hinein, Rüben und Maulwurf wandern mit; ein Hase auf dem herausfallenden Teil erscheint auf dem neuen; Rückschub-Verbot (`lastPush`) greift, ein anderer Schub ist erlaubt.
- Öffnungen und Drehung: Tabelle aller Bitmasken für alle drei Teilarten und vier Drehungen.
- Laufen: Breitensuche über ein handgebautes Brett mit bekanntem Ergebnis, Maulwurf sperrt Durchgang, Hase auf dem Maulwurfsteil darf hinaus, „stehen bleiben“ ist immer erlaubt.
- Ernte und Nachwachsen: Zähler steigt, gleich viele Rüben liegen aus, neue nie unter dem Maulwurf oder in einer Startecke; gleiche Seed-Züge ergeben denselben Spielstand.
- Sieg bei Zielzahl und Zuglimit mit Gleichstand.
- Je Zugliste eindeutige `describeMove`-Texte; `playerView` enthält keinen Rng-Zustand.
- Danach: `corepack pnpm check`, `corepack pnpm build && corepack pnpm rauchtest mole-tunnels`, `PRUEFSTAND=1 PRUEFSTAND_SPIELE=mole-tunnels corepack pnpm pruefstand`.

## Schritte (Glieder für das Vorhaben)

Freigegeben (`status: Ready`) wird jedes Glied einzeln durch Cornelius; Unter-Issues legt man nach seiner Zustimmung an (Kopiervorlage: Zeile hier + „Fertig, wenn“).

| Glied | Inhalt | Vorgänger | Dateien (Schwerpunkt) |
|---|---|---|---|
| **M1** Regelkern | Spiel anlegen (`neues-spiel`), `meta.ts` (`draft: true`), `rules.ts`, `describe.ts`, `index.ts` mit Optionen und `timePresets`, Regeltests und Vertragsprüfungen, Server-Eintrag; Oberfläche vorerst die Vorlage | – | `packages/games/mole-tunnels/src/{meta,rules,describe,index}.ts`, `test/`, `apps/server/src/games.ts`, `apps/server/package.json` |
| **M2** Bots | „Wühlmaus“ leicht/mittel/schwer, Bot-Tests, Prüfstand-Ziele, `BOT_STEP_MS` | M1 | `src/bots.ts`, `test/`, `apps/server/src/bots.ts` |
| **M3** Brett und Bedienung | Eigenes Brett mit SVG-Gängen, Pfeile, Freiteil, Drehen, Vorschau, erreichbare Felder, Laufen, Spielerleiste, Handy-Layout, Tastatur; noch ohne Animation und Bilder | M1 | `src/ui/index.tsx`, `src/ui/styles.css` (`mt-`) |
| **M4** Leben ins Brett | Schiebe- und Hüpf-Animation mit stabilen Teil-IDs, Hasen/Rübe/Maulwurf als Bilder, Acker-Kulisse, Klänge und Musik, `prefers-reduced-motion`, Kontrast-Modus | M3 | `src/ui/`, `src/ui/bilder.ts`, `apps/web/src/lib/sceneTable.ts`, `packages/ui/src/audio/music.json` |
| **M5** Freischalten | VR-Katalog und Spieltafel, Rauchtest, Prüfstand, Doku (README, CHRONIK), Spiel-Label, `draft` entfernen **nur auf Cornelius' Wort** | M2, M4 | `apps/xr/src/…`, `docs/` |
| **M6** (optional) | Gemalte Gangteile (Gerade, Kurve, Abzweig) nach `docs/grafik/STILBIBEL.md`; Originale ins private Grafik-Repo – nur mit dessen Zugang und Cornelius' Auswahl | M5 | `src/ui/teile/`, `scripts/grafik/manifeste/` |
| **M7** (optional) | Tagesrätsel allein („alle Rüben in N Zügen“, Seed pro Tag), Lernpaket-Variante (Bilder statt Rüben), Teams | M5 | später planen |

M2 und M3 können nach M1 **parallel** laufen (verschiedene Dateien). Alle anderen Glieder nacheinander, jedes als kurzer PR von aktuellem `main`.

## Entscheidungen und offene Fragen (für Cornelius)

- **Entschieden vorgeschlagen:** offene Rüben statt verdeckter Schatzkarten (eigene Kernregel, kein Übergabe-Bildschirm im Hot-Seat, Bots ohne `sampleHidden`); Maulwurf als wandernder Marker; Nachwachsen; Gangteile zuerst als SVG.
- **Offen 1:** Name „Maulwurfsgänge“ endgültig? (Rübenacker hat schon Maulwurf – das passt zur Spielwelt, ist aber vielleicht zu ähnlich.)
- **Offen 2:** Soll es später eine **Option „Geheimauftrag“** mit verdeckten Karten geben? Sie käme dem Vorbild näher und verlangt Geheimnis-Prüfung, `sampleHidden` und Übergabe-Bildschirm. Vorschlag: nein, außer Cornelius will es.
- **Offen 3:** Maulwurf in der Standardeinstellung an oder aus? Vorschlag: an (macht den Unterschied zum Vorbild).
- **Offen 4:** Mehr als 4 Plätze (6 Hasenfarben liegen vor)? Vorschlag: erst nach M5, mit Rand-Startfeldern.
- Ravensburger-Marken: weder den Namen „Das verrückte Labyrinth“ noch Begriffe/Bilder des Vorbilds verwenden (keine Rechtsberatung).
