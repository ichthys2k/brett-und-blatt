# Mau-Mau

| Steckbrief | |
|---|---|
| Spieler | 2–5 |
| Dauer | 10–20 Minuten |
| Modi | Solo gegen Bot, Hot-Seat, online |
| Muster | verdeckt (Handkarten und Talon), Zug um Zug |
| Etappe | 7 (Nachtrag) |
| Ordner | `packages/games/mau-mau` |

Das klassische deutsche Ablegespiel mit 32 Karten: Wer in Farbe oder Wert passt, legt ab. 7er bestrafen den Nächsten, 8er setzen aus, Buben wünschen eine Farbe, und vor der letzten Karte heißt es „Mau!“.

## Regeln

- **Blatt:** 32 Karten, Ränge 7, 8, 9, 10, Bube, Dame, König, Ass in Kreuz, Karo, Herz und Pik.
- **Austeilung:** Jeder Platz erhält 5 Handkarten. Eine Startkarte liegt offen; sie hat keine Sonderfunktion, ihre Farbe ist die Anfangsfarbe.
- **Zug:** Eine Karte passt, wenn ihre Farbe der aktuellen Farbe oder ihr Wert dem Wert der obersten Karte entspricht. Nach einem Buben gilt die gewünschte Farbe.
- **Ziehen:** Wer nicht legen kann oder will, zieht eine Karte. Passt sie, darf sofort gelegt werden; sonst ist der Nächste dran. Alternativ kann „Ziehen bis passend“ eingestellt werden.
- **7:** Der Nächste zieht zwei Karten und wird übersprungen. Mit „7er stapeln“ wandert die Strafe weiter (+2, +4, +6 …); wer keine 7 mehr hat, zieht die gesamte Summe.
- **8:** Der Nächste wird übersprungen.
- **9:** Die Spielrichtung wechselt. Bei zwei Spielern wirkt die 9 wie Aussetzen.
- **Ass:** Optional darf der Spieler sofort noch eine Karte legen (Standard: aus).
- **Bube:** Er darf standardmäßig auf jede Karte gelegt werden. Der Spieler bestimmt die neue Farbe. „Bube auf Bube“ ist standardmäßig verboten.
- **„Mau!“:** Wer seine vorletzte Karte legt, muss rufen. Er hat dafür 3 Sekunden (auch nach dem Legen noch per „📣 Mau! rufen“); danach löst die Oberfläche die Strafe von 2 Karten automatisch aus (`catchMau`, auch gegen sich selbst; `useCallDeadline` in `packages/ui`). Die Regel lässt sich abschalten.
- **Ende:** Wer zuerst keine Karten mehr hat, gewinnt. Es gibt eine Runde pro Partie, keine Restkartenwertung und keine Mehrrunden-Serie.

## Optionen

| Option | Werte | Standard |
|---|---|---|
| Kartenbild | Französisch, Vierfarben, Deutsch | Französisch |
| 7er stapeln | An, Aus | An |
| 9 = Richtungswechsel | An, Aus | An |
| Ass = noch einmal | Aus, An | Aus |
| Bube auf alles | An, Aus | An |
| Bube auf Bube | Verboten, Erlaubt | Verboten |
| „Mau!“ rufen | An, Aus | An |
| Nachziehen | 1 Karte, bis passend | 1 Karte |

## Spielmodell

- Reines JSON: `hands`, `stock`, `discard`, `activeSuit`, `direction`, `turn`, `pendingDraw`, `hasDrawn`, `mauProtection`, `rng`, `winner`.
- Der Zufall läuft ausschließlich über den Seed-Rng; in der Sicht wird `rng` genullt.
- `playerView` verbirgt fremde Hände und den Talon; nach Spielende werden alle Hände offen gezeigt.
- `sampleHidden` füllt unbekannte Karten für Bot-Simulationen ohne Doppelte auf.
- Ein Zug ist entweder `play`, `draw`, `pass` oder `catchMau`. „Mau vergessen“ ist ein eigener Zug und verbraucht den Zug nicht.
- Die Ablage wird bis auf die oberste Karte zurück in den Talon gemischt, wenn dieser leer ist.
- Sonderfunktionen werden nach dem Legen ausgeführt. Wer mit der letzten Karte gewinnt, wird nicht mehr von einer 7 oder 8 bestraft.

## Bot

Der Standard-Bot heißt **Mau-Mau-Meister** und spielt in drei Stufen:

- **leicht:** wählt zufällig unter den erlaubten Karten.
- **mittel:** bevorzugt die eigene stärkste Farbe, passt Werte an und spart Buben für brenzlige Situationen auf.
- **schwer:** zählt Karten und Gegnerhand, legt bei einem knappen Gegner 7, 8 oder Bube nach, hält eine starke Farbe zusammen und mahnt vergessene „Mau!“-Rufe mit hoher Wahrscheinlichkeit an.

## Oberfläche

- Grüner Filz-Tisch mit Richtungsanzeige, Talon, Ablage und aktiver Wunschfarbe.
- Handkarten als Fächer mit `PlayingCard`, `usePointerDrag` und Klick/Tap-Bedienung.
- Der Fächer (`CardFan` mit `minStep`) bricht bei vielen Karten in überlappende Reihen um, Wert und Farbe jeder Karte bleiben sichtbar; Mitspieler zeigen ihre Kartenzahl als kleinen verdeckten Fächer (31.10.2026, W-019).
- Flug-Animationen beim Legen und Ziehen, Aufprall-Impuls auf der Ablage, organischer Ablagewinkel.
- „Mau!“-Knopf bei zwei Handkarten, kein Anpranger-Knopf mehr, die Frist läuft von allein.
- Wunschfarben-Modal für Buben, Hervorhebung aller spielbaren Karten.
- Responsive für Handy, Tablet und Desktop; `prefers-reduced-motion` schaltet die Fluganimationen ab.

## Tests

`packages/games/mau-mau/test/mau-mau.test.ts` prüft:

- die allgemeinen Vertragsregeln über `gameContractChecks` (2 und 5 Plätze, alle Optionsvarianten, Bot-Partien, Zeitablauf),
- Austeilung und vollständiges 32er-Blatt,
- Farb- und Wertpassung, Bube auf Bube, Bube auf alles,
- 7er-Stapeln und 7er ohne Stapeln, 8er-Aussetzen, 9er-Richtungswechsel, Ass-Zusatzzug,
- Wunschfarbe, „Mau!“-Schutz und Strafkarte,
- Sieg mit der letzten Karte vor Sonderfunktionen,
- Ziehen einer Karte und Ziehen bis passend,
- verdeckte Sicht und `sampleHidden`,
- eine Partie über `LocalSession`.

## Offene Punkte

- Keine Mehrrunden-Serie und keine Restkartenwertung (bewusst nicht in v1).
- Kein Zwischenwerfen (Jump-In) und kein 7-0-Tausch; diese Varianten bleiben Uno vorbehalten.
- Die Startkarte hat keine Sonderfunktion. Das ist eine bewusste Vereinfachung und kann später als Option ergänzt werden.
