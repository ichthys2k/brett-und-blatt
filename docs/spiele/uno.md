# Eins! (Uno-Familie)

| Steckbrief | |
|---|---|
| Spieler | 2–10 |
| Dauer | 10–25 Minuten |
| Modi | Solo gegen Bot, Hot-Seat, online |
| Muster | verdeckt (Handkarten und Nachziehstapel), Zug um Zug |
| Etappe | 7 |
| Ordner | `packages/games/uno` |

Das bunte Ablegespiel für Familie und Freunde: Passend zur Farbe oder Zahl ablegen, mit Aussetzen, Richtungswechsel und Strafkarten. Vor der letzten Karte heißt es: „Eins!“

## Varianten

1. **Klassisch (Classic):** 108 Karten (0–9 in 4 Farben, Aussetzen, Richtungswechsel, +2, Farbwahl, +4 Farbwahl).
2. **Keine Gnade (No Mercy):** Extrem-Variante mit 168 Karten (+6, +10, Alle Aussetzen, Farben-Roulette, 25-Karten-K.O.-Regel).
3. **Wenden (Flip):** 112 beidseitige Karten mit Helle Seite (Light) und Dunkle Seite (Dark: +5, Skip All, Farbwahl mit Ziehen bis passend).
4. **Nur Joker (All Wild):** Jede Karte ist ein Joker mit speziellem Aktionseffekt.
5. **Junior:** Kindgerechte Tiermotive (Bär, Löwe, Elefant, Affe ...) statt reiner Zahlen.

## Hausregeln (in der Lobby wählbar)

- **Strafkarten stapeln:** `same` (+2 auf +2, +4 auf +4), `progressive` (+4 auf +2, +6 auf +4 etc.) oder `off`.
- **7-0 Tauschregel:** 7 tauscht die Hand mit einem Wunschspieler; 0 lässt alle Hände in Spielrichtung wandern.
- **Zwischenwerfen (Jump-in):** Wer eine identische Karte (Farbe + Wert) hat, darf sie sofort außerhalb der Reihe ablegen.
- **Nachziehen:** 1 Karte ziehen oder so lange ziehen, bis eine passende kommt (`untilMatch`).
- **„Eins!“ rufen:** Wer die vorletzte Karte legt, muss „Eins!“ rufen; hat er dafür 3 Sekunden (auch nach dem Legen noch), sonst zieht er automatisch 2 Strafkarten (`catchUno` löst die Oberfläche nach Ablauf aus; `useCallDeadline` in `packages/ui`).
- **Mathe-Karten (`mathLabels`):** Im Modus „An (Kopfrechnen & Brüche)“ zeigen Zahlenkarten (`0–9`) in der Kartenmitte Rechenterme, Potenzen und Brüche (Klasse 5/6, z. B. `42 : 7`, `2³`, `3/4 · 8`) statt der Ziffer; in den Ecken steht `?`, sodass vor dem Ablegen im Kopf gerechnet werden muss.

## Umsetzung

- Modulare Kartendecks in `src/decks/` (`classic.ts`, `noMercy.ts`, `flip.ts`, `allWild.ts`, `junior.ts`).
- Deterministische Spielleitung ohne Seiteneffekte mit `Rng`-Zufallszustand (`rng`, in der Sicht genullt).
- `sampleHidden`: Füllt unbekannte fremde Hände und den Nachziehstapel für Bot-Simulationen auf.
- KI-Bot `unoBot` in drei Stufen (`easy`, `medium`, `hard`) mit Taktiken für Farbwahl, Aussetzen, Farbmehrheiten und Anprangern.
- Oberfläche: Handkarten-Fächer (`CardFan` mit `minStep`) bricht bei vielen Karten in bis zu vier überlappende Reihen um, sodass von jeder Karte die Ecke mit Zahl oder Symbol sichtbar bleibt (31.10.2026, F-001); nicht spielbare Karten werden abgedunkelt statt durchscheinend. Mitspieler zeigen ihre Kartenzahl zusätzlich als kleinen verdeckten Fächer (W-019). Pointer Drag & Drop (`usePointerDrag`), sichtbare kaskadierende Flug-Animationen beim Kartenlegen und Nachziehen (inkl. Aufprall-Impuls und organischem Ablagewinkel), Richtungsring mit CSS-Animation, pulsierender „Eins!“-Button, Farbwahl-Modal.
- Registriert auf dem Cloudflare-Spieleserver (`apps/server/src/games.ts` und `package.json`).
