# Domino

| Steckbrief | |
|---|---|
| Spieler | 2–4 |
| Dauer | 10–30 Minuten (je nach Ziel) |
| Modi | Solo gegen Bot, Hot-Seat (mit Übergabe), online |
| Muster | verdeckt (Hände und Vorrat), Zug um Zug, mehrere Runden |
| Etappe | 4 |
| Ordner | `packages/games/dominoes` |

## Regeln (Doppel-6, mit Cornelius abgestimmt am 26.10.2026)

- 28 Steine [0|0] bis [6|6]. Block-Domino: je 7 Steine; Ziehen und Fünfer: zu zweit 7, zu dritt und viert 5.
- Jede Runde beginnt, wer den höchsten Pasch hat (sonst den höchsten Stein), und legt ihn zuerst.
- Reihum an ein offenes Ende anlegen. Wer nicht kann: Block – passen; Ziehen/Fünfer – einen Stein ziehen (so lange, bis es geht), bei leerem Vorrat passen.
- Rundenende: Wer zuerst leer ist, bekommt die Augen der anderen (Fünfer: auf 5 gerundet). Passen alle nacheinander (gesperrt), gewinnt die wenigsten Augen; bei Gleichstand punktet niemand.
- **Fünfer-Domino (All Fives):** Nach jedem Anlegen zählen die offenen Enden zusammen; ist die Summe ein Vielfaches von 5, gibt es sofort so viele Punkte. Ein Pasch am Ende zählt doppelt. Mit optionaler „Spinner“-Regel (der erste Pasch öffnet nach Belegen beider Hauptseiten zwei zusätzliche vertikale Äste).
- Ziel 50, 100, 150 oder 250 Punkte; wer es erreicht, gewinnt sofort.
- **Darstellung (Mathe-Modus):** Neben klassischen Augen (`pips`, 0–6) können auf den Steinhälften **Rechenterme (Kl. 5)** (`terms`, z. B. `18 : 3`, `2²`, `15 − 9`) oder **Brüche & Dezimalzahlen (Kl. 6)** (`fractions`, z. B. `12/2`, `1,5 · 4`, `100 %`) angezeigt werden. Angelegt wird an wertgleiche Steinhälften.

## Umsetzung

- Mischen über einen Zufallsstand im Spielstand (`rng`, in der Sicht genullt), wie bei Mäxle.
- `lacks`: öffentlich, welche Zahlen ein Platz nicht bedienen konnte; nutzen der schwere Bot und `sampleHidden`.
- Bot: leicht zufällig, mittel gierig (Fünferpunkte, dann schwere Steine), schwer zusätzlich Pasche früh, eigene Zahlen offen halten, Zahlen legen, die der Nächste nicht hat, beim Fünfer die Antwort des Nächsten über sechs Belegungen schätzen.
- Kette als umbrechende Reihe, Pasche quer, Spinner-Zweige nach oben und unten.
- Steuerung: Steine können per Antippen/Klick oder per Drag & Drop direkt auf das Spielfeld bzw. an die offenen Enden gezogen werden.

## Offen

- Mannschaften zu viert, Mexican Train.
