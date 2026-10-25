# Quartett

| Steckbrief | |
|---|---|
| Spieler | 2–6 |
| Dauer | 5–15 Minuten |
| Modi | Solo gegen Bots, Hot-Seat, online, gemischt |
| Muster | verdeckt (Stapel bzw. Hände), Zug um Zug |
| Bausteine | Karten-Baukasten, Inhaltspakete (Kartensets mit Werten) |
| Aufwand | Regeln M, Oberfläche M, Bot M, Inhalte L (vier Sets recherchieren) |
| Etappe | 3 |

Ein Modul mit **zwei Spielweisen**, die dieselben Kartensets nutzen:

- **Trumpf:** Werte vergleichen, wie beim Autoquartett.
- **Sammeln:** das klassische Quartett: Mitspieler nach Karten fragen und Vierergruppen ablegen.

## Kartensets (Inhaltspakete)

Ein Set hat 32 Karten in 8 Gruppen (A–H) zu je 4 Karten (1–4). Jede Karte hat einen Namen, ein Bild bzw. Emoji, 5–6 Werte und optional einen Laut. Jeder Wert legt fest, ob der höhere oder der niedrigere gewinnt. **Jeder Wert braucht eine Quelle**, weil die Sets auch im Unterricht genutzt werden.

```jsonc
// content/quartett/tiere.json (Ausschnitt)
{
  "id": "tiere", "name": "Tiere", "license": "CC-BY-SA-4.0",
  "properties": [
    { "id": "weight", "label": "Gewicht", "unit": "kg", "higherWins": true },
    { "id": "speed", "label": "Höchsttempo", "unit": "km/h", "higherWins": true },
    { "id": "lifespan", "label": "Lebenserwartung", "unit": "Jahre", "higherWins": true }
  ],
  "cards": [
    { "id": "C3", "name": "Elefant", "emoji": "🐘", "sound": "tiere/elefant.mp3",
      "values": { "weight": 6000, "speed": 40, "lifespan": 70 },
      "sources": { "weight": "…" } }
  ]
}
```

| Set | Werte (Vorschlag) | Hinweis |
|---|---|---|
| **Tiere** | Gewicht, Länge, Höchsttempo, Lebenserwartung, Nachwuchs pro Wurf | Tierlaute aus Emojistone |
| **Weltraum und Planeten** | Durchmesser, Masse, Entfernung zur Sonne, Temperatur, Anzahl Monde, Umlaufzeit | Planeten, Zwergplaneten, Monde, Sterne; gut für Mathe und NwT |
| **Biblische Personen** | Erwähnungen in der Bibel, Zahl der Bücher mit Erwähnung, ungefähre Lebenszeit, AT oder NT | Nur Werte, die für alle 32 Personen belegbar sind; Zählung nach Lutherbibel 2017 |
| **Dinosaurier** | Länge, Gewicht, Höhe, Zeitalter (Mio. Jahre), Jahr des ersten Fundes | Bei Kindern beliebt; Schätzwerte als solche kennzeichnen |

Regel für Sets: Jede Karte hat **alle** Werte des Sets. Leere Werte sind nicht erlaubt, damit jede Eigenschaft immer wählbar ist.

## Regeln: Trumpf

- Alle Karten werden verdeckt verteilt. Jeder sieht nur seine **oberste** Karte.
- Wer am Zug ist, wählt eine Eigenschaft. Alle decken ihre oberste Karte auf; der beste Wert gewinnt alle aufgedeckten Karten und legt sie unter seinen Stapel.
- Gleichstand: Die Karten kommen in die Mitte, und derselbe Spieler wählt erneut. Der nächste Gewinner bekommt die Mitte dazu.
- Wer gewinnt, ist wieder am Zug. Wer keine Karten mehr hat, scheidet aus. Gewonnen hat, wer alle Karten hat.
- **Spielfluss:** Damit eine Partie nicht endlos läuft, gibt es ein Rundenlimit (Standard 30). Danach gewinnt, wer die meisten Karten hat.

## Regeln: Sammeln

- Alle Karten werden verteilt (Hand verdeckt).
- Wer am Zug ist, fragt einen Mitspieler nach einer bestimmten Karte („Hast du C3, den Elefanten?“). Er muss selbst mindestens eine Karte dieser Gruppe haben.
- Hat der Gefragte sie, muss er sie abgeben, und der Fragende darf weiterfragen. Sonst ist der Gefragte am Zug.
- Vollständige Vierergruppen werden offen abgelegt. Wer am Ende die meisten Quartette hat, gewinnt.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Spielweise | Trumpf, Sammeln | Trumpf |
| Kartenset | Tiere, Weltraum, Biblische Personen, Dinosaurier, später eigene | Tiere |
| Rundenlimit (Trumpf) | 15, 30, 50, unbegrenzt | 30 |
| Laute | an, aus | an |

