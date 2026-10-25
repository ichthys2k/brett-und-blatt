# Bingo

| Steckbrief | |
|---|---|
| Spieler | 1–10, im Klassen-Modus später bis etwa 35 |
| Dauer | 5–15 Minuten pro Runde |
| Modi | Solo gegen Bots, Hot-Seat (bis 4 Karten), online, **Klassen-Modus** |
| Muster | **gleichzeitig** (alle markieren zugleich), Ziehung als Systemzug |
| Bausteine | Inhaltspakete (Lern-Bingo), Taktgeber für Systemzüge (neu), Zuschauer-Sicht als Tafel |
| Aufwand | Regeln S, Oberfläche M, Bot S |
| Etappe | 3 (Phase 5), Klassen-Modus danach |

Bingo ist das erste Spiel, bei dem **alle gleichzeitig** handeln, und das erste für den **Klassen-Modus**: Der Beamer zeigt die Ziehung, die Handys zeigen die eigene Karte. Neben Zahlen-Bingo gibt es **Lern-Bingo**: Angesagt wird eine Aufgabe („7 · 8“), auf der Karte steht die Lösung („56“).

## Regeln (Standard)

- **Karte:** 5 × 5 Felder mit freiem Mittelfeld. Spalte B hat Zahlen von 1–15, I 16–30, N 31–45, G 46–60, O 61–75 (amerikanisches 75er-Bingo). Jede Karte ist anders.
- **Ziehung:** Die Spielleitung zieht nacheinander Zahlen ohne Zurücklegen und sagt sie an.
- **Markieren:** Wer die Zahl auf seiner Karte hat, markiert sie.
- **Bingo:** Wer eine volle Reihe hat (waagrecht, senkrecht oder diagonal), ruft „Bingo!“. Die Spielleitung prüft die Karte gegen die gezogenen Zahlen.
  - **Richtig:** Diese Person gewinnt. Rufen mehrere zur selben Ziehung, gewinnen alle.
  - **Falsch:** Die Person muss bis zur nächsten Ziehung aussetzen und darf so lange nicht rufen.
- **Ende:** beim ersten richtigen Bingo. Sind alle Einträge gezogen und hat niemand richtig gerufen, gewinnt keiner.

**Lern-Bingo:** Die Karte enthält Lösungen aus einem Inhaltspaket, angesagt wird die passende Aufgabe. Das Mittelfeld ist auch hier frei.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Inhalt | Zahlen 1–75, Einmaleins, Englisch, Tiere, … (alle Inhaltspakete) | Zahlen 1–75 |
| Kartengröße | 3 × 3, 4 × 4, 5 × 5 (nur Lern-Bingo; Zahlen immer 5 × 5) | 5 × 5 |
| Ziel | eine Reihe, zwei Reihen, vier Ecken, volle Karte | eine Reihe |
| Markieren | selbst, automatisch | selbst |
| Falsches Bingo | eine Ziehung aussetzen, scheidet aus, ohne Folgen | eine Ziehung aussetzen |

- **Markieren „automatisch“** ist für kleine Kinder gedacht: Die Karte markiert sich selbst, man muss nur noch „Bingo!“ rufen.
- Bei 4 × 4 gibt es kein freies Mittelfeld.

## Spielmodell

```ts
type BingoMove =
  | { type: 'draw' }                           // Systemzug bzw. Ansager: nächste Ansage ziehen
  | { type: 'mark'; cell: number }             // Feld markieren oder Markierung zurücknehmen
  | { type: 'bingo' };                         // „Bingo!“ rufen

interface BingoState {
  cards: string[][];          // je Platz die Felder (Kennungen der Einträge), Mittelfeld = 'frei'
  marks: boolean[][];         // je Platz die Markierungen
  order: string[];            // die ganze Ziehreihenfolge, beim Start gemischt – geheim
  drawn: number;              // wie viele davon schon gezogen sind
  blockedUntil: number[];     // je Platz: gesperrt bis zu dieser Ziehung (falsches Bingo)
  winners: SeatId[];
  // dazu Optionen und die Einträge des Inhaltspakets (Ansage und Feldtext)
}
```

- **Zufall nur beim Start:** `setup` mischt mit dem Seed die Karten und die ganze Ziehreihenfolge. `applyMove` braucht keinen Zufall.
- **Geheim (`playerView`):** `order` wird bis auf die gezogenen Einträge abgeschnitten. Sonst könnte jemand im Browser die nächsten Zahlen lesen. Fremde Karten sind kein Geheimnis, die Sicht zeigt aber nur, wie viele Felder jedem noch zur nächsten Reihe fehlen.
- **Gleichzeitig:** `currentPlayers` liefert alle Plätze, die nicht gesperrt sind. Dazu kommt `'system'` bzw. der Ansager, sobald die nächste Ziehung fällig ist.
- **Gültige Bingos prüfen:** Nur markierte Felder zählen, die auch gezogen wurden. Wer ein Feld fälschlich markiert hat, hat dort kein gültiges Feld.
- **Ereignisse:** `drawn` (mit Ansage und Lösung), `bingo` (richtig oder falsch, mit Platz) und `over`. Alle sind öffentlich; `mark` erzeugt kein Ereignis für andere.

### Taktgeber für die Ziehung (neu, in der Engine)

Systemzüge führt die Spielleitung heute sofort aus. Beim Bingo muss zwischen zwei Ziehungen Zeit vergehen. Vorschlag: ein neues, optionales Modulfeld

```ts
/** Systemzug erst nach dieser Wartezeit ausführen (z. B. Bingo-Ziehung). */
systemDelayMs?(state: S, options: Options): number | null;
```

