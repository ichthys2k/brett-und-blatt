# Spielersuche: „Ich will spielen“ (W-063, Issue #65)

**Stand 12.11.2026: Konzept, alle sechs Fragen von Cornelius entschieden (siehe unten); wartet auf sein Wort zur Umsetzung.** Nichts davon ist umgesetzt.

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
5. ~~**Stimmungen**~~ **Entschieden (Cornelius, 12.11.2026): Locker, Ernst, Mit Kindern, Lernen.**
6. ~~**Umfang der ersten Stufe**~~ **Entschieden (Cornelius, 12.11.2026): Brett, Zettel, „Bin dabei“ und automatischer Raum.** Das Anheften bestehender offener Runden als Zettel (Ablauf Punkt 5) kommt später.

## Erweiterung: Entscheidung am Rundenende (Cornelius, 12.11.2026; Issue #298)

**Wunsch:** Jede Spielergruppe – egal ob über das Schwarze Brett zusammengekommen oder über „Online spielen“ in einen Raum gekommen – entscheidet **am Ende einer Runde gemeinsam**, wie es weitergeht:

- 🚪 **Aussteigen**
- 🔁 **Nochmal** mit gleichen Regeln (Revanche)
- 🎲 **Anderes Spiel** – dafür braucht es eine **Abstimmung** am Rundenende.

**Heute:** Nach Partieende entscheidet allein die Raumleitung (`start` mit `rotate`, `toLobby`; Knöpfe unter dem Spielfeld und in der Siegerehrung). Die anderen können nur zusehen oder gehen. Der Wunsch macht daraus eine Entscheidung der Gruppe.

### Ablauf (Vorschlag)

1. Mit dem Ergebnis erscheint am Tisch und in der Siegerehrung die Leiste **„Wie geht's weiter?“** mit drei Knöpfen: Aussteigen, Nochmal, Anderes Spiel. Jeder Mensch mit Platz stimmt einmal ab und kann bis zum Schluss umstimmen; die anderen sehen als Zähler, wie viele wofür sind (nicht wer – bis zur Entscheidung).
2. **Aussteigen** wirkt sofort für die Person (sie verlässt den Raum, wie „Verlassen“ heute) und zählt nicht mehr mit. Die übrigen entscheiden weiter. Wer sitzen bleibt, stimmt für Nochmal oder Anderes Spiel.
3. **Anderes Spiel:** Wer dafür stimmt, wählt zugleich ein Spiel aus der **Kandidatenliste**. Die Liste füllt sich ohne Freitext: jede Person darf **ein** Spiel vorschlagen (Auswahl aus den online spielbaren, nicht-Entwurf-Spielen, die zur Zahl der Verbliebenen passen, `min ≤ n ≤ max`), dazu steht immer „🎲 Zufällig“ darin. Höchstens 4 Kandidaten; wer eins vorschlägt, hat damit schon dafür gestimmt. Danach kann jede Person ihre Stimme auf einen Kandidaten legen.
4. **Auswertung**, sobald alle abgestimmt haben oder nach **30 s** (Nichtstimmen zählt als Enthaltung):
   - **Mehrheit** der abgegebenen Stimmen unter den Verbliebenen gewinnt zwischen Nochmal und Anderes Spiel; bei Gleichstand gilt **Nochmal** (die kleinste Änderung).
   - Gewinnt Nochmal: die Partie startet sofort neu, bei zwei Plätzen mit Farb-/Platzwechsel wie heute (`rotate`). Die Raumleitung muss nichts drücken.
   - Gewinnt Anderes Spiel: der Raum geht in die Lobby, das gewählte Spiel mit Standardoptionen ist eingestellt, die Leute behalten ihre Plätze; die Raumleitung stellt Optionen ein und startet wie gewohnt. Bei mehreren Kandidaten gewinnt der mit den meisten Stimmen, bei Gleichstand zieht der Server den Sieger zufällig.
5. **Bots** stimmen nie; ihre Plätze bleiben. Zuschauer stimmen nicht ab.
6. Die Knöpfe der Raumleitung bleiben als **Abkürzung** erhalten (Host darf sofort entscheiden); so funktioniert es auch mit älteren Browserständen, die die Abstimmung noch nicht kennen.
7. **Ausgenommen:** Turnierpartien (`match`) und Räume, in denen nur Bots oder eine Person sitzen.

### Technik (Skizze)