## Spielmodell

```ts
type QuartettMove =
  | { type: 'chooseProperty'; property: string }               // Trumpf
  | { type: 'ask'; target: SeatId; card: CardId };              // Sammeln
```

- **Trumpf:**
  - Der Zustand umfasst die Stapel je Spieler (Reihenfolge geheim), die Mitte bei Gleichstand, den aktiven Spieler und den Rundenzähler.
  - Die Auflösung nach `chooseProperty` ist ein einziger Schritt mit Ereignissen: aufdecken, vergleichen, Karten wandern.
- **Sammeln:**
  - Der Zustand umfasst die Hände, die abgelegten Quartette und das **öffentliche Frageprotokoll**: wer wen wonach gefragt hat und mit welcher Antwort.
- **Geheim (`playerView`):**
  - Trumpf: Jeder sieht nur die eigene oberste Karte und die Kartenzahlen. Aufgedeckte Karten sind öffentlich.
  - Sammeln: Jeder sieht nur die eigene Hand. Kartenzahlen und das Protokoll sind öffentlich.

## Bot

- **Trumpf:** Der Bot kennt das ganze Set und schätzt für jede Eigenschaft, wie gut sein Wert im Vergleich zu den noch unbekannten Karten ist (Rangplatz). Er wählt die Eigenschaft mit dem besten Rang.
  - leicht: zufällige Eigenschaft
  - mittel: Rang gegen alle Karten
  - schwer: Rang nur gegen Karten, die noch im Spiel sein können (Kartenzählen)
- **Sammeln:** Der Bot führt ein Wissensmodell und fragt gezielt dort, wo eine fehlende Karte sicher oder wahrscheinlich liegt. Sein Wissen stammt aus:
  - Fragen (wer fragt, hat eine Karte der Gruppe)
  - Übergaben (genaues Wissen)
  - „Nein“-Antworten (der Gefragte hat die Karte nicht)

  Die Schwierigkeit ergibt sich aus dem Gedächtnis: Der leichte Bot vergisst schnell.
- `sampleHidden` verteilt die unbekannten Karten passend zu allem, was das Protokoll verrät.

## Zeitlimits

| Voreinstellung | Trumpf: Eigenschaft wählen | Sammeln: fragen |
|---|---|---|
| gemütlich | aus | aus |
| normal | 15 s | 20 s |
| schnell | 8 s | 10 s |

**Bei Zeitablauf** entscheidet der Bot. Nach dem Aufdecken bleibt das Ergebnis 2 Sekunden stehen (einstellbar), dann geht es automatisch weiter.

## Oberfläche

- **Trumpf, Hochformat:** die eigene oberste Karte groß in der Mitte, die Eigenschaften als große Tippflächen mit Wert und Einheit. Die Gegner oben mit Kartenzahl.
- **Aufdecken:** Alle Karten drehen sich gleichzeitig, der beste Wert leuchtet auf, und die Karten fliegen zum Gewinner. Laut abspielen, wenn eingeschaltet.
- **Sammeln:** Die Hand ist nach Gruppen sortiert; fehlende Karten einer Gruppe erscheinen als graue Platzhalter mit Namen. Fragen in drei Schritten: Mitspieler antippen, Platzhalter antippen, „Fragen“. Das Protokoll ist in der Seitenleiste bzw. als ausklappbare Leiste sichtbar.
- **Quellen:** Ein Info-Knopf auf jeder Karte zeigt die Quellen der Werte.

## Hot-Seat und Online

- **Hot-Seat (Trumpf):** Nur der aktive Spieler muss seine oberste Karte geheim sehen. Übergabe an ihn, er wählt, dann Aufdecken für alle. Weil der Gewinner am Zug bleibt, gibt es nur wenige Übergaben.
- **Hot-Seat (Sammeln):** Übergabe vor jedem Zug.
- **Online:** Der Server hält Stapel und Hände.

## Tests

- Vergleich mit `higherWins` true und false; Gleichstand mit Mitte über mehrere Runden.
- Ausscheiden, Rundenlimit, Sieg.
- Sammeln:
  - Frage nur mit eigener Gruppenkarte erlaubt
  - Übergabe und weiterfragen
  - Quartett erkennen und ablegen
  - Spielende, wenn alle Gruppen abgelegt sind
- **Set-Prüfung:** 32 Karten, 8×4 Gruppen, alle Werte vorhanden, Quellen vorhanden. Läuft automatisch für jedes Set in `content/quartett/`.
- `playerView` verrät keine tieferen Stapelkarten und keine fremden Hände.

## Offene Punkte

- Werte für die vier Sets recherchieren und mit Quellen belegen. Biblische Personen prüfst du als Religionslehrer.
- Später: ein Editor für eigene Sets, z. B. von einer Klasse erstellt.
