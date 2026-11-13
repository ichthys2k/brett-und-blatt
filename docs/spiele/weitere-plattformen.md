# Weitere Plattformen: Brett & Blatt als getrennte Clients (W-064)

13.11.2026 · Erkundung zu [Issue #66](https://github.com/ichthys2k/brett-und-blatt/issues/66)

> Erkunde, inwiefern es mit dem aktuellen Setup möglich wäre, das Spiel „Brett und Blatt“ auch für völlig andere Plattformen anzubieten. Beispielsweise als 3D-App für die Meta Quest, bei der man sich in einem 3D-Raum befindet, mit anderen Spielern treffen kann und dann die Spiele von Brett und Blatt auf einem virtuellen Tisch spielt. Auch ganz andere Varianten wären möglich, wie beispielsweise ein Mod in Factorio, mit dem man dann die Spiele spielt. Erkunde die Möglichkeiten, auch für andere Spiele. Wichtig wäre, dass die Apps getrennt voneinander funktionieren und beispielsweise nur die Spielzüge etc. vom Server abrufen.

## Kurzfassung

**Die heutige Trennung trägt schon weit.** Der Spieleserver rechnet jede Online-Partie vollständig selbst und schickt jedem Platz zwei Dinge: seine Sicht (`view`) und die Liste der Züge, die er gerade machen darf (`legalMoves`). Ein fremder Client muss also **keine Spielregeln kennen**. Er muss nur die Sicht darstellen und einen Zug aus der Liste zurückschicken. Bots laufen auf dem Server, Geheimnisse bleiben dort. Das ist genau der Wunsch „nur die Spielzüge vom Server abrufen“.

Was fehlt, ist vor allem **Beschreibung und Öffnung**: Das Nachrichtenformat ist nur als TypeScript-Typ beschrieben. Sicht und Züge sind je Spiel eigene JSON-Formen ohne Schema. Der Server lässt WebSockets nur von eingetragenen Webseiten zu (`ALLOWED_ORIGINS`).

Meine Empfehlung in dieser Reihenfolge:

1. **Grundlage für alle Clients** (klein bis mittel): Protokoll als Dokument und JSON-Schema veröffentlichen, Zugang für Nicht-Browser-Clients regeln, je Spiel eine kurze Beschreibung von Sicht und Zügen. Erst sie macht fremde Clients möglich, auch solche von anderen Leuten.
2. **Meta Quest als WebXR-Client** (mittel für den Probelauf, groß für den Treffpunkt): eine eigene Web-App `apps/xr` mit Three.js. Sie nutzt `packages/online` und den Spieleserver unverändert und beginnt mit wenigen Brettspielen auf einem 3D-Tisch.
3. **Ein Text-Client als Prüfstein** (klein): ein Kommandozeilen-Client oder Chat-Bot, der jede Partie allein über `legalMoves` spielt. Er beweist, dass die Grundlage reicht, und kostet wenig.

**Nicht empfehlen:** Factorio (Mods dürfen nicht ins Netz), Horizon Worlds (Spiele müssten dort neu entstehen), Roblox (Jugendschutz und Geschäftsmodell passen nicht).

## Was die heutige Trennung schon hergibt

| Baustein | Stand | Bedeutung für fremde Clients |
| --- | --- | --- |
| Spielleitung auf dem Server | Jede Online-Partie läuft im Durable Object `GameRoom` (`apps/server/src/index.ts`) mit `Room` aus `packages/online/src/room.ts`. Der Server prüft jeden Zug. | Ein Client kann nicht schummeln und muss keine Regeln nachbauen. |
| Sicht je Platz | `GameMessage.view` ist schon `playerView` des eigenen Platzes; der Seed geht nie hinaus. | Verdeckte Karten bleiben auch bei fremden Clients geheim. |
| Erlaubte Züge | `GameMessage.legalMoves` enthält nur die Züge, die der eigene Platz gerade machen darf (`room.ts`, um Zeile 1748). | Ein Client kann Züge als Knöpfe oder Ziele anbieten, ohne die Regeln zu verstehen. |
| Zug senden | `{ type: 'move', version, move }`: der Zug als JSON, dazu die zuletzt gesehene Version. | Einfach, ein einziges Nachrichtenformat für alle Spiele. |
| Bots | laufen auf dem Server (`apps/server/src/bots.ts`, `server-bots.ts`) | Ein Client braucht keinen Bot. Nur der Tipp-Knopf rechnet heute im Browser (`OnlineSession.botRunner`). |
| Uhren | `clocks` mit `serverNow`; der Server entscheidet über Zeitablauf (`extrapolateClock` in `client.ts`) | Ein Client zählt nur zur Anzeige weiter. |
| Ereignisse | `GameMessage.events`, schon je Platz gefiltert | Grundlage für Klänge und Animationen in jedem Client. |
| Rollen | Spieler, Zuschauer und Tisch-Bildschirm (`{ type: 'display' }`, [`tisch-bildschirm.md`](tisch-bildschirm.md)) | Ein 3D-Tisch kann als Zuschauer oder Tisch-Bildschirm anfangen, ohne Platz. |
| Wiedereinstieg | `hello` mit geheimem Geräte-Token; Plätze bleiben beim Verbindungsabbruch frei | Gut für wackelige Verbindungen, etwa in VR. |
| Nachspielen | `replay` mit Seed und Zugliste nach Partieende (#99) | Ein Client mit eingebauter Engine kann jede Partie nachspielen. |
| Gesellschaft | Emoji-Reaktionen und Schnellnachrichten (`react`, `say`), kein freier Chat | Passt auch in VR: kein Moderationsproblem durch Text. |
| Breite | 55 Spiele in `onlineGames` (`apps/server/src/games.ts`) | Jedes davon ist sofort über dasselbe Protokoll erreichbar. |
| Engine als Paket | `packages/engine` und alle Spiele sind reines TypeScript ohne Browser-Abhängigkeit | Ein JavaScript-Client (WebXR, Node, Discord) kann sogar die Regeln lokal nutzen, etwa für Hot-Seat in VR oder Zugvorschau. |

## Was fehlt

### 1. Ein beschriebenes, offenes Protokoll

- **Heute:** Das Format steht nur als TypeScript in `packages/online/src/protocol.ts` (`ClientMessage`, `ServerMessage`, `PROTOCOL_VERSION = 1`). Für TypeScript-Clients reicht das. Für C# (Unity), Lua oder Python fehlt eine Beschreibung.
- **Nötig:** ein Dokument `docs/protokoll.md` mit Ablauf (Raum anlegen, verbinden, `hello`, Lobby, Partie, Wiedereinstieg) und ein JSON-Schema, aus `protocol.ts` erzeugt (etwa mit `ts-json-schema-generator`) und in der CI geprüft, damit es nicht veraltet.
- **Aufwand:** klein bis mittel.

### 2. Sicht und Züge je Spiel beschreiben

- **Heute:** `view` und `legalMoves` sind `unknown`. Jedes Spiel hat eigene Typen (etwa `TicTacToeMove = { type: 'place'; cell: number }`), lesbar nur im Quelltext.
- **Nötig:** Für die Spiele, die ein fremder Client zuerst anbietet, ein Schema von Sicht und Zug, wieder aus den Typen erzeugt. Dazu eine **Zugbeschreibung als Text** (etwa „Kreuz auf Mitte“, „Herz-Ass spielen“). Damit kann ein einfacher Client jedes Spiel als Liste von Knöpfen spielen, auch ohne eigene Darstellung. Heute gibt es so etwas nur verstreut in den Oberflächen.
- **Möglicher Baustein:** `GameModule.describeMove?(view, move): string` in der Engine, vom Server mitgeschickt (`legalMoves` plus `labels`). Nützt auch der Barrierefreiheit der Web-App (Bildschirmleser).
- **Aufwand:** klein für die Schnittstelle, je Spiel klein; für alle 55 Spiele zusammen mittel.

### 3. Zugang für Clients, die keine Webseite sind

- **Heute:** `originAllowed` lässt `POST /rooms` und WebSockets nur zu, wenn der `Origin`-Kopf in `ALLOWED_ORIGINS` steht (`apps/server/wrangler.jsonc`). Ein Browser setzt ihn immer, eine Unity-App oder ein Lua-Mod setzt ihn nicht oder beliebig. Der Kopf schützt nur davor, dass fremde Webseiten Besucher unbemerkt in Räume schicken; gegen eigene Programme schützt er nicht.
- **Nötig:** eine Entscheidung. Entweder weitere Origins eintragen (WebXR-Client, Discord-Proxy), oder für Nicht-Browser-Verbindungen ohne `Origin` eine eigene Kennung, etwa `?client=quest-1`, mit eigener Ratenbegrenzung. Kein Geheimnis im Client, denn das ließe sich aus jeder App auslesen.
- **Aufwand:** klein. Zusammen mit [#322](https://github.com/ichthys2k/brett-und-blatt/issues/322) (Härtung, localhost-Origins) entscheiden.

### 4. Treffen im Raum

- **Heute:** Ein Raum kennt Mitglieder, Plätze, Lobby und Partie, aber keine Positionen im Raum, keine Avatare in 3D und keine Sprache.
- **Nötig für den Treffpunkt in VR:** ein flüchtiger Kanal für Kopf- und Handpositionen (etwa 10 bis 20 Nachrichten je Sekunde je Person, nicht im Schnappschuss gespeichert, nicht an Web-Clients) und Sprache. Sprache läuft besser direkt zwischen den Geräten (WebRTC) als über den Worker; der Raum vermittelt nur die Verbindung. Sprache bricht mit der bisherigen Linie „kein freier Chat“ (siehe [`discord.md`](discord.md), Konzept E) und braucht eine eigene Entscheidung zu Alter, Melden und Stummschalten.
- **Kosten:** Positionsdaten treiben die Zahl der Durable-Object-Nachrichten stark hoch; im Gratis-Tarif nur für wenige gleichzeitige Räume tragbar. Vor einer Umsetzung messen.
- **Aufwand:** groß.

### 5. Darstellung je Spiel

- Jeder neue Client braucht für jedes Spiel eine eigene Darstellung. Das ist der eigentliche Aufwand und der Grund, mit wenigen Spielen anzufangen.
- Ein **Notbehelf** für alle übrigen Spiele: Im WebXR-Client kann die vorhandene 2D-Oberfläche als Fläche über dem Tisch erscheinen (die React-Oberfläche in eine Textur gezeichnet, oder ein schwebendes 2D-Fenster neben der 3D-Szene). Das bringt alle 55 Spiele sofort in den Raum, wenn auch flach.

## Einschätzung je Plattform

Aufwand: **klein** bis 3 Tage, **mittel** 1 bis 2 Wochen, **groß** mehr als 2 Wochen. Die Grundlage (Abschnitte 1 bis 3 oben) ist bei allen vorausgesetzt.

| Plattform | Weg | Aufwand | Nutzen | Empfehlung |
| --- | --- | --- | --- | --- |
| Meta Quest: PWA im Store | vorhandene Web-App als App verpacken | klein | mittel | ja, als schneller erster Schritt |
| Meta Quest: WebXR-Client | eigene Web-App mit 3D-Tisch | mittel bis groß | hoch für VR-Runden | ja, als Probelauf |
| Meta Quest: native App (Unity) | C#-Client gegen das Protokoll | groß | hoch, aber nur für VR | erst, wenn WebXR an Grenzen stößt |
| Meta Horizon Worlds | Welt im Editor, TypeScript | groß | gering | nein |
| Text-Client / Chat-Bot | Node-Programm gegen das Protokoll | klein | mittel (Prüfstein, Fernpartien) | ja, als Beweis der Grundlage |
| Discord Activity | Web-App im Sprachkanal | mittel | hoch für Discord-Gruppen | siehe [`discord.md`](discord.md), Konzept D |
| Minecraft (Java, Fabric-Mod) | Java-Mod mit WebSocket | mittel bis groß | mittel | nur, wenn jemand aus der Minecraft-Welt mitbaut |
| Tabletop Simulator | Lua-Mod mit Webanfragen | mittel | gering | nein |
| Factorio | Mod plus Brückenprogramm | groß | gering | nein |
| Roblox | Lua im Roblox-Studio | groß | fraglich | nein |
| Steam / Desktop | Web-App in Tauri oder Electron | klein bis mittel | gering | später, falls gewünscht |
| Android- und iOS-Store | PWA als TWA oder mit Capacitor | klein bis mittel | mittel (Auffindbarkeit) | eigenes Issue wert |

### Meta Quest (Meta Horizon OS)

Die Quest hat drei Wege. Für Brett & Blatt passt der Web-Weg mit Abstand am besten.

**a) Die vorhandene PWA.** Brett & Blatt läuft heute schon im Meta Quest Browser als 2D-Fenster. Meta erlaubt, Webseiten mit einer von Meta angepassten Fassung von Bubblewrap als APK zu verpacken und über den Horizon Store anzubieten ([PWA-Überblick](https://developers.meta.com/horizon/documentation/web/pwa-overview/), [2D-Apps im Store](https://developers.meta.com/vr/blog/building-2d-apps-on-the-meta-horizon-store/)). Ob reine 2D-PWAs im Store schon zugelassen sind oder nur immersive WebXR-PWAs, widerspricht sich in Metas eigenen Seiten; vor einem Antrag prüfen. Aufwand klein, Nutzen: Brett & Blatt ist im Store auffindbar und startet wie eine App.

**b) Ein WebXR-Client (Empfehlung).**

- **Technik:** eine neue Web-App `apps/xr` im Monorepo mit Three.js. Passend zum Stack: React Three Fiber mit `@react-three/xr`, oder Metas *Immersive Web SDK*, das seit September 2025 als Version 1.0 vorliegt und Hand- und Blicksteuerung mitbringt ([Ankündigung](https://developers.meta.com/horizon/blog/immersive-web-sdk-new-era-spatial-web-development), [Mixed](https://mixed-news.com/en/?p=34609)). Neue Fremdbibliotheken in `THIRD_PARTY.md` eintragen.
- **Getrennt, wie gewünscht:** Die XR-App bringt nur `packages/online` (Verbindung, `OnlineSession`) und die Steckbriefe der Spiele mit. Sie verbindet sich mit demselben Spieleserver und denselben Raumcodes. Ein Quest-Spieler und zwei Handy-Spieler können also am selben Tisch sitzen.
- **Erster Probelauf:** ein Raum mit Holztisch, darauf Tic-Tac-Toe, Vier in einer Reihe und Schach als 3D-Figuren. Züge durch Zeigen und Greifen auf die Ziele, die `legalMoves` vorgibt. Die anderen Plätze sitzen als Bild auf einem Stuhl (Avatar-Emoji als Schild). Gegen Bots und online gegen Web-Spieler. Dazu die übrigen Spiele über das 2D-Fenster über dem Tisch.
- **Danach Karten:** Kartenfächer in der Hand, Stich in der Tischmitte. Die Hand-Ansicht (`GameUi.handView`) und der Tisch-Bildschirm zeigen schon, welche Teile wohin gehören.
- **Danach Treffpunkt:** Positionen, Avatare, Sprache (siehe Abschnitt 4 oben). Erst, wenn der Probelauf genutzt wird.
- **Testen:** Entwicklermodus auf der Brille, Seite über HTTPS im Quest Browser öffnen, ohne Store. Mit der WebXR-Emulation im Desktop-Browser geht vieles auch ohne Brille. Der Rauchtest mit Playwright passt nur für die 2D-Teile.
- **Aufwand:** mittel für den Probelauf (etwa 1 bis 2 Wochen), groß für Karten und Treffpunkt.

**c) Eine native App (Unity, Unreal, Godot, Spatial SDK).** Bessere Leistung und mehr Gestaltung, aber ein eigener C#-Client mit eigener Verbindung, eigener Darstellung für jedes Spiel und ohne Wiederverwendung des TypeScript-Codes. Möglich, weil der Server die Regeln kennt; aber nur sinnvoll, wenn der WebXR-Client an Grenzen stößt.

**d) Horizon Worlds.** Welten entstehen im Desktop-Editor und werden in TypeScript programmiert. Ich habe keine Belege gefunden, dass Skripte dort frei ins Netz dürfen. Ohne Netz müsste jedes Spiel innerhalb der Welt neu entstehen, das widerspricht der Vorgabe „getrennt, nur Züge vom Server“. Dazu kommen Metas Bedingungen für Inhalte und Altersgrenzen. Nicht empfohlen.

**Zum TTS-Bericht:** Dort steht VR unter „bewusst nicht nachbauen“ ([`tabletop-simulator.md`](tabletop-simulator.md)). Das galt für VR als Teil der Web-App. Ein getrennter WebXR-Client belastet die Web-App nicht und kann klein anfangen; deshalb fällt die Einschätzung hier freundlicher aus.

### Text-Client und Chat-Bot (Prüfstein)

- **Was:** ein kleines Node-Programm `apps/cli` (oder ein Skript neben `apps/server/scripts/smoke.mjs`), das einen Raum betritt und jede Partie als nummerierte Liste von Zügen anbietet, mit der Zugbeschreibung aus Abschnitt 2.
- **Nutzen:** zeigt, dass ein Client ohne Regeln auskommt. Wird zur Vorlage für alle weiteren Clients und als Test in der CI nützlich. Später als Telegram- oder Matrix-Bot für Fernpartien (Go, Schach) denkbar.
- **Aufwand:** klein.

### Discord Activity

Steht ausführlich in [`discord.md`](discord.md) (Konzept D, etwa 8 bis 10 Tage). Hier nur der Zusammenhang: Die Activity ist die Web-App in einem Rahmen von Discord. Für den Server ist sie ein weiterer Origin (Discords Proxy). Die Grundlage aus diesem Bericht nützt ihr also kaum; sie ist eher ein Verwandter der PWA im Quest-Store.

### Minecraft

- **Java Edition:** Mods (Fabric, NeoForge) sind Java-Programme mit vollem Netzzugang. Ein Mod könnte einen Spieltisch-Block setzen; Rechtsklick öffnet einen Raum, Bretter erscheinen als Blöcke oder Kartenbilder. Machbar, aber eine eigene Java-Codebasis mit Darstellung je Spiel.
- **Bedrock Edition:** Netzzugang (`@minecraft/server-net`) gibt es nur auf dem dedizierten Server, nicht in normalen Welten.
- **Einschätzung:** mittel bis groß; nur lohnend, wenn jemand mitbaut, der Minecraft-Mods kennt.

### Tabletop Simulator

TTS-Lua kann Webanfragen schicken, aber keine dauerhafte WebSocket-Verbindung halten. Ein Mod müsste den Server regelmäßig abfragen; dafür bräuchte der Server eine HTTP-Schnittstelle neben dem WebSocket. Ein regelgeführter Tisch in einem Sandkasten ohne Regeln bringt wenig ([`tabletop-simulator.md`](tabletop-simulator.md)). Nicht empfohlen.

### Factorio

Factorio-Mods dürfen nicht ins Netz; die Lua-Umgebung ist absichtlich abgeschottet, die Entwickler lehnen Netzzugang ab ([Forum](https://forums.factorio.com/viewtopic.php?p=547156)). Hinaus geht nur `helpers.write_file` in den Ordner `script-output` ([Lua-API](https://lua-api.factorio.com/latest/classes/LuaHelpers.html)), hinein nur RCON auf einem eigenen Server. Ein Brückenprogramm müsste beides verbinden, so wie es der Mod Wiretap für Statistiken macht ([Wiretap](https://mods.factorio.com/mod/wiretap?from=updated)). Für Mitspieler auf normalen Mehrspieler-Servern kaum einzurichten, und Spielen über Dateien und RCON wäre zäh. Nicht empfohlen.

### Roblox

Technisch denkbar über Anfragen vom Roblox-Server, aber das Geschäftsmodell (Robux, Plattform-Bindung) und die Jugendschutz-Lage passen nicht zu einem freien Projekt für Schule und Familie. Nicht empfohlen.

### Steam, Android, iOS

Das sind keine neuen Clients, sondern Verpackungen der Web-App (Tauri oder Electron für Steam, Trusted Web Activity oder Capacitor für die App-Stores). Sie brauchen die Grundlage nicht, gehören aber zur Frage „weitere Plattformen“. Für Android ist eine TWA der kleinste Schritt und mit derselben Bubblewrap-Werkzeugkette wie die Quest-PWA zu bauen. Ein eigenes Issue wert, falls gewünscht.

## Vorgeschlagene Schritte

Wenn Cornelius weitermachen will, bekommt jeder Schritt ein eigenes Issue (`status: Idee`), am besten unter einem Vorhaben „Weitere Clients“:

1. **Protokoll offenlegen:** `docs/protokoll.md`, JSON-Schema aus `protocol.ts` in der CI, Entscheidung zum Zugang ohne `Origin`. Klein bis mittel.
2. **Zugbeschreibung:** `describeMove` in der Engine, Server schickt Texte zu `legalMoves` mit, zuerst für zehn Spiele. Klein bis mittel; nützt auch dem Bildschirmleser.
3. **Text-Client als Prüfstein:** `apps/cli`, spielt jede Partie über die Liste. Klein.
4. **Quest-PWA im Store prüfen:** Bubblewrap-Paket, Antrag im Horizon Store. Klein; braucht ein Entwicklerkonto bei Meta.
5. **WebXR-Probelauf:** `apps/xr` mit 3D-Tisch für drei Brettspiele und 2D-Fenster für die übrigen. Mittel.
6. **Später:** Karten in VR, dann Treffpunkt mit Positionen und (nach eigener Entscheidung) Sprache. Groß.

## Offene Fragen an Cornelius

- [ ] Soll es mit der Grundlage (Schritte 1 bis 3) weitergehen, auch ohne festes Ziel-Gerät?
- [ ] Hast du eine Meta Quest zum Ausprobieren, und welche (Quest 2, 3, 3S)?
- [ ] Dürfen fremde Leute eigene Clients gegen den Spieleserver bauen (offenes Protokoll), oder nur eigene Clients aus diesem Repo?
- [ ] Sprache im VR-Raum: grundsätzlich denkbar, oder bleibt es bei Emoji und Schnellnachrichten?

## Quellen

- [Meta: Progressive Web Apps auf Meta Horizon OS](https://developers.meta.com/horizon/documentation/web/pwa-overview/)
- [Meta: 2D-Apps im Meta Horizon Store](https://developers.meta.com/vr/blog/building-2d-apps-on-the-meta-horizon-store/)
- [Meta: WebXR-PWAs](https://developers.meta.com/horizon/documentation/web/pwa-webxr/)
- [Meta: Immersive Web SDK](https://developers.meta.com/horizon/blog/immersive-web-sdk-new-era-spatial-web-development)
- [Meta: GDC 2026, Neues auf Meta Horizon OS](https://developers.meta.com/horizon/blog/gdc-2026-highlights-whats-next-meta-horizon-os/)
- [Mixed: Immersive Web SDK 1.0](https://mixed-news.com/en/?p=34609)
- [Factorio-Forum: HTTP-Anfragen aus Mods](https://forums.factorio.com/viewtopic.php?p=547156)
- [Factorio Lua-API: LuaHelpers (`write_file`)](https://lua-api.factorio.com/latest/classes/LuaHelpers.html)
- [Factorio-Mod Wiretap (Brückenprogramm)](https://mods.factorio.com/mod/wiretap?from=updated)
- [Bedrock Wiki: `@minecraft/server-net`](https://wiki.bedrock.dev/scripting/script-net)
