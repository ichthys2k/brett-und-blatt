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

## Schritt 2b (umgesetzt): Größe auf dem Fernseher

Die Spielszene läuft auf einer **Bühne** (`Stage` in `Display.tsx`, Faktor `stageScale` in `lib/stage.ts`): Das Spiel rechnet mit einer Fläche von etwa 1280 × 720 und wird als Ganzes hochskaliert (`transform: scale`, höchstens 2,5; auf Full-HD 1,5, nie kleiner als 1). Karten, Steine und Schrift werden so größer, ohne dass jedes Spiel eine eigene Fernsehansicht braucht. Der `GameTable` nimmt dort `h-full` statt `h-dvh` (`OnlineTableProps.display`). Festgesetzte Elemente (Siegerehrung, Sprechblasen) bleiben in der Bühne. Grenze: Medienabfragen der Spiele (`max-height: 720px` u. ä.) sehen weiter die echte Bildschirmgröße; geprüft mit zwölf Spielen auf 1920 × 1080, ohne Überlauf (Mau-Mau, Schach, Nicht ärgern!, Eins!, Poker, Skat, Domino, Sternhalma, Go, Narrenhof, Doppelkopf).

## Schritt 3 (umgesetzt für Mau-Mau, Eins!, Skat, Doppelkopf, Schafkopf und Binokel): Hand-Ansicht fürs Handy

- `BoardProps.handOnly` und `GameUi.handView` (`packages/ui/src/types.ts`): Ein Spiel mit `handView: true` zeigt in der Hand-Ansicht nur die eigene Hand mit den Aktionsknöpfen und eine kleine Zusammenfassung des Tisches (Ablage, aktuelle Farbe, Kartenzahlen der anderen, Talon; im Skat der Stich klein und die Reiz- und Ansagefelder).
- Der Schalter „🃏 Hand-Ansicht“ / „Ganzer Tisch“ steht online in den Knöpfen unter dem Spielfeld (am Tablet im Menü „⋯“) und wirkt je Gerät (`lib/handView.ts`, `localStorage` `brett-und-blatt:handansicht`). Er erscheint nur mit eigenem Platz und nicht auf dem Tisch-Bildschirm.
- Flug-Animationen der Karten entfallen in der Hand-Ansicht, weil es Ablage und Stapel dort nicht gibt. Die Handkarten sind größer (Mau-Mau 104, Eins! 96, Stichspiele 72 px). Die Stichspiele (Skat, Doppelkopf, Schafkopf, Binokel) zeigen dieselbe Übersicht: Ansagen und Reizen, der Stich klein (`TrickTable`), darunter die Hand.
- Neue Spiele: `handOnly` auswerten, `handView: true` setzen, eigene CSS-Klassen mit Spielpräfix. Weitere Spiele (Karten-Anlegespiele, Würfelspiele) folgen nach demselben Muster.

## Noch offen

- **Spielspezifische Fernsehansicht (`GameUi.tableView?`):** Wo die Zuschauer-Darstellung nicht passt, etwa im Skat der Fußplatz mit „Deine Hand (0 Karten)“ und verdeckten Karten. Dort sollte der Tisch alle Plätze gleich zeigen.
- **Hand-Ansicht für weitere Spiele** (Anlegespiele wie Elf zuerst!, Präsident, Tiefflug; Würfelspiele).
- **Hand-Ansicht automatisch anbieten**, sobald ein Tisch-Bildschirm im Raum ist (`RoomMessage.displays`).
- **Spielleiter-Panel** mit dem Fähigkeiten-Modell, auch ohne Platz und während der Partie.
- **Weitere Szenen** auf demselben Rahmen: Turnierbaum (die Turnierseite hat schon einen Zuschaulink, `settings.spectators`) und Partie nachspielen (#99).
- **Punkte setzen** ist spielabhängig; erst mit den Turnier-Stufen und einem optionalen `GameModule`-Haken klären.
