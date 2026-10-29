# Klangideen für alle Spiele

Stand: 29.10.2026. Gesamtliste möglicher neuer Soundeffekte, geordnet nach **Wiederverwendung**: zuerst Klänge, die viele Spiele zugleich verbessern, dann Stimmen, dann Besonderheiten einzelner Spiele. Der Narrenhof hat eine eigene Liste ([`narrenhof-klaenge.md`](narrenhof-klaenge.md)) und ist hier nur für gemeinsame Klänge erwähnt.

**Stand 29.10.2026:** Abschnitt 1.1 bis 1.3 (Karten, Steine, Würfel) und die acht Narrenhof-Klänge mit hoher Priorität sind erzeugt, von Cornelius ausgewählt (Hörprobe mit Auswahl: `tools/hoerprobe.mjs` im Klang-Repo) und eingebaut; noch nicht erzeugt: Abschnitt 1.4, Stimme (2) und alles aus Abschnitt 3. Dateinamen im Klang-Repo haben Unterstriche (`karte_legen.mp3`), Katalognamen Bindestriche. Nicht verdrahtet, aber im Katalog: `karten-faecher`, `domino-kette`, `wuerfel-halten`. **Cornelius wählt aus** (Regel aus `CLAUDE.md`). Erzeugt wird mit `tools/erzeugen.mjs` im privaten Klang-Repo `ichthys2k/brett-und-blatt-klaenge`; die Dateien kommen nie ins öffentliche Repo. Prompts sind englisch, weil ElevenLabs damit am besten arbeitet.

## Befund: Wo der Katalog heute schwach ist

Der Katalog (`packages/ui/src/audio/catalog.json`, 69 Einträge auf 54 Dateien) benutzt für fast alle Spiele dieselben wenigen Grundnamen, und die sind mit **Oberflächenklicks aus PepperMINT** belegt:

| Katalogname | Heute | Benutzt von | Problem |
|---|---|---|---|
| `karte-legen` | `tab_switch` (Verstärkung ×3) | Skat, Schafkopf, Doppelkopf, Binokel, Mau-Mau, Eins!, Präsident, Kartenblitz, Speed, Solitaire, Quartett | klingt nach Reiter-Klick, nicht nach Karte |
| `karte-ziehen` | `swipe_right` | dieselben, dazu Schwarzer Peter, Paare | Wisch-Geräusch einer App |
| `stein-setzen` | `click_wooden` | Tic-Tac-Toe, Gomoku, Reversi, Dominoes, Scrabble, Farbe & Form, Würfelblock, Zielzahl u. a. (über 12 Spiele) | ein UI-Klick, kein Stein |
| `stein-ziehen` | `click_wooden` | Schach, Dame, Mühle, Vierer-Schach, Ludo | derselbe Klick |
| `wuerfeln` | `wood_impact` | Würfelblock, Nicht ärgern!, Mäxle | ein einzelner Aufprall, kein Würfeln |
| `ansage` | `click_soft` | Skat, Doppelkopf, Schafkopf, Binokel, Mau-Mau, Eins!, Mäxle, Präsident | kaum hörbar |
| `poker-call/bet/raise` | `fs_coin` | Poker | Münze statt Spielmarke |

**Folgerung:** Wer diese sieben Katalognamen auf bessere Dateien umlenkt, verbessert über 30 Spiele auf einen Schlag, ohne eine Zeile Spielcode zu ändern. Das ist die größte Hebelwirkung. Pro Katalogeintrag reicht es, `file`/`end`/`gain` zu ändern.

Technik, die schon da ist: `SoundPlayer` verändert die Tonhöhe bei jedem Abspielen zufällig um ±3 %. Mehrere Varianten pro Ereignis gibt es noch nicht (siehe unten, Abschnitt „Technik“).

---

## 1. Grundausstattung (ersetzt Katalognamen, wirkt in vielen Spielen)

Je Klang sind 3 Varianten (`_a/_b/_c`) sinnvoll; für die Katalogeinbindung genügt die beste.

### 1.1 Karten (11 Spiele, plus Narrenhof, Drachenspiel-Anklänge)

