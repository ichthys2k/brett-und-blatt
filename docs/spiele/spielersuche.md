# Spielersuche: „Ich will spielen“ (W-063, Issue #65)

**Stand 12.11.2026: Konzept, wartet auf Cornelius' Entscheidung.** Nichts davon ist umgesetzt.

## Ziel

Wer Lust auf eine Partie hat, kann das ankündigen („Ich suche Mitspieler“), Spiele vorschlagen und sich mit anderen auf eines einigen – **ohne freien Chat** (Jugendschutz, wie bei den Wortspielen: Freitext nur kurz, gefiltert und nur, wo ein Spiel ihn braucht).

## Was es schon gibt

- **Offene Runden** (`OpenRoomListing`, `OpenRoomDirectory`, Durable Object `LobbyRegistry`, Komponente `OpenRooms.tsx`): Ein Raum steht dort, sobald er öffentlich ist. Der Raum existiert also schon. Wer nur Lust hat, aber noch keinen Raum erstellt hat, kommt nicht vor.
- **Feste Schnellnachrichten und Reaktionen** im Raum (`PHRASES`, `REACTIONS` in `protocol.ts`): Der Server nimmt nur Werte aus der Liste an, mit Abstand und Höchstzahl je Zeitfenster (`SIGNAL_*`). Dieses Muster übernehmen wir.
- Spitznamen- und Wortfilter (`cleanName`, `BLOCKED_WORD_PARTS`) und Profil mit Emoji-Bild.

## Vorschlag in einem Satz

Ein **Schwarzes Brett „Wer hat Lust?“** neben den offenen Runden: Man steckt einen **Zettel** an (Profil + gewünschte Spiele + Spielerzahl, alles aus Auswahllisten), andere tippen ein Spiel an („Ich wäre dabei“), und sobald sich genug Leute auf ein Spiel einigen, entsteht automatisch ein Raum, in den alle per Klick kommen.

## Ablauf

0. **Wo es steht (Cornelius, 12.11.2026):** Das Schwarze Brett hängt im **Hauptmenü links unten**. Es wird eine sechste Station der begehbaren Taverne (`tavern3d.ts`, `TavernStationId` um `board` erweitert, Route z. B. `#/spielersuche`): ein Brett mit angehefteten Zetteln in der linken unteren Ecke der Szene, mit eigenem Menüeintrag in `Menu.tsx` an derselben Stelle (Überfahren hebt die Station hervor, Kamera gleitet beim Öffnen hin wie bei den anderen Stationen). Auf schmalen Bildschirmen (Standbild-Hochformat) erscheint es als Eintrag unten im Menü. Eine kleine Zahl am Brett zeigt, wie viele Zettel hängen. Die Startseite braucht dann keine eigene Karte.
1. **Ankündigen.** Auf der Seite des Schwarzen Bretts (zusätzlich ein Link auf `#/online`): „🙋 Ich hätte Lust zu spielen“. Auswahl, nichts zum Tippen:
   - bis zu **3 Spiele** aus der Spieleliste, die online gehen (oder „Egal, überrascht mich“),
   - **Spielerzahl** (2, 3–4, 5+, egal),
   - **Stimmung** (Emoji-Kette aus fester Liste: „Locker“ 😌, „Ernst“ 🎯, „Mit Kindern“ 🧒 …),
   - Name und Bild aus dem Profil (wie bisher gefiltert).
   Der Zettel hängt **30 Minuten** (verlängerbar per Tipp), danach fällt er weg; „Zurückziehen“ jederzeit.
2. **Zettel ansehen.** Die Liste zeigt Zettel mit Bild, Name, Spielen und Zahl; Filter nach Spiel. Zettel passender Leute stehen oben.
3. **Zustimmen statt schreiben.** Auf jedem Zettel gibt es je Spiel einen Knopf „👍 Bin dabei“. Die Zustimmung gilt diesem Zettel und damit seiner Verfasserin oder seinem Verfasser. Das ist die ganze Abstimmung.
4. **Einigen.** Sobald auf **einem Zettel** für **ein** Spiel genug Zustimmungen da sind (`min` des Spiels, bei Zweispielerspielen also zwei Leute), schlägt das Brett dieses Spiel vor: „🎲 Mau-Mau mit Anna, Ben, Chris – Los geht's?“. Jede beteiligte Person bestätigt mit einem Tipp (Frist 60 s). Bestätigen genug, legt der Server den Raum an, **die Person, die den Zettel geschrieben hat, wird Raumleitung** (entschieden), und alle werden per Link hineingeführt. Wer nicht bestätigt, bleibt auf dem Brett.
5. **Sonderfall Raum existiert schon:** Wer in einer offenen Runde mit freien Plätzen sitzt, kann sie als Zettel „Mitspieler gesucht“ anheften; das ist die bestehende Liste, nur mit Stimmung und Wunschzahl. Hier ändert sich nichts Technisches.

