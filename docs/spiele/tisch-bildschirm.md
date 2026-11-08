# Tisch-Bildschirm und die drei Ansichten (#100)

Stand 8.11.2026. Plan und Umsetzungsstand für „Tisch auf dem großen Bildschirm, Hand auf dem Handy“. Er soll später auch Turnierbäume, Partien nachspielen (#99) und die Moderation tragen, darum ist er als allgemeiner Rahmen gebaut.

## Drei Ansichten, eine Verbindung

| Ansicht | Wer | Was sie sieht und darf |
|---|---|---|
| **Spieler** | Mitglied mit Platz | die eigene Sicht (`playerView(seat)`), eigene Züge |
| **Beamer** (Tisch-Bildschirm) | Fernseher, Beamer, Tafel, Tablet in der Mitte | nur die Zuschauersicht, groß; keine Bedienung, kein Platz |
| **Spielleiter** | Raumleitung, im Turnier Leitung, Mitleitung und Helfer | Moderation: Mitglieder entfernen, umbenennen, vom Platz nehmen, später Punkte setzen; kann auch ohne Platz arbeiten |

Statt Rollenabfragen im Code sollen alle Ansichten aus **Fähigkeiten** gespeist werden, die der Server je Verbindung meldet (`kick`, `rename`, `unseat`, später `setScore`, `extendTime`, `startRound`). Raum und Turnier füllen sie aus ihren eigenen Rollen (`isHost`, `leader`/`coleader`/`helper`); die Oberfläche zeigt nur Erlaubtes. Raum- und Turnierlogik werden dafür nicht zusammengelegt.

## Schritt 1 (umgesetzt): Rolle `display` im Raum

- Protokoll: Nachricht `display` (nur `protocol`) statt `hello`. Der Server antwortet mit `welcome` und `you: DISPLAY_MEMBER` (`@display`).
- Ein Tisch-Bildschirm ist **kein Mitglied**: nicht in der Mitgliederliste, nicht für `minHumans` gezählt, nie Raumleitung, kein Platz. Er bekommt `playerView(state, 'spectator')` und die dafür gefilterten Ereignisse (`eventView(…, 'spectator')`), keine Züge (`legalMoves` leer).
- Er darf nur Lebenszeichen (`ping`) senden und `leave`; alles andere ergibt `notAllowed`. Seine Lebenszeichen halten den Raum nicht am Leben (kein `touch`).
- Höchstens `MAX_DISPLAYS` (3) je Raum, `roomFull` darüber. `RoomMessage.displays` meldet die Zahl, damit die Lobby „Verbundene Tisch-Bildschirme“ zeigen kann.
- Wiederverbinden nach dem Schlafen des Durable Object: der Anhang der Verbindung trägt `DISPLAY_MEMBER`, `Room.reattach` ordnet ihn wieder zu.
- Tests: `packages/online/test/room.test.ts`, Gruppe „Tisch-Bildschirm (#100)“.

## Schritt 2 (umgesetzt): Beamer-Bildschirm in der Web-App

- Route `#/tisch/<Raumcode>` (`screens/Display.tsx`), Knopf „📺 Als Tisch-Bildschirm öffnen“ und Link in der Lobby (`Room.tsx`).
- **Lobby-Szene:** großer Raumcode mit QR zum Mitspielen, gewähltes Spiel, besetzte Plätze, Zuschauer.
- **Spielszene:** der vorhandene `GameTable` mit `yourSeat: null` und `display: true` (ohne Zurück-Knopf, Anleitung und Partieende-Knöpfe); Klänge, Musik, Reaktionen und Siegerehrung laufen auf dem großen Gerät.
- Bildschirm bleibt wach (Wake Lock), Vollbildknopf, Wiederverbinden wie im Raum.

## Noch offen (Schritt 2b und weiter)

- **Größe auf dem Fernseher:** viele Spiele zeichnen ihr Feld nur bis zu einer festen Größe; auf 1920 × 1080 wirkt es klein. Je Spiel eine größere Darstellung (`GameUi.tableView?`) oder eine allgemeine Skalierung.
- **Hand-Ansicht fürs Handy** (`GameUi.handView?`) für Mau-Mau, Eins! und ein Stichspiel.
- **Spielleiter-Panel** mit dem Fähigkeiten-Modell, auch ohne Platz und während der Partie.
- **Weitere Szenen** auf demselben Rahmen: Turnierbaum (die Turnierseite hat schon einen Zuschaulink, `settings.spectators`) und Partie nachspielen (#99).
- **Punkte setzen** ist spielabhängig; erst mit den Turnier-Stufen und einem optionalen `GameModule`-Haken klären.