| Neuer Name | Ersetzt | Prompt | Dauer | Spiele |
|---|---|---|---|---|
| `karte-legen` | `tab_switch` | single playing card placed down on green felt, soft clean slap, dry, no echo | 0.5 s | alle Kartenspiele |
| `karte-ziehen` | `swipe_right` | one playing card sliding off the top of a deck across felt, short swish | 0.5 s | alle Kartenspiele, Schwarzer Peter, Paare |
| `karte-umdrehen` | – (neu) | playing card flipped face up with a crisp flick | 0.4 s | Paare, Solitaire (`flipped`), Quartett, Bibel-Quiz-Aufdecken |
| `karten-austeilen` | teils `mischen` | dealing four cards one after another onto a table, snap snap snap snap | 1.0 s | Skat, Doppelkopf, Schafkopf, Binokel, Poker, Eins!, Mau-Mau |
| `stich-einsammeln` | `karte-ziehen` | hand sweeping a small stack of cards across felt and squaring them, soft | 0.8 s | Skat, Doppelkopf, Schafkopf, Binokel, Präsident (Stich geht), Speed |
| `karten-faecher` | – | cards fanned out in one hand, quick riffling | 0.7 s | Handanzeige (Eins!, Mau-Mau, Quartett) – nur wenn die Oberfläche es auslöst |
| `mischen` | `paper_slide` | **vorhanden prüfen:** `fs_shuffle.mp3` ist ein echtes Kartenmischen und kann den Namen `mischen` übernehmen | – | alle |

### 1.2 Steine und Figuren (über 12 Spiele)

| Neuer Name | Ersetzt | Prompt | Dauer | Spiele |
|---|---|---|---|---|
| `stein-setzen` | `click_wooden` | small wooden game piece set down on a wooden board, clean tock, dry | 0.3 s | Tic-Tac-Toe, Ultimate, Reversi, Farbe & Form, Scrabble, Kniffel-Eintrag, Zielzahl, Rechenmauer, Teiler-Duell |
| `stein-schiefer` | – (neu) | slate go stone placed on a wooden goban, crisp ceramic clack | 0.4 s | Go, Gomoku |
| `stein-ziehen` | `click_wooden` | wooden chess piece slid a few centimetres across a wooden board, soft scrape | 0.5 s | Schach, Vierer-Schach, Dame, Mühle, Ludo |
| `stein-schlagen` | `wood_impact` | wooden piece knocking another piece aside, then being lifted away, firm knock | 0.6 s | Schach, Dame, Vierer-Schach, Go, Ludo, Mühle |
| `stein-fallen` | `click_plastic` | plastic disc dropping down a plastic grid and clattering to rest | 0.9 s | Vier gewinnt |
| `domino-klack` | – | heavy ceramic domino tile placed on a table next to others, bright click | 0.4 s | Domino |
| `domino-kette` | – | row of dominoes toppling one after another, fast cascade | 1.5 s | Domino (Sieg/Ende), optional Gomoku-Linie |
| `plaettchen-setzen` | – | wooden letter tile placed on a board, solid tock | 0.3 s | Wortgitter, Farbe & Form |

### 1.3 Würfel (3 Spiele)

| Neuer Name | Ersetzt | Prompt | Dauer | Spiele |
|---|---|---|---|---|
| `wuerfeln` | `wood_impact` | five wooden dice rolled in a hand and thrown onto a wooden table, rattle then settling | 1.3 s | Würfelblock |
| `wuerfel-einzeln` | – | single die tumbling across a wooden board and coming to rest | 0.9 s | Nicht ärgern!, Mäxle-Aufdecken |
| `wuerfelbecher-schuetteln` | – | dice shaken in a leather cup, rattling, then slammed upside down on a table | 1.4 s | Mäxle |
| `wuerfel-halten` | – | die tapped and set aside with a tiny wooden click | 0.3 s | Würfelblock (Halten) |

### 1.4 Ereignisse über alle Spiele hinweg

| Neuer Name | Ersetzt/ergänzt | Prompt | Dauer |
|---|---|---|---|
| `ansage` | `click_soft` | small hand bell, single clear ding with short ring | 0.6 s |
| `runde-gewonnen` | ergänzt `sieg` | short bright victory sting, major chord with glockenspiel, upbeat | 1.5 s |
| `runde-verloren` | ergänzt `niederlage` | gentle descending two-note trombone, friendly, not harsh | 1.2 s |
| `punkte-sammeln` | `points_counter` ok | coins/points ticking up quickly, 6 ticks, rising | 1.0 s |
| `los` | ergänzt Countdown | short referee start whistle | 0.5 s |
| `zug-hinweis` | ergänzt `dein-zug` | two soft wooden knocks, polite "your turn" | 0.4 s |

