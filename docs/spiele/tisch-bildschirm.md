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

## Schritt 3 (umgesetzt für Mau-Mau, Eins!, Skat, Doppelkopf, Schafkopf, Binokel, Elf zuerst!, Präsident, Mäxle und Würfelblock): Hand-Ansicht fürs Handy

- `BoardProps.handOnly` und `GameUi.handView` (`packages/ui/src/types.ts`): Ein Spiel mit `handView: true` zeigt in der Hand-Ansicht nur die eigene Hand mit den Aktionsknöpfen und eine kleine Zusammenfassung des Tisches (Ablage, aktuelle Farbe, Kartenzahlen der anderen, Talon; im Skat der Stich klein und die Reiz- und Ansagefelder).
- Der Schalter „🃏 Hand-Ansicht“ / „Ganzer Tisch“ steht online in den Knöpfen unter dem Spielfeld (am Tablet im Menü „⋯“) und wirkt je Gerät (`lib/handView.ts`, `localStorage` `brett-und-blatt:handansicht`). Er erscheint nur mit eigenem Platz und nicht auf dem Tisch-Bildschirm.
- Flug-Animationen der Karten entfallen in der Hand-Ansicht, weil es Ablage und Stapel dort nicht gibt. Die Handkarten sind größer (Mau-Mau 104, Eins! 96, Stichspiele 72 px). Die Stichspiele (Skat, Doppelkopf, Schafkopf, Binokel) zeigen dieselbe Übersicht: Ansagen und Reizen, der Stich klein (`TrickTable`), darunter die Hand.
- - **Anbieten:** Ist ein Tisch-Bildschirm im Raum (`RoomMessage.displays` > 0) und auf dem Gerät noch nichts gewählt (`useHandViewChoice() === null`), erscheint unter dem Spielfeld „Ein Tisch-Bildschirm ist verbunden. Nur die Hand zeigen?“ mit „Hand-Ansicht“ und „Nein“. „Nein“ gilt bis zum Neuladen, der Schalter „Ganzer Tisch“ speichert „aus“ dauerhaft.
- Anlegespiele zeigen statt des Legemusters den Status und die Kartenzahlen (Elf zuerst!), Präsident die Kartenzahlen der anderen und den Hinweis; den Stich bzw. das Muster zeigt der Tisch-Bildschirm.
- Mäxle zeigt nur Becher und Knöpfe (Verlauf und Aufdecken zeigt der Tisch-Bildschirm), Würfelblock Würfel und die eigene Spalte der Tafel.
- **Spiele, deren Züge am Tisch hängen (#214, 10.11.2026):** Schwarzer Peter, Quartett, Domino und Tiefflug haben jetzt ebenfalls eine Hand-Ansicht; das Handy zeigt dort die eigene Hand plus nur die Ziele, die ein Zug braucht:
  - **Schwarzer Peter:** nur die Karten des Nachbarn, von dem gezogen wird (antippen), die übrigen Mitspieler als eine Zeile mit Kartenzahl, die abgelegten Paare entfallen.
  - **Domino:** statt der Kette die beiden Enden als Zahlen mit den Knöpfen zum Anlegen (links, rechts, oben, unten bei Spinnern), dazu Ziehen und Passen.
  - **Tiefflug:** das eigene Raster bleibt groß, Stapel, Ablage und gezogene Karte bleiben; die Raster der anderen entfallen.
  - **Quartett:** Sammeln – Mitspieler antippen und fehlende Karte wählen, ohne Kartenstapel und Fragenverlauf; Trumpf – die eigene Karte mit den Eigenschaften, ohne Stapel der anderen und ohne die aufgedeckten Karten (die zeigt der Tisch-Bildschirm).
- Neue Spiele: `handOnly` auswerten, `handView: true` setzen, eigene CSS-Klassen mit Spielpräfix. Weitere Spiele (Karten-Anlegespiele, Würfelspiele) folgen nach demselben Muster.

## Schritt 2c (umgesetzt für Stichspiele und Tiefflug): Ansicht der Spiele auf dem Tisch-Bildschirm

`BoardProps.display` sagt dem Spielfeld, dass es auf dem Tisch-Bildschirm läuft: kein eigener Platz, keine eigene Hand, alle Plätze gleich. Zuschauer sehen weiter die bisherige Darstellung (der erste Platz als „Ich“).

- **Skat, Doppelkopf, Schafkopf, Binokel:** Der Platz unten zeigt wie die anderen Chip und verdeckten Fächer; „Deine Hand (n Karten)“ entfällt.
- **Tiefflug:** Wer gerade dran ist, sitzt groß unten, die anderen klein darüber (statt immer Platz 0 groß).
- Geprüft auf 1920 × 1080 an vierzehn Spielen; die übrigen sehen als Zuschauer-Darstellung schon passend aus (Mau-Mau, Eins!, Elf zuerst!, Präsident, Schwarzer Peter, Domino, Poker, Marktstände). Mäxle zeigt nur Becher und Verlauf, Quartett nur Kartenzahlen, weil die Karten geheim sind; dort bliebe der Tisch leer, bis aufgedeckt wird.

## Schritt 4 (umgesetzt für den Raum): Spielleiter-Panel

- **Fähigkeiten** (`packages/online/src/capabilities.ts`): `kick`, `rename`, `unseat`, `lockNames`, `restart`. `roomCapabilities(isHost)` füllt sie aus der Raumleitung; das Turnier kann sie später aus Leitung, Mitleitung und Helfer füllen und dasselbe Panel nutzen. Die Liste ist nur Anzeigehilfe, der Server prüft jede Nachricht weiter selbst.
- **Panel** (`apps/web/src/components/ModeratorPanel.tsx`, Eintrag „🛠 Spielleitung“ unter dem Spielfeld, `ModeratorEntry` in `Room.tsx`): Mitglieder mit Platz, Zuschauer-Status, „Computer spielt“ und Verbindung; je Mitglied Namen und Bild festlegen, vom Platz nehmen, entfernen; dazu „Namen festlegen“, „Neu starten“, „Zurück in die Lobby“ und die Zahl der Tisch-Bildschirme. Es zeigt nur, was `capabilities` erlaubt.
- Die Raumleitung braucht **keinen Platz**: In der Lobby muss sie sich nicht setzen, im Spiel sieht sie als Zuschauer alles Offene und moderiert über das Panel (etwa Lehrkraft am Tablet, Tisch-Bildschirm an der Tafel).
- Die frühere Liste „Plätze im Spiel“ (nur vom Platz nehmen) ist im Panel aufgegangen; „Platz übernehmen“ für Zuschauer bleibt am Tisch.
- Getestet im Browser mit Leitung ohne Platz und zwei Gästen: umbenennen, vom Platz nehmen, entfernen (der Gast bekommt „entfernt“).

## Schritt 5 (umgesetzt, #212): Turnier-Bildschirm

- `#/turnier/<Code>/beamer` (`TournamentBeamerScreen` in `Tournament.tsx`, Knopf „📺 Als Turnier-Bildschirm öffnen“ im Zuschau-Block der Turnierseite): nur Ansicht, auf der Bühne des Tisch-Bildschirms (`Stage`, `FullscreenButton`, `useWakeLock` aus `Display.tsx`).
- Vor Ort im Spielbetrieb wechselt die Ansicht alle 20 s zwischen „Als Nächstes“ (laufende Partien mit Tisch, nächste Partien) und „Stand“ (Baum bzw. Tabelle); Tischrunden, Anmeldung und Ende zeigen eine feste Seite (Ende mit Siegerehrung).
- Nutzt das gespeicherte Profil des Geräts, sonst Gast: auf dem Gerät der Leitung läuft es immer, auf einem fremden Gerät nur bei Turnieren mit Zuschaulink.

## Schritt 6 (umgesetzt, #213): Fähigkeiten im Turnier

- `tournamentCapabilities` (`packages/online/src/capabilities.ts`) macht aus der Rolle eines Geräts (`isLeader`, `helperRole`, `mayDelete`, vor Ort oder online) eine Liste im selben Format wie `roomCapabilities`: `entrants`, `tools`, `enterResult`, `checkin`, `print`, `deleteTournament`. Leitung und Mitleitung verwalten, ein Helfer trägt nur vor Ort Ergebnisse ein, setzt Check-in und druckt, gelöscht wird nur von der Hauptleitung. `roomCapabilities` bleibt bei den fünf Raum-Fähigkeiten.
- Die Turnierseite (`Tournament.tsx`, `capsOf`) fragt nur noch `can(…)` statt die Rolle; Mitleitung bekommt einen Hinweis. Der Server prüft weiter jede Nachricht selbst.
- Ein eigenes Panel nach dem Vorbild von `ModeratorPanel` gibt es im Turnier nicht: Teilnehmer und Tische verwaltet die Turnierseite selbst, das Raum-Panel (Namen festlegen, vom Platz nehmen) passt dort nicht.
- **Punkte setzen** (Entscheidung): bleibt Sache der Leitung über `enterResult` bzw. `enterTable` (Plätze oder Punkte im Spiel); ein spielabhängiger `GameModule`-Haken ist nicht nötig, solange vor Ort nur Ergebnis, Punkte oder Plätze zählen.

## Noch offen

- **Fernsehansicht für die übrigen Spiele** nur bei Bedarf: Spiele mit verborgenen Aktionen (Quartett, Mäxle) könnten auf dem Tisch den Verlauf größer zeigen.
- **Weitere Szenen** auf demselben Rahmen: Partie nachspielen (#99, Issue #215); Turnier-Bildschirm siehe Schritt 5.
