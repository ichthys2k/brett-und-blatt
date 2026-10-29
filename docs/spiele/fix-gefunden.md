# Fix gefunden! (Dobble-artig)

*Reaktionsspiel für 1–8 Spieler (Klassen-Modus bis 30): Zwischen zwei Karten gibt es immer genau ein gleiches Symbol – wer es zuerst findet, gewinnt die Karte.*

> **Name:** „Dobble“ (bzw. „Spot It!“) ist eine Marke von Asmodee. Arbeitsname **„Fix gefunden!“**, id `symbol-match`. Die Mechanik selbst (Karten aus einer endlichen projektiven Ebene) ist Mathematik und frei.

| Steckbrief | |
|---|---|
| Spieler | 1–8, Klassen-Modus bis 30 |
| Modi | Allein gegen Bots, geteilter Bildschirm (2–4 am Tablet), online |
| Muster | gleichzeitig (Echtzeit), wenig Verdecktes (Stapelreihenfolge) |
| Bausteine | neu: Symbolkarte (runde Karte mit verstreuten Emojis), Kartengenerator; vorhanden: `stillValid`/`tooLate`, `delayMs`, geteilter Bildschirm, Inhaltspakete |
| Aufwand | Regeln M (fünf Mini-Spiele), Oberfläche M, Bot S |
| Ordner | `packages/games/symbol-match` |

## Kartensatz

- Eine **projektive Ebene der Ordnung n** liefert n² + n + 1 Karten mit je n + 1 Symbolen aus n² + n + 1 Symbolen. Je zwei Karten haben **genau ein** Symbol gemeinsam. Für Primzahlen n ist die Konstruktion kurz (Geraden über ℤₙ plus Punkte im Unendlichen); `src/deck.ts` erzeugt das Deck, ein Test prüft „genau eins gemeinsam“ für alle Paare.
- **Stufen** (Option „Kartengröße“):
  - **Klein (Kinder):** n = 3 → 13 Karten, 4 Symbole je Karte.
  - **Mittel:** n = 5 → 31 Karten, 6 Symbole.
  - **Groß (wie das Original):** n = 7 → 57 Karten, 8 Symbole (das Original nutzt 55 davon).
- **Symbolpakete** in `content/symbole/` (je 57 Einträge, für kleinere Stufen die ersten 13 bzw. 31):
  - **Emojis bunt** (Standard), **Tiere**, **Bibel** (Arche, Fisch, Brot, Krone, Stern …).
  - **Mathe Kl. 5/6:** Ein „Symbol“ ist ein *Wert*; jede Karte zeigt ihn in einer anderen Schreibweise (12, 3·4, 24 : 2, 2²·3). Gleich ist, was denselben Wert hat. Ebenso Brüche (½ = 0,5 = 50 %) und Einheiten (1 m = 100 cm). Das macht Kopfrechnen zum Reaktionsspiel.
- Darstellung: Symbole verstreut auf runder Karte, Größe und Drehung je Karte und Symbol aus dem Seed (deterministisch, in allen Browsern gleich). Größe und Drehung abschaltbar („ruhige Karten“) für jüngere Kinder.

## Mini-Spiele (Option „Spielart“)

1. **Turmbau** (Standard): Jeder hat eine offene Karte (seinen Turm), in der Mitte liegt der Stapel. Wer das gemeinsame Symbol zwischen der Mittelkarte und seinem Turm zuerst antippt, legt die Mittelkarte auf seinen Turm. Ist der Stapel leer, gewinnt der höchste Turm.
2. **Brunnen:** Alle Karten werden verteilt, eine liegt in der Mitte. Wer zwischen seiner obersten Karte und der Mittelkarte das Symbol findet, legt seine Karte ab. Wer zuerst leer ist, gewinnt.
3. **Vergiftetes Geschenk:** Jeder hat eine Karte; wer zwischen der Mittelkarte und der Karte eines *Mitspielers* das Symbol findet, schiebt ihm die Mittelkarte zu. Die wenigsten Karten gewinnen.
4. **Heiße Kartoffel** (mehrere Runden): Jeder hält eine Karte; wer eine Übereinstimmung mit einer fremden Karte findet, legt seine darauf. Wer am Ende alle Karten hat, verliert die Runde.
5. **Duell / Training (allein):** Zwei Karten, möglichst viele Treffer in 60 s. Ideal für Solo und als Mathe-Übung.