Für Countdown 3-2-1 liegen schon `countdown_00` bis `countdown_03` (Ansager aus der Enten-Rallye) in `duck-rally/`. Mit dem Namen `los` ergibt das einen Countdown für Kartenblitz und Speed ohne neue Stimme.

---

## 2. Stimme: einheitliche Ausrufe (Text-to-Speech, eine Stimme für alle)

Eine Stimme für alle Spiele hat doppelten Nutzen: sie wirkt wie ein „Spielleiter“ und verhindert zusammengewürfelte Stimmen. Wäre ein Herold mit tiefer Stimme (passt zu den Narrenhof-Kombis), kämen die Ausrufe aus derselben Quelle. Jeweils sehr kurz, 0,5 bis 1,2 s.

| Ausruf | Verwendung |
|---|---|
| „Eins!“ | Eins! (`calledUno`), Anprangern „Nicht gerufen!“ separat |
| „Mau!“ / „Mau-Mau!“ | Mau-Mau (`calledMau`, Sieg) |
| „Schach!“ / „Matt!“ / „Patt!“ | Schach, Vierer-Schach (ersetzt oder ergänzt das Dreieck `schach`) |
| „Atari!“ | Go (Atari-Go, Warnung) |
| „Mühle!“ | Mühle (neben `muehle`) |
| „Bingo!“ | Bingo |
| „Speed!“ / „Kartenblitz!“ | Speed, Kartenblitz (`speed`, `ligretto`) |
| „Re!“ / „Kontra!“ / „Keine Neunzig!“ | Doppelkopf-Ansagen |
| „Schneider!“ / „Schwarz!“ / „Ouvert!“ / „Hand!“ | Skat-Ansagen |
| „Kreuzer!“ / „Sauspiel!“ / „Wenz!“ / „Solo!“ / „Tout!“ | Schafkopf-Ansagen |
| „Durch!“ / „Abgehen!“ | Binokel |
| „Revolution!“ | Präsident |
| „Mäxle!“ | Mäxle (21) |
| „Richtig!“ / „Leider falsch.“ | Bibel-Quiz, Zielzahl, Rechenmauer (wenn Sprache erwünscht) |
| „Los!“ / „Fertig!“ | Wettrennen (Wort-Salat, Bibel-Quiz, Rechenmauer, Zielzahl) |

Das sind rund 30 Sprachschnipsel. Sie kosten ein paar Hundert Zeichen Guthaben, brauchen aber Aufmerksamkeit bei der Aussprache („Eins“, „Mäxle“, „Hand“).

---

## 3. Nach Spielgruppe (nur, was über die Grundausstattung hinausgeht)

### 3.1 Brettspiele

| Spiel | Idee | Prompt / Wiederverwendung |
|---|---|---|
| Schach, Vierer-Schach | Rochade: zwei Figuren nacheinander | Prompt: two wooden chess pieces moved in quick succession, knock then slide. Dauer 0.8 s |
| | Umwandlung: Bauer wird Dame | Reuse `magic_heal` oder `star_burst`; sonst: tiny magical sparkle on a wooden piece, 0.7 s |
| | Matt: König fällt | Prompt: wooden king piece tipped over on a board, rolling and settling, 1.0 s |
| | Schach-Warnung (ergänzt „Schach!“) | Reuse `hit_triangle` (steht schon) |
| Schach, Dame | Remis-Angebot | Prompt: two soft gentle chimes, polite offer, 0.8 s |
| Dame | Dame wird gekrönt | Reuse `crown_placed` |
| Go | Gefangene entfernen (mehrere Steine) | Prompt: several slate stones lifted off a board in quick succession, ceramic clicks, 0.8 s |
| | Passen, Zählphase | Reuse `click_soft` / Stein-Klick; kein eigener Klang nötig |
| Mühle | Mühle geschlossen | Behalten `hit_marimba`; optional Stimme „Mühle!“ |
| Reversi | Steine wenden | Prompt: several wooden discs flipping over in a ripple, fast clicks, 0.8 s. Reuse `ds_flipcard` für schnell |
| Ultimate Tic-Tac-Toe | Teilbrett gewonnen | Reuse `hit_marimba` (steht schon), Sieg: `correct_sparkle` |
| Gomoku | Fünf gewonnen | Prompt: five stones in a row lighting up, rising glass chimes, 1.0 s |
| Vier gewinnt | Reihe gewonnen | Reuse `correct_sparkle` + `stone_impact` |
| Schiffe versenken | Salve abfeuern | Prompt (kein passender Kanonenschuss im Bestand): single naval cannon shot with echo over water, 1.2 s |
| | Treffer, Wasser, Versenkt | Heute `arcade_explosion_1`, `water_splash`, `stone_impact` – Idee: Prompt: ship hit with metal groan and burst, 1.0 s; ship sinking with bubbling gurgle, 2.0 s |
| | Gesamtsieg (alle versenkt) | Prompt: ship horn blast, deep and long, 2.0 s |
| Nicht ärgern! | Figur kommt ins Haus | Prompt: pawn hopping five times on wooden board, light taps, 1.0 s |
| | Sechs gewürfelt | Reuse `star_collect_2` + Würfelklang |
| Mäxle | Becher aufheben (Aufdecken) | Prompt: leather dice cup lifted off a table slowly, 0.8 s |
| | Mäxle (21) geworfen | Stimme „Mäxle!“ + Reuse `hit_cymbal` |

