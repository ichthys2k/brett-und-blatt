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
| Inhalt | Zahlen 1–75, Kleines Einmaleins, Großes Einmaleins, Potenzen & Rechengesetze, Größen & Einheiten, Teiler, ggT & kgV, Brüche, Komma & Prozent, Negative Zahlen, Englisch, Tiere | Zahlen 1–75 |
| Kartengröße | 3 × 3, 4 × 4, 5 × 5 (nur Lern-Bingo; Zahlen immer 5 × 5) | 5 × 5 |
| Ziel | eine Reihe, zwei Reihen, vier Ecken, volle Karte | eine Reihe |
| Markieren | selbst, automatisch | selbst |
| Falsches Bingo | eine Ziehung aussetzen, scheidet aus, ohne Folgen | eine Ziehung aussetzen |

- **Markieren „automatisch“** ist für kleine Kinder gedacht: Die Karte markiert sich selbst, man muss nur noch „Bingo!“ rufen.
- Bei 4 × 4 gibt es kein freies Mittelfeld.

## Umsetzung (Oktober 2026)

Umgesetzt in `packages/games/bingo`, lokal und online. Entscheidungen von Cornelius und Abweichungen vom Plan:

- **Die Spielleitung zieht per Knopf** – kein automatischer Taktgeber. Spielleitung ist Platz 1 (`CALLER`); Option „zieht und spielt mit“ oder „zieht nur“ (ohne Karte, z. B. die Lehrkraft am Beamer). Allein spielt sie immer mit.
- **Zieh-Animation:** Bei jeder Ziehung wirbeln auf allen Geräten etwa 2,8 s lang zufällige Einträge durch die Kugel, immer langsamer, dann springt die echte Zahl heraus. Bis dahin ist die neue Zahl auch auf der Karte noch nicht markierbar (auch nicht automatisch). Mit „Bewegung reduzieren“ nur 0,5 s.
- **Bis 30 Spieler** (`players.max`, Raumgrenze `MAX_SEATS` = 30). Freie Plätze fallen beim Start weg, solange genug besetzt sind – die Raumleitung muss also nicht abzählen. Lobby und Setup zeigen bei vielen Plätzen − / + und eine kompakte Platzliste.
- **Am Zug ist, wer etwas zu tun hat:** eine gezogene Zahl markieren oder ein gültiges Bingo rufen; die Spielleitung, solange es etwas zu ziehen gibt. Markieren geht nur bei gezogenen Einträgen. Falsch rufen kann man daher nur, solange noch etwas zu markieren ist. Der Knopf „Bingo!“ sieht trotzdem immer bereit aus (sonst verriete er eine ungesehene Zahl); ohne möglichen Ruf erscheint nur „Noch keine volle Reihe!“ ohne Strafe.
- **Mehrere Gewinner:** Wer zur selben Ziehung ebenfalls eine fertige Karte hat (nach gezogenen Zahlen, auch unmarkiert), gewinnt mit.
- **Bot-Tempo über eine neue Engine-Funktion:** `BotDefinition.delayMs` parkt einen Bot-Zug bis zur Fälligkeit (`LocalSession`: Zeitgeber plus `nextDeadline()`, auf dem Server über den Alarm). Bingo-Bots markieren leicht 2–4 s, mittel 1–2 s, schwer ¼ s und übersehen manchmal eine Zahl; eine Computer-Spielleitung (oder ein Bot-Ersatz für eine abwesende) zieht alle 6–8 s.
- **Hot-Seat:** alle Karten der Menschen nebeneinander (neue optionale `BoardProps.humanSeats`).
- **Zeit-Voreinstellungen** haben keine Wirkung (alle „ohne Zeitlimit“).
- **Tafel für den Beamer:** Knopf „📺 Tafel“ öffnet das Vollbild mit großer Kugel, allen gezogenen Einträgen, den zehn Besten und online dem QR-Code samt Raumcode (neue optionale `BoardProps.invite`). Die Spielleitung kann dort auch ziehen.
- **Klassen-Modus & Mathe-Pakete:** Beim Auswählen von Bingo im Online-Raum öffnen sich standardmäßig 30 Plätze; mit dem Knopf „🪑 Alle verteilen“ setzt die Raumleitung alle beigetretenen Schülerinnen und Schüler auf einen Schlag auf freie Plätze. Für den Mathematikunterricht (Klasse 5/6) stehen sieben Pakete bereit: Kleines Einmaleins, Großes Einmaleins, Potenzen & Rechengesetze, Größen & Einheiten, Teiler, ggT & kgV, Brüche, Komma & Prozent sowie Negative Zahlen.

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
- **Ereignisse:** `drawn` (mit Ansage und Lösung), `marked` (über `eventView` nur für den eigenen Platz) und `bingo` (richtig oder falsch, mit Platz). Markierungen erzeugen über `eventView` kein Ereignis für andere.

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

- **Taktgeber** in der Engine bauen (siehe oben) – mit Cornelius abstimmen, ob das Modulfeld so passt. Bisher zieht die Spielleitung von Hand („Nächste Zahl“).
- ✅ **Mehr als 10 Plätze** (bis 30) und automatische Platzvergabe für den Klassen-Modus („🪑 Alle verteilen“, Online-Nachricht `fillSeats`).
- 90er-Bingo (britisch, 3 × 9-Karten) als weitere Spielart? Eher nicht, das 75er ist bekannter.
- Welche Inhaltspakete für den Unterricht zuerst? Ideen von Cornelius sammeln.