- `LocalSession` stellt dafür einen Zeitgeber, und `nextDeadline()` berücksichtigt ihn.
- Online weckt der Raum über `nextWakeup()` und den Alarm des Durable Objects. So übersteht der Takt auch das Schlafen des Servers.
- Die Wartezeit richtet sich nach dem Zeit-Preset (siehe unten). Bei „gemütlich“ gibt es keinen Takt: Dann zieht man per Knopf „Nächste Zahl“. Den Knopf hat im Klassen-Modus nur die Raumleitung, sonst jeder Spieler.

## Bot

Bingo braucht kein Nachdenken. Der Bot ist vor allem **Bot-Ersatz** für Abwesende und Mitspieler im Solo.

| Stufe | Verhalten |
|---|---|
| leicht | markiert langsam (2–4 s), übersieht manchmal eine Zahl, ruft Bingo spät |
| mittel | markiert nach 1–2 s, übersieht selten etwas |
| schwer | markiert sofort und ruft Bingo, sobald es gilt |

Ein Bot ruft nie ein falsches Bingo. Das Übersehen ist nicht zufällig pro Zug, sondern wird aus dem Seed-Rng des Bots gezogen, damit Partien nachspielbar bleiben.

## Zeitlimits

| Voreinstellung | Takt der Ziehung |
|---|---|
| gemütlich | per Knopf „Nächste Zahl“ |
| normal | alle 8 s |
| schnell | alle 4 s |

Eine Zug-Uhr für die Spieler gibt es nicht: Wer nicht markiert, verpasst nur etwas.

## Oberfläche

- **Karte** über das Gitterbrett; markierte Felder mit Stempel-Kreis, das Mittelfeld mit ⭐.
- **Aktuelle Ansage** groß über der Karte, darunter die letzten fünf. Im Lern-Bingo steht dort die Aufgabe.
- **Knopf „Bingo!“** ist immer sichtbar, aber erst ab einer möglichen Reihe hervorgehoben (das verrät nichts, die Karte sieht man ja selbst).
- **Fortschritt der anderen** als kleine Leiste: „Anna: noch 1“.
- **Tafel** für den Beamer: die Zuschauer-Sicht im Vollbild. Sie zeigt die Ansage groß, alle gezogenen Einträge als Raster, den Raumcode mit QR-Code und die Rangliste. Sie ist im Klassen-Modus die Startseite der Lehrkraft.

## Hot-Seat und Online

- **Hot-Seat:** bis 4 Karten nebeneinander bzw. untereinander auf einem Gerät. Es gibt nichts Geheimes auf den Karten, also keine Übergabe.
- **Online:** Der Server mischt, zieht und prüft jedes Bingo. Emoji-Reaktionen passen gut („😱 noch eine!“).
- **Klassen-Modus** (später):
  - Die Lehrkraft erstellt den Raum am Beamer-Rechner und bleibt Zuschauer (Tafel); die Schüler treten per QR-Code bei.
  - Dafür braucht der Raum mehr als 10 Plätze. Vorschlag: `info.players.max` bis 40 je Spiel erlauben, `MAX_SEATS` gilt dann nur als Standard. Die Grenze von 40 Mitgliedern bleibt.
  - Plätze vergibt der Raum automatisch beim Beitreten, damit die Lehrkraft nicht 30 Plätze von Hand verteilen muss.
  - Datenschutz: nur Spitznamen, keine Konten. Vor dem Einsatz im Unterricht mit dem schulischen Datenschutz abstimmen (siehe Konzept).

## Inhaltspakete

Lern-Bingo nutzt die vorhandenen Paare-Pakete unter `content/paare/`: `a` ist die Ansage, `b` steht auf der Karte. Voraussetzung ist, dass die `b`-Seiten eindeutig sind (beim Einmaleins steht 12 deshalb nur einmal drin). Für eine 5 × 5-Karte braucht ein Paket mindestens 24 Paare, besser 40 und mehr, damit sich die Karten unterscheiden. Eigene Bingo-Pakete (z. B. Bibelverse und Bücher, Hauptstädte) kommen in denselben Aufbau.

## Tests

- Zahlenkarten: Spalten im richtigen Bereich, keine doppelten Zahlen, freies Mittelfeld; alle Karten einer Partie verschieden.
- Ziehung ohne Wiederholung; nach 75 Ziehungen ist alles gezogen.
- Gültiges Bingo für jede Zielart (Reihe, Spalte, beide Diagonalen, zwei Reihen, vier Ecken, volle Karte).
- Falsches Bingo: Sperre bis zur nächsten Ziehung bzw. Ausscheiden, je nach Option.
- Mehrere richtige Bingos zur selben Ziehung: alle gewinnen.
- Fälschlich markierte Felder zählen nicht.
- `playerView` verrät keine ungezogenen Einträge.
- Lern-Bingo: Karten nur aus `b`-Seiten, Ansagen aus den passenden `a`-Seiten.
- Taktgeber: Der Systemzug kommt erst nach der Wartezeit, auch nach Speichern und Wiederherstellen.
- **Bot:** „schwer“ ruft Bingo spätestens bei der ersten gültigen Ziehung, nie falsch.
- Allgemeine Prüfungen `gameContractChecks`.

## Offene Punkte

- **Taktgeber** in der Engine bauen (siehe oben) – mit Cornelius abstimmen, ob das Modulfeld so passt.
- **Mehr als 10 Plätze** und automatische Platzvergabe für den Klassen-Modus.
- 90er-Bingo (britisch, 3 × 9-Karten) als weitere Spielart? Eher nicht, das 75er ist bekannter.
- Welche Inhaltspakete für den Unterricht zuerst? Ideen von Cornelius sammeln.