### 3.2 Kartenspiele

| Spiel | Idee | Prompt / Wiederverwendung |
|---|---|---|
| Skat, Schafkopf, Doppelkopf, Binokel | Stich gewonnen (nach `trickTaken`) | `stich-einsammeln` (siehe 1.1) |
| | Spiel gewonnen / verloren | `runde-gewonnen` / `runde-verloren` |
| | Reizen, Passen | Prompt: wooden knock on table, single firm, 0.4 s (Skat: „Reizen“; Binokel/Schafkopf: „Klopfen“) |
| | Skat drücken / aufnehmen | Prompt: two cards pushed face-down across felt, 0.7 s |
| Schafkopf | Klopfen / Stoß (Verdopplung) | Prompt: two sharp knuckle knocks on a wooden tavern table, 0.6 s |
| Doppelkopf | Re/Kontra enthüllt | `hit_gong` kurz, oder Stimme |
| Eins!, Mau-Mau | +2/+4/Strafe | Prompt: cartoon "dun dun" brass sting, short and comical, 0.8 s (ersetzt `leben-weg` für Strafen) |
| | Richtungswechsel | Reuse `swipe_left` oder Prompt: quick whoosh with reversing rewind, 0.6 s |
| | Aussetzen | Prompt: cartoon "stop" sign flip with a short buzz, 0.5 s |
| | Farbwahl, Wunschfarbe | Reuse `magic_teleport` oder `click_bubble` |
| | Flip-Seite (Uno Flip) | Reuse `ds_flipcard` mit höherer Tonhöhe (`rate`) |
| | Eins/Mau nicht gerufen (Anprangern) | Reuse `record_scratch` (steht schon) |
| Präsident | Revolution | Prompt: crowd shouting with a drum roll and a crash, 1.5 s; Reuse `drum_roll`, `hit_cymbal` |
| | Ränge tauschen (Tausch zwischen Arsch und Präsident) | Prompt: two stacks of cards passed across a table, 0.8 s |
| | Präsident bestimmt | Reuse `crown_placed` |
| Poker | Chips setzen/call/raise | **Statt `fs_coin`:** Prompt: clay poker chips dropped in a small stack, 0.6 s (call); a handful of chips pushed forward, 1.0 s (bet/raise) |
| | All-in | Prompt: whole stack of poker chips pushed forward in a slide, then a dull knock, 1.4 s |
| | Fold | Reuse `ds_swipe` (steht schon) |
| | Blind-Anhebung | Reuse `hit_gong` oder `schach` (Dreieck) |
| | Handgewinn, Pot einsammeln | Prompt: chips raked across felt into a pile, 1.2 s |
| Kartenblitz (Ligretto), Speed | Karte klatscht auf den Mittelstapel | Prompt: card slapped hard onto a pile, sharp smack, 0.3 s |
| | Festgefahren | Prompt: game buzzer, short flat honk, 0.6 s |
| | Runde gewonnen | `runde-gewonnen` |
| Solitaire | Karte auf Fundament | Prompt: bright single note on a music box rising by a step, 0.4 s (Notenfolge 1 bis 13 je Wert!) |
| | Auto-Vervollständigen (Kaskade) | Prompt: playing cards cascading and bouncing off a table, fast, 2.5 s (wie Win-Solitaire) |
| | Spiel gelöst | Reuse `victory_fanfare` oder `tada_chime` |
| Quartett | Quartett vollständig | `stapel-fertig` ist da; Prompt für Variante: four small bells rising to a final chime, 1.2 s |
| | Frage stellen („Hast du …?“) | Reuse `click_soft` / `hover_sound` |
| Schwarzer Peter | Peter gezogen | Prompt: cartoon cat hiss and a short "dun dun dun", 1.0 s; Reuse `cat_meow` |
| | Paar ablegen | `correct_pop` (steht schon) |
| Paare | Gleiches Paar | `correct_pop` / `correct_sparkle` |
| | Spielende | Reuse `tada_chime` |
| Bingo | Kugel aus der Trommel | Prompt: lottery drum tumbling balls then one ball rolling out and clacking, 1.5 s |
| | Feld markiert | Prompt: marker pen dot being stamped on paper, 0.3 s (Reuse `pencil_scratch`) |
| | Bingo gültig / ungültig | Stimme „Bingo!“, `buzzer_fail` |

