# Schach

| Steckbrief | |
|---|---|
| Spieler | 2 |
| Dauer | 10–60 Minuten |
| Modi | Solo gegen Bot, Hot-Seat, online |
| Muster | offen, Zug um Zug |
| Bausteine | Gitterbrett, **chess.js** (Fremdbibliothek, BSD-2-Clause), eigene Alpha-Beta-Suche |
| Aufwand | Regeln – (chess.js), Oberfläche M, Bot M |
| Etappe | 2, fertig und veröffentlicht (Feinschliff in Commit `5dd4ded`) |

Dieser Plan beschreibt den **gebauten Stand**. Er dient als Nachschlagewerk und als Grundlage für spätere Erweiterungen.

## Regeln (Standard)

Die üblichen FIDE-Regeln. Die Zuggenerierung kommt vollständig aus `chess.js`, wir schreiben keine eigenen Schachregeln.

- **Brett:** 8 × 8 Felder, Weiß (Platz 0) beginnt, Schwarz ist Platz 1.
- **Züge:** König, Dame, Turm, Läufer, Springer und Bauer wie gewohnt; dazu Rochade, en passant und Umwandlung (Dame, Turm, Läufer oder Springer nach Wahl).
- **Gewonnen** hat, wer den gegnerischen König mattsetzt.
- **Unentschieden:**
  - Patt
  - dreimal dieselbe Stellung (eigene Zählung, siehe Spielmodell)
  - 50-Züge-Regel
  - zu wenig Material für ein Matt
- **Aufgeben** und **Zeitverlust** regelt die Spielleitung, nicht das Regelwerk.
- Remis-Angebote gibt es (noch) nicht.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Brett drehen | zum Spieler am Zug, fest | zum Spieler am Zug |

Die Option ist vor allem für Hot-Seat gedacht: Das Brett dreht sich nach jedem Zug zur Farbe am Zug. Online und gegen den Bot sieht jeder ohnehin das Brett von seiner Seite.

## Spielmodell

```ts
interface ChessMove {
  type: 'move';
  from: string;            // z. B. 'e2'
  to: string;              // z. B. 'e4'
  promotion?: 'q' | 'r' | 'b' | 'n';
}

interface ChessState {
  fen: string;                         // Stellung als FEN-Text
  positions: Record<string, number>;   // Stellungszähler für die Wiederholung
  history: string[];                   // Partieverlauf in SAN, z. B. 'Nf3', 'O-O'
  lastMove: { from: string; to: string } | null;
  inCheck: boolean;
  end: 'checkmate' | 'stalemate' | 'repetition' | 'fiftyMoves' | 'material' | null;
  winner: SeatId | null;
  rotate?: boolean;                    // Option „Brett drehen“
}
```

- **Spielstand als FEN:** Die Stellung ist ein einziger Text. Für jeden Zug erzeugt `applyMove` ein frisches `Chess`-Objekt aus der FEN. So bleibt der Spielstand reines JSON und die Funktionen bleiben rein.
- **Wiederholung selbst gezählt:** `chess.js` kennt nur den Verlauf seines eigenen Objekts. Deshalb zählt `positions` die Stellungen (FEN ohne Zugzähler) über die ganze Partie.
- **Umwandlung:** `legalMoves` liefert für jeden Umwandlungszug vier Einträge, einen je Figur.
- **Ereignisse:** `moved` (mit SAN, geschlagener Figur und Schach) und `over`. Die Oberfläche spielt danach Animationen ab.
- Keine Geheimnisse: `playerView` gibt den ganzen Spielstand zurück.

## Bot

Eigene Suche in `src/search.ts`, weil die allgemeine MCTS für Schach zu schwach und zu langsam ist:

- **Negamax mit Alpha-Beta-Schnitt** und iterativer Vertiefung.
- **Ruhesuche:** Am Suchende werden Schlagabtausche zu Ende gerechnet, damit der Bot nicht mitten in einem Abtausch falsch bewertet.
- **Bewertung:** Material und Figurenstellung mit den Feldtabellen der „Simplified Evaluation Function“. Für den König gibt es eine eigene Endspieltabelle.
- **Schnelle Vorbewertung** vor der eigentlichen Suche. Sie findet auch unter Zeitdruck ein Matt in eins und hängende Figuren.
- **Rauschen** für die schwächeren Stufen: eine zufällige Abweichung der Bewertung in Hundertstel Bauern.

| Stufe | Tiefe | Zeit | Rauschen |
|---|---|---|---|
| leicht | 1 Halbzug | ≤ 0,3 s | ±1,5 Bauern, übersieht gern etwas |
| mittel | 2 Halbzüge + Ruhesuche | ≤ 0,8 s | ±0,3 Bauern |
| schwer | bis 8 Halbzüge | so viel, wie das Budget erlaubt | keins |

Zusätzlich gibt es den Zufallsbot zum Testen. Gemessen auf Cloudflare (Gratis-Tarif): „schwer“ braucht 0,5–1,3 s pro Zug.

**Später denkbar:** Stockfish (WebAssembly) als stärkster Gegner. Dann muss die Lizenz (GPL-3.0) zur AGPL des Projekts passen und in `THIRD_PARTY.md` stehen.

## Zeitlimits

