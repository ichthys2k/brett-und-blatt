# Maulwurfsgänge – offene Punkte vor dem Freischalten

*Vorhaben [#457](https://github.com/ichthys2k/brett-und-blatt/issues/457), Wappen [#568](https://github.com/ichthys2k/brett-und-blatt/issues/568), Bot-Porträt [#567](https://github.com/ichthys2k/brett-und-blatt/issues/567). Stand 20.11.2026.*

Vorbereitung für Cornelius: Was vor dem Freischalten von `mole-tunnels` (Plan: [`maulwurfsgaenge.md`](maulwurfsgaenge.md), Glied M5) zu entscheiden oder am Desktop mit dem privaten Grafik-Repo zu erledigen ist. **Hier wurde nichts erzeugt:** keine Bilder, keine Klangdateien, `draft: true` bleibt, bis Cornelius „deploy“ bzw. die Freigabe sagt.

Reihenfolge: Wappen und Porträt malen (Abschnitt 1 und 2), Klänge wählen (3), dann die Prüfliste (4).

## 1. Wappen (#568)

**Zustand:** Es gibt **kein** Wappen für `mole-tunnels`; `apps/web/src/wappen/mole-tunnels.webp` fehlt. Auf der Startseite bleibt deshalb das Emoji aus dem Steckbrief (`crestUrl` in `apps/web/src/lib/crest.ts` liefert `undefined`). Ein Platzhalter (Kopie des Rübenacker-Wappens `turnip-patch.webp`) lag nur im Entwurf-Zweig und **darf nicht veröffentlicht werden**: zwei Kacheln mit demselben Bild wären verwirrend. Er gehört nicht in `main`.

**Regeln** (Stilbibel [`docs/grafik/STILBIBEL.md`](../grafik/STILBIBEL.md), Abschnitt „Wappen / Emblem“ und Technische Tabelle; Ablauf [`.agent/workflows/grafik-erzeugen.md`](../../.agent/workflows/grafik-erzeugen.md)):

- **Ein** zentrales Symbol, dicke klare Formen, starker Kontrast, dunkelwarmer Grund bis zum Rand, Gold als Akzent; lesbar bei 50 px. Kein Text, keine Zahlen, kein Rahmen, kein Schildumriss, keine Ecken.
- Format **4:5**, Zielgröße **160 × 184 px**, WebP-Qualität 78, nicht freigestellt, Ladeweise „vorab“ (Startseite), also klein halten.
- Verbote: die allgemeine „Avoid“-Liste (Stilbibel Abschnitt 3, inkl. Alkohol, Tabak) plus Wappen-Zusatz `shield outline, thin details, plate, medallion edge, white background, black corners`. Das Feld `ohne` des Manifests `wappen.json` trägt beides schon.
- Abgrenzung: Das Rübenacker-Wappen zeigt eine Rübe im Boden. Das neue Wappen soll **nicht** ebenfalls nur eine Rübe sein, sondern den Maulwurf bzw. das Tunnelsystem zeigen.

**Ablauf am Desktop** (Zugang zum privaten Repo nötig, `../brett-und-blatt-grafik`, ImageMagick):

1. Im Manifest `scripts/grafik/manifeste/wappen.json` unter `motive` einen Eintrag ergänzen: `{ "id": "mole-tunnels", "titel": "Maulwurfsgänge", "prompt": "<Motiv unten>" }`. Der Eintrag `id` bestimmt den Dateinamen `mole-tunnels.webp` (Präfix leer, Ziel `apps/web/src/wappen`). Die Beschreibung im Manifest nennt „54 Spiele“; Zahl dann anpassen.
2. 3 Varianten je Prompt in höchster Auflösung erzeugen (Referenzen aus dem Manifest: `marketplace`, `dominoes`, `chess`), nach `grafik-roh/wappen/mole-tunnels/v1.png` bis `v3.png`; Selbstprüfung (auch bei 96 px ansehen).
3. `node scripts/grafik/kontaktbogen.mjs scripts/grafik/manifeste/wappen.json`, Cornelius wählt.
4. `node scripts/grafik/uebernehmen.mjs scripts/grafik/manifeste/wappen.json mole-tunnels=<Variante>`: schreibt `apps/web/src/wappen/mole-tunnels.webp` und legt das **Original** in voller Auflösung ins private Repo (`originale/apps/web/src/wappen/mole-tunnels.png`) plus alle Varianten unter `varianten/`. Dort committen und pushen. Danach `node scripts/grafik/originale-pruefen.mjs` und `node scripts/grafik/bestand.mjs`.
5. `THIRD_PARTY.md`: Abschnitt nach dem Muster der vorhandenen (Pfad, **KI-erzeugt** mit Modell und Monat, „Auswahl und Zuschnitt durch Cornelius Lipponer“, Manifest).

**Prompt-Vorschlag (empfohlen), Motiv:**

> Emblem motif: a round-faced velvety grey-brown mole with tiny pink paws and a pink nose, peeking out of a mound of rich dark earth, a small golden crown of tunnel entrances on the mound, warm glow from below.

**Alternative A (Tunnelknoten):**

> Emblem motif: a cross-section of dark earth with one thick golden-brown T-shaped tunnel, a glowing purple-and-white turnip at the end of one branch.

**Alternative B (Hase und Maulwurf):**

> Emblem motif: two round holes in dark earth side by side, a long-eared hare's ears sticking out of the left one and a mole's pink nose out of the right one, a thin golden tunnel line connecting them below.

(Jeder Prompt wird mit dem `stil` des Manifests davor und `Avoid: ` + `ohne` dahinter zusammengesetzt; die Motive sind absichtlich ohne Text und Rahmen formuliert.)

## 2. Bot-Porträt „Wühlmaus“ (#567)

**Zustand:** Der Bot heißt im Spielcode „Wühlmaus“ (`packages/games/mole-tunnels/src/bots.ts`), hat aber in `apps/web/src/lib/botPortraits.ts` weder Namen noch Zuordnung. Der Rückfall ist heute: `botPortraitId('mole-tunnels')` ergibt `zufall`, die Oberfläche zeigt also den allgemeinen Bot „Zufall“ (Namen und Bild der **allgemeinen Bots der Engine**). Das ist spielbar, nur nicht schön.

**Persona** (nach dem Stil von `scripts/grafik/manifeste/bots.json`, 1:1, 256 × 256, WebP 80, rund beschnitten; Präfix `bot-`, Ziel `packages/ui/src/bots/portraits`): Die Bots sind **Uhrwerk-Automaten des Barock** mit Aufziehschlüssel (gemeinsames Erkennungszeichen), kein Steampunk, noch immer ein Fabeltier mit Fell und Stoffkleidung. Wühlmaus: ein Maulwurf-Automat mit kleinen Grabschaufel-Pfoten und einer Bergmannslaterne, der zwischen den Gängen herumtüftelt.

**Prompt-Vorschlag** (Motiv-`prompt` im Manifest, `stil`/`ohne` davor und dahinter wie bei den anderen 46 Motiven):

> A mole in a small velvet waistcoat with a tiny brass lantern on its forehead and spade-shaped paws, one paw holding a little wooden tunnel tile, a polished brass wind-up key behind its shoulder.

**Ablauf:**

1. In `scripts/grafik/manifeste/bots.json` unter `motive` ergänzen: `{ "id": "wuehlmaus", "titel": "Wühlmaus (Maulwurfsgänge)", "prompt": "…" }`; erzeugen, Kontaktbogen, Cornelius wählt, `uebernehmen.mjs scripts/grafik/manifeste/bots.json wuehlmaus=<Variante>` (schreibt `packages/ui/src/bots/portraits/bot-wuehlmaus.webp`, Original ins private Repo, dort committen).
2. In `apps/web/src/lib/botPortraits.ts`: `'wuehlmaus': 'Wühlmaus'` in `BOT_NAMES` und `'mole-tunnels': 'wuehlmaus'` in `BOT_BY_GAME` (neben `'turnip-patch': 'langohr'`).
3. **Reihenfolge beachten:** `tests/bot-portraits.test.ts` verlangt zu jedem `BOT_NAMES`-Eintrag ein Bild. Den Eintrag also **erst mit** der Bilddatei einchecken, nicht vorher.
4. `THIRD_PARTY.md` (bei den Bot-Porträts ergänzen), dann `corepack pnpm exec vitest run tests/bot-portraits.test.ts`.

**Ohne Bild:** `mole-tunnels` bleibt bei „Zufall“, kein Fehler, kein Hindernis fürs Freischalten. Das Porträt darf auch nach der Freigabe nachgereicht werden.

## 3. Klangauswahl

Stand im Spiel (`gameUi.sounds` in `packages/games/mole-tunnels/src/ui/index.tsx`): `push` → `stein-schiefer`, `walk` → `ruebenacker-hopps` (nur wenn der Weg länger als ein Feld ist), `harvest` → `punkte-sammeln`. Alles vorläufig. Katalog: `packages/ui/src/audio/catalog.json` (197 Einträge); Ablauf und Prompts für neue Klänge: [`klaenge-alle-spiele.md`](klaenge-alle-spiele.md). **Nur vorhandene Klänge sind unten vorgeschlagen**; die Dateien liegen im privaten Klang-Repo und werden nicht angefasst. Neue Klänge nur nach Cornelius' Auswahl.

Das Spiel meldet die Ereignisse `push`, `walk`, `harvest`, `sprout` (neue Rübe wächst nach) und `end` (Partieende). Sieg, Niederlage und Zeitablauf vertont die Plattform (`sieg`/`niederlage`, `zeit-knapp`, `zeit-um`); der Zugwechsel (`dein-zug`) ebenfalls. Die Zeilen dafür stehen nur als Alternative da, falls Cornelius es spielspezifisch will.

| Ereignis | Heute | Kandidaten (vorhanden) | Begründung |
|---|---|---|---|
| **Schieben** (`push`) | `stein-schiefer` | 1. `stein-schiefer` (Schieferstein-Klack, 0,5 s) · 2. `plaettchen-setzen` (Plättchen auf Tisch, 0,33 s) · 3. `mauer-stein` (Stein, 0,48 s) | Das Gangteil rutscht und rastet ein: ein trockener, kurzer Holz-/Steinklack passt. `plaettchen-setzen` klingt nach Legeteil und ist kürzer, `mauer-stein` etwas dumpfer und „erdiger“. |
| **Laufen** (`walk`, Weg > 1 Feld) | `ruebenacker-hopps` | 1. `ruebenacker-hopps` (Hasenhüpfer) · 2. `fs-pop` (kleines Plopp, 0,25 s) · 3. `steine-wenden` (sehr kurz, 0,22 s) | Der Hase hüpft; der Hüpfer aus dem Rübenacker ist dieselbe Spielwelt. `fs-pop` wäre leiser und neutraler, falls das Hüpfen bei langen Wegen nervt. |
| **Ernten** (`harvest`) | `punkte-sammeln` | 1. `punkte-sammeln` (Punkte ticken hoch, 0,98 s) · 2. `paar` (helles Plopp, 0,93 s) · 3. `wort-perle` (kleine Perle, 0,49 s) | Die Rübe wird gezogen, der Zähler springt: ein belohnender Ton. `paar` ist „Plopp“ und passt zur Pop-Animation, `wort-perle` ist kürzer, wenn mehrere Ernten schnell folgen. |
| **Neue Rübe wächst** (`sprout`) | – (stumm) | 1. `fs-pop` · 2. `plaettchen-setzen` · bewusst **stumm** lassen | Der Spross erscheint nach der Ernte; ein zweiter Ton direkt nach `harvest` würde überlagern. Vorschlag: stumm. |
| **Sieg** (`end`, Partieende) | Plattform (`sieg`) | 1. Plattform belassen · 2. `runde-gewonnen` (Fanfare, 1,44 s) · 3. `quartett-komplett` | Spielübergreifend einheitlich ist besser; nur wenn Cornelius eine eigene Siegermelodie will. |
| **Zug beenden** (Laufschritt, Wechsel zum Nächsten) | Plattform (`dein-zug`) | 1. Plattform belassen · 2. `zug-hinweis` (zwei Holzklopfer, 0,34 s) · 3. `aussetzen` (0,48 s, für „Stehenbleiben“) | `zug-hinweis` ist leiser als `dein-zug`. `aussetzen` nur, wenn man „Hase bleibt stehen“ hörbar machen will (derzeit ohne Ton, da kein Hüpfen). |
| **Maulwurf-Pech** (Hase wird vom Maulwurf behindert) | – (kein Ereignis) | 1. `ruebenacker-maulwurf` (Plumps, im Katalog unbelegt) · 2. `festgefahren` (0,6 s) · 3. `kein-paar` (sanftes „Oh“, 0,51 s) | **Achtung:** Dafür gibt es noch **kein Spielereignis**; der Maulwurf sperrt nur Felder, er „trifft“ nicht. Ein Ton bräuchte eine kleine Regeländerung (z. B. Ereignis, wenn ein Schub einen Maulwurf auf einen Hasen schiebt) und ist daher **nicht** Teil der Freischaltung. Vorschlag: weglassen, `ruebenacker-maulwurf` bleibt Rübenacker. |

**Musik:** `mole-tunnels` steht schon in der Playlist `spielabend` (`packages/ui/src/audio/music.json`); nichts zu tun.

**Wenn Cornelius ändert:** nur die Zeilen in `gameUi.sounds` des Spiels anpassen (Name aus dem Katalog); `walk` bleibt die Funktion mit der Wegprüfung.

## 4. Prüfliste Freischalten (M5)

Nur auf Cornelius' Wort („deploy“ bzw. Freigabe des Glieds). Einzelheiten: [`maulwurfsgaenge.md`](maulwurfsgaenge.md), Abschnitt „Anbindung (Checkliste für die Freischaltung)“ und „Tests“.

- [ ] Wappen `apps/web/src/wappen/mole-tunnels.webp` übernommen, Original im privaten Repo, `THIRD_PARTY.md` ergänzt (Abschnitt 1). **Kein** Platzhalter.
- [ ] Optional: Bot-Porträt und Einträge in `apps/web/src/lib/botPortraits.ts` (Abschnitt 2); ohne Bild gilt „Zufall“.
- [ ] Klänge nach Abschnitt 3 entschieden und in `gameUi.sounds` eingetragen.
- [ ] `apps/server/src/games.ts` (`onlineGames`) und `apps/server/package.json` (`"@brett-und-blatt/game-mole-tunnels": "workspace:*"`), danach `corepack pnpm install` (Lockfile `pnpm-lock.yaml` mit committen); `apps/server/test/games.test.ts` grün. `BOT_STEP_MS['mole-tunnels']` steht schon in `apps/server/src/bots.ts`.
- [ ] `apps/xr/src/catalog.ts` (`['mole-tunnels', 'Maulwurfsgänge']`), Zeilen für die Spieltafel in `apps/xr/src/scene/tafel-lines.ts`, Eingaben in `apps/xr/src/input-spec.ts` falls nötig; `tests/xr-karten.test.ts` grün.
- [ ] Spiel-Label `spiel: Maulwurfsgänge` (Beschreibung „Spiel-id mole-tunnels · Rubrik Familie & Gesellschaft“) anlegen.
- [ ] Doku: Tabellenzeile in `docs/spiele/README.md` (Status), Eintrag in `docs/CHRONIK.md`, `docs/spiele/offene-plaene.md` nachführen.
- [ ] **Zuletzt:** `draft: true` aus `packages/games/mole-tunnels/src/meta.ts` entfernen.

Befehle (immer `corepack pnpm …`):

```
corepack pnpm exec vitest run packages/games/mole-tunnels
corepack pnpm exec vitest run tests/repo.test.ts tests/bot-portraits.test.ts tests/xr-karten.test.ts apps/server/test/games.test.ts
corepack pnpm check
corepack pnpm build && corepack pnpm rauchtest mole-tunnels      # ggf. RAUCHTEST_CHROMIUM=/usr/bin/chromium
PRUEFSTAND=1 PRUEFSTAND_SPIELE=mole-tunnels corepack pnpm pruefstand
```

Danach Blick im Browser (Handy-Hochformat, 5 × 5 und 7 × 7, hell und dunkel), eigener Zweig mit PR (`Refs #457`); nach `main` erst auf „deploy“.

## Offene Entscheidungen für Cornelius

- Wappen: Prompt wählen (Vorschlag, A oder B) und Variante nach dem Kontaktbogen.
- Bot-Porträt: jetzt malen oder nach der Freigabe nachreichen (Rückfall „Zufall“ ist zulässig).
- Klänge: eine Zeile je Ereignis aus Abschnitt 3 wählen; Maulwurf-Pech-Klang ja/nein (bräuchte ein neues Ereignis).
- Die vier „Offen“-Fragen aus dem Plan ([`maulwurfsgaenge.md`](maulwurfsgaenge.md), „Entscheidungen und offene Fragen“): Name, Option „Geheimauftrag“, Maulwurf standardmäßig an, mehr als 4 Plätze.
