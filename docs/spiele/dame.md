# Dame

| Steckbrief | |
|---|---|
| Spieler | 2 |
| Dauer | 5–15 Minuten |
| Modi | Solo gegen Bot, Hot-Seat, online |
| Muster | offen, Zug um Zug |
| Bausteine | Gitterbrett (`GridBoard`), Drag & Drop (`usePointerDrag`, `useGridMoveAnimation`), Negamax mit Alpha-Beta |
| Aufwand | Regeln M, Oberfläche M, Bot M |
| Etappe | 7 |

## Regeln (Standard: Klassisch Deutsch)

- **Brett:** 8×8 Felder mit 12 Steinen je Spieler auf den 32 dunklen Feldern (`(col + row) % 2 === 1`). Weiß beginnt (Reihen 1–3 von unten bzw. 5–7, Schwarz auf Reihen 6–8 bzw. 0–2).
- **Züge einfacher Steine:**
  - Ziehen ein Feld diagonal vorwärts auf ein freies dunkles Feld.
  - Schlagen (nur vorwärts): Überspringen einen gegnerischen Stein diagonal auf das unmittelbar dahinter liegende freie Feld.
- **Fliegende Dame:**
  - Erreicht ein Stein die gegnerische Grundreihe, wird er zur Dame gekrönt.
  - Die Dame zieht beliebig weit diagonal vor- und rückwärts entlang freier Felder.
  - Die Dame schlägt über einen gegnerischen Stein in beliebiger Distanz und darf auf jedem freien Feld dahinter auf derselben Diagonale landen.
- **Schlagpflicht & Mehrfachschlag:**
  - Kann ein Spieler schlagen, **muss** geschlagen werden (Schlagzwang). Einfache Züge sind dann unzulässig.
  - Kann nach einem Schlag derselbe Stein weiter schlagen, muss der Schlag im selben Zug fortgesetzt werden, bis keine Schläge mehr möglich sind.
  - Freie Schlagwahl (Klassisch Deutsch): Wenn mehrere Schlagzüge zur Wahl stehen, darf der Spieler frei entscheiden, welchen er ausführt.
- **Spielende:**
  - **Verloren** hat, wer alle Steine verliert oder bewegungsunfähig blockiert ist.
  - **Unentschieden:** Dreifache Stellungswiederholung oder 40 Halbzüge ohne Schlagen und ohne Vorrücken eines Steins.

## Optionen in der Lobby

| Option | Werte | Standard | Beschreibung |
|---|---|---|---|
| **Regelvariante** | Klassisch Deutsch, International, Checkers (Englisch) | Klassisch Deutsch | Klassisch Deutsch: fliegende Dame, nur Vorwärtsschlag, freie Schlagwahl.<br/>International: fliegende Dame, Vor- und Rückwärtsschlag, Mehrheitszwang.<br/>Checkers (Englisch): kurze Dame (1 Schritt), nur Vorwärtsschlag. |
| **Brettgröße** | 8 × 8 (12 Steine), 10 × 10 (20 Steine) | 8 × 8 | Klassisches 8×8-Brett oder 10×10-Turnierbrett. |
| **Brett drehen** | Zum Spieler am Zug, Fest | Zum Spieler am Zug | Dreht das Brett bei Hot-Seat am Gerät zur jeweiligen Spielerfarbe. |

## Spielmodell

- **Zustand (`CheckersState`):**
  - `cells`: Array der Länge `size * size` mit `{ seat: SeatId, king: boolean } | null`.
  - `turn`: Platz 0 (Weiß) oder Platz 1 (Schwarz).
  - `history`: Partieverlauf in deutscher algebraischer Notation (`c3-d4`, `c3:e5:g7`).
  - `positions`: Hash-Tabelle der Stellungen zur Erkennung von 3-facher Wiederholung.
  - `sinceCaptureOrAdvance`: Zähler für 40-Halbzüge-Remis.
- **Züge (`CheckersMove`):**
  - Atomare Züge: `{ type: 'move', from, to, path, captures, san }`.
  - Enthält bei Mehrfachsprüngen alle Zwischenstationen und geschlagenen Steine in Schlagreihenfolge.

## Bot

**Negamax mit Alpha-Beta-Schnitt, iterativer Vertiefung und Feldtabellen (PST):**
- **Bewertung:**
  - Material: Einfacher Stein = 100, Dame = 320.
  - Feldtabellen: Vorrücken einfacher Steine in Richtung Verwandlungsreihe (+6 pro Reihe), Schutz der Grundreihe vor frühen Damendurchbrüchen (+12), Zentrumskontrolle für Damen, Sicherung der Randsteine (+4).
- **Zugsortierung:** Schlagzüge mit den meisten Opfern zuerst, danach vorrückende Züge.
- **Stufen:**
  - `easy`: Tiefe 2 mit Zufallsrauschen (übersieht Fehler).
  - `medium`: Tiefe 4 mit leichtem Rauschen.
  - `hard`: Tiefe 8 mit vollem Zeitbudget.

## Zeitlimits

| Voreinstellung | Modell |
|---|---|
| gemütlich | aus |
| normal | 20 s pro Zug |
| schnell | Schachuhr 3 Minuten + 2 s pro Zug |

## Oberfläche

- **Layout:** Angelehnt an Schach (`FitBox ratio={8 / 9}`).
- **Schlagleisten (`CaptureStrip`):** Geschlagene gegnerische Steine und Materialvorsprung über und unter dem Brett.
- **Gitterbrett (`GridBoard`):** 8×8 / 10×10 im edlen Holz-/Schiefer-Look.
- **Steine:** Plastische runde Steine in Elfenbein/Weiß und Ebenholz/Schwarz mit subtilen Rillen; Damen tragen eine zentrierte goldene Krone 👑.
- **Interaktion:**
  - Pointer Drag & Drop (`usePointerDrag`): Direktes Ziehen auf Zielfelder mit flüssiger `useGridMoveAnimation`.
  - Klick/Tap: Antippen des Steins hebt legale Zielfelder hervor, Antippen des Ziels führt den Zug aus.
  - Schlagzwang: Schlagpflichtige Steine pulsieren sanft (`dk-must-capture`).
- **Zughistorie:** Popover mit Partieverlauf in algebraischer Notation (`1. c3-d4 d6-c5 2. ...`).

## Tests

- Startaufstellung (8×8: 12 Steine je Seite; 10×10: 20 Steine je Seite).
- Einfache Vorwärtszüge und Vorwärtsschläge.
- Rückwärtsschlag einfacher Steine (nur in Variante International).
- Fliegende Dame (beliebige Weite bei Zug und Sprung) vs. Kurze Dame.
- Schlagpflicht und Mehrheitszwang.
- Umwandlung zur Dame bei Erreichen der Grundreihe.
- Niederlage bei Materialverlust und Blockade; Remis durch Wiederholung und Zugzähler.
- Vollständige Plattform-Vertragsprüfungen (`gameContractChecks`).
