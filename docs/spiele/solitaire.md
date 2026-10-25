# Solitaire

| Steckbrief | |
|---|---|
| Spieler | 1 |
| Dauer | 3–15 Minuten |
| Modi | Solo; der Computer kann auch selbst spielen (zum Zuschauen) |
| Muster | verdeckt (verdeckte Karten und Talon), Einzelspieler |
| Bausteine | Spielkarten (französisch, als SVG), Kartenstapel, Tipp-Funktion |
| Aufwand | Regeln M, Oberfläche L, Bot M |
| Etappe | 2 |

Ein Modul mit vier Varianten, die Karten, Stapel und Bedienung teilen.

## Varianten

- **Klondike** (das „klassische“ Solitaire):
  - Sieben Stapel mit 1–7 Karten, nur die oberste liegt offen. Darauf wird absteigend mit wechselnden Farben angelegt (rot auf schwarz).
  - Leere Stapel nehmen nur Könige.
  - Ziel: alle Karten nach Farbe aufsteigend auf die vier Ablagen, vom Ass bis zum König.
  - Vom Talon wird eine oder werden drei Karten gezogen (Option).
- **FreeCell:**
  - Alle 52 Karten liegen offen in acht Stapeln. Dazu kommen vier freie Zellen für je eine Karte.
  - Mehrere Karten auf einmal lassen sich nur verschieben, wenn genug Zellen und Stapel frei sind.
  - Fast jedes Spiel ist lösbar.
- **Spider:**
  - Zwei Kartenspiele (104 Karten) in zehn Stapeln.
  - Angelegt wird absteigend unabhängig von der Farbe, verschoben werden nur gleichfarbige Folgen.
  - Eine vollständige Folge vom König bis zum Ass wird abgelegt.
  - Der Talon gibt jedem Stapel eine Karte; das geht nur, wenn kein Stapel leer ist.
  - Option: 1, 2 oder 4 Farben.
- **Pyramide:**
  - 28 Karten bilden eine Pyramide.
  - Entfernt werden zwei freie Karten, deren Wert zusammen 13 ergibt (Bube 11, Dame 12, König 13 allein).
  - Dazu kommen Talon und Ablage.
  - Ziel: die Pyramide abräumen.

## Spielmodell

- **Karten** sind Kennungen wie `H7` (Herz 7) oder `SK` (Pik König). Bei Spider kommt die Nummer des Kartenspiels dazu.
- **Geheim:** Verdeckte Karten und die Reihenfolge des Talons stehen nicht in der Sicht. Auch der Tipp-Bot rechnet ehrlich mit einer zufälligen Belegung des Unbekannten.
- **Züge:** `move` (Karte bzw. Folge von A nach B), `draw` (Talon), `recycle` (Ablage zurück in den Talon), bei Pyramide `pair` und `remove`.
- **Ergebnis:** Gewonnen, wenn alles abgelegt ist; „verloren“ nur durch Aufgeben.
- **Automatik:** Liegt alles offen und der Talon ist leer, legt die Spielleitung den Rest per Systemzug selbst ab.

## Bot und Tipps

Ein Bot mit Faustregeln spielt die Varianten ordentlich:

1. auf die Ablagen
2. verdeckte Karten freilegen
3. lange Folgen bilden
4. Talon nutzen

Er liefert auch die **Tipps** („Was kann ich jetzt tun?“). Ein vollständiger Löser, der nur lösbare Spiele austeilt, ist für später vorgesehen.

## Oberfläche

- **Kartengröße:** Die Karten passen sich der Bildschirmbreite an (7, 8 bzw. 10 Spalten). Hohe Stapel werden enger gefächert.
- **Bedienung:** Antippen einer Karte führt den naheliegendsten erlaubten Zug aus (Ablage vor Stapel). Gibt es mehrere Ziele, leuchten sie auf, und man tippt das gewünschte an.
- **Anzeigen:** Zugzähler, Knöpfe „Zug zurück“ und „Tipp“.

## Tests

- Austeilen ist wiederholbar und vollständig: jede Karte genau einmal, bei Spider zweimal.
- Anlegeregeln je Variante; Mehrfachverschieben bei FreeCell; Spider-Folge ablegen; Talon-Regeln; Pyramide 13er-Paare.
- `playerView` enthält keine verdeckten Karten.
- Bot-Partien laufen ohne Fehler durch.
