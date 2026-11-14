# Brett & Blatt VR (WebXR-Probelauf)

Stand 13.11.2026 · [Issue #339](https://github.com/ichthys2k/brett-und-blatt/issues/339) · Vorhaben [#333](https://github.com/ichthys2k/brett-und-blatt/issues/333)

Eine eigene Web-App für die Meta Quest (und jeden Browser mit WebGL): ein Tisch in der Taverne, an dem man mit denselben Raumcodes wie auf spiele.lipponer.de spielt – gegen Freunde am Handy, am Rechner, in der Brille oder gegen Server-Bots.

- **Adresse:** https://vr.spiele.lipponer.de, sobald die Unterdomain eingerichtet ist (siehe unten). Immer erreichbar unter https://brett-und-blatt-vr.pages.dev; der erste Probelauf lag unter https://brett-und-blatt-xr.lipponer.workers.dev.
- **Code:** `apps/xr` – React Three Fiber mit `@react-three/xr`. Die App kennt **keine Spielregeln**: Sie spricht nur das [offene Protokoll](protokoll.md) mit dem Spieleserver und nutzt aus `packages/online` nur Typen und Listen (Avatare, Reaktionen, Raumcodes).

## So spielt man

1. In der Quest den Browser öffnen, die Adresse aufrufen, Name und Bild wählen.
2. **Neuen Raum anlegen** oder den **Raumcode** einer Runde eingeben. Ein Link mit `#<Raumcode>` führt direkt in den Raum.
3. In der Lobby (Leiste rechts oder 2D-Fenster über dem Tisch) wählt die Raumleitung eines der 55 Online-Spiele (im Fenster mit ◀ ▶, in Zehnerschritten mit ⏪ ⏩), besetzt Plätze mit Bots und beginnt.
4. **In VR betreten** – oder auf der Quest 3 **In Mixed Reality betreten**: Dann bleibt deine echte Umgebung sichtbar (Passthrough), und nur Tischplatte, Kerzen, Karten und Menü schweben vor dir (#369). Gezogen wird durch Zeigen mit dem Controller (Abzug) oder Antippen mit dem Finger.

| Spiel | Darstellung |
| --- | --- |
| Tic-Tac-Toe, Vier in einer Reihe, Schach, Dame, Mühle, Reversi, Gomoku, Go | 3D-Figuren auf dem Tisch. Leuchtende Ziele sind die erlaubten Züge. Bei Schach und Dame erst die Figur, dann das Ziel; bei Mühle nach einer Mühle den Stein antippen, der weg soll. Passen, Auszählen (Go) und Ähnliches stehen im 2D-Fenster. |
| Mau-Mau, Eins!, Skat, Doppelkopf, Schafkopf, Binokel, Präsident, Speed, Schwarzer Peter, Elf zuerst!, Poker | Karten in der Hand (#350, #358): Der eigene Fächer steht vor dir an der Tischkante; spielbare Karten leuchten und werden durch Antippen gespielt. Ablage und Nachziehstapel (zum Ziehen antippen) bzw. der Stich liegen in der Tischmitte, die Karten der anderen als aufrechter Fächer an ihren Plätzen (#366). Gespielte, gezogene und ausgeteilte Karten fliegen sichtbar von der Hand bzw. vom Stapel an ihren Platz. Hat eine Karte mehrere Möglichkeiten (Bube mit Wunschfarbe, Farbwahl, Handtausch), erscheinen Knöpfe zur Wahl; beim Skat-Drücken tippst du zwei Karten an und bestätigst. Wer mehrere Karten auf einmal spielt (Präsident, Binokel drücken), tippt sie nacheinander an und wählt dann den Knopf. Bei Schwarzer Peter leuchten die verdeckten Karten des Nachbarn zum Ziehen. Bei Speed liegen zwei Stapel in der Mitte, bei Elf zuerst! die Farbreihen, beim Poker die Gemeinschaftskarten und der Pot. Reizen, Ansagen und Einsätze stehen im 2D-Fenster. |
| Ultimate Tic-Tac-Toe, Teiler-Duell, Schiffe versenken, Vierer-Schach, Sternhalma, Nicht ärgern! (#358) | Ultimate Tic-Tac-Toe: das Feld, in dem du spielen musst, leuchtet. Teiler-Duell: Zahlenplättchen in der Farbe ihres Besitzers. Schiffe versenken: links die eigene Flotte, rechts das Feld des Gegners mit den Zielen. Vierer-Schach: deine Farbe liegt vorn, erst Figur, dann Ziel. Sternhalma: deine Zacke liegt vorn. Nicht ärgern!: Laufstrecke als Ring mit Häusern außen und Zielen innen, gewürfelt wird über den Knopf in der Mitte. |
| Domino, Wortgitter, Farbe & Form, Grafschaft (#358) | Domino: Kette in der Mitte, eigene Steine vorn zum Antippen, Ziehen über den Knopf am Stapel. Wortgitter und Farbe & Form: ein leuchtendes Feld antippen, dann aus den Wörtern bzw. Reihen wählen, die es berühren. Grafschaft: erst ein Plättchen vom Markt vorn wählen, dann den leuchtenden Platz. Tauschen und Passen stehen im 2D-Fenster. |
| Würfelblock, Mäxle, Paare finden, Tiefflug (#358) | Würfel bzw. Karten auf dem Tisch. Beim Würfelblock hält Antippen einen Würfel; Würfeln über den Knopf rechts, Eintragen im Fenster. Beim Tiefflug liegt dein Raster vorn, Stapel und Ablage in der Mitte. |
| Schätzmeister, Zeitstrahl, Wort-Salat, Kategorien-Sprint, Verboten!, Rechenmauer, Zielzahl, Enten-Rallye, Fix gefunden! (#358) | Eingabe schräg vor dir: Zahlenfeld, Tastatur (bei Kategorien-Sprint erst die Kategorie wählen), Reihenfolge antippen, Rechnung aus Zahl, Zeichen, Zahl, bei Fix gefunden! das gemeinsame Symbol auf deiner Karte. Die Beispielzüge des Servers stehen dann nicht im Fenster, weil sie teils die Lösung enthalten (`apps/xr/src/scene/input-spec.ts`). |
| alle übrigen Online-Spiele (#358) | **Spieltafel** auf dem Tisch mit dem Stand (Frage und Antworten, Galgenmännchen-Wort, Bingo-Karte, eigene Quartett-Karte, Marktstände …), gezogen wird über die Knöpfe mit den Zugtexten im Fenster. |

**Alles in der Brille (#349):** Das 2D-Fenster über dem Tisch kann alles, was die Leiste kann. In der Lobby wählt die Raumleitung mit ◀ ▶ das Spiel, ändert die Platzzahl und schaltet freie Plätze durch: frei → Bot leicht → mittel → schwer → frei. In der Partie gibt es dort Aufgeben (mit Rückfrage), Remis anbieten (Schach, Dame), die Bitte ums Zurücknehmen samt Abstimmung und **„💬 Nachricht“** für die Schnellnachrichten. Unter **„↕ Tisch“** stellt man Tischhöhe und Abstand ein (bleibt im Gerät gespeichert) und die Lautstärke. Neu ausrichten geht wie immer mit gedrückter Meta-Taste; danach (und beim Eintreten) setzt sich der Tisch mittig vor den Kopf, mit den Augen über der Tischplatte (#365). Bei vielen Plätzen zeigt die Lobby sie seitenweise, das Fenster bleibt über der Tischplatte (#364). Uhren stehen als „⏱ 0:42“ auf den Schildern.

**Klänge:** Züge, Schlagen, Mühle, Sieg und „Du bist dran“ klingen wie in der Web-App. Die Dateien kommen nur beim Bauen aus dem privaten Klang-Repo (`apps/xr/klaenge.ts`, Auswahl in `apps/xr/src/sound-names.ts`); ohne sie bleibt die App stumm.

**Treffpunkt (#351):** Wer mit Brille im Raum ist, erscheint bei den anderen Brillen als **Figur** mit Kopf (das Avatar-Emoji als Gesicht), Händen und einem Schild mit Avatar und Name vor der Brust. Kopf und Hände laufen direkt zwischen den Brillen (WebRTC), der Spieleserver vermittelt nur. Klappt keine direkte Verbindung, wird nach zehn Sekunden einmal je Sekunde nur der Kopf über den Server geschickt. Wer am **Handy oder Rechner** spielt, sitzt weiter als **Schild am Stuhl**, ohne Figur, mit „am Zug“, Uhr und Reaktionen.

**Sprachchat (#352):** In privaten Räumen über **„🎙 Sprache“** im Fenster über dem Tisch oder in der Leiste: Mitsprechen, Stumm, Aussteigen und Melden. Melden schaltet den Sprachchat für alle bis zur nächsten Partie ab. In der Leiste kann man außerdem einzelne Mitspieler für sich stumm schalten. Wer spricht, zeigt 🔊 auf Schild bzw. Brustschild. Handy- und Web-Spieler sprechen über den Knopf 🎙 neben den Reaktionen mit.

Mitspieler stehen als Schild mit Avatar-Emoji über ihrem Stuhl. Emoji-Reaktionen schickt man über die Leiste an der eigenen Tischkante; sie schweben über dem Schild der Person. Sprache gibt es bewusst nicht (später nur in privaten Räumen, siehe [weitere-plattformen.md](spiele/weitere-plattformen.md)).

Ohne Brille läuft dieselbe Seite im Browser: Klick auf die Ziele im Bild oder auf die Zugliste in der Leiste rechts (auch für Bildschirmleser).

## Entwickeln

```bash
corepack pnpm --filter @brett-und-blatt/server dev
```

```bash
corepack pnpm --filter @brett-und-blatt/xr dev
```

Dann http://localhost:5175/?server=http://127.0.0.1:8787 öffnen. Im Entwicklungsbetrieb bildet `@react-three/xr` eine Quest 3 nach (IWER), so lässt sich „In VR betreten“ auch am Rechner ausprobieren; der Build enthält diesen Nachbau nicht. `?server=` wählt den Spieleserver, sonst gilt `VITE_GAME_SERVER` aus dem Build oder der echte Server.

Gemischte Partie zum Nachprüfen (XR-App gegen die Web-App im Handyformat, dazu ein Server-Bot):

```bash
corepack pnpm --filter @brett-und-blatt/xr build && corepack pnpm --filter @brett-und-blatt/xr preview
```

```bash
cd apps/web && VITE_GAME_SERVER=http://127.0.0.1:8787 corepack pnpm exec vite build && corepack pnpm exec vite preview
```

```bash
node apps/xr/test/gemischt.mjs mau-mau
```

Die Lastmessung steht in [weitere-plattformen.md](spiele/weitere-plattformen.md#gemessene-last-13112026-339).

## Veröffentlichen

- Die CI baut die App bei jedem Push.
- **Nur auf `main`, also nach „deploy“**, lädt der Job „VR-App auf Cloudflare veröffentlichen“ die statischen Dateien zu **Cloudflare Pages** hoch (Projekt `brett-und-blatt-vr`, beim ersten Lauf angelegt). Er läuft nach dem Spieleserver und hält die Web-App nicht auf. Von Hand: `corepack pnpm --filter @brett-und-blatt/xr build`, dann `corepack pnpm --filter @brett-und-blatt/xr run deploy`.
- Die Origins `https://vr.spiele.lipponer.de` und `https://brett-und-blatt-vr.pages.dev` (dazu die alte Probe-Adresse unter workers.dev) stehen in `ALLOWED_ORIGINS` des Spieleservers (`apps/server/wrangler.jsonc`).

**Warum Pages und kein Worker:** Das DNS von `lipponer.de` liegt bei Strato, nicht bei Cloudflare. Eine Custom Domain für einen Worker verlangt die Zone bei Cloudflare (erster Versuch scheiterte mit „Can't infer zone from route“). Pages nimmt dagegen eine Unterdomain per CNAME von einem fremden DNS-Anbieter.

### Umweg-Server (TURN) für den Treffpunkt, nur bei Bedarf

Scheitern direkte Verbindungen zwischen Brillen oft (etwa in Schul- oder Firmennetzen), kann der Spieleserver Zugangsdaten für den TURN-Server von Cloudflare ausgeben (`GET /rtc/ice`):

1. Im Cloudflare-Dashboard unter *Realtime → TURN Server* einen TURN-Schlüssel anlegen.
2. Die beiden Werte als Secrets des Spieleservers setzen, nie ins Repo oder in den Chat:
   - `corepack pnpm --filter @brett-und-blatt/server exec wrangler secret put TURN_KEY_ID`
   - `corepack pnpm --filter @brett-und-blatt/server exec wrangler secret put TURN_KEY_API_TOKEN`
3. Fertig; ohne die Secrets bleibt es beim freien STUN-Server. Die ersten 1 000 GB im Monat sind frei.

### Einmalig einrichten

1. **Token:** Im Cloudflare-Dashboard unter *My Profile → API Tokens* beim Token der CI (*⋯ → Edit*) in der bestehenden Account-Policy das Recht **„Cloudflare Pages: Edit“** ergänzen (Bereich *Developer Platform*). „Workers Scripts: Edit“ bleibt. Zonenrechte sind nicht nötig.
2. **Deploy** abwarten (oder den Job in GitHub mit *Re-run failed jobs* wiederholen). Danach gibt es unter *Workers & Pages* das Pages-Projekt `brett-und-blatt-vr`, erreichbar unter https://brett-und-blatt-vr.pages.dev. Hängt Cloudflare an den Namen ein Kürzel an, weil `brett-und-blatt-vr.pages.dev` schon vergeben ist, diese Adresse melden – sie muss dann in `ALLOWED_ORIGINS`.
3. **Domain im Pages-Projekt:** `brett-und-blatt-vr` → *Custom domains* → *Set up a custom domain* → `vr.spiele.lipponer.de` → *Continue*. Cloudflare zeigt dann den CNAME-Eintrag, den es erwartet.
4. **Bei Strato:** Im Kundenlogin unter *Domains → Domainverwaltung* bei `lipponer.de` die Subdomain `vr.spiele` anlegen, dann in deren *DNS-Verwaltung* einen **CNAME-Record** auf `brett-und-blatt-vr.pages.dev` setzen (so wie `spiele` auf GitHub Pages zeigt). Lässt Strato keine Subdomain unter `spiele` zu, stattdessen `vr.lipponer.de` nehmen und hier Bescheid geben, damit der Origin angepasst wird.
5. Nach einigen Minuten meldet Cloudflare im Pages-Projekt die Domain als *Active* und stellt das Zertifikat aus.

Den alten Worker `brett-und-blatt-xr` (erster Versuch) kann man danach im Dashboard löschen; seine Adresse fällt dann bei Gelegenheit aus `ALLOWED_ORIGINS`. Den Worker **`brett-und-blatt`** nie anfassen – das ist der Spieleserver.

## Grenzen des Probelaufs

- Die Figuren sind schlicht (Kopf, Hände, Körper); Finger und Mimik gibt es nicht.
- Der Kartenfächer schwebt vor dir; an der Hand oder am Controller hängt er noch nicht, und Karten werden angetippt statt gegriffen. Kartenblitz, Quartett, Marktplatz, Drachenspiel, Narrenhof und Wölfe im Schafspelz laufen über Spieltafel und Fenster, noch ohne eigene Figuren.
