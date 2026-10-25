# Paare finden

| Steckbrief | |
|---|---|
| Spieler | 1–6 |
| Dauer | 3–10 Minuten |
| Modi | Solo (gegen Uhr und Züge oder gegen Bots), Hot-Seat, online, gemischt |
| Muster | verdeckt: Die Lage der Karten ist geheim, alles Aufgedeckte ist öffentlich |
| Bausteine | Gitterbrett, Inhaltspakete (Paare) |
| Aufwand | Regeln S, Oberfläche M, Bot S |
| Etappe | 2, erstes Spiel mit Inhaltspaketen |

Gedächtnisspiel nach dem bekannten Prinzip. Der Name „Memory“ ist eine Marke, deshalb heißt es „Paare finden“.

## Regeln (Standard)

- Alle Karten liegen verdeckt im Raster.
- Wer am Zug ist, deckt zwei Karten auf. Passen sie zusammen, nimmt er sie und ist noch einmal dran. Sonst werden sie wieder umgedreht, und der Nächste ist am Zug.
- Sind alle Paare gefunden, gewinnt, wer die meisten hat.
- **Solo:** Ziel ist, alle Paare mit möglichst wenigen Zügen bzw. in möglichst kurzer Zeit zu finden. Bestwerte werden lokal gespeichert.

## Paare (Inhaltspakete)

Ein Paar besteht aus zwei Seiten, die **gleich** oder **zusammengehörig** sein können. Dieses Format teilen sich Paare finden und später Schwarzer Peter.

```jsonc
// content/paare/einmaleins.json (Ausschnitt)
{
  "id": "einmaleins", "name": "Einmaleins", "license": "CC-BY-SA-4.0",
  "pairs": [
    { "a": { "text": "7 · 8" }, "b": { "text": "56" } },
    { "a": { "text": "6 · 9" }, "b": { "text": "54" } }
  ]
}
```

Erste Sets:

- Emojis (gleiche Paare)
- Tiere mit Lauten aus Emojistone
- Einmaleins
- Vokabeln Deutsch–Englisch
- Biblische Begriffe, z. B. Person ↔ Geschichte

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Set | siehe oben, später eigene | Emojis |
| Größe | 12, 16, 20, 24, 30, 36 Karten | 16 (4×4) |
| Weiter bei Paar | an, aus | an |
| Anschauzeit | 1, 1,5, 2, 3 Sekunden, bis Tippen | 1,5 s |
| Vorlesen | an, aus (Begriffe per Sprachausgabe, für jüngere Kinder) | aus |

## Spielmodell

```ts
type PairsMove = { type: 'flip'; index: number };
```

- **Ablauf:** Ein Zug besteht aus zwei `flip`-Zügen. Nach dem zweiten Aufdecken entscheidet die Spielleitung über einen **Systemzug** nach Ablauf der Anschauzeit: `resolve` (Paar nehmen oder umdrehen).
- **Zustand:** Kartenbelegung (geheim), Status je Feld (verdeckt, gerade aufgedeckt, genommen von …), Punkte, aktiver Spieler.
- **Geheim (`playerView`):** Nur aufgedeckte und genommene Karten enthalten ihren Inhalt. Verdeckte Felder sind leer.
  - Wichtig: Am echten Tisch ist das Spiel „offen“, aber online darf die Belegung nie im Browser liegen. Sonst verrät ein Blick in die Entwicklertools alles. Deshalb gehört Paare finden zum Muster „verdeckt“.

## Bot

Ein **Gedächtnis-Modell**, denn ein Bot mit perfektem Gedächtnis wäre unschlagbar.

- Der Bot merkt sich jede gesehene Karte. Die Erinnerung verblasst mit jeder weiteren aufgedeckten Karte: Die Wahrscheinlichkeit, sich richtig zu erinnern, sinkt.
- **Erste Karte:** Kennt er ein Paar, deckt er es auf. Sonst nimmt er eine unbekannte Karte.
- **Zweite Karte:** Erinnert er sich an das Gegenstück, nimmt er es. Sonst nimmt er eine unbekannte Karte; Fehlgriffe sind möglich.

| Stufe | Gedächtnisspanne |
|---|---|
| leicht | etwa die letzten 4 Karten, mit Fehlern |
| mittel | etwa 12 Karten |
| schwer | fast alles, kleine Fehlerquote |

## Zeitlimits

| Voreinstellung | Pro Aufdecken |
|---|---|
| gemütlich | aus |
| normal | 10 s |
| schnell | 5 s |

**Bei Zeitablauf** deckt der Bot auf. Die Anschauzeit ist eine eigene Einstellung und kein Zeitlimit.

## Oberfläche

- Das Raster füllt den Bildschirm. Im Hochformat passen bis 5×6 bequem, 6×6 mit kleineren Karten. Quer und auf dem Desktop gibt es breitere Raster.
- **Umdrehen** als 3D-Animation; gefundene Paare fliegen zum Spieler.
- Die Kartenrückseite ist einheitlich; die Vorderseite zeigt Emoji, Bild oder Text (große Schrift).
- **Barrierearm:** Inhalte nie nur über Farbe unterscheiden; Vorlesen optional.

## Hot-Seat und Online

- **Hot-Seat:** Keine Übergabe nötig, weil alles Aufgedeckte ohnehin alle sehen. Die Spielerleiste zeigt deutlich, wer dran ist.
- **Online:** Der Server hält die Belegung. Die Anschauzeit läuft auf dem Server, damit alle gleich lange schauen können.

## Tests

- Belegung aus Seed wiederholbar; jedes Paar genau zweimal.
- Gleiche und zusammengehörige Paare werden erkannt.
- „Weiter bei Paar“ an und aus; Spielende und Punkte.
- `playerView` enthält nie Inhalte verdeckter Karten.
- **Gedächtnis-Bot:** Der schwere Bot gewinnt gegen den leichten deutlich häufiger (statistischer Test über viele Partien).
- **Set-Prüfung:** keine doppelten Paare, Lizenzangabe vorhanden.
