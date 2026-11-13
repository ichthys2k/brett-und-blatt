# Online-Protokoll für eigene Clients

Stand 13.11.2026 · Protokollversion **1** · [Issue #334](https://github.com/ichthys2k/brett-und-blatt/issues/334)

Der Spieleserver von Brett & Blatt ist offen: Neben der Web-App dürfen auch eigene Programme Räume anlegen und mitspielen, etwa eine Quest-App, ein Kommandozeilen-Client oder ein Mod. Das ist kostenlos, braucht keine Anmeldung und geschieht ohne Gewähr.

**Das Wichtigste vorweg:** Ein Client muss **keine Spielregeln kennen**. Der Server leitet jede Partie selbst. Er schickt jedem Platz seine eigene Sicht (`view`) und die Liste der Züge, die dieser Platz gerade machen darf (`legalMoves`). Ein Client zeigt die Sicht an, wählt einen Zug aus der Liste und schickt ihn unverändert zurück. Bots laufen auf dem Server, verdeckte Karten bleiben dort.

- **Nachrichtenformat als JSON-Schema:** [`protokoll.schema.json`](protokoll.schema.json). Es ist aus [`packages/online/src/protocol.ts`](../packages/online/src/protocol.ts) erzeugt und maßgeblich; diese Seite erklärt den Ablauf.
- **Server:** `https://brett-und-blatt.lipponer.workers.dev`. Lokal startet ihn `corepack pnpm --filter @brett-und-blatt/server dev` (http://127.0.0.1:8787).
- **Beispiel:** [`apps/server/scripts/smoke.mjs`](../apps/server/scripts/smoke.mjs) spielt unter anderem als fremder Client eine Partie gegen einen Bot.

## Zugang

| Wer | Wie | Bemerkung |
| --- | --- | --- |
| Webseite | Der Browser schickt `Origin`. | Nur eingetragene Seiten (`ALLOWED_ORIGINS`). Eine weitere Webseite bitte als Issue anfragen. |
| Programm ohne Webseite | **kein** `Origin`, dafür `?client=<name>` an jeder Adresse | `<name>`: 3 bis 40 Zeichen aus `a–z`, `0–9` und `-`, nicht mit `-` am Anfang oder Ende, z. B. `mein-quest-client`. |

- Die Kennung ist **öffentlich und kein Geheimnis**. Sie dient nur der Ratenbegrenzung. Bitte einen Namen wählen, der den eigenen Client erkennbar macht.
- Ein vorhandener, nicht eingetragener `Origin` wird immer abgelehnt, auch mit Kennung.
- **Ratenbegrenzung** für Programme: höchstens 40 Nachrichten am Stück, danach 8 je Sekunde. Darüber verwirft der Server Nachrichten und meldet höchstens einmal je Sekunde `{ "type": "error", "code": "tooFast" }`.
- **Regeln wie in der Web-App:** kein freier Text. Gesellschaft gibt es nur über die festen Listen `REACTIONS` (Emoji) und `PHRASES` (Schnellnachrichten). Namen werden gekürzt und geprüft (höchstens 16 Zeichen), Avatare müssen aus `AVATARS` stammen, sonst gilt der erste. Nachrichten haben höchstens 16 000 Zeichen.

## Ablauf

### 1. Raum anlegen oder Code bekommen

```http
POST /rooms?client=mein-client
Content-Type: application/json

{ "isPublic": false }
```

Antwort `201` mit `{ "code": "🐻🦊🌈🚀" }`. Ein Raumcode besteht aus vier Emoji (`ROOM_EMOJIS` in `packages/online/src/codes.ts`) und muss in Adressen URL-kodiert werden.

- `GET /rooms/<Code>?client=…` ohne WebSocket antwortet mit `{ "exists": true | false }`.
- `GET /rooms/open?client=…` liefert die öffentlichen offenen Räume (`OpenRoomListing[]`).

### 2. Verbinden und anmelden

WebSocket auf `wss://…/rooms/<Code>?client=mein-client`. Die erste Nachricht ist immer `hello`:

```json
{ "type": "hello", "protocol": 1, "token": "zufällige-kennung-mindestens-16-zeichen", "name": "Ada", "avatar": "🦊" }
```

- `token` ist die **geheime Kennung dieses Geräts** (16 bis 100 Zeichen, zufällig erzeugen und sicher aufbewahren). Wer mit demselben Token wiederkommt, bekommt seinen Platz zurück (Wiedereinstieg). Das Token nie anzeigen oder weitergeben.
- Antwort: `{ "type": "welcome", "protocol": 1, "you": "m1", "serverNow": … }`, danach sofort eine `room`-Nachricht. Das erste Mitglied leitet den Raum (`hostId`).
- Ein Tisch-Bildschirm ohne Platz meldet sich stattdessen mit `{ "type": "display", "protocol": 1 }` an und bekommt nur die Zuschauersicht.

### 3. Lobby

Der Server schickt nach jeder Änderung die ganze `room`-Nachricht: Phase, Mitglieder und `lobby` mit Spiel, Optionen, Zeit und Plätzen. Wichtige Nachrichten des Clients:

| Nachricht | Wer | Wirkung |
| --- | --- | --- |
| `{ "type": "setGame", "gameId": "tic-tac-toe" }` | Raumleitung | Spiel wählen; die ids stehen in `packages/games/*/src/meta.ts` |
| `{ "type": "setSeat", "index": 1, "seat": { "bot": "easy" } }` | Raumleitung | Platz mit einem Bot (`easy`, `medium`, `hard`) oder `"open"` besetzen |
| `{ "type": "takeSeat", "index": 0 }` / `{ "type": "leaveSeat" }` | alle | sich setzen oder aufstehen |
| `{ "type": "setOption", "id": "…", "value": "…" }`, `setTime`, `setSeatCount` | Raumleitung | Einstellungen |
| `{ "type": "start" }` | Raumleitung | Partie beginnen |

Die übrigen Nachrichten (Teams, Rechte, Rauswurf, Anfragen ums Mitspielen) stehen im Schema unter `ClientMessage`.

### 4. Partie

In der Partie schickt der Server nach jeder Änderung eine `game`-Nachricht (`GameMessage`). Die wichtigsten Felder:

| Feld | Bedeutung |
| --- | --- |
| `version` | zählt jede Änderung; ein Zug nennt die Version, die der Client zuletzt gesehen hat |
| `yourSeat` | eigener Platz (0, 1, …) oder `null` als Zuschauer |
| `view` | die eigene Sicht, je Spiel verschieden (siehe unten) |
| `legalMoves` | die Züge, die der eigene Platz **jetzt** machen darf; leer, wenn er nicht dran ist |
| `current` | wer gerade am Zug ist |
| `clocks`, `serverNow` | Uhrenstände; der Client zählt zur Anzeige selbst weiter, der Server entscheidet |
| `events` | was seit der letzten Nachricht passiert ist, schon für diesen Platz gefiltert (für Klänge und Animationen) |
| `result` | Ergebnis, sobald die Partie zu Ende ist |
| `replay` | nach dem Ende Seed und Zugliste zum Nachspielen |

Ein Zug:

```json
{ "type": "move", "version": 7, "move": { "type": "place", "cell": 4 } }
```

`move` ist **ein Eintrag aus `legalMoves`, unverändert**. Ist die Version veraltet, antwortet der Server mit `error`/`staleMove`, bei einem unerlaubten Zug mit `illegalMove`. Danach auf die nächste `game`-Nachricht warten. Weitere Nachrichten: `resign` (aufgeben), `takeBack` und `answerTakeBack` (Zurücknehmen mit Zustimmung, nur bei offenen Spielen), `react` und `say` (Emoji und Schnellnachrichten), `toLobby` (Raumleitung) und `ping` (der Server antwortet mit `pong` und seiner Uhrzeit).

**Sicht und Züge je Spiel:** `view` und die Einträge von `legalMoves` sind je Spiel eigenes JSON. Bis es Beschreibungen und Zugtexte gibt (#335), helfen die Typen im Spielordner: `packages/games/<id>/src/rules.ts`, zum Beispiel bei Tic-Tac-Toe:

```ts
interface TicTacToeMove { type: 'place'; cell: number } // Felder 0–8 zeilenweise
```

Ein Client kann aber jedes Spiel auch ohne dieses Wissen spielen, indem er die Einträge von `legalMoves` als Liste zur Wahl stellt.

### 5. Fehler und Verbindungsabbruch

- `{ "type": "error", "code": …, "message": … }`. `code` ist einer von `badMessage`, `protocol`, `notAllowed`, `roomFull`, `badName`, `notReady`, `staleMove`, `illegalMove`, `tooLate` oder `tooFast`; `message` ist ein deutscher Text für Menschen.
- Bricht die Verbindung ab, bleibt der Platz frei. Nach 20 Sekunden gilt er als abwesend; bei Zeitablauf zieht ein Bot. Mit demselben `token` neu verbinden und `hello` schicken.
- Räume ohne Verbindung werden nach 24 Stunden gelöscht, Fernpartien nach 30 Tagen.

## Versionen

- `protocol` in `hello` nennt die Version des Clients. Der Server versteht alle Versionen von `MIN_PROTOCOL_VERSION` bis `PROTOCOL_VERSION`, sonst antwortet er mit `error`/`protocol`.
- **Neue Felder und neue Nachrichtentypen** erhöhen die Version nicht. Clients sollen unbekannte Felder und unbekannte `type`-Werte still übergehen.
- **Änderungen, die alte Clients brechen**, erhöhen `PROTOCOL_VERSION`. Die alte Version bleibt eine Übergangszeit lang erlaubt (Richtwert: drei Monate) und wird hier unter „Änderungen“ beschrieben.
- Das Schema `protokoll.schema.json` erzeugt `node scripts/protokoll-schema.mjs`; ein Test (`tests/protokoll-schema.test.ts`) lässt die CI scheitern, wenn es nicht mehr zum Code passt.

## Änderungen

| Datum | Version | Änderung |
| --- | --- | --- |
| 13.11.2026 | 1 | Protokoll offengelegt: Zugang ohne `Origin` mit `?client=…`, Ratenbegrenzung, Fehlercode `tooFast` |

## Lizenz

Der Server-Code steht unter AGPL-3.0. Ein eigener Client, der nur über dieses Protokoll mit dem Server spricht und keinen Code aus diesem Repo übernimmt, ist davon nicht betroffen und kann unter jeder Lizenz stehen. Wer Code aus dem Repo übernimmt, etwa `packages/online` oder die Spielmodule, muss die AGPL-3.0 einhalten.
