# Sternhalma

*Brettspiel-Klassiker für 2–6 Spieler auf dem Sternbrett mit 121 Löchern: alle Steine mit Schritten und Sprungketten in die gegenüberliegende Zacke bringen.*

> **Name:** Sternhalma (auch „Chinesisches Halma“) ist alt und frei. id `chinese-checkers` (W-034, Etappe 7 der Planungsliste, Paket A).

| Steckbrief | |
|---|---|
| Spieler | 2–6 |
| Modi | Solo gegen Bots, Hot-Seat, online |
| Muster | Zug um Zug, offen |
| Bausteine | SVG-Sternbrett mit axialen Koordinaten, Sprungketten per Breitensuche |
| Aufwand | Regeln S, Oberfläche M, Bot M |
| Ordner | `packages/games/chinese-checkers` |

## Regeln

- **Brett:** Sechseck mit 61 Löchern und sechs Zacken mit je 10 Löchern (121 insgesamt).
- **Aufstellung:** Jeder Spieler hat 10 Steine (Option: 6, nur die drei Reihen an der Spitze) in seiner Zacke. Zu zweit sitzen sich die Spieler gegenüber, zu dritt bleibt jede zweite Zacke leer, zu viert bleiben zwei gegenüberliegende Zacken leer, zu fünft eine.
- **Zug:** ein Schritt auf ein freies Nachbarloch oder ein Sprung über genau einen Nachbarstein (gleich welcher Farbe) auf das freie Loch dahinter. Sprünge lassen sich beliebig verketten, man darf nach jedem aufhören. Geschlagen wird nicht. Ohne möglichen Zug wird gepasst.
- **Im Ziel:** Ein Stein, der die Zielzacke erreicht hat, darf sie nicht mehr verlassen.
- **Sieg:** Wer zuerst alle Ziellöcher besetzt hat, gewinnt. Gegen Blockieren: Stehen dort noch fremde Steine, reicht es, wenn alle Ziellöcher besetzt sind und mindestens eines mit einem eigenen Stein.
- **Rundengrenze:** Nach 150 Runden gewinnt, wessen Steine zusammen am nächsten an der Zielspitze stehen (bei Gleichstand aller: unentschieden). Kommt im normalen Spiel nicht vor (Bots brauchen zu zweit etwa 40 Züge je Spieler), verhindert aber endlose Partien.
- **Aufgeben:** Nur dieser Platz scheidet aus, seine Steine bleiben stehen.

## Spielmodell

Löcher in axialen Koordinaten `(q, r)`, Stern = Vereinigung zweier großer Dreiecke (`q, r, s ≥ −4` oder `≤ 4`). Zacke 0 oben, dann im Uhrzeigersinn; Platz 1 sitzt unten (Zacke 3). Zug `{ type: 'move', from, to }`; den Sprungweg berechnet `destinations` (kürzester Weg), er steht in `lastMove.path` und im Ereignis `jumped`/`stepped`.

## Bot „Sternspringer“

- **leicht:** irgendein Vorwärtszug, manchmal der weiteste.
- **mittel:** größter Raumgewinn zur Zielspitze, bei Gleichstand der hinterste Stein.
- **schwer:** Stellungswert aus Abständen, größtem Nachzügler und freien Ziellöchern, dazu der beste eigene Folgezug (bereitet Sprungleitern vor). Etwa 2 ms je Zug. Zu zweit gegen Zufall 8/8 im Prüfstand, gegen „mittel“ mindestens 4 von 6.

## Oberfläche

SVG-Stern, die eigene Zacke unten (gedreht nach eigenem Platz). Zacken in der Farbe ihres Besitzers, leere Zielzacken in der Farbe dessen, der dorthin will. Stein antippen, erreichbare Löcher pulsieren grün; Sprungketten laufen Loch für Loch ab (Web Animations, `prefers-reduced-motion` beachtet), der letzte Weg bleibt gestrichelt sichtbar. Farben mit Formzeichen (● ▲ ■ ★ ◆ ✚). Klänge `stein-ziehen`, `stein-setzen`, `ludo-haus` (Stein im Ziel), `sieg`; Playlist „Spielabend“.

## Offen

- Option „Brett nicht drehen“ für Hot-Seat, falls gewünscht.
- Mehr Steine zu zweit (15 oder 19) als Variante.