- Im Raum (`packages/online/src/room.ts`) ein neuer Zustand `afterGame` nach `result`: `{ votes: Record<memberId, 'again' | 'other' | 'leave'>, proposals: gameId[], picks: Record<memberId, gameId>, deadline }`, nie im Schnappschuss der Sicht verraten, welche Person was gewählt hat (nur Zähler, bis die Entscheidung fällt). Die Frist läuft über `room.nextWakeup()` wie die anderen Fristen.
- Neue Nachrichten (nur Menschen mit Platz): `afterVote { choice }`, `afterPropose { gameId }`, `afterPick { gameId }`; Antwort als neues Feld in `RoomMessage` (`afterGame` mit Zählern, Kandidaten, Frist und der eigenen Stimme). Alle Werte werden wie `PHRASES` gegen feste Listen geprüft; keine Freitexte.
- Ratenbegrenzung wie bei den Signalen. `PROTOCOL_VERSION` bleibt, weil die Änderung nur Neues ergänzt; ältere Browser sehen die Leiste nicht und nutzen weiter die Knöpfe der Raumleitung.
- Oberfläche: Leiste `AfterGameBar` in `OnlineParts.tsx` unter dem Spielfeld und in `Ceremony.tsx`; Texte in `i18n.ts`.
- Tests: Auswertung (Mehrheit, Gleichstand, Aussteigen, Frist, Bots, Zuschauer), Rauchtest `node apps/server/scripts/rundenende.mjs` mit drei nachgebauten Browsern (Abstimmung zu Nochmal; zu anderem Spiel; Aussteigen).
- **Unabhängig vom Schwarzen Brett:** Gilt für jeden Raum, also auch ohne Brett. Darum als eigener Schritt, der zuerst kommen kann.

### Offene Fragen dazu

