# Narrenhof – Klangideen

Stand: 29.10.2026. Sammlung von Cornelius' Klangwünschen für den Narrenhof (`packages/games/color-sorter`, Plan in [`farbensortierer.md`](farbensortierer.md)). **Stand 29.10.2026:** Die acht Klänge mit hoher Priorität sind erzeugt, ausgewählt und eingebaut: Brezeln (`fs-kauf`, `fs-verkauf`, `fs-auszahlung`), Schellen (kurz beim Treffer, lang beim Jubel), `nh-hoftag` (Fanfare), `nh-thronsaal` (Tor) und `nh-herold` (Beginn der Morgenaudienz). Offen: mittlere und niedrige Priorität, Kombi-Ansagen. **Cornelius wählt aus**; erzeugte Dateien gehören ins private Klang-Repo `ichthys2k/brett-und-blatt-klaenge` (ElevenLabs-Lizenz), nie in dieses Repo.

## Heute im Spiel

| Ereignis | Klang | Urteil |
|---|---|---|
| Karte wählen, abschicken, verwerfen | `ds_flipcard`, `ds_snip` | passt |
| Mischen, Treffer, Angriff | `fs_shuffle`, `ds_punch1`, `ds_swipe` | passt |
| Kaufen, Verkaufen, Auszahlung | `fs_coin_end`, `fs_coin` | Münzen statt Brezeln – größter Stilbruch |
| Applaus, Jubel | `applause_small`, `applause_huge` | passt |
| Hoftag, Thronsaal, Sieg | `level_up_classical`, `trophy_unlocked`, `victory_fanfare` | brauchbar, nicht höfisch |
| Verlieren, Ausscheiden | `fs_game_over` | passt |
| Kombi-Ansagen `fs_hand_*` | Sprachaufnahmen mit den alten Namen | offen |

## Aus PepperMINT wiederverwendbar (liegt schon im Klang-Repo)

- **Thron, Hof:** `crown_placed` (Königlicher Stand), `hit_trumpet`, `hit_orchestra_win`, `hit_bagpipes` (Dudelsack), `door_knock`, `dungeon_gate` (Audienz, Thronsaal), `tavern_ambience`.
- **Narren-Humor:** `goblin_laugh` (Lachanfall), `slide_whistle_up`/`_down`, `boing_spring`, `squeak_toy`, `party_blower`, `record_scratch` (Da capo!), `drum_roll` (vor der Wertung).
- **Schellen, Glöckchen 🔔:** `hit_tambourine` (Schellenbesatz), `hit_triangle`, `hit_chimes_bar`, `wind_chimes`; Zauber und Traumkarten: `hit_harp`, `hit_music_box`.
- **Bündel, Jahrmarkt:** `gift_unwrap` (Schleife), `cloth_tear`, `chest_open`/`chest_rare` (Wunderkiste), `ceramic_break`, `paper_slide` (Bittschrift), `book_opening` (Narrenschule), `armor_equip` (Kettenhemd), `key_ring`, `chalk_write`, `torch_ignite`.
- **Verlieren:** `wrong_dull_thud`, `hit_piano_sad`, `hit_brass_fail`, `hit_orchestra_fail`.

## Neu zu erzeugen (Prompts englisch, ElevenLabs Sound-Effects-API)

**Hohe Priorität** (ersetzt Münzklänge, Hof-Atmosphäre)

| Name | Prompt | Einsatz |
|---|---|---|
| `nh-brezel-kauf` | crunchy pretzel snap and a few salt grains falling on a wooden table, short | Kaufen |
| `nh-brezel-verkauf` | soft cloth pouch of pretzels being handed over, light crunch | Verkaufen |
| `nh-brezel-auszahlung` | cascade of crunchy pretzels dropping into a wooden bowl, cheerful | Auszahlung |
| `nh-schellen-kurz` | short jingle of a jester's cap bells, three quick shakes, bright | Wertungs-Treffer |
| `nh-schellen-lang` | long cheerful jester bells jingling while the wearer skips, one second | Hoftag-Start |
| `nh-hoftag-fanfare` | short medieval court trumpet fanfare, playful, two bars, with a small drum | Hoftag geschafft |
| `nh-thronsaal-tor` | heavy wooden double doors opening in a castle hall with an echoing herald trumpet | Thronsaal betreten |
| `nh-herold` | medieval herald announcing with a short trumpet call "ta-ta-taaa" | neue Audienz |

**Mittlere Priorität** (Spielgefühl der Wertung)

| Name | Prompt | Einsatz |
|---|---|---|
| `nh-lachen-leise` | a small royal court chuckling politely, then a few giggles | Miene 🙂 |
| `nh-lachen-laut` | a whole royal court bursting into laughter, with a king's deep belly laugh | Lachanfall des Throns |
| `nh-buh` | medieval crowd booing and groaning, with a few thrown vegetable splats | Ziel verfehlt |
| `nh-kleinvieh` | a tiny trumpet blowing a very sad "wah-wah" falling note | kleiner Misserfolg, weicher als `fs_game_over` |
| `nh-wappen-stempel` | wax seal stamped on parchment, wooden stamp thud with a soft squelch | Wappen aufkleben |
| `nh-flicken-naht` | needle and thread pulling through thick cloth, quick stitch | Schneiderei |
| `nh-gold-glanz` | soft magical shimmer, tiny golden chimes, rising | Glanz „Vergoldet“ |
| `nh-kuriositaet-erscheint` | cartoon "poof" with a tiny bell and a puff of glitter | neuer Narr im Jahrmarkt |

**Niedrige Priorität** (Feinschliff)

| Name | Prompt | Einsatz |
|---|---|---|
| `nh-aufschnueren` | silk ribbon pulling loose with a soft pop and rustling cloth | Schleife (bis dahin `gift_unwrap`) |
| `nh-zugabe` | short crowd chant "encore" with clapping | Privileg Zugabe |
| `nh-da-capo` | quick rewind of a musical box with a little tada | Zauberkarte „Da capo!“ |
| `nh-kronenwechsel` | golden crown being lifted off and placed on a new head, metal clink and cheers | Wettstreit: Krone wechselt |

**Sprachaufnahmen der Kombis:** zehn Ansagen mit den neuen Namen (Duo, Triple, Kombisatz …) über die Text-to-Speech-API von ElevenLabs, tiefe Herolds-Stimme, danach auf etwa −14 LUFS angleichen (wie die Enten-Rallye-Ansagen).

## Ideen für andere Spiele (ungeprüft)

- **Präsident:** Rangwechsel (Krone/Stuhl), „Revolution“ als Trommel und Aufschrei, Kartentausch beim Ablegen.
- **Speed:** zwei schnelle Kartenklatscher, Patt als kurzer Gong.
- **Fix gefunden! / Tiefflug:** erst nach dem Bau planen.

## Vorgehen

1. Zuordnungen aus „wiederverwendbar“ im Katalog probehören (kostenlos).
2. Dann die Einträge mit hoher Priorität erzeugen, je drei Varianten (24 Aufrufe), Auswahl durch Cornelius.
3. Das Erzeugen automatisiert ein Skript im Klang-Repo (liest eine Liste mit Name, Prompt, Dauer; erzeugt nur, was fehlt; Key aus `ELEVENLABS_API_KEY`; Trockenlauf zeigt vorher die Zahl der Aufrufe). Vorlage: `PepperMINT/scripts/generate-sounds.js`.
