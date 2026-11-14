# Web Push für Partie-Aufrufe und „Du bist dran“ (Konzept #206, Umsetzung #242)

Stand (12.11.2026): **Schritte 1–9 umgesetzt** auf dem Zweig `claude/youthful-carson-mb10am` (Refs #242), noch nicht auf `main`. Offen sind nur noch Dinge, die Cornelius tun muss: Datenschutztext (Entwurf `PushPrivacy` in `Legal.tsx`) ist von Cornelius am 12.11.2026 freigegeben, nicht juristisch geprüft; es bleiben Schlüssel anlegen und die Funktion freischalten (Abschnitt „Freischalten“ unten), Live-Test auf echten Geräten. Ursprünglich entschieden am 10.11.2026 (Abschnitt „Entscheidungen“); der Fahrplan unten ist als Übergabe an andere Agenten geschrieben worden.

Verwandt: Kalenderdatei für feste Termine ([#243](https://github.com/ichthys2k/brett-und-blatt/issues/243), fertig und live), Turniersoftware (`turniersoftware.md`), PWA-Aktualisierung (#175, siehe `CLAUDE.md`).

## Entscheidungen (Cornelius, 10.11.2026)

| Frage | Entscheidung |
|---|---|
| Web Push überhaupt? | Ja, **zusätzlich** zur Kalenderdatei (#206: „Beides“). Die Kalenderdatei kam zuerst. |
| Umfang | **Turniere und Fernpartien.** Turniere: Partie aufgerufen, Frist läuft bald ab, Turnier beginnt/endet. Fernpartien: „Du bist dran“, nur wenn niemand verbunden ist. **Nicht** für normale Online-Räume. **Nachtrag 12.11.2026 (Cornelius: „Ja“):** auch fürs Schwarze Brett (Zusage, Vorschlag, Raum steht), siehe `spielersuche.md`, „Vierte Stufe“. |
| Service Worker | **Kleines Zusatzskript** `push-sw.js`, per `workbox.importScripts` in den bestehenden `generateSW` eingebunden. **Kein** Umbau auf `injectManifest` (schont #175 und den Offline-Betrieb). |
| Fristerinnerung | **Fest 2 Stunden vor Fristende**, eine Erinnerung an alle, die noch fehlen. Keine Einstellung durch die Leitung, keine zweite Stufe. |
| Datenschutz | Claude/der umsetzende Agent **entwirft den Text**, Cornelius liest gegen und entscheidet über eine rechtliche Prüfung. Bis zur Freigabe des Textes bleibt die Funktion **unsichtbar** (kein öffentlicher VAPID-Schlüssel im Build, siehe Schritt 9). |
| Mehrere Geräte | Ein Abonnement gilt **je Gerät** und wird nicht im Spielerpass synchronisiert (die Endpunkt-URL ist gerätegebunden). Wer mehrere Geräte will, schaltet es auf jedem ein. |
| Absenderangabe (VAPID `sub`) | `https://spiele.lipponer.de` statt einer E-Mail-Adresse (Vorschlag; Push-Dienste akzeptieren URL oder `mailto:`). Cornelius kann eine Adresse nachreichen. |
| Nicht entschieden, hier festgelegt | Höchstens **eine Meldung je Person und Ereignisart alle 30 Minuten** (Spam-Schutz); Meldungstexte ohne Namen Dritter; Meldung gilt nur, solange Turnier/Raum bestehen. |

## Ausgangslage

Heute gibt es Hinweise nur bei offener Seite im Hintergrund (Web Notifications, z. B. Go-Fernpartien und Turnierpartien). Sobald der Browser-Tab geschlossen oder die App vom Betriebssystem beendet ist, kommt nichts an. Bei Fernpartien über Tage und Turnieren mit Fristen ist das die größte Lücke.

## Funktionsumfang (Vorschlag)

Ereignisse, für jeweils den betroffenen Menschen, nur auf Wunsch:

| Ereignis | Wer | Wann |
|---|---|---|
| Du bist dran (Fernpartie, Go, Schach über Tage) | Spieler am Zug | wenn der Zug fällig wird, nicht bei jedem Zug einer schnellen Partie (nur wenn niemand verbunden ist) |
| Deine Turnierpartie ist angesetzt / startet | Beide Seiten | beim Aufruf; Erinnerung kurz vor Fristende |
| Frist läuft bald ab | Wer noch fehlt | z. B. 2 Stunden vor Ablauf |
| Turnier hat begonnen / ist zu Ende | Teilnehmer | einmalig |

Nicht Teil des Vorschlags: Werbung, Chat-Inhalte, Sammelhinweise „Es gibt neue Spiele“. Je Nachricht nur ein kurzer Text ohne Namen Dritter („Du bist am Zug in deiner Partie“), damit auf dem Sperrbildschirm nichts Verräterisches steht.

## Technischer Ablauf

1. **Schlüssel:** Ein VAPID-Schlüsselpaar (ES256). Der private Schlüssel liegt als Wrangler-Secret (`VAPID_PRIVATE_KEY`), der öffentliche steht im Build (`VITE_VAPID_PUBLIC_KEY`). Nie ins Repo.
2. **Abonnement:** Auf Wunsch (Knopf „Hinweise aufs Gerät“) fragt die App die Berechtigung an und ruft `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`. Ergebnis: Endpunkt-URL des Push-Dienstes des Browsers plus zwei Schlüssel (`p256dh`, `auth`).
3. **Speicherung:** Das Abonnement geht per WebSocket-Nachricht an den Raum bzw. das Turnier (Durable Object), gebunden an die Geräte-Kennung (`token`) und dort nur, solange die Partie bzw. das Turnier läuft. Es gehört in den Speicher des jeweiligen Objekts, nicht in eine globale Tabelle; wird das Objekt gelöscht, ist auch das Abonnement weg.
4. **Versand:** Fällt ein Ereignis an (Zug fällig, Aufruf, Frist), sendet das Durable Object aus seinem bestehenden Wecker (`alarm`) eine Web-Push-Anfrage (RFC 8030/8291, verschlüsselter Inhalt, VAPID-Kopf) an den Endpunkt. Cloudflare Workers können das mit der Web-Crypto-API selbst; eine kleine Bibliothek (z. B. `web-push`-kompatibel für Workers) oder eigener Code von etwa 150 Zeilen genügt. Antwortet der Push-Dienst mit 404/410, wird das Abonnement gelöscht.
5. **Anzeige:** Der Service Worker der PWA bleibt `generateSW`; ein Zusatzskript `push-sw.js` (per `workbox.importScripts`) zeigt die Nachricht (`push`-Ereignis) und öffnet beim Antippen `#/raum/<Code>` oder `#/turnier/<Code>` (`notificationclick`). **Entschieden: kein `injectManifest`.**
6. **Widerruf:** Knopf „Hinweise ausschalten“ ruft `unsubscribe()` und löscht das Abonnement im Objekt. Wer in den Browser-Einstellungen widerruft, wird beim nächsten Versand durch 410 bereinigt.

## Grenzen je Plattform

- **Android (Chrome, Edge, Firefox):** Funktioniert im Browser und als installierte PWA. Spar-Modi der Hersteller können Hinweise verzögern.
- **iOS/iPadOS (ab 16.4):** Nur für Web-Apps, die **zum Home-Bildschirm hinzugefügt** wurden; im normalen Safari-Tab nicht. Die Berechtigung muss durch eine Nutzeraktion angefragt werden. Dies muss die Oberfläche erklären.
- **Desktop (Chrome, Edge, Firefox, Safari):** Funktioniert, solange der Browser läuft (Chrome/Edge können im Hintergrund laufen).
- **Zuverlässigkeit:** Push ist ein Hinweis, keine Zustellgarantie. Spielregeln dürfen nie davon abhängen, dass ein Hinweis ankam.

## Aufwand und Betriebskosten

- **Entwicklung (Schätzung):** Schlüssel und Secret anlegen, Abonnement-Verwaltung im Raum und im Turnier (mit Tests), Versand mit Verschlüsselung, Service-Worker-Umbau, Einstellungsseite, Hinweise für iOS, Datenschutztext. Etwa 3–5 Arbeitstage mit Tests; der Service-Worker-Umbau ist das Risiko (Updates der PWA, #175).
- **Betrieb:** Der Versand sind kleine ausgehende Anfragen aus dem bestehenden Durable-Object-Wecker. Bei den heutigen Zahlen (wenige Dutzend Hinweise am Tag) bleibt es im Gratis-Kontingent (100 000 Anfragen/Tag für Workers, Subrequests je Aufruf begrenzt). Bei einem Turnier mit 128 Teilnehmern und Fristhinweisen fallen einige hundert Anfragen an. Die Push-Dienste von Google/Apple/Mozilla sind kostenlos.

## Datenschutz (nicht rechtlich geprüft)

- **Gespeichert würde:** Endpunkt-URL, zwei Schlüssel und die Geräte-Kennung je Abonnement, dazu ein Zeitstempel. Die Endpunkt-URL ist ein Pseudonym beim jeweiligen Push-Dienst (Google, Apple, Mozilla, Microsoft); darüber läuft die Zustellung, also eine **Übermittlung an diese Dienste** (Drittland-Thema, daher Eintrag in der Datenschutzerklärung).
- **Dauer:** Bis zum Ende bzw. Löschen der Partie oder des Turniers, spätestens mit Widerruf oder Fehlerantwort 404/410 des Push-Dienstes.
- **Opt-in:** Nur auf ausdrücklichen Knopfdruck, nie beim Seitenaufruf. Der Browser fragt zusätzlich selbst.
- **Widerruf:** Jederzeit in der App und im Browser.
- **Inhalt der Hinweise:** keine Namen Dritter, keine Spielinhalte.
- **Nötig:** Ergänzung der Datenschutzerklärung (Zweck, Empfänger, Dauer, Widerruf) und ein Satz in „Hilfe“. Die Einwilligung ist freiwillig und für das Spielen nicht erforderlich.

## Empfehlung und Alternativen

| Weg | Vorteil | Nachteil |
|---|---|---|
| **A) Web Push (dieses Konzept)** | Hinweis auch bei geschlossener App, kein Konto, keine E-Mail | Aufwand, Service-Worker-Umbau, iOS nur als installierte App, Datenschutztext |
| **B) Erinnerungslink per E-Mail** | Funktioniert überall | Wir bräuchten E-Mail-Adressen und einen Versanddienst, schlechter Datenschutz, widerspricht „ohne Konto“ |
| **C) Kalenderdatei (.ics) mit Fristen** | Keine Schlüssel, keine Speicherung, Hinweis durch das Handy | Nur feste Termine (Fristen, Turnierabend), kein „Du bist dran“ |
| **D) Nur offene Seite (heute)** | Nichts zu tun | Kein Hinweis bei geschlossener Seite |

**Empfehlung:** Erst **C** für Termine (billig, ohne Datenspeicherung), und **A** nur für Fernpartien und Turnierfristen, **wenn** der Bedarf bleibt – in kleinem Umfang (nur „Du bist dran“ bei Fernpartien und „Frist läuft ab“), auf Wunsch und mit Abonnement im jeweiligen Objekt. B nicht.

## Fahrplan für die Umsetzung (Übergabe an einen anderen Agenten)

### Regeln, die vorab gelten

Lies `AGENTS.md` und `CLAUDE.md` (Regeln für die Zusammenarbeit). Kurz das Wichtigste für diese Aufgabe:

- Nur arbeiten, wenn [#242](https://github.com/ichthys2k/brett-und-blatt/issues/242) `status: Ready` hat; vorher einen Reservierungskommentar (`🔒 Übernehme ich: @konto, zweig — Datum`) schreiben. GitHub nur über das GitHub-MCP oder `gh`, nach den Regeln des Repos.
- Eigener Zweig (z. B. `gemini/web-push` oder `claude/web-push`), nie direkt auf `main`; Commit-Adresse `855814+ichthys2k@users.noreply.github.com`; PR mit `Refs #242`, nicht `Fixes`.
- Vor jedem Push `corepack pnpm check` grün. **Nach `main` nur auf Cornelius' Wort „deploy“.**
- **Keine Geheimnisse ins Repo:** der private VAPID-Schlüssel gehört nur als Wrangler-Secret auf den Server und lokal in `apps/server/.dev.vars` (gitignored). Den Schlüssel nie in Chat, Issue oder Commit schreiben.
- Neue Fremdbibliotheken wären in `THIRD_PARTY.md` einzutragen. Empfehlung: **keine** neue Bibliothek, die Krypto läuft über die Web-Crypto-API (Cloudflare Workers und Browser können das).
- Neue Nachrichten zwischen Browser und Server sind **zusätzlich** (nicht abwärtsinkompatibel), `PROTOCOL_VERSION` bleibt also. Ein älterer Server beantwortet sie mit „Unbekannte Nachricht“, das ist hinnehmbar, weil die Oberfläche Push nur anbietet, wenn der Build den öffentlichen Schlüssel hat.
- Arbeitsmuster des Projekts: **Reine Logik in `packages/online` (ohne Anbieterbindung, mit Tests), dünner Adapter in `apps/server/src/index.ts`**. Das Senden hängt als Schnittstelle (`PushSender`) in den Abhängigkeiten, Tests setzen eine Attrappe ein. In Workers steht `Date.now()` während einer Berechnung still; das spielt hier keine Rolle (kleine Anfragen), aber nicht auf Zeitmessung innerhalb einer Rechnung bauen.

### Überblick der Schritte

| Schritt | Inhalt | Wo | Abhängig von |
|---|---|---|---|
| 1 | Datentypen, Prüfung des Abonnements, Abo-Buch | `packages/online/src/push.ts` | – |
| 2 | Krypto und Versand (RFC 8291, VAPID) | `packages/online/src/webpush.ts` | – |
| 3 | Nachrichten im Protokoll | `packages/online/src/protocol.ts`, `tournament/protocol.ts` | 1 |
| 4 | Turnier: Abos halten, Ereignisse, Erinnerung | `packages/online/src/tournament.ts`, `apps/server/src/index.ts` (`TournamentRoom`) | 1, 2, 3 |
| 5 | Fernpartien: „Du bist dran“ | `packages/online/src/room.ts`, `apps/server/src/index.ts` (`GameRoom`) | 1, 2, 3 |
| 6 | Service Worker und Browser-Seite | `apps/web/public/push-sw.js`, `apps/web/vite.config.ts`, `apps/web/src/lib/push.ts` | 3 |
| 7 | Oberfläche (Schalter, iOS-Hinweis) | `apps/web/src/screens/Tournament.tsx`, `Room.tsx`, `#/ton` | 6 |
| 8 | Datenschutzerklärung, Hilfetext | `apps/web/src/screens/Legal.tsx` | – (parallel) |
| 9 | Schlüssel, Rauchtest, Freischaltung | `apps/server/scripts/vapid.mjs`, `push.mjs`, `.github/workflows/ci.yml` | 1–7 |

Die Schritte 1 und 2 sind unabhängig und können parallel entstehen. Jeder Schritt endet mit Tests und einem lauffähigen `corepack pnpm check`.

### Schritt 1 – Datentypen und Abo-Buch (`packages/online/src/push.ts`)

**Ziel:** Alles, was nicht kryptografisch ist.

- Typ `PushSubscriptionData = { endpoint: string; keys: { p256dh: string; auth: string } }`.
- `parsePushSubscription(raw: unknown): PushSubscriptionData | null`: Endpunkt muss `https:` sein, höchstens 600 Zeichen, **Host auf einer Zulassungsliste** (`fcm.googleapis.com`, `updates.push.services.mozilla.com`, Endungen `.push.services.mozilla.com`, `.notify.windows.com`, `web.push.apple.com` und `.push.apple.com`); `p256dh` base64url, dekodiert 65 Byte; `auth` base64url, dekodiert 16 Byte. **Das ist eine Sicherheitsgrenze:** Ohne Zulassungsliste würde der Server beliebige vom Browser genannte Adressen anrufen (SSRF). Für den lokalen Rauchtest darf eine Ausnahme für `127.0.0.1`/`localhost` nur gelten, wenn die Umgebung als Testserver läuft (`ROOM_JURISDICTION === 'none'`), nie im echten Betrieb.
- Klasse `PushBook`: speichert höchstens **ein Abo je Geräte-Kennung** (`token`), höchstens 300 Abos je Objekt; `set(token, sub, now)`, `remove(token)`, `removeByEndpoint(endpoint)`, `get(token)`, `toJSON()`/`fromJSON()` für den Speicher des Durable Object. Zeitstempel je Abo für die Aufräum-Regel.
- Meldungsarten als `type PushKind = 'matchCalled' | 'deadline' | 'tournamentStarted' | 'tournamentFinished' | 'yourTurn'`.
- Spam-Schutz `PushLimiter`: je (Kennung, Art) höchstens eine Meldung in 30 Minuten (`allow(token, kind, now)`).
- `pushPayload(kind, url): string`: kleines JSON `{ k: kind, u: url }`, **ohne Namen oder Spielinhalte**. Der Service Worker baut daraus den sichtbaren Text.

**Tests (`packages/online/test/push.test.ts`):** Zulassungsliste lehnt `http://`, fremde Hosts, `https://evil.example/x`, zu lange Adressen und falsche Schlüssel ab; Buch begrenzt und überschreibt; Limiter lässt nach 30 Minuten wieder zu; Speicher-Rundlauf.

### Schritt 2 – Krypto und Versand (`packages/online/src/webpush.ts`)

**Ziel:** Eine Web-Push-Nachricht ausliefern, nur mit Web Crypto und `fetch`.

- **VAPID (RFC 8292):** JWT (`ES256`) mit `aud` = Ursprung des Endpunkts, `exp` ≤ 12 Stunden, `sub` = `https://spiele.lipponer.de`. Kopf: `Authorization: vapid t=<jwt>, k=<öffentlicher Schlüssel, base64url>`.
- **Verschlüsselung (RFC 8291, `aes128gcm`):** ECDH P-256 mit dem Schlüssel des Empfängers (`p256dh`), HKDF mit `auth`, Inhalt mit Auffüllung und 4096-Byte-Datensatzgröße. Kopfzeilen `Content-Encoding: aes128gcm`, `TTL` (z. B. 3600 für Aufrufe, 7200 für Fristen), `Urgency: normal`, `Topic` (≤ 32 Zeichen, ersetzt eine ältere Meldung derselben Sache, z. B. `m-<Partie>`).
- `interface PushSender { send(sub: PushSubscriptionData, payload: string, opts: { ttl: number; topic?: string }): Promise<'ok' | 'gone' | 'retry' | 'failed'> }` und die Umsetzung `createPushSender({ publicKey, privateKey, subject, fetch })`. Antworten: 201 → `ok`; 404/410 → `gone` (Abo löschen); 429 und 5xx → `retry` (einmal nach Pause, sonst verwerfen); sonst `failed` (nur protokollieren, ohne Endpunkt-URL im Log).
- Schlüsselformat: der private Schlüssel als base64url der 32 Byte (`d`), der öffentliche als 65 Byte unkomprimiert; Hilfsfunktion zum Import als JWK.

**Tests (`packages/online/test/webpush.test.ts`):** Der **Testvektor aus RFC 8291, Abschnitt 5** (Beispiel mit festem Absenderschlüssel und Salt) ergibt genau den dort genannten Chiffretext; VAPID-JWT lässt sich mit dem öffentlichen Schlüssel prüfen; Statuscode-Abbildung mit einer Attrappe für `fetch`.

### Schritt 3 – Nachrichten im Protokoll

- Browser → Server: `{ type: 'pushSubscribe', subscription }` und `{ type: 'pushUnsubscribe' }`. In `tournament/protocol.ts` (Turnier) **und** `protocol.ts` (Raum) mit `parsePushSubscription` prüfen; ungültige Abos mit einer Fehlermeldung ablehnen.
- Server → Browser: `{ type: 'pushState', enabled: boolean }` als Antwort, damit die Oberfläche den Schalter richtig zeigt (auch nach Wiederverbinden).
- Das Abo gehört zur **Geräte-Kennung** des Absenders (`hello.token`), nie zu einer fremden. Die Abo-Daten gehen **nie** an andere Verbindungen und stehen nicht in `TournamentView`/Raumsichten.

**Tests:** Nachrichten werden geprüft, `pushState` kommt nur an den Absender.

### Schritt 4 – Turnier (`TournamentRoom`)

**Speicherung:** Das `PushBook` liegt im Speicher des Durable Object unter dem eigenen Schlüssel `push` (nicht im Turnier-`snapshot`), `ctx.storage.put('push', book.toJSON())`. `deleteTournament` löscht alles mit `storage.deleteAll()`, das Abo verschwindet also mit dem Turnier.

**Ereignisse** (nur online-Turniere, nicht `LOKAL-…` und nicht vor Ort):

| Art | Wann | Empfänger | Anschluss im Code |
|---|---|---|---|
| `matchCalled` | Für eine Partie wurde der Raum angelegt und beide sind angesetzt | beide Seiten (bei Teams alle Mitglieder) | `changed()`: nach `t.roomCreated(...)` |
| `deadline` | `dueAt(...)` minus 2 Stunden; nur für die, die noch nicht „bereit“ waren | wer fehlt | `nextWakeup()` um den Zeitpunkt ergänzen, in `alarm()` auslösen |
| `tournamentStarted` | Phase wechselt von `signup` zu `running` | alle Teilnehmer mit Abo | Wechsel im `Tournament` |
| `tournamentFinished` | Phase `finished` | alle Teilnehmer mit Abo | ebenso |

- Damit nach einem Aufwachen nichts doppelt kommt, merkt sich das Objekt gesendete Meldungen (Schlüssel `art:partie`) im Speicher `push` und räumt sie beim Löschen der Partie auf.
- Die Erinnerung gilt **nicht**, wenn die Frist weniger als 2 Stunden entfernt entsteht (dann nur `matchCalled`).
- Teilnehmer ohne Abo, Zuschauer, Helfer und Leitung bekommen nichts (Leitung hat ihre Sicht).
- **Abo je Kennung zu Teilnehmer:** `playerByToken(token)` bzw. `players[].token` (bei Teams `members[].token`).
- Nach jedem Versand: `gone` → Abo löschen. Fehler dürfen den Turnierablauf nie aufhalten (`try/catch`, kein `await` auf langsamen Versand im Pfad, der Zustand wird zuerst gespeichert).

**Tests (`packages/online/test/tournament-push.test.ts`):** Mit Attrappe für `PushSender` und fester Uhr: Aufruf erzeugt zwei Meldungen, Erinnerung genau einmal 2 Stunden vor Fristende und nur für Fehlende, Start/Ende einmalig, Limiter greift, Abo-Entzug, Löschen räumt auf, Turnier ohne Abo sendet nichts.

### Schritt 5 – Fernpartien (`GameRoom`)

- Voraussetzung: `room.isCorrespondence()` (Bedenkzeit ≥ 12 Stunden oder Option `correspondence`).
- **Ereignis `yourTurn`:** Nach einem Zug (`broadcastGame` in `packages/online/src/room.ts`) gilt: Für jeden Platz, der neu am Zug ist, dessen Mitglied **keine Verbindung** hat (`member.connections.size === 0`) und ein Abo besitzt, geht `yourTurn`. Wer verbunden ist, bekommt wie bisher die Meldung im Browser (`notifyTurn`).
- Abos liegen im Speicher des `GameRoom` (Schlüssel `push`), gelöscht mit dem Raum (`storage.deleteAll()` beim Aufräumen nach 30 Tagen).
- Auch hier der 30-Minuten-Limiter und ein Eintrag in `alarm()` ist nicht nötig (kein Zeitpunkt, nur Zugwechsel).
- **Nicht** für normale Online-Räume und nicht für Turnierpartien (dort gilt Schritt 4).

**Tests (`packages/online/test/room-push.test.ts`):** Fernpartie, Mitglied getrennt → eine Meldung; Mitglied verbunden → keine; normale Partie → keine; Limiter; Abo wird mit dem Raum gelöscht.

### Schritt 6 – Service Worker und Browser-Seite

- `apps/web/public/push-sw.js`: `self.addEventListener('push', …)` liest `{k,u}` und zeigt `registration.showNotification(titel, { body, tag: k + u, icon: 'icons/icon-192.png', data: { url: u } })`. Deutsche Texte nach Art: `matchCalled` „Deine Turnierpartie ist bereit“, `deadline` „Die Frist deiner Partie läuft bald ab“, `tournamentStarted` „Das Turnier hat begonnen“, `tournamentFinished` „Das Turnier ist beendet“, `yourTurn` „Du bist am Zug“. **Keine Namen.** `notificationclick`: `clients.matchAll({ type: 'window' })`, ein vorhandenes Fenster fokussieren und zur Adresse navigieren, sonst `clients.openWindow(scope + '#/…')`.
- `apps/web/vite.config.ts`: bei `workbox` `importScripts: ['push-sw.js']`, die Datei liegt in `public/` und wird kopiert. **Prüfen:** `dist/sw.js` enthält den Aufruf; `registerType: 'prompt'` bleibt; das Aktualisierungsverhalten (#175, `appUpdate.ts`) ändert sich nicht; Solo-Betrieb ohne Netz funktioniert weiter (Rauchtest).
- `apps/web/src/lib/push.ts` (Browser-Seite): `pushSupported()` (Service Worker, `PushManager`, `Notification`), `pushNeedsInstall()` (iOS im Safari-Tab: `navigator.userAgent` iOS und nicht `display-mode: standalone`), `enablePush()` (fragt `Notification.requestPermission()` **nur auf Knopfdruck**, `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, sendet `pushSubscribe`), `disablePush()` (`unsubscribe()` + `pushUnsubscribe`), Zustand je Gerät in `localStorage` (`brett-und-blatt:push`, mit `try/catch`). Nach jedem Wiederverbinden (`hello`) das Abo erneut melden, falls aktiviert, weil Endpunkte wechseln können; Ereignis `pushsubscriptionchange` im Service Worker fürs Erneuern.
- Der öffentliche Schlüssel kommt aus `import.meta.env.VITE_VAPID_PUBLIC_KEY`. **Ohne ihn ist Push in der Oberfläche unsichtbar** (gleiches Muster wie `VITE_GAME_SERVER`).

**Tests (`tests/push-client.test.ts`):** reine Teile (Erkennung, Zustandsablage, Umwandlung des Schlüssels `urlBase64ToUint8Array`); Service-Worker-Texte als reine Funktion testbar machen (`pushTexts`).

### Schritt 7 – Oberfläche

- **Schalter „Hinweise aufs Gerät“** mit kurzer Erklärung: im Turnier (`Tournament.tsx`, für Teilnehmer, nicht für Zuschauer), im Raum (`Room.tsx`, nur bei Fernpartien) und auf `#/ton` (Gesamtschalter mit Liste). Zustände: nicht verfügbar (versteckt), „Hinweise einschalten“, „Hinweise sind an – ausschalten“, „Vom Browser blockiert“ (mit Hinweis, wo man es freigibt).
- **iOS-Hinweis** (`pushNeedsInstall()`): „Auf dem iPhone geht das nur, wenn du die Seite zum Home-Bildschirm hinzufügst und von dort öffnest.“
- Satz „Ein Hinweis ist keine Zustellgarantie – verlass dich nicht darauf.“ und Link zur Datenschutzerklärung.
- UI-Texte deutsch in `apps/web/src/i18n.ts`.

### Schritt 8 – Datenschutzerklärung und Hilfe (`apps/web/src/screens/Legal.tsx`)

Entwurf für einen neuen Abschnitt „Hinweise aufs Gerät (Web Push)“; **Cornelius liest gegen und entscheidet über eine rechtliche Prüfung**:

- **Zweck:** Hinweise auf aufgerufene Turnierpartien, ablaufende Fristen und „Du bist dran“ bei Fernpartien, nur auf ausdrücklichen Wunsch (Knopf), freiwillig, fürs Spielen nicht nötig.
- **Gespeichert wird:** Endpunkt-Adresse des Push-Dienstes, zwei Schlüssel für die Verschlüsselung, die Geräte-Kennung und ein Zeitstempel, im Speicher des Turniers bzw. des Raums bei Cloudflare (EU).
- **Empfänger:** Der Browser-Hersteller betreibt den Push-Dienst (Google, Apple, Mozilla, Microsoft), über den die verschlüsselte Meldung läuft; dabei kann eine Übermittlung in Drittländer stattfinden. Der Inhalt enthält keine Namen und keine Spielinhalte.
- **Dauer:** bis zum Ende oder Löschen des Turniers bzw. Raums, spätestens bei Widerruf oder wenn der Push-Dienst das Abo als ungültig meldet.
- **Widerruf:** jederzeit in der App („ausschalten“) und in den Browsereinstellungen.
- Dazu ein Satz in der Hilfe und ein Verweis im Abschnitt „Online-Partien über Cloudflare“.
- Der Abschnitt darf schon im Code stehen, solange die Funktion unsichtbar bleibt (Schritt 9). Veröffentlichung nur auf „deploy“.

### Schritt 9 – Schlüssel, Rauchtest, Freischaltung

1. `apps/server/scripts/vapid.mjs` erzeugt ein Schlüsselpaar und gibt beide Teile aus (privat nur zur direkten Eingabe in `wrangler secret put VAPID_PRIVATE_KEY`, nie speichern oder loggen). Öffentlicher Schlüssel und `sub` als Konfiguration: `VAPID_PUBLIC_KEY` (`wrangler.jsonc` `vars`, nicht geheim) und `VAPID_SUBJECT`.
2. `Env` in `apps/server/src/index.ts` um `VAPID_PRIVATE_KEY?`, `VAPID_PUBLIC_KEY?`, `VAPID_SUBJECT?` erweitern. **Fehlt ein Teil, ignoriert der Server Abos** (Muster wie `GOOGLE_CLIENT_ID`).
3. `.github/workflows/ci.yml`: im Build `VITE_VAPID_PUBLIC_KEY: ${{ vars.VAPID_PUBLIC_KEY }}` neben `VITE_GAME_SERVER` ergänzen. Solange die GitHub-Variable `VAPID_PUBLIC_KEY` leer ist, bleibt die Funktion unsichtbar. **Das ist der Schalter für die Freigabe.**
4. Rauchtest `node apps/server/scripts/push.mjs` gegen den lokalen Wrangler-Server mit einem kleinen **Attrappen-Push-Dienst** (HTTP-Server auf `127.0.0.1`, nur im Testserver erlaubt): Abo anmelden, Turnier mit Aufruf, Erinnerung (Zeit durch kurze Fristen beschleunigen), Fernpartie mit getrenntem Mitglied, 410-Antwort löscht das Abo. Das Skript gehört zu `docs/spiele/turniersoftware.md`/`CLAUDE.md` wie `turnier.mjs`.
5. **Prüfen auf echten Geräten (Cornelius, nicht automatisierbar):** Android-Chrome (Seite geschlossen, Meldung kommt, Antippen öffnet das Turnier), iPhone als installierte App, Desktop. Dazu Widerruf in den Browsereinstellungen.
6. Wrangler-Migration: **keine nötig**, solange kein neues Durable-Object-Gerüst entsteht (die Abos liegen in `TournamentRoom` und `GameRoom`). Entsteht doch eines, Migration `v12` anlegen.

### Fertig, wenn (Abnahme durch Cornelius, Status `Review`)

- [x] Schritte 1–9 umgesetzt, `corepack pnpm check` grün, Rauchtest `push.mjs` grün
- [x] Ohne gesetzte Variable `VAPID_PUBLIC_KEY` ist Push in der Oberfläche unsichtbar und der Server ignoriert Abos
- [x] Entwurf der Datenschutzerklärung von Cornelius gelesen und freigegeben (12.11.2026; keine rechtliche Prüfung)
- [ ] Auf echten Geräten geprüft (Android, iPhone als installierte App, Desktop)
- [x] `CLAUDE.md` (Abschnitt Turniere) und `turniersoftware.md` mit einem Satz zum Stand ergänzt

### Risiken und Fallen

- **SSRF über Abo-Adressen:** Zulassungsliste (Schritt 1) ist Pflicht, nie freie URLs anrufen.
- **Service Worker:** Eine fehlerhafte `push-sw.js` kann das Registrieren des ganzen Service Workers brechen und damit den Offline-Betrieb. Rauchtest und `dist/sw.js` prüfen; im Zweifel Skript klein halten.
- **iOS:** Berechtigung nur nach Nutzeraktion und nur in der installierten Web-App; ältere Versionen (vor 16.4) bieten nichts an.
- **Datenschutz:** Meldungen ohne Namen und Inhalte; Endpunkt-Adresse nie loggen oder in Sichten geben.
- **Doppelte Meldungen** nach dem Aufwachen eines Durable Object: Merkmal im Speicher `push` (Schritt 4).
- **Zeit:** Fristen sind absolute Zeiten (`dueAt`); Erinnerung = `dueAt − 2 h`, nicht aus Relativzeiten berechnen.
- **Keine Zustellgarantie:** Spielregeln und Fristen dürfen nie davon abhängen, dass eine Meldung ankam.

### Aufwand

Etwa 3–5 Arbeitstage mit Tests (Schätzung aus dem Konzept bleibt): Schritte 1–2 je 0,5 Tage, 3–5 zusammen etwa 1,5 Tage, 6–7 etwa 1 Tag, 8–9 etwa 0,5 bis 1 Tag. Das größte Risiko ist der Service Worker (Schritt 6).

## Umsetzungsstand und Abweichungen (12.11.2026)

Gebaut nach dem Fahrplan, mit diesen Abweichungen:

- **Aufruf (`matchCalled`):** kommt schon, wenn die Partie offen ist und beide angesetzt sind (am Turnierabend ohne „Bereit“: beim Start der Partie), nicht erst bei der Raumanlage. Die Raumanlage folgt erst auf „Bereit“ beider Seiten, dann wäre die Meldung sinnlos.
- **Gemerkte Meldungen** gelten je Empfänger (`art:anlass:kennung`); wer sich erst später anmeldet, bekommt nichts über Vergangenes (`claimSilently`). Je Durchlauf höchstens 25 Sendungen (Grenze für Unteranfragen), der Rest folgt per Wecker nach 10 Sekunden.
- **Meldung „Du bist dran“** lebt bis zu 24 Stunden beim Push-Dienst (Fernpartie-Züge warten Tage), Aufrufe 1 Stunde, Fristen 2 Stunden.
- **`RoomMessage.correspondence`** (neu, optional): sagt den Browsern, dass der Raum eine Fernpartie ist; nur dann gibt es den Schalter.
- **`#/ton`:** Gesamtschalter ohne Liste der Turniere und Räume (das Gerät kennt sie nicht); Ausschalten beendet das Abo im Browser, die Server räumen beim nächsten Versand über 404/410 auf. Eine Verbindung meldet das Abo beim nächsten Öffnen von selbst neu, wenn das Gerät Hinweise wünscht.
- **Nicht umgesetzt:** Abo entfernen, wenn jemand ein Turnier verlässt oder sich zurückzieht (er bekommt dann nichts mehr, das Abo bleibt bis zum Turnierende).
- **Die Erinnerung zwei Stunden vor Fristende** lässt sich im Rauchtest nicht beschleunigen (eine kürzere Frist erzeugt keine Erinnerung); sie deckt `packages/online/test/tournament-push.test.ts` ab.
- **Datenschutz:** `PushPrivacy` in `Legal.tsx` erscheint nur, wenn die Funktion sichtbar ist (`VITE_VAPID_PUBLIC_KEY`).
- **Bekannt, nicht neu:** Turnier- und Raumseite fragen schon beim Öffnen die Berechtigung für normale Browser-Benachrichtigungen an (`requestNotificationPermission`); das widerspricht dem Grundsatz „Push nie beim Seitenaufruf“ nicht, sollte aber mit entschieden werden.

## Freischalten (Cornelius)

Bis die GitHub-Variable `VAPID_PUBLIC_KEY` gesetzt ist, ist die Funktion unsichtbar und der Server ignoriert Abos.

1. Schlüsselpaar anlegen und den privaten Teil als Secret ablegen, ohne ihn anzuzeigen: `node apps/server/scripts/vapid.mjs --put` (ruft `wrangler secret put VAPID_PRIVATE_KEY`; das Skript gibt nur den öffentlichen Schlüssel aus). Ohne Wrangler-Anmeldung auf dem Rechner: `node apps/server/scripts/vapid.mjs` zeigt beide Teile, den privaten dann direkt mit `corepack pnpm --filter @brett-und-blatt/server exec wrangler secret put VAPID_PRIVATE_KEY` eingeben und nirgends sonst speichern.
2. GitHub-Variablen (Settings → Variables → Actions) setzen: `VAPID_PUBLIC_KEY` (der öffentliche Schlüssel, nicht geheim) und optional `VAPID_SUBJECT` (Standard `https://spiele.lipponer.de`). Die CI gibt sie an den Build der Web-App (`VITE_VAPID_PUBLIC_KEY`) und an den Worker (`wrangler deploy --var …`).
3. Datenschutzabschnitt: freigegeben (12.11.2026). Er erscheint mit der Funktion, sobald die Variable gesetzt ist.
4. Danach `deploy`: neuer Build und neuer Worker. **Wird die Variable später wieder geleert, ist die Funktion mit dem nächsten Deploy aus.**
5. Live-Test (nicht automatisierbar): Android-Chrome (Seite geschlossen, Meldung kommt, Antippen öffnet das Turnier), iPhone als installierte App, Desktop; Widerruf in den Browsereinstellungen.

Lokal ausprobieren: `node apps/server/scripts/vapid.mjs --dev` (schreibt `apps/server/.dev.vars`, steht in `.gitignore`), Server starten (`WRANGLER_SEND_METRICS=false corepack pnpm --filter @brett-und-blatt/server dev`), dann `node apps/server/scripts/push.mjs`. Für die Oberfläche lokal die Web-App mit `VITE_VAPID_PUBLIC_KEY=<öffentlicher Schlüssel aus der Ausgabe>` bauen oder starten.

## Wo steht was im Code (Hilfe für den Einstieg)

| Thema | Datei |
|---|---|
| Browser-Benachrichtigungen heute | `apps/web/src/lib/notifications.ts`, Aufrufe in `lib/online.ts`, `screens/Tournament.tsx`, `screens/Room.tsx` |
| Turnier-Objekt, Wecker, Aufruf von Partien | `apps/server/src/index.ts` (`class TournamentRoom`, `changed()`, `alarm()`), `packages/online/src/tournament.ts` (`nextWakeup`, `roomCreated`, `tick`) |
| Frist einer Partie | `packages/online/src/tournament/online-play.ts` (`dueAt`, `deadlineOutcome`) |
| Teilnehmer und ihre Kennungen | `packages/online/src/tournament/types.ts` (`TournamentPlayer.token`, `members`) |
| Raum, Fernpartie, Mitglieder | `packages/online/src/room.ts` (`isCorrespondence`, `Member.connections`, `broadcastGame`) |
| Protokolle | `packages/online/src/protocol.ts`, `packages/online/src/tournament/protocol.ts` |
| PWA-Konfiguration | `apps/web/vite.config.ts` (`VitePWA`, `workbox`) |
| Muster „Feature nur mit Secret sichtbar“ | `apps/server/src/oidc.ts`, `Env` in `apps/server/src/index.ts` (`GOOGLE_CLIENT_ID`) |
| Datenschutzerklärung | `apps/web/src/screens/Legal.tsx` |

## Offene Punkte für Cornelius

1. Freigabe: #242 auf `status: Ready` setzen (erst dann beginnt die Umsetzung).
2. Secrets setzen: `wrangler secret put VAPID_PRIVATE_KEY` (Schlüssel erzeugt `vapid.mjs`), GitHub-Variable `VAPID_PUBLIC_KEY` und `VAPID_SUBJECT` (Vorschlag `https://spiele.lipponer.de`).
3. Den Entwurf der Datenschutzerklärung lesen und über eine rechtliche Prüfung entscheiden.
4. Live-Test auf echten Geräten.