| Voreinstellung | Modell |
|---|---|
| gemütlich | aus |
| normal | Schachuhr 10 Minuten + 5 s pro Zug |
| schnell | Schachuhr 5 Minuten + 3 s pro Zug |

**Bei Zeitablauf** gibt es keinen `timeoutMove`, also zieht der Bot für den Spieler.

## Oberfläche

- **Brett** über das Gitterbrett mit Figuren als Textzeichen (♚︎ usw.). Das Zeichen U+FE0E verhindert, dass Handys sie als bunte Emojis zeigen.
- **Ziehen:** Figur antippen, dann das leuchtende Zielfeld (oder per Drag & Drop ziehen). Figuren gleiten geschmeidig zum Zielfeld (`useGridMoveAnimation`, inkl. beider Figuren bei Rochade). Bei einer Umwandlung erscheint eine Auswahl mit vier Figuren.
- **Hervorhebungen:** letzter Zug, König im Schach, Tipp-Zug.
- **Schach- & Fesselungswarnung:** Versucht man eine gefesselte Figur zu bewegen oder den König ins Schach zu ziehen, erklärt ein kurzer Warnhinweis mit Feldsymbolen den Grund. Auf dem Brett werden die gefesselte Figur, der eigene König und die gegnerische Angreiferfigur farblich hervorgehoben.
- **Leisten mit geschlagenen Figuren** über und unter dem Brett, dazu der Materialvorsprung (+3 usw.). Umgewandelte Bauern werden dabei richtig verrechnet.
- **Chronik (📜)** in deutscher Notation (S, L, T, D statt N, B, R, Q), mit geschlagenen Figuren als Zeichen. Ein Zug zeigt die Stellung danach (Rückblick mit ◀ ▶, Pfeiltasten, Esc). Geschlagene Figuren fliegen in die Leiste am Brettrand.
- **Schachanzeige (28.10.2026):** König rot, Angreifer rot umrandet, gestrichelter Pfeil vom Angreifer zum König, dazu „Schach! Dein König wird vom Läufer auf b4 angegriffen.“ unter dem Brett und „Schach durch Läufer!“ im Spieler-Chip.
- **Vorziehen:** Wer nicht am Zug ist, merkt einen Zug vor (blau gestrichelt); er wird ausgeführt, sobald man dran ist, oder mit Hinweis verworfen. Nur mit festem Platz (gegen den Bot, online).
- **Warnhinweise** liegen über der Leiste unter dem Brett, nicht mehr über den Feldern.
- **Brett drehen** je nach Option. Online steht die eigene Farbe immer unten.

## Hot-Seat und Online

- Keine Geheimnisse, also keine Übergabe. Im Hot-Seat dreht sich das Brett (Option).
- Online prüft der Server die Züge mit denselben Regeln. Der Bot rechnet auf dem Server mit einer Zähl-Uhr (Schrittweite in `apps/server/src/bots.ts`), weil `Date.now()` in Workers während einer Berechnung stillsteht.

## Tests

Vorhanden in `test/chess.test.ts` und `test/check-warning.test.ts`:

- Weiß hat zu Beginn genau 20 Züge.
- Schäfermatt, Patt und dreifache Stellungswiederholung werden erkannt.
- Eine Umwandlung bietet vier Figuren an; unerlaubte Züge werden abgelehnt.
- **Bot:** findet ein Matt in einem Zug, schlägt eine ungedeckte Dame und rechnet in der Eröffnung genug Stellungen pro Sekunde.
- **Fesselung & Schach:** `check-warning.test.ts` prüft Fesselungserkennung (Turm/Läufer/Dame), Fesselungslinien, Schachgebote und Rochade-Einschränkungen (König im Schach oder zieht durch Schach).
- Allgemeine Prüfungen `gameContractChecks`.

## Offene Punkte

- ✅ Remis anbieten und annehmen (29.10.2026): Wer am Zug ist, bietet statt zu ziehen an; der Gegner ist dann dran und nimmt an oder lehnt ab. Danach erst nach 10 Halbzügen wieder. Baustein `draw-offer.ts` in der Engine (Züge `offerDraw`/`acceptDraw`/`declineDraw`, „anbieten“ nur über `isLegal`, damit Bots und Zufallspartien nie anbieten), Leiste `DrawOfferBar` in `packages/ui`. Der Bot nimmt an, wenn er nach seiner Bewertung zurückliegt (leicht ab ausgeglichen, mittel ab −1,5, schwer ab −3 Bauern). Spielfeld jetzt 8 : 10 für die Remis-Zeile.
- ✅ Partie als PGN (29.10.2026): In der Chronik „📋 PGN kopieren“ und „💾 Speichern“ (`toPgn` mit Namen, Datum, Ergebnis); ist die Zwischenablage gesperrt, erscheint die Partie zum Kopieren von Hand. In der Einrichtung „📥 PGN-Partie fortsetzen“ (`PgnSetup`, Text oder Datei, sofortige Prüfung) – `loadFromPgn` spielt die Partie Zug für Zug mit den eigenen Regeln nach, nur ab Grundstellung. Verborgene Option `pgn` (bis 8000 Zeichen), wirkt nur am eigenen Gerät, wird nicht gespeichert.
- Eröffnungsbuch für „mittel“ und „schwer“, damit die ersten Züge abwechslungsreicher sind.
- Stockfish als zusätzlicher, starker Bot (Lizenz prüfen, siehe oben).