### 3.3 Wort- und Wissensspiele

| Spiel | Idee | Prompt / Wiederverwendung |
|---|---|---|
| Wortgitter | Wort gelegt (3 Stufen nach Länge) | Prompt: wooden tiles clicking into a rack, rising soft marimba note; kurz, mittel, lang (0.5 / 0.9 / 1.4 s) |
| | Bingo (7 Steine, 50 Punkte) | Reuse `hit_bell_church` + `applause_small` |
| | Buchstaben tauschen | Prompt: wooden tiles shaken in a cloth bag, 1.0 s |
| Galgenmännchen | Buchstabe richtig | Prompt: pen writing a letter on a chalkboard, short tick, 0.3 s (Reuse `chalk_write`) |
| | Buchstabe falsch | Prompt: wooden creak of a gallows and a small drop, 0.8 s; Reuse `wood_creak` |
| | Wort verloren | Prompt: sad slow descending three-note tuba, 1.5 s (Reuse `hit_piano_sad`) |
| | Wort gewonnen | Reuse `tada_chime` oder `correct_sparkle` |
| Wort-Salat | Wort gefunden (nach Länge) | `plaettchen-setzen` + aufsteigende Töne; Prompt: short rising xylophone run, 3 Längen |
| | Perle (einzigartig) | Prompt: bright sparkle with a tiny gem chime, 0.7 s |
| Bibel-Quiz | Antwort richtig | Prompt: soft harp glissando, warm and gentle, 1.0 s (Reuse `hit_harp`) |
| | Antwort falsch | Prompt: soft low wooden bell, gentle not shameful, 0.8 s (kein harter Buzzer, ist ein Kinderspiel) |
| | Auflösung / Lobruf | Prompt: church bell once, warm, with a faint choir "ah", 2.0 s (Reuse `hit_bell_church`, `hit_choir_heaven`) |
| | Frage wechselt | Prompt: page of a big book turning, 0.7 s (Reuse `book_opening`) |

### 3.4 Mathe

| Spiel | Idee | Prompt / Wiederverwendung |
|---|---|---|
| Zielzahl | Zahl getroffen | Reuse `math_calculator`, `correct_perfect` |
| | Knapp daneben | Prompt: calculator beeping a soft error, 0.5 s |
| Teiler-Duell | Zug gültig | Reuse `stein-setzen` |
| | Steuereintreiber nimmt Zahl | Prompt: coin bag taken away with a soft jingle, 0.8 s (Reuse `coin_purse`) |
| Rechenmauer | Stein richtig | Prompt: stone brick laid into a wall with mortar squelch, 0.5 s (Reuse `brick_lay`) |
| | Mauer fertig | Prompt: short fanfare of builders: hammer clinks and a trumpet, 1.5 s |
| Enten-Rallye | hat eigene Töne | nichts nötig |

### 3.5 Drachenspiel (Tierstimmen vorhanden, Fähigkeiten fehlen)

Hier reichen meist Wiederverwendungen aus PepperMINT. Neu erzeugen nur, wenn sie nicht überzeugen:

