# Brett & Blatt VR (WebXR-Probelauf)

Stand 13.11.2026 · [Issue #339](https://github.com/ichthys2k/brett-und-blatt/issues/339) · Vorhaben [#333](https://github.com/ichthys2k/brett-und-blatt/issues/333)

Eine eigene Web-App für die Meta Quest (und jeden Browser mit WebGL): ein Tisch in der Taverne, an dem man mit denselben Raumcodes wie auf spiele.lipponer.de spielt – gegen Freunde am Handy, am Rechner, in der Brille oder gegen Server-Bots.

- **Adresse:** https://vr.spiele.lipponer.de, sobald die Unterdomain eingerichtet ist (siehe unten). Immer erreichbar unter https://brett-und-blatt-vr.pages.dev; der erste Probelauf lag unter https://brett-und-blatt-xr.lipponer.workers.dev.
- **Code:** `apps/xr` – React Three Fiber mit `@react-three/xr`. Die App kennt **keine Spielregeln**: Sie spricht nur das [offene Protokoll](protokoll.md) mit dem Spieleserver und nutzt aus `packages/online` nur Typen und Listen (Avatare, Reaktionen, Raumcodes).

## So spielt man

1. In der Quest den Browser öffnen, die Adresse aufrufen, Name und Bild wählen.
2. **Neuen Raum anlegen** oder den **Raumcode** einer Runde eingeben. Ein Link mit `#<Raumcode>` führt direkt in den Raum.
3. In der Lobby (Leiste rechts oder 2D-Fenster über dem Tisch) wählt die Raumleitung das Spiel, besetzt Plätze mit Bots und beginnt.
4. **In VR betreten.** Gezogen wird durch Zeigen mit dem Controller (Abzug) oder Antippen mit dem Finger.

| Spiel | Darstellung |
| --- | --- |
| Tic-Tac-Toe, Vier in einer Reihe, Schach, Dame, Mühle, Reversi, Gomoku, Go | 3D-Figuren auf dem Tisch. Leuchtende Ziele sind die erlaubten Züge. Bei Schach und Dame erst die Figur, dann das Ziel; bei Mühle nach einer Mühle den Stein antippen, der weg soll. Passen, Auszählen (Go) und Ähnliches stehen im 2D-Fenster. |
| Mau-Mau, Eins!, Skat | Karten in der Hand (#350): Der eigene Fächer steht vor dir an der Tischkante; spielbare Karten leuchten und werden durch Antippen gespielt. Ablage und Nachziehstapel (zum Ziehen antippen) bzw. der Stich liegen in der Tischmitte, die Karten der anderen verdeckt vor ihren Plätzen. Hat eine Karte mehrere Möglichkeiten (Bube mit Wunschfarbe, Farbwahl, Handtausch), erscheinen Knöpfe zur Wahl; beim Skat-Drücken tippst du zwei Karten an und bestätigst. Reizen und Ansagen stehen im 2D-Fenster. |
| alle anderen Online-Spiele | 2D-Fenster über dem Tisch mit der Zugliste und den Zugtexten des Servers (#335) |

**Alles in der Brille (#349):** Das 2D-Fenster über dem Tisch kann alles, was die Leiste kann. In der Lobby wählt die Raumleitung mit ◀ ▶ das Spiel, ändert die Platzzahl und schaltet freie Plätze durch: frei → Bot leicht → mittel → schwer → frei. In der Partie gibt es dort Aufgeben (mit Rückfrage), Remis anbieten (Schach, Dame), die Bitte ums Zurücknehmen samt Abstimmung und **„💬 Nachricht“** für die Schnellnachrichten. Unter **„↕ Tisch“** stellt man Tischhöhe und Abstand ein (bleibt im Gerät gespeichert) und die Lautstärke. Neu ausrichten geht wie immer mit gedrückter Meta-Taste. Uhren stehen als „⏱ 0:42“ auf den Schildern.

**Klänge:** Züge, Schlagen, Mühle, Sieg und „Du bist dran“ klingen wie in der Web-App. Die Dateien kommen nur beim Bauen aus dem privaten Klang-Repo (`apps/xr/klaenge.ts`, Auswahl in `apps/xr/src/sound-names.ts`); ohne sie bleibt die App stumm.

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

### Einmalig einrichten

1. **Token:** Im Cloudflare-Dashboard unter *My Profile → API Tokens* beim Token der CI (*⋯ → Edit*) in der bestehenden Account-Policy das Recht **„Cloudflare Pages: Edit“** ergänzen (Bereich *Developer Platform*). „Workers Scripts: Edit“ bleibt. Zonenrechte sind nicht nötig.
2. **Deploy** abwarten (oder den Job in GitHub mit *Re-run failed jobs* wiederholen). Danach gibt es unter *Workers & Pages* das Pages-Projekt `brett-und-blatt-vr`, erreichbar unter https://brett-und-blatt-vr.pages.dev. Hängt Cloudflare an den Namen ein Kürzel an, weil `brett-und-blatt-vr.pages.dev` schon vergeben ist, diese Adresse melden – sie muss dann in `ALLOWED_ORIGINS`.
3. **Domain im Pages-Projekt:** `brett-und-blatt-vr` → *Custom domains* → *Set up a custom domain* → `vr.spiele.lipponer.de` → *Continue*. Cloudflare zeigt dann den CNAME-Eintrag, den es erwartet.
4. **Bei Strato:** Im Kundenlogin unter *Domains → Domainverwaltung* bei `lipponer.de` die Subdomain `vr.spiele` anlegen, dann in deren *DNS-Verwaltung* einen **CNAME-Record** auf `brett-und-blatt-vr.pages.dev` setzen (so wie `spiele` auf GitHub Pages zeigt). Lässt Strato keine Subdomain unter `spiele` zu, stattdessen `vr.lipponer.de` nehmen und hier Bescheid geben, damit der Origin angepasst wird.
5. Nach einigen Minuten meldet Cloudflare im Pages-Projekt die Domain als *Active* und stellt das Zertifikat aus.

Den alten Worker `brett-und-blatt-xr` (erster Versuch) kann man danach im Dashboard löschen; seine Adresse fällt dann bei Gelegenheit aus `ALLOWED_ORIGINS`. Den Worker **`brett-und-blatt`** nie anfassen – das ist der Spieleserver.

## Grenzen des Probelaufs

- Kein Treffpunkt mit Körpern oder Händen der anderen (#351), keine Sprache (#352).
- Der Kartenfächer schwebt vor dir; an der Hand oder am Controller hängt er noch nicht, und Karten werden angetippt statt gegriffen. Weitere Kartenspiele (z. B. Doppelkopf, Schafkopf) laufen noch über das 2D-Fenster.