1. ~~**Mehrheit oder alle?**~~ **Entschieden (Cornelius, 12.11.2026): einfache Mehrheit der Abstimmenden, bei Gleichstand Nochmal.**
2. ~~**Frist**~~ **Entschieden (Cornelius, 12.11.2026): 30 Sekunden.** Stimmt niemand ab, bleibt der Raum wie heute am Spielfeld stehen (Vorschlag, nicht widersprochen).
3. **Eigenes Issue?** Der Wunsch gilt für alle Räume und ist größer als das Brett. Vorschlag: eigenes Issue „Online: Abstimmung am Rundenende“ (`status: Idee`, bis du es freigibst), #65 verweist darauf.
4. ~~**Reihenfolge**~~ **Entschieden (Cornelius, 12.11.2026): 1. Abstimmung am Rundenende (#298), 2. Anfrage für Neue (#299), 3. Schwarzes Brett (#65).**

## Erweiterung: Laufende Runde offen für Neue (Cornelius, 12.11.2026; Issue #299)

**Wunsch:** Eine laufende Session kann **offen für neue Spieler** sein. Neue **fragen an**, ob sie **ab der nächsten Runde** mitspielen dürfen; **die Raumleitung (Spielleiter) entscheidet**.

**Heute:** Wer den Link oder Code kennt (oder in „Offene Runden“ klickt), kommt als **Zuschauer** in den Raum (bis 40 Mitglieder). In der Lobby kann man sich auf einen freien Platz setzen (`takeSeat`); in einer laufenden Partie nur, wenn das Spiel `joinMidGame` kann (Poker) oder ein Platz verwaist ist. Sonst bleibt nur Zusehen, bis die Raumleitung etwas tut. Eine Anfrage gibt es nicht.

### Ablauf (Vorschlag)

1. **Einstellung der Raumleitung:** „Neue Spieler dürfen anfragen“ (aus/an, in Lobby und Spiel umschaltbar). Bei „an“ steht der Raum in „Offene Runden“ auch während der Partie, mit dem Zusatz „läuft – Anfrage möglich“ (bisher nur mit freien Plätzen in der Lobby, zu prüfen). Die Raumleitung bleibt die einzige Stelle, die entscheidet.
2. **Anfragen:** Wer als Zuschauer im Raum ist, sieht den Knopf „🙋 Ich möchte ab der nächsten Runde mitspielen“. Ein Tipp schickt die Anfrage (kein Text, keine Begründung); „Zurückziehen“ geht jederzeit. Ein Zuschauer hat höchstens eine offene Anfrage.
3. **Entscheiden:** Die Raumleitung sieht ein Zeichen am Spielleiter-Knopf (`ModeratorPanel`) und eine Liste mit Bild und Name der Fragenden: **✅ Annehmen** / **❌ Ablehnen** (und „Alle annehmen“). Ohne Entscheidung bleibt die Anfrage bis zum Rundenende offen und verfällt dann **nicht**, sondern erinnert dort noch einmal.
4. **Angenommen:** Die Person ist **vorgemerkt** (für alle sichtbar mit Bild und Name in der Mitgliederliste: „ab nächster Runde dabei“). Mitten in der Runde ändert sich nichts am Tisch – keine Geheimnisse, keine Uhr, kein Zugriff auf die laufende Partie.
5. **Nächste Runde:** Beim Start der nächsten Runde (Revanche oder Neustart) bekommen Vorgemerkte der Reihe nach einen **freien oder neu geöffneten Platz**; die Plätze steigen dazu bis `max` des Spiels (`setSeatCount`), danach bleibt der Rest auf der **Warteliste** (höchstens 30) und rückt nach, wenn jemand aussteigt. Bei Spielen mit Teams ordnet die Raumleitung die Neuen in der Lobby zu (`setTeam`, `shuffleTeams`); Spiele mit fester Spielerzahl (z. B. nur zu zweit) bieten die Funktion gar nicht an.
6. **Abgelehnt:** Die Person sieht „Leider nicht dabei“ und bleibt Zuschauer; neue Anfrage frühestens nach 2 Minuten. Wer zu oft nervt, kann wie heute entfernt werden (`kick`).
7. **Verbindung zur Abstimmung am Rundenende:** Vorgemerkte dürfen dort **mit abstimmen** (Vorschlag), weil sie in der nächsten Runde mitspielen; das ändert auch die Zahl der Verbliebenen für die Kandidatenliste (`min ≤ n ≤ max`).
8. **Verbindung zum Schwarzen Brett:** Ein Zettel kann auf eine **laufende** Runde zeigen („Plätze frei, Anfrage möglich“); wer dort „Bin dabei“ tippt, schickt damit die Anfrage.
9. **Ausgenommen:** Turnierpartien, Klassenräume (dort setzt die Lehrkraft Plätze selbst) und Spiele mit eigener Mitspielerlogik (Poker: bleibt bei `joinSeat`).

### Technik (Skizze)

- Im Raum (`room.ts`) je Mitglied `join?: 'asking' | 'queued'` (mit Zeit für die Reihenfolge), Raumeinstellung `acceptRequests`. Neue Nachrichten: `askToJoin`, `cancelAskToJoin` (Zuschauer), `answerJoin { memberId, ok }` (nur Raumleitung); `MemberInfo.join` zeigt für alle, wer vorgemerkt ist, und für Raumleitung und Anfragenden den Stand „fragt an“. Bei Raumleitungswechsel (nach 60 s) gehen offene Anfragen auf die neue Leitung über.
- Plätze verteilen beim Start einer neuen Runde in `start`/Revanche; bestehende Plätze bleiben unverändert. Anzeige in der Lobby und im `ModeratorPanel`; Fähigkeit in `roomCapabilities` ergänzen.
- Alles Auswahl, kein Freitext; Ratenbegrenzung je Kennung (eine offene Anfrage, 2 Minuten Sperre nach Ablehnung). `PROTOCOL_VERSION` bleibt (nur Neues dazu); ältere Browser sehen die Anfrage-Knöpfe nicht.
- Tests: Anfrage, Zurückziehen, Annehmen/Ablehnen, Zuteilung zur nächsten Runde, Warteliste, Leitungswechsel; Rauchtest `node apps/server/scripts/anfrage.mjs` (Raum mit laufender Partie, Zuschauer fragt an, Leitung nimmt an, Revanche setzt ihn an den Tisch).

### Offene Fragen dazu

1. ~~**Standard**~~ **Entschieden (Cornelius, 12.11.2026): an für öffentliche Räume, aus für private.**
2. ~~**Mit abstimmen**~~ **Entschieden (Cornelius, 12.11.2026): Ja, Vorgemerkte stimmen am Rundenende mit ab.**
3. ~~**In „Offene Runden“**~~ **Entschieden (Cornelius, 12.11.2026): Ja, laufende Runden stehen dort mit „läuft – Anfrage möglich“.**
4. ~~**Warteliste**~~ **Entschieden (Cornelius, 12.11.2026): höchstens 30 Plätze.** Reihenfolge: wie vorgeschlagen die Reihenfolge der Annahme (nicht umsortierbar), sofern du nichts anderes willst.

## Schritte nach Zustimmung

1. `seeking.ts` mit Tests (Zettel, Zustimmung, Treffer, Fristen, Raten).
2. Registry-Erweiterung und Server-Rauchtest.
3. Station „Schwarzes Brett“ im Hauptmenü links unten und Seite mit Zetteln.
4. Doku nachziehen (`CLAUDE.md` Stand, `docs/KONZEPT.md`), Prüfung durch Cornelius.