| Fähigkeit/Ereignis | Wiederverwendung | Neu (falls nötig) |
|---|---|---|
| Beschützer 🛡️ | `shield_block`, `magic_shield` | – |
| Flink ⚡ | `speed_up`, `sword_swing` | quick whoosh with spark, 0.4 s |
| Schutzblase 🫧 | `balloon_pop`, `click_bubble` | bubble forming and popping, 0.6 s |
| Giftig 🧪 | `snake_hiss`, `chemistry_boil` | green potion splash with hiss, 0.8 s |
| Versteckt 🌙 | `ghost_woosh`, `owl_hoot` | quiet wind with a hush, 0.8 s |
| Auftritt 🎺 | `hit_trumpet` | short brass call, 0.8 s |
| Abschied 👋 | `hit_flute`, `arcade_item_drop` | soft descending sparkle, 0.8 s |
| Kristall (Mana) | `gem_collect`, `star_collect_1` | crystal chime, 0.5 s |
| Held stirbt | `dragon_roar`, `glass_shatter` | – |
| Sieg | `victory_fanfare` | – |

### 3.6 Narrenhof

Siehe [`narrenhof-klaenge.md`](narrenhof-klaenge.md). Mit den Klängen dieser Gesamtliste profitiert er von `karte-legen`, `karten-austeilen`, `runde-gewonnen`, `los`, `ansage`.

---

## 4. Synergie-Tabelle: ein Klang, viele Spiele

| Klang | Spiele |
|---|---|
| `karte-legen` | 11 Kartenspiele + Narrenhof |
| `karte-ziehen` | 13 Spiele |
| `stein-setzen` | 12 Spiele |
| `stein-ziehen`, `stein-schlagen` | Schach, Vierer-Schach, Dame, Mühle, Ludo, Go |
| `wuerfeln`, `wuerfel-einzeln` | Würfelblock, Nicht ärgern!, Mäxle |
| `ansage` | 8 Spiele |
| `runde-gewonnen`, `runde-verloren` | alle Mehrrunden-Spiele (Stich- und Echtzeitspiele, Wettrennen) |
| `los` + `countdown_*` | Kartenblitz, Speed, Wort-Salat, Bibel-Quiz, Rechenmauer, Zielzahl |
| Stimme „Herold“ | alle Ausrufe in Abschnitt 2 |
| `stich-einsammeln` | vier Stichspiele + Präsident |

Weniger Klänge, mehr Wirkung: die Abschnitte 1 und 2 enthalten rund 35 Dateien und betreffen fast alle Spiele.

## 5. Technik und Umsetzung

- **Nur Katalog:** Die Grundausstattung ändert in `catalog.json` die Datei und Länge hinter bestehenden Namen. Kein Spielcode, kein Test. Neue Namen (zum Beispiel `stein-schiefer`) brauchen zusätzlich einen Eintrag in `gameUi.sounds` des Spiels.
- **Varianten:** `SoundPlayer` hat ±3 % Tonhöhe zufällig, aber keine Varianten pro Ereignis. Mit je 2 bis 3 Varianten (`karte-legen-a/b/c`) wäre das Abspielen natürlicher. Dafür bräuchte der Katalog eine Liste (`files: []`). Das wäre eine kleine Änderung in `packages/ui/src/audio/sound.ts`.
- **Größe:** `apps/web/klaenge.ts` baut höchstens 1,5 MB vorab ein. Neue Dateien sollten kurz sein (unter 1,5 s, etwa 12 bis 25 KB), die langen (Kaskade, Schiffsuntergang) laden bei Bedarf.
- **Lautstärke:** Nach dem Erzeugen auf etwa −14 LUFS angleichen (wie die Enten-Rallye-Ansagen) und Stille am Anfang und Ende wegschneiden (`ffmpeg`).
- **Kosten:** Die 24 Narrenhof-Entwürfe haben rund 300 von 10 000 Guthaben gebraucht. Für etwa 60 weitere Klänge in je 3 Varianten (rund 180 Dateien) wäre mit grob 2 000 bis 3 000 Guthaben zu rechnen. Die Aufmerksamkeit beim Anhören ist der Engpass, nicht das Guthaben.

## 6. Reihenfolge-Vorschlag

1. **Katalog-Umlenkung mit vorhandenen Dateien** (kostenlos): `mischen` → `fs_shuffle`; testweise `crown_placed` usw. Zum Probehören.
2. **Abschnitt 1.1 bis 1.3** erzeugen (Karten, Steine, Würfel): rund 15 Klänge, größte Wirkung.
3. **Abschnitt 1.4 und Stimme** (Abschnitt 2): einheitlicher Rahmen.
4. **Abschnitt 3** nach Lust: Poker-Chips, Solitaire-Kaskade, Bibel-Quiz, Schiffe, Wortgitter.
5. Narrenhof-Klänge aus [`narrenhof-klaenge.md`](narrenhof-klaenge.md) laufen parallel (Entwürfe sind schon erzeugt).
