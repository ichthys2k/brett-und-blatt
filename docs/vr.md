# Brett & Blatt VR (WebXR-Probelauf)

Stand 13.11.2026 · [Issue #339](https://github.com/ichthys2k/brett-und-blatt/issues/339) · Vorhaben [#333](https://github.com/ichthys2k/brett-und-blatt/issues/333)

Eine eigene Web-App für die Meta Quest (und jeden Browser mit WebGL): ein Tisch in der Taverne, an dem man mit denselben Raumcodes wie auf spiele.lipponer.de spielt – gegen Freunde am Handy, am Rechner, in der Brille oder gegen Server-Bots.

- **Adresse:** https://vr.spiele.lipponer.de (nach dem ersten „deploy“; vorher und als Rückfall https://brett-und-blatt-xr.lipponer.workers.dev)
- **Code:** `apps/xr` – React Three Fiber mit `@react-three/xr`. Die App kennt **keine Spielregeln**: Sie spricht nur das [offene Protokoll](protokoll.md) mit dem Spieleserver und nutzt aus `packages/online` nur Typen und Listen (Avatare, Reaktionen, Raumcodes).

## So spielt man

1. In der Quest den Browser öffnen, die Adresse aufrufen, Name und Bild wählen.
2. **Neuen Raum anlegen** oder den **Raumcode** einer Runde eingeben. Ein Link mit `#<Raumcode>` führt direkt in den Raum.
3. In der Lobby (Leiste rechts oder 2D-Fenster über dem Tisch) wählt die Raumleitung das Spiel, besetzt Plätze mit Bots und beginnt.
4. **In VR betreten.** Gezogen wird durch Zeigen mit dem Controller (Abzug) oder Antippen mit dem Finger.

| Spiel | Darstellung |
| --- | --- |
| Tic-Tac-Toe, Vier in einer Reihe, Schach | 3D-Figuren auf dem Tisch. Leuchtende Ziele sind die erlaubten Züge; bei Schach erst die Figur, dann das Ziel wählen, die Umwandlung erscheint als Knöpfe. |
| alle anderen Online-Spiele | 2D-Fenster über dem Tisch mit der Zugliste und den Zugtexten des Servers (#335) |

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

- Die CI prüft bei jedem Push, dass die App baut und ihre Cloudflare-Konfiguration stimmt (`wrangler deploy --dry-run`).
- **Nur auf `main`, also nach „deploy“**, veröffentlicht der Job „VR-App auf Cloudflare veröffentlichen“ die statischen Dateien als Worker `brett-und-blatt-xr` (`apps/xr/wrangler.jsonc`). Er läuft nach dem Spieleserver und hält die Web-App nicht auf.
- Die Origins `https://vr.spiele.lipponer.de` und `https://brett-und-blatt-xr.lipponer.workers.dev` stehen in `ALLOWED_ORIGINS` des Spieleservers (`apps/server/wrangler.jsonc`).

**Einmalig für die Unterdomain:** Der Worker trägt `vr.spiele.lipponer.de` als Custom Domain; Cloudflare legt DNS-Eintrag und Zertifikat selbst an, weil die Zone `lipponer.de` dort liegt. Dafür braucht das Secret `CLOUDFLARE_API_TOKEN` neben „Workers Scripts: Bearbeiten“ auch Rechte an der Zone `lipponer.de`, nämlich „Workers Routes: Bearbeiten“ und „DNS: Bearbeiten“. Fehlen sie, scheitert nur dieser Job. Den Token im Cloudflare-Dashboard unter „Mein Profil → API-Token“ erweitern. Den Token selbst nie ins Repo oder in den Chat geben.

## Grenzen des Probelaufs

- Kein Treffpunkt mit Körpern oder Händen der anderen, keine Sprache (#340).
- Karten in der Hand gibt es noch nicht; Kartenspiele laufen über das 2D-Fenster (#340).
- Die Lobby in der Brille kann sich setzen und die Partie beginnen; Spiel und Bots wählt man bequemer in der Leiste vor dem Betreten.