Ohne Chat bleiben Rückfragen (z. B. „Mit Regelvariante X?“) bewusst außen vor; Optionen stellt die Raumleitung in der Lobby ein, wo es schon Schnellnachrichten gibt.

## Schutz

- **Keine Freitexte.** Auswahl aus Listen; einzig Name/Bild aus dem Profil, gefiltert wie bisher.
- **Ratenbegrenzung** je Gerät-Kennung: höchstens 1 Zettel gleichzeitig, Neuanlage frühestens 10 s nach Zurückziehen, höchstens 5 Zustimmungen pro Minute.
- **Obergrenze** des Bretts: z. B. 200 Zettel; ältester fällt zuerst raus.
- **Kein Spieler-Tracking:** nur die geheime Kennung am Server, nie öffentlich; Zettel enthalten keine Ortsangabe.
- **Kinder und Klassen:** Das Brett ist in Klassenräumen und Turnierpartien abgeschaltet; es erscheint nicht, wenn der Server es nicht anbietet. Option für Eltern/Schulen: Gerät-Schalter „Spielersuche ausblenden“ (wie Ausblenden bei Turnieren).
- Meldeknopf entfällt zunächst, da es keine freien Texte gibt; Missbrauch zeigt sich nur über Name/Bild (bestehender Filter).

## Technik (Skizze)

- Kein neues Durable Object, sondern `LobbyRegistry` erweitern (gleiche Live-Verbindung, gleicher Wecker). Zettel als `SeekingNote { id, name, avatar, games[], seats, mood, createdAt, expiresAt, votes: Record<gameId, string[]> }` (Verfasser = spätere Raumleitung) `` in einer neuen Klasse `SeekingBoard` in `packages/online/src/seeking.ts` (ohne Anbieterbindung, Tests mit festem `now`).
- Nachrichten an die Registry (WebSocket): `post`, `withdraw`, `extend`, `join` (Zustimmung), `confirm`, Antwort `board` (ganze Liste, wie `openRooms`) und `match` (Vorschlag mit Frist). Alles über `parse…` geprüft wie in `protocol.ts`; `PROTOCOL_VERSION` bleibt, weil neue Nachrichten, kein bestehendes Format brechen.
- Raum anlegen wie `POST /rooms`, dann Link an die Bestätigten schicken; Teilnehmer treten per `hello` bei, Platz reservieren wir nicht (wer nicht auftaucht, lässt den Platz frei bzw. der Bot springt ein, wie bisher).
- Oberfläche: `components/SeekingBoard.tsx` als Seite in der `TavernPage`-Hülle, neue Station links unten in `tavern3d.ts`/`TavernScene.tsx`/`Menu.tsx` (Test in `tests/tavern3d.test.ts`), Link auf `#/online`; Texte in `i18n.ts`.
- Tests: `seeking.test.ts` (Ablauf, Frist, Raten, Obergrenze), `apps/server/test/…`, Rauchtest `node apps/server/scripts/spielersuche.mjs` mit zwei nachgebauten Browsern (Zettel, Zustimmung, Treffer, Raum).

## Offene Fragen an Cornelius

1. ~~**Öffentlichkeit**~~ **Entschieden (Cornelius, 12.11.2026): Ja, das Brett ist öffentlich** – alle sehen alle Zettel. Mit Gerät-Schalter zum Ausblenden; „private Bretter“ mit Code bleiben eine spätere Möglichkeit.
2. ~~**Wer wird Raumleitung?**~~ **Entschieden (Cornelius, 12.11.2026): wer den Zettel geschrieben hat.** Folge: Zustimmungen zählen je Zettel, nicht je Spiel über alle Zettel; hängen mehrere Zettel mit demselben Spiel, entsteht der Raum beim Zettel, der zuerst genug Zustimmungen hat. Wer zugestimmt hat, ist danach auf anderen Zetteln nicht mehr zustimmend gebucht.
3. ~~**Anonymität**~~ **Entschieden (Cornelius, 12.11.2026): Profilname und Bild reichen**, gefiltert wie bisher (`cleanName`).
4. ~~**Dauer**~~ **Entschieden (Cornelius, 12.11.2026): 30 Minuten** (verlängerbar per Tipp, wie im Ablauf beschrieben).
5. **Stimmungen:** Welche Auswahlwerte sollen es sein (Vorschlag: Locker, Ernst, Mit Kindern, Lernen)?
6. **Umfang der ersten Stufe:** Nur Schritte 1–4 (ohne „Raum existiert schon“-Umbau), kleinster Schnitt, danach Rückmeldung.

## Schritte nach Zustimmung

1. `seeking.ts` mit Tests (Zettel, Zustimmung, Treffer, Fristen, Raten).
2. Registry-Erweiterung und Server-Rauchtest.
3. Station „Schwarzes Brett“ im Hauptmenü links unten und Seite mit Zetteln.
4. Doku nachziehen (`CLAUDE.md` Stand, `docs/KONZEPT.md`), Prüfung durch Cornelius.
