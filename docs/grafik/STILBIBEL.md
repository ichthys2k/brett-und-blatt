# Stilbibel für die gemalten Bilder

Grundlage aller Grafik-Pakete des Vorhabens „Taverne überall“ (#306, G0 = #307). Jedes Bild-Issue verweist hierher. Die **maßgebliche Motivliste** eines Pakets ist sein Manifest unter `scripts/grafik/manifeste/` (Übersicht in [`scripts/grafik/README.md`](../../scripts/grafik/README.md)); der Ablauf für Antigravity steht in [`.agent/workflows/grafik-erzeugen.md`](../../.agent/workflows/grafik-erzeugen.md), der Bestand in [`BESTAND.md`](BESTAND.md).

**Vorrang:** Trägt ein Manifest oder ein einzelnes Motiv ein eigenes Feld `stil` bzw. `ohne`, gilt das Manifest. Die Stil-Köpfe hier sind die Vorlage für neue Manifeste und der Maßstab für die Selbstprüfung.

## 1. Welt

Ein Märchen-Königreich mit **Taverne, Narrenhof, Jahrmarkt und Turnierplatz**. Die Bewohner sind **Fabeltiere in Gewändern** (Fuchs, Bär, Dachs, Eule, Esel, Löwe …) und wenige frei erfundene Menschenfiguren. Der Ton ist **humorvoll, würdevoll und kindgerecht**: freundliche Gesichter mit einem verschmitzten Funkeln, nie bedrohlich, kein Blut, keine Waffen, die auf den Betrachter zeigen.

**Kein Alkohol, kein Tabak, keine Drogen** (Cornelius, 13.11.2026): Auch in der Taverne gibt es **keine Bierkrüge, Weingläser, Flaschen mit Schnaps oder Wein, Bierfässer, Betrunkenen, Pfeifen oder Zigaretten**. Getrunken wird – wenn überhaupt – Wasser, Milch, Saft, Tee oder Kakao aus Bechern, Kannen und Tassen; Fässer und Krüge nur, wenn klar ist, dass etwas anderes darin ist (Äpfel, Mehl, Wasser), sonst weglassen. Die Sammlung ist für Kinder und Klassen gedacht.

**Altbestand, der dagegen verstößt** (vor dem 13.11.2026 erzeugt, beim Neuerzeugen ersetzen; Prompts in den Manifesten sind schon berichtigt): Narrenhof-Mundschenk `packages/games/color-sorter/src/ui/portraits/fool-cupbearer-1.webp` (Rotweinglas), Medaillon „Festschmaus“ `packages/games/color-sorter/src/ui/items/tag-stock.webp` (Bierkrug). Fraglich, bitte ansehen: Flaschen im Hintergrund der Tavernenwirtin `packages/games/marketplace/src/ui/figures/innkeeper.webp` und auf dem Kaminsims im Hauptmenü `apps/web/src/menu/taverne-*.webp`, Pokale im Narrenhof-Thronsaal `packages/games/color-sorter/src/ui/kulissen/thronsaal.webp`. Durchgesehen wurden nur die Szenen, Medaillon-Namen und Prompts, nicht jedes der 286 Porträts.

Gemalt wird wie ein **Ölbild alter Meister bzw. ein Märchenbuch**: sichtbarer Pinselduktus, reiche Stoffe (Samt, Brokat, Pelzbesatz), warmes Kerzen- und Laternenlicht, tiefe Farben mit Gold. **Keine Schrift im Bild** – Namen, Werte und Beschriftungen setzt immer die Oberfläche.

## 2. Stil-Köpfe je Bildart

Englisch, **wörtlich vor jeden Prompt** zu setzen: Prompt = Stil-Kopf + Motiv-Prompt + „Avoid: “ + Verbote (Abschnitt 3).

### Porträt
Bots, Avatare, Narren, Nebenfiguren (`narren.json`, `bots.json`, `avatare.json`, `marktplatz-figuren.json`).

> Painterly warm baroque oil portrait of a whimsical storybook animal character of a fairy-tale kingdom, in the style of the reference images: warm candlelight, rich fabric textures, dark warm background with subtle damask pattern, warm gold and deep colours, detailed expressive friendly face with a clever twinkle, humorous but dignified, suitable for children. Bust portrait facing the viewer, head and shoulders fully inside the image, centred with space around so it can be cropped (to a circle where the manifest says so). No text, no letters, no numbers, no watermark.

Abwandlungen: **Bots sind Uhrwerk-Automaten des Barock** (Vorschlag 13.11.2026, #311, noch im Probelauf): gleiche Tiere, Stoffe und Kerzenlicht, dazu als gemeinsames Erkennungszeichen ein Aufziehschlüssel aus Messing hinter der Schulter, feine Messingnähte an den Gelenken und Glasaugen – ausdrücklich kein Steampunk (Dampfrohre, Kessel, Zylinder, Nieten stehen in den Verboten von `bots.json`); so unterscheiden sie sich von den Avataren der Menschen. Avatare tragen schlichte Reisekleidung vor **schlichtem dunkelbraunem Grund** (der Kopf muss im kleinen Kreis erkennbar bleiben); Narren tragen kleine Narrenattribute; Spielkartenfiguren (`bildkarten*.json`) sind Hochformat 4:5.

### Gegenstand / Medaillon
Pokale, Urkunden, Stempel, Jahrmarkt-Symbole, Hauptmenü-Stationen (`ehrung.json`, `jahrmarkt*.json`, `menue-stationen.json`).

> Painterly storybook oil illustration of a single object, medieval tavern and fairy-tale kingdom mood: warm candlelight from the upper left, rich colours, soft shadow directly beneath, the object centred and fully inside the image with margin around it, on a plain flat pure green background (#00B140) so that it can be cut out. No text, no letters, no numbers, no engraving, no figures, no faces.

Medaillons des Narrenhofs (rund, nicht freigestellt) stattdessen: *„… as a round medieval fairground medallion icon: the object centred on a deep warm brown wooden background with a thin gold ring … object fills about 70% of the image with margin around.“*

### Kulisse
Raum- und Spielkulissen (`raeume.json`, `kulissen.json`, `kulissen-spiele.json`).

> Painterly storybook oil illustration of an empty medieval fantasy scene, wide landscape background for a game screen: rich warm colours, soft atmospheric light, candlelight and lantern glow, detailed decoration at the left and right edges and the top, while the centre and lower third stay calm, darker and uncluttered so that interface elements can be laid over it. No people, no animals, no characters, no faces, no text, no letters, no numbers, no frame.

### Wappen / Emblem
Kacheln der Startseite (`wappen.json`).

> A bold, simple heraldic emblem for a board-game tile, painted like enamel on metal: ONE single central symbol, thick clean shapes, strong contrast, limited palette of deep colours with gold accents, subtle painterly texture, dark warm background filling the whole image, readable even when shrunk to 50 pixels. Medieval tavern and fairy-tale kingdom mood, consistent with a set of crests. The artwork extends all the way to every edge of the image: no margin, no visible plate or medallion edge, no corners. No text, no letters, no numbers, no border, no shield outline.

### Kartenbild
Drachenspiel, Quartett, Spielteile mit Kartenform (`drachenspiel-karten.json`, `quartett-*.json`, `ruebenacker-karten.json`, `marktstaende-waren.json`); dazu die Regeln in Abschnitt 5.

> Painterly storybook oil illustration, the motif of a playing card: a single main subject, warm atmospheric lighting, rich colours, expressive friendly face where there is one, soft painted background that grows slightly darker towards the edges. Subject centred and fully inside the image with generous margin on all sides so the picture can be cropped by up to 8% on every side. No text, no letters, no numbers, no card frame, no border.

Die Quartett-Sätze haben je einen eigenen Kopf (Bestiarium, Paläo-Kunst, Sternatlas, Kinderbibel) – siehe ihre Manifeste.

### Textur
Tischflächen (`tische.json`).

> Seamless tileable texture, painted in a soft painterly oil style, viewed exactly from straight above, perfectly flat and evenly lit with no light source, no shadows, no vignette, no perspective. Very low contrast and calm, so that playing cards and text placed on top stay clearly readable. The left edge continues into the right edge and the top edge into the bottom edge without any visible seam. No objects, no text, no letters, no numbers.

### Spielfigur (G12)
Figurensätze der Brettspiele (`figuren-<spiel>.json`), freigestellt auf Grün. Je Satz ein eigener Kopf (Holz, Zinn und Messing, Fabeltiere) in den Manifesten; gemeinsam ist: *„single game piece … simple bold silhouette that stays readable at very small size … centred and fully inside the image with margin, on a plain flat pure green background (#00B140) … no cast shadow.“* Abnahme: erkennbar bei kleinster Feldgröße, beide Seiten auch in Graustufen unterscheidbar.

## 3. Verbote

**Immer** (an jeden Prompt nach „Avoid: “; steht auch im Feld `ohne` jedes Manifests, `tests/grafik.test.ts` prüft das):

> text, letters, numbers, watermark, border, frame, logos, real people, celebrities, modern clothing, modern objects, photo, alcohol, beer, wine, spirits, beer mugs, tankards, wine glasses, liquor bottles, beer barrels, drunkenness, tobacco, smoking pipes, smoking, cigarettes, drugs

Trägt ein Manifest oder Motiv ein eigenes `ohne`, gilt diese Liste trotzdem zusätzlich. Auch im Motiv-Prompt keine Getränke nennen, die wie Alkohol aussehen könnten (statt „Kelch mit Rotwein“: „Krug mit Wasser“).

**Zusätze je Bildart** (aus den Manifesten, Feld `ohne`):

| Bildart | Zusätzlich |
|---|---|
| Porträt | playing-card layout, weapons pointed at the viewer, scary or aggressive expression, busy background (Avatare) |
| Gegenstand (freigestellt) | people, animals, faces, hands, engraved writing, green on the object itself, background gradient |
| Medaillon | people, animals, faces, hands |
| Kulisse | people, animals, characters, faces, signs with writing |
| Wappen | shield outline, thin details, plate, medallion edge, white background, black corners |
| Kartenbild | card layout, stat icons, labels, blood, gore, frightening horror imagery |
| Textur | objects, cards, dice, cups, stains, strong highlights, shadows, vignette, perspective, visible seams, repeating eye-catching spots |
| Spielfigur | background scene, hands, people, cast shadow, green on the object itself |

**Regel für Prompts:** Was nicht im Bild sein soll, steht **in den Verboten, nie im Motiv-Prompt**. Bildmodelle malen Genanntes oft gerade deshalb („a table without a candle“ ergibt eine Kerze). Der Motiv-Prompt beschreibt nur, was zu sehen ist.

## 4. Palette und Licht

- **Farben:** warmes Gold, Weinrot, Tannengrün, Nachtblau, Holzbraun; Pergament und Cremeweiß als helle Töne. **Keine Neonfarben**, kein reines Schwarz als Fläche, kein kühles Blaugrau außer bei Nacht- und Sternmotiven.
- **Licht:** Kerzen-, Kamin- und Laternenlicht, warm, meist von **oben links**; Kulissen mit weichem Dunst. Texturen und Spielfiguren ohne sichtbare Lichtrichtung bzw. gleichmäßig von oben.
- **Farbwerte der Tavernen-Oberfläche** (`apps/web/src/look.css`), an denen sich Bilder messen, die neben der Oberfläche stehen:

| Token | hell | dunkel |
|---|---|---|
| Grund `--color-bg` | `#efe3c8` | `#1d1510` |
| Fläche `--color-surface` | `#fbf5e6` | `#2a1f17` |
| Schrift `--color-ink` | `#2e2014` | `#f2e6d0` |
| Akzent `--color-accent` | `#2f5d3a` (Tannengrün) | `#e6b450` (Gold) |
| Gefahr `--color-danger` | `#a32a1c` (Weinrot) | `#ff8a75` |
| Holz `--tavern-wood` / `--tavern-wood-dark` | `#5a3b22` / `#3f2a18` | `#6b4728` / `#2f1f12` |
| Schild-Schrift `--tavern-sign-ink` | `#f6ead2` | `#f6ead2` |

Die Zielfarben der zwölf Tischflächen stehen in `tische.json` (G5, #313); `tests/look.test.ts` prüft die Kontraste.

## 5. Kartenbilder sind Anki-Medien

Karten lassen sich als `.apkg` exportieren, in Anki ändern und zurückholen (#270). Für alle Kartenbilder (G2, G6, G9, G9a) gilt deshalb:

1. **Nur das Motiv** im Bild: kein Kartenrahmen, kein Name, keine Werte, keine Farbzeichen. Rahmen, Name und Werte zeichnet die Vorlage des Notiztyps; nur so bleibt eine in Anki geänderte Karte stimmig.
2. **Ein festes Seitenverhältnis je Kartensatz:** Drachenspiel **3:4**, Quartett **4:3**, Kartenrücken **5:7**. Motiv mittig mit Rand – **Beschnitt bis 8 % je Seite** muss möglich sein, damit auch ein eigenes Bild des Nutzers in denselben Platz passt.
3. **Dateinamen flach und eindeutig:** `bub-<spiel>-<kennung>.webp`, nur `a–z`, Ziffern, Bindestrich und Unterstrich (Anki kennt keine Ordner und nur einen Namensraum je Sammlung). Die `<kennung>` ist die Karten-id aus dem Code und ändert sich nie. Das Manifest setzt dafür `praefix`.
4. **Größenbudget:** je Bild **höchstens 80 KB**, je Kartensatz **höchstens 12 MB** (harte Grenzen in `packages/engine/src/anki/media.ts`: 5 MB je Bild, 50 MB je Sammlung).
5. Das mitgelieferte Bild ist der **Standard**; ein Bild im Feld „Bild“ einer geänderten Notiz hat **Vorrang**.
6. Jedes Karten-Issue verlangt einen **Rundlauf-Test**: exportieren, Bild ersetzen, importieren, das neue Bild erscheint.

Nicht betroffen: Tische, Kulissen, Bot-Porträts, Avatare, Hauptmenü.

## 6. Technische Tabelle

Erzeugt wird **immer in der höchsten verfügbaren Auflösung** im Seitenverhältnis des Manifests; `uebernehmen.mjs` schneidet mittig zu, verkleinert auf die Zielgröße und schreibt WebP. **Vorab** heißt: im Bundle bzw. vom Service Worker vorab gespeichert (nur kleine Sätze); **bei Bedarf**: erst geladen, wenn die Ansicht es braucht.

| Bildart | Seitenverhältnis | Zielgröße (px) | WebP-Qualität | freigestellt | Ladeweise |
|---|---|---|---|---|---|
| Porträt Narrenhof / Spielkarte | 4:5 | 360 × 450 bzw. 320 × 400 | 78–80 | nein | bei Bedarf (je Spiel) |
| Bot-Porträt | 1:1 | 256 × 256 | 80 | nein | bei Bedarf |
| Avatar | 1:1 | 192 × 192 | 80 | nein | bei Bedarf |
| Gegenstand / Pokal | 1:1 | 384 × 384 | 80 | ja | bei Bedarf |
| Medaillon | 1:1 | 256 × 256 | 80 | nein | bei Bedarf (je Spiel) |
| Kulisse | 16:9 | 1280 × 720 (Raum 960 × 540) | 70–72 | nein | bei Bedarf |
| Hauptmenü-Ebene | 16:9 | 1376 × 768 | 80 | teils | vorab |
| Hauptmenü-Station | 1:1 | 512 × 512 | 80 | ja | vorab |
| Wappen | 4:5 (Ziel 160 × 184) | 160 × 184 | 78 | nein | vorab (Startseite) |
| Drachenspiel-Karte | 3:4 | 360 × 480 | 78 | nein | bei Bedarf, ≤ 80 KB |
| Quartett-Karte | 4:3 | 480 × 360 | 78 | nein | bei Bedarf, ≤ 80 KB |
| Kartenrücken (Viertel) | 5:7 | 500 × 700 | 80 | nein | bei Bedarf |
| Textur (Tisch) | 1:1, kachelbar | 512 × 512 | 72 | nein | bei Bedarf |
| Spielfigur | 1:1 | 192 × 192 (kleine Steine 96 × 96) | 80 | ja | bei Bedarf (gewählter Satz) |

**Freistellen:** Motive mit `"freistellen": true` werden auf reinem Grün `#00B140` erzeugt; `uebernehmen.mjs` macht das Grün durchsichtig, glättet die Kante, dämpft grünen Farbsaum und schreibt WebP mit Alphakanal (Toleranz mit `--fuzz=<Prozent>`, Standard 22).

## 7. Referenzbilder

Beim Erzeugen mitgeben (das Manifest nennt sie im Feld `referenzen`) und bei der Selbstprüfung danebenlegen.

| Bildart | Referenzen |
|---|---|
| Porträt | `packages/games/color-sorter/src/ui/portraits/boss-bear-2.webp`, `packages/games/color-sorter/src/ui/portraits/court-fox-1.webp`, `packages/games/marketplace/src/ui/figures/herald.webp`, `packages/games/marketplace/src/ui/figures/innkeeper.webp` |
| Spielkartenfigur | `packages/ui/src/cards/portraits/koenig-herz.webp` |
| Gegenstand / Medaillon | `packages/games/color-sorter/src/ui/items/dream-crestBook.webp` |
| Kulisse | `apps/web/src/assets/raeume/burgsaal.webp`, `packages/games/color-sorter/src/ui/kulissen/thronsaal.webp` |
| Hauptmenü | `apps/web/src/menu/taverne-hinten.webp`, `apps/web/src/menu/taverne-vorn.webp` |
| Wappen | `apps/web/src/wappen/battleship.webp`, `apps/web/src/wappen/bingo.webp` |
| Kartenbild | `packages/games/drachenspiel/src/ui/champions/forest.webp`, `packages/games/wolves-sheep/src/ui/cards/role-shepherd.webp` |
| Gebäude / Spielort | `packages/games/marketplace/src/ui/fields/corner-fair.webp` |
| Textur, Spielfigur | noch keine – der erste gewählte Satz (G5 bzw. G12, Schach als Pilot) wird hier eingetragen |

## 8. Archiv der Originale

- Die Originale in voller Auflösung liegen **ausschließlich im privaten Repo** `ichthys2k/brett-und-blatt-grafik`, geklont neben dem Projekt (`../brett-und-blatt-grafik`). Aufbau: `originale/<Zielordner im öffentlichen Repo>/<name>.png`, z. B. `originale/apps/web/src/wappen/grafschaft.png`. Privat ist das Repo nur wegen der Größe; die Bilder stehen unter CC BY-SA 4.0 wie die übrigen Inhalte.
- **Nie** ein Ordner `original/` oder ein PNG über 1 MB im öffentlichen Repo (`tests/grafik.test.ts`).
- `scripts/grafik/uebernehmen.mjs` legt das Original beim Übernehmen dort ab und **bricht ab**, wenn der Ordner fehlt (anderer Ort: `GRAFIK_ORIGINALE_DIR`). Ohne archiviertes Original keine Übernahme.
- `node scripts/grafik/originale-pruefen.mjs` meldet jedes WebP ohne Original; die Altfälle vor dem 12.11.2026 (Originale verloren) stehen in `scripts/grafik/originale-fehlen.json`. Dort kommt nichts Neues hinzu.
- `node scripts/grafik/bestand.mjs` erzeugt [`BESTAND.md`](BESTAND.md) neu.
- Rohvarianten (`grafik-roh/`) bleiben lokal und unversioniert.
