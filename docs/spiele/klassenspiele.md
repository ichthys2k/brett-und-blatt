# Klassenspiele: Schätzmeister, Mehrheitsfrage, Zeitstrahl (W-027, Welle 1)

Stand 1.11.2026. Drei Spiele für bis zu 30 Plätze ohne Freitext, die kein Gespräch brauchen. Konzept: [`spiele-fuer-viele.md`](spiele-fuer-viele.md).

## Ablauf

Alle drei laufen gleich: Frage, alle antworten gleichzeitig und verdeckt, Zeit läuft, Auflösung, nächste Frage. Das steckt in `makeRoundGame` (`packages/engine/src/round-game.ts`), die Oberfläche im `RoundFrame` (`packages/ui/src/classroom/`): Zeitbalken, Rangliste und Tafel mit QR-Code. Optionen je Spiel: Paket, 5/10/15 Runden, Antwortzeit, und ob es von selbst weitergeht oder Platz 1 „Weiter“ tippt.

- **Schätzmeister** (`estimate`, 1–30): am nächsten 10 Punkte, bis 10 % daneben 5, bis 25 % daneben 2, genau getroffen 5 extra.
- **Mehrheitsfrage** (`majority`, 3–30): Punkte nach dem Anteil derer, die dasselbe gewählt haben.
- **Zeitstrahl** (`timeline`, 1–30): je Eintrag am richtigen Platz 2 Punkte, alles richtig 4 extra. Jahreszahlen erscheinen erst bei der Auflösung.

„Zug zurück“ ist abgeschaltet (`noUndo`), sonst könnte man nach der Auflösung neu antworten.

## Inhalte

`content/klassenspiele/` (60 Schätzfragen, 35 Mehrheitsfragen, 20 Zeitstrahl-Sätze), ausgeliefert unter `GET /klassenspiele/<name>`. **Status „entwurf“: Die Freigabe durch Cornelius steht aus**, besonders Bibel-Pakete und Jahreszahlen.

## Lastmessung

`node apps/server/scripts/klasse.mjs [Adresse] [Spiel] [Plätze] [Runden]`, lokal mit `wrangler dev` und 30 nachgebauten Browsern, nicht auf Cloudflare: 950 Nachrichten und rund 6 MB je Runde (etwa 200 KB je Gerät), die Auflösung erreicht alle praktisch sofort.

## Dabei gefunden

Ein gestellter Systemwecker blieb stehen, auch wenn alle früher abgegeben hatten: Die Klasse hätte die restliche Zeit abgewartet. Neu: `GameModule.systemTimerKey` stellt ihn je Abschnitt neu.

## Offen

Tafel aus Bingo nicht vereinheitlicht (Bingo behält seine eigene). Test mit einer echten Klasse und auf Cloudflare.