## Optionen

Spielart, Kartengröße (13/31/57), Symbolpaket, ruhige Karten, Strafzeit bei Fehlgriff (aus, 1 s, 2 s; Standard 1,5 s), Rundenzahl bei Heißer Kartoffel.

## Spielmodell

- **Muster:** `simultaneous`. Alle Plätze sind immer am Zug.
- **Züge:** `claim` mit Symbol-Kennung und Zielkarte (bei „Vergiftetes Geschenk“ zusätzlich Ziel-Platz), `ready` zwischen Runden.
- **Fehlgriff:** Ein falsches Symbol ist ein *legaler* Zug, der den Platz für die Strafzeit sperrt (Zustand `blockedUntil` in Zugzählern, nicht in Uhrzeit, damit der Zustand reines JSON bleibt; die Oberfläche zeigt die Sperre, die Spielleitung wertet sie mit der vorhandenen Uhr aus). Klärung beim Bau: Wie gelangt Echtzeit sauber in `applyMove`? Kartenblitz kommt ohne aus; hier ist eine kleine Engine-Erweiterung nötig (z. B. `move.at` vom Server gestempelt).
- **Wettlauf:** Der erste richtige `claim` gewinnt. Der zweite mit veralteter Version wird über `stillValid` geprüft und meist `tooLate` („Zu spät – jemand war schneller.“).
- **Sicht:** Fast alles offen; verdeckt sind nur die Stapelreihenfolge und `rng`. `sampleHidden` mischt den Rest.

## Bot

„Adlerauge“ mit Bedenkpause, die mit der Kartengröße wächst (mehr Symbole = länger suchen):

- **leicht:** 4–7 s, ab und zu ein Fehlgriff.
- **mittel:** 2,5–4 s.
- **schwer:** 1,2–2 s.

Im Klassen-Modus besser keine Bots, damit Kinder gegeneinander spielen.

## Oberfläche

- Mittelkarte groß in der Mitte, eigene Karte groß unten; Symbole direkt antippbar (große Trefferflächen auch bei kleinen Symbolen).
- Treffer: Symbol leuchtet auf beiden Karten, Karte fliegt zum Gewinner. Fehlgriff: Karte wackelt, grauer Schleier für die Strafzeit.
- Mitspieler als Leiste mit Turmhöhe bzw. Kartenzahl.
- Geteilter Bildschirm für 2–4 Spieler am Tablet (vier Ecken, jeweils zur Tischkante gedreht).
- Klänge (Auswahl durch Cornelius): Treffer, Fehlgriff, Rundenende. Playlist „Spielabend“.

## Tests

- Deckgenerator: Anzahl Karten/Symbole je Stufe, jedes Kartenpaar genau ein gemeinsames Symbol.
- Jedes Mini-Spiel: Ablauf, Sieger, Strafzeit, zwei gleichzeitige Treffer.
- Mathe-Paket: alle Schreibweisen eines Werts ergeben wirklich denselben Wert.
- `gameContractChecks`, Prüfstand.

## Offene Punkte

- Endgültiger Name (Vorschläge: „Fix gefunden!“, „Gleich gesehen!“, „Doppelblick“).
- Strafzeit braucht Echtzeit im Spielzustand – Lösung beim Bau klären (siehe Spielmodell).
- Symbolpakete kuratieren, Mathe-Paket gemeinsam mit Cornelius.
