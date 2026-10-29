# Farbensortierer

| Steckbrief | |
|---|---|
| Spieler | 1 (Lauf) bzw. 2–8 (Duell, Überleben, Wettrennen) |
| Dauer | Solo 30–60 Minuten pro Lauf, Duell zu zweit 20–40 Minuten |
| Modi | Solo, gegen Bots, Hot-Seat (rundenweise abwechselnd), online |
| Muster | **parallele Läufe mit gleichem Seed** plus **gleichzeitige Phasen** (Treffpunkte) |
| Bausteine | Karten-Baukasten (Emoji-Karten), Phasen-Timer, flüchtige Signale (Live-Punkte), Inhaltsdaten für Mods |
| Aufwand | Regeln L, Oberfläche L, Bot M |
| Etappe | 6 (früher „Emoji-Sortierer“), vorgezogen im Oktober 2026 |
| Vorlage | Cornelius' Klon „Emoji-Sortierer“ (`~/code/emojiclicker/minigames/emoji-sortierer/`, nur als Vorlage lesen) |

Deckbau-Kartenspiel nach dem Vorbild von Balatro mit **allen Grundmechaniken** (Packs, Gutscheine, Marken, Decks, Schwierigkeitsstufen, Verbrauchsgegenstände, Veredelungen, Folien, Siegel), aber **ohne Glücksspiel-Anmutung** (Jugendschutz): keine Poker- und Casino-Begriffe, kein Geld-Look, keine Spielautomaten-Effekte. Man sortiert Emoji-Karten nach **Farben** und **Zahlen** zu Kombinationen, besiegt Tier-Gegner und baut sich zwischen den Runden in der **Sortier-Zentrale** ein Team aus **Mods** (Helfern) auf.

Von Anfang an mit Mehrspieler gedacht, angelehnt an die Balatro-Multiplayer-Mod: alle spielen **denselben Lauf** (gleicher Seed, gleiche Karten, gleiche Läden) und treffen sich in **Duell-Runden**, in denen die höhere Punktzahl gewinnt.

## Name und Thema

Begriffe aus dem Klon werden übernommen; was dort noch nach Glücksspiel klingt, wird ersetzt (Vorschläge, mit Cornelius abzustimmen).

| Balatro | Klon „Emoji-Sortierer“ | Farbensortierer |
|---|---|---|
| Joker | Helfer / MOD | **Mod** |
| Geld ($) | T (Token) | **T (Token)** |
| Shop | Sortier-Zentrale | **Sortier-Zentrale** |
| Reroll | Neu Würfeln (5 T) | **Neu sortieren** (5 T) |
| Ante | Level | **Level** |
| Small/Big Blind | Kleine/Große Blende | **Vorhut** / **Wächter** (Tier-Gegner mit Lebenspunkten) |
| Boss Blind | Boss | **Boss** (25 Tiere und Fabelwesen) |
| Zinsen | Bonus-Zinsen | **Ordnungsbonus** |
| Tarot | Zauberkarten | **Zauberkarten** |
| Planet | Hand-Upgrades (Nagelstudio) | **Nagelstudio** |
| Enhancement | Veredelungen (Friseur-Salon) | **Friseur-Salon** |
| Edition | Spezial-Folien (Druck-Technik) | **Druck-Technik** |
| Seal | Abzeichen (nur geplant) | **Abzeichen** |
| Lucky Card | Glücks-Welle | **Sternen-Welle** |
| Booster Pack | – | **Lieferung** (Kiste, Mappe, Set; siehe unten) |
| Voucher | – | **Werkzeug** (dauerhafte Verbesserung der Zentrale) |
| Tag (Blind überspringen) | – | **Abkürzung** mit **Sticker** als Belohnung |
| Spectral Card | – | **Traumkarten** |
| Seal | Abzeichen | **Abzeichen** |
| Deck | – | **Kartensätze** |
| Stake | – | **Sortierstufen** (Weiß bis Gold) |

### Glücksspiel-Anmutung vermeiden – Regeln für alle Mechaniken

Die Mechanik bleibt, die Verpackung ändert sich:

- **Packs heißen Lieferungen** und dürfen **spannend** sein, aber als Paket-Auspacken statt als Automat: Das Paket wackelt, das Klebeband reißt, die Karten werden einzeln umgedreht (Tippen beschleunigt), seltene Funde bekommen einen eigenen Effekt im Werkstatt-Stil (Funken, Konfetti aus Farbschnipseln, Staunen-Emoji). Danach wählt man 1 (bzw. 2) aus. Nicht verwendet werden die typischen Automaten-Zeichen: drehende Walzen, Münz- und Jackpot-Klänge, blinkende Lichterketten, „Fast gewonnen“-Effekte (knapp verpasste seltene Karte zeigen).
- **Wahrscheinlichkeiten offen:** Jede Lieferung, der Laden und jeder Mod mit Zufall zeigen ihre Quoten im Tooltip („Selten: 5 %“).
- **Token sind Werkstatt-Marken**, kein Geld: Symbol 🔩 statt Münze, kein Klimpern, keine Geldscheine, kein „Kontostand“. Token gelten nur im Lauf. Daneben gibt es eine **Meta-Währung** (siehe unten), aber **nie echte Käufe**.
- **Kein Einsatz-Gefühl:** Begriffe wie Blind, Ante, Stake, Jackpot, All-In, Zinsen, Kasse, Würfeln, Wette kommen nicht vor. Die Ideen-Kategorie „Glücksspiel & Casino“ aus `joker-ideen.md` wird umgedeutet (z. B. Einarmiger Bandit → 🤖 Sortierroboter mit derselben Wirkung) statt gestrichen.
- **Zufall bleibt** (Mischen, Laden, Mods wie 🐛 Der Bug), aber es wird nie etwas gesetzt, das man verlieren kann.

## Neues Thema: Narrenhof (Vorschlag, 29.10.2026, Schritte 1 bis 4 umgesetzt)

Das Emoji-Blatt mit eigenen Kombi-Namen fühlt sich nicht griffig an, und die Welt ist zusammengewürfelt (Sortier-Zentrale, Nagelstudio, Friseur-Salon, Druckerei, Werkstatt). Vorschlag: **zurück zum vertrauten 52er-Blatt und zu den bekannten Kombi-Namen, aber in einer ganz eigenen Welt: einem Fabeltier-Königshof, an dem man als junger Narr die Herrschaften zum Lachen bringt.** Der Joker ist historisch der Narr, und König, Dame und Bube stehen schon auf den Karten. Die Spiel-id `color-sorter` bleibt (wie bei Kniffel/Ligretto), damit Links, Online-Räume und Spielstände weiter funktionieren.

**Arbeitstitel:** **Narrenhof** (Alternativen: Narrenblatt, Hofnarr, Narrenkappe).

**Geschichte in einem Satz:** Am Hof von König Nobel, dem Löwen, wird ein neuer Hofnarr gesucht. Acht Hoftage lang musst du Höflinge, Edle und zuletzt die Herrschaften selbst zum Lachen bringen, mit Karten, Kunststücken und einer bunten Truppe anderer Narren.

Die Tierfiguren von König Nobels Hof stammen aus *Reineke Fuchs* (Goethe 1794, gemeinfrei). So bleiben die Tier-Gegner, die Bosse und die Tierstimmen aus `tiere/` erhalten.

### Plagiats-Fingerabdrücke im jetzigen Stand

Rechtlich frei sind Regeln und Mechaniken (Pokerhände, Grundwert × Multiplikator, Laden, Packs). Geschützt sein kann der **Ausdruck**: Optik, Namen, Texte, Bilder und die Auswahl und Anordnung der Inhalte. Der jetzige Stand ist dort an vielen Stellen eine **Übersetzung von Balatro**, nicht bloß eine Anlehnung:

- **Zahlen:** Die Grundwerte *und* die Steigerung je Level aller 12 Kombis, die Ziele je Level (300, 800, 2.000 … 50.000), Belohnung 3/4/5 und Zinsen „1 je 5, höchstens 5“ sind identisch.
- **Kataloge:** alle 22 Zauberkarten mit den Tarot-Namen und Balatro-Wirkungen, die Traumkarten mit übersetzten Namen (Familienfoto, Talisman, Déjà-vu, Trance, Medium, Aura, Spukgestalt, Seele, Schwarzes Loch), die vier Abzeichen in denselben Farben, die Sortierstufen in denselben acht Farben (Weiß, Rot, Grün, Schwarz, Blau, Lila, Orange, Gold), die Kartensätze nach Farben (Rot +1 Verwerfen, Blau +1 Hand, Gelb +10 …), die Aufkleber (angeklebt, vergänglich, geliehen) und die Werkzeug-Paare.
- **Mods:** ein Teil ist Balatro-Joker mit deutschem Namen (Fröhlich, Verrückt, Wimpel, Eiswaffel, Popcorn, Busfahrt, Banane u. a.).

Eine einzelne Übereinstimmung ist unproblematisch. Die **Summe** ist der Fingerabdruck. Das neue Thema löst die Namen, aber **Zahlen und ein Teil der Wirkungen sollten mit umgebaut werden** (siehe Werte unten). Die Mods werden Schritt für Schritt zu Narren mit eigenen Ideen, nicht nur umbenannt.

### Begriffe

| Balatro | Bisher (Farbensortierer) | **Narrenhof** | Begründung |
|---|---|---|---|
| Spielkarten | Emoji-Blatt (1–9, Baby, Mädchen, Junge, Santa; 🔴🟡🔵🟢) | **52er-Blatt** 2–10, Bube, Dame, König, Ass; ♥ ♦ ♠ ♣ (wählbar: französisch / vierfarbig) | vertraut, `PlayingCard` aus `packages/ui` ist fertig |
| Play Hand | Abschicken | **Vorführen** (4 je Audienz) | |
| Discard | Verwerfen | **Tauschen** (3 je Audienz) | |
| Chips | Chips | **Witz** (blau) | die Pointe |
| Mult | Mult | **Lachen** (rot, „× Lachen“) | |
| Score | Punkte | **Applaus** 👏 = Witz × Lachen | „Witz 40 × Lachen 4 = 160 Applaus“ |
| Ante | Level | **Hoftag** (1–8) | |
| Small Blind | Vorhut | **Morgenaudienz** vor einem Höfling | |
| Big Blind | Wächter | **Festmahl** vor einem Edlen | |
| Boss Blind | Boss | **Thronsaal** vor einer **Herrschaft** mit **Marotte** (Boss-Regel) | „Der Bär mag keine Kreuze.“ |
| Ziel (Blind-Wert) | Lebenspunkte des Tiers | **Applaus-Ziel**; die Miene der Herrschaft wandert mit dem Fortschritt 😐 → 🙂 → 😄 → 😂 | eigenes Bild statt Lebensbalken |
| Geld ($) | Token 🔩 | **Brezeln** 🥨 | Narren wurden mit Essen entlohnt; kein Geld, schwäbisch |
| Zinsen | Ordnungsbonus | **Vorratsbonus** (Privileg „Vorratskammer“ hebt die Obergrenze) | |
| Shop | Sortier-Zentrale | **Jahrmarkt** (Stände) | |
| Reroll | Neu sortieren | **Weiterschlendern** | |
| Joker | Mods | **Narren**, 5 Plätze auf der **Narrenbank** | |
| Joker-Seltenheit | gewöhnlich … legendär | gewöhnlich, ungewöhnlich, selten, **legendär** | bleibt verständlich |
| Tarot | Zauberkarten | **Kunststücke** 🎭 (2 Plätze in der **Narrentasche**), verändern Karten | keine Tarot-Namen mehr |
| Planet | Nagelstudio | **Übungen** 📖 („Übung: Jonglage“ → Drilling +1 Stufe); jede Kombi hat eine eigene Disziplin (siehe Kombis) | „Übung macht den Meister“ |
| Spectral | Traumkarten | **Kuriositäten** 🏺 aus der Wunderkammer, starke Wirkung mit Preis | keine Okkult-Begriffe (Trance, Medium, Seele) |
| Enhancement | Friseur-Salon | **Schneiderei** 🧵 (Verzierungen an Karten) | |
| Edition | Druck-Technik | **Glanz**: Vergoldet, Perlmutt, Buntglas, **Unsichtbar** (+1 Narrenplatz) | |
| Seal | Abzeichen (Gold/Rot/Blau/Lila) | **Wappen** mit Bild statt Farbe: 🥨 Brezel, 🔁 Echo, 🦉 Eule, 🪶 Feder | weg vom Farbschema |
| Booster Pack | Lieferung | **Bündel** vom Markt: Narrenkorb, Trickbeutel, Bücherbündel, Wunderkiste, Kartenbündel; je klein, groß, riesig. Auspacken: Schnur aufknoten, Tuch wegziehen | |
| Voucher | Werkzeug | **Privilegien** 📜, vom König verliehen, zweistufig (z. B. Marktrecht → Großes Marktrecht: +1 Stand) | |
| Skip Blind + Tag | Abkürzung + Sticker | **Auslassen**, dafür schuldet dir der Hof einen **Gefallen** 🎀 („nächstes Bündel gratis“) | |
| Deck | Kartensätze (Rot-, Blau-, Gelb-Satz …) | **Narrenkappen**: Jede Kappe ist eine Herkunft mit Startvorteil (Wandergaukler +1 Tauschen, Klosterschüler +1 Vorführen, Bäckerskind +10 🥨 …) | weg von den Balatro-Deckfarben |
| Stake | Sortierstufen Weiß … Gold | **Hofränge**: Lehrling, Geselle, Spaßmacher, Hofnarr, Oberhofnarr, Königsnarr, Narrenmeister, Narrenkönig | weg von den Balatro-Farben |
| Eternal / Perishable / Rental | Angeklebt / Vergänglich / Geliehen | **Treu** (unverkäuflich) / **Müde** (geht nach 5 Audienzen) / **Gastnarr** (kostet 🥨 je Audienz) | |
| – | Farbtropfen 💧 | **Glöckchen** 🔔 (von der Narrenkappe) | |
| – | Atelier | **Narrenschule** (Freischaltungen, Schmuck) | |
| – | Atelier-Lieferung | **Schulranzen** (bringt eine noch gesperrte Sache, keine Dubletten, Quoten offen) | |
| – | Album | **Hofchronik** | |
| Multiplayer: PvP-Blind | Duell | **Wettstreit** (zwei Narren vor demselben Thron) | |
| | Showdown / Überleben / Wettrennen | **Großer Wettstreit** / **Ausdauer** / **Wettlauf** | |
| | Leben | **Herzen** ❤️ | |

### Kombis

Die Namen sind Kniffel- und Rommé-Vokabular, kein Casino-Wort. Jede Kombi bekommt eine Narren-Disziplin; die zugehörige Übungskarte steigert sie.

| Kombi | Disziplin (Übung) | Witz | Lachen | +Witz je Stufe | +Lachen je Stufe |
|---|---|---|---|---|---|
| Hohe Karte | 😝 Grimasse | 8 | 1 | 8 | 1 |
| Paar | 🗣️ Wortspiel | 12 | 2 | 12 | 1 |
| Zwei Paare | 🔀 Doppelsinn | 24 | 2 | 16 | 1 |
| Drilling | 🤹 Jonglage | 25 | 3 | 20 | 2 |
| Straße | 🦯 Stelzenlauf | 35 | 4 | 25 | 2 |
| Farbe | 🎨 Farbenspiel | 40 | 4 | 18 | 2 |
| Full House | 🤸 Menschenpyramide | 45 | 4 | 25 | 2 |
| Vierling | 🔥 Feuerspucken | 60 | 6 | 30 | 3 |
| Farbstraße | 🎪 Seiltanz | 90 | 9 | 40 | 3 |
| Fünfling *(versteckt)* | 🗼 Narrenturm | 110 | 11 | 35 | 3 |
| Full House in Farbe *(versteckt)* | 🎆 Feuerwerk | 130 | 13 | 40 | 4 |
| Farb-Fünfling *(versteckt)* | 👑 Königsnummer | 150 | 15 | 50 | 4 |

**Kartenwerte (Witz je gewertete Karte):** Augenzahl 2–10, **Bube 11, Dame 12, König 13, Ass 14**. Das ist intuitiver als „alle Bilder 10, Ass 11“ (Wert = Rang) und hebt sich ab. Weil die Karten dadurch etwas mehr Witz bringen, liegen die Grundwerte von Hoher Karte bis Drilling nur leicht über bzw. unter dem alten Stand, und Vierling und Farbstraße haben weniger Lachen.

**Ass in der Straße:** nur oben (10-B-D-K-A), wie bisher Santa. Die Farbstraße von der 10 bis zum Ass heißt **Königsstraße** (früher „FarbenLauf Deluxe“). Das ist einfacher zu erklären als „Ass auch unten“, kann aber als Option „Ass auch unten (A-2-3-4-5)“ dazukommen.

### Ziele und Belohnungen

| Hoftag | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Grundziel | 300 | 750 | 1.900 | 4.600 | 10.000 | 19.000 | 33.000 | 52.000 |

- Morgenaudienz ×1, Festmahl ×1,5, Thronsaal **×2,2** (Marotte und Ziel zusammen machen den Thronsaal zum Höhepunkt).
- Belohnung: Morgen **3 🥨**, Festmahl **4 🥨**, Thronsaal **6 🥨**; dazu **1 🥨 je übrige Vorführung**.
- **Vorratsbonus:** +1 🥨 je 6 🥨 im Vorrat, höchstens **+4** (Privilegien erhöhen die Obergrenze).
- Unverändert (Grundmechanik, gut erprobt): 8 Handkarten, 1–5 auswählen, 4 Vorführungen, 3 Tausche, 5 Narrenplätze, Start mit 4 🥨.
- **Alle Zahlen sind Startwerte.** Nach dem Umbau mit dem Bot nachmessen: Ziel bleibt „schwer schafft Hoftag 8 in mindestens 30 % der Läufe“, bei Bedarf die Ziele um ±10 % verschieben.

### Die ersten 10 Narren

Eigene Ideen aus der Narrenwelt, bewusst keine Balatro-Joker. Preise in 🥨. Umgesetzt ersetzen sie die zehn Mods, die Balatro-Joker am direktesten nachbildeten (Smiley, Wanderer, Wimpel, Eiswaffel, Popcorn, Goldei, Jongleur mit +1 Handgröße, Bastelkleber, Liedermacher, Busfahrt); Cornelius' eigene Mods aus dem Emoji-Sortierer bleiben. In der Umsetzung heißt die Morgenaudienz-Bedingung des Frühaufstehers „erste Audienz eines Hoftags“ (`run.round === 0`), das Hofäffchen verliert alles, sobald irgendein Narr dazukommt (auch durch Kunststücke), und der Herold wechselt die Kombi nach jeder gewonnenen Audienz nach einer festen Regel (`value`, nur die neun offenen Kombis).

| Narr | Wirkung | Preis | Seltenheit |
|---|---|---|---|
| 🤹 Der Jongleur | +2 Lachen je gewertete Karte | 5 | gewöhnlich |
| 🎻 Die Spielfrau | +30 Witz, wenn die Kombi genau 3 Karten wertet (Dreivierteltakt) | 5 | gewöhnlich |
| 🐓 Der Frühaufsteher | in der Morgenaudienz ×2 Lachen, sonst +3 Lachen | 6 | gewöhnlich |
| 🥨 Der Bäckerjunge | +1 🥨 für jeden gewerteten Buben | 5 | gewöhnlich |
| 🪕 Der Bänkelsänger | +5 Witz für jede Vorführung, die du an diesem Hoftag schon gemacht hast (beginnt jeden Morgen bei 0) | 6 | gewöhnlich |
| 🐒 Das Hofäffchen | +1 Lachen dauerhaft für jede Karte, die du tauschst (höchstens +20); eifersüchtig: verliert alles, wenn du einen weiteren Narren kaufst | 6 | ungewöhnlich |
| 📚 Der Bücherwurm | +1 Lachen je Stufe der vorgeführten Kombi | 7 | ungewöhnlich |
| 📯 Der Herold | ruft zu Beginn jeder Audienz eine Kombi aus; führst du sie vor: ×3 Lachen | 7 | ungewöhnlich |
| 💑 Das Königspaar | ×2 Lachen, wenn König und Dame derselben Farbe gewertet werden | 8 | selten |
| 🎭 Der Doppelgesichtige | die erste Vorführung jeder Audienz wertet alle Karten zweimal | 10 | selten |

Der Herold bringt nebenbei die Kombi-Namen bei. Das Hofäffchen und der Bänkelsänger belohnen Spielweisen (viel tauschen bzw. viele kleine Vorführungen), die bisher kein Mod abdeckte. Die übrigen 40 Mods werden beim Umbau einzeln geprüft: Die Übersetzungen von Balatro-Jokern bekommen eine neue Idee, die eigenen (z. B. 🥧 Pi, 🐛 Der Bug, 404) werden passend umgekleidet (🥧 → „Der Rechenmeister“).

### Herrschaften und Höflinge (Bosse und Gegner)

Wirkungen bleiben, nur Name und Rolle ändern sich. Muster: **Hoftitel + Tier**. Beispiele:

| Bisher | Narrenhof |
|---|---|
| 🦁 Goldener Löwe | **König Nobel** (Vorschlag: immer die Herrschaft von Hoftag 8) |
| 🐺 Alpha-Wolf | Ritter Isegrim |
| 🐻 Papa Bär | Braun, der Bär (Truchsess) |
| 🕷️ Mutterspinne | Gräfin Spinnweb |
| 🐸 Frosch-König | Der Froschkönig (Gast, Grimm gemeinfrei) |
| 🦉 Uhu-Oma | Hofgelehrte Uhu |
| 🐊 Kroko-Boss | Zöllner Kroko |
| 🐍 Riesen-Schlange | Kanzlerin Natter |
| 🦈 Hai-General | Admiral Hai |
| 👻 Schloss-Gespenst | Das Schlossgespenst |
| 🐉 Der Drache | Drachenfürstin |
| 🦄 Einhorn-Prinzessin | Prinzessin Einhorn |

Die übrigen 13 entsprechend (Gäste von weither wie „Yeti aus dem Norden“, „Feuerfürst Phönix“). Die 20 Tier-Gegner der Morgenaudienz und des Festmahls werden Höflinge und Edle („Page Maus“, „Zofe Marienkäfer“, „Freiherr Dachs“).

### Optik

- **Hintergrund:** Harlekin-Rauten in gedeckten Hoffarben (Weinrot, Senfgelb, Tannengrün) auf Stoff- bzw. Pergamentstruktur. **Kein** Wabern, kein CRT, keine Pixelschrift, kein grüner Filz.
- **Oben:** der Thron mit der Herrschaft (Emoji groß) und ihrer **Miene** als Fortschritt statt Lebensbalken, darunter die Marotte als Spruchband.
- **Mitte:** die Narrenbank (5 Plätze), Wertung als Spruchband „Witz × Lachen“, Applaus fliegt als 👏 zur Herrschaft, die Miene springt eine Stufe weiter.
- **Unten:** die Hand mit `PlayingCard` aus `packages/ui`, Kartenrücken als Schmuck aus der Narrenschule.
- **Jahrmarkt:** Marktstände mit Stoffdach; Bündel werden aufgeknotet.
- **Klänge:** Die vorhandenen passen größtenteils (Karten, Wertung, Tierstimmen). Für Brezeln statt Münzen, Applaus, Lachen und Fanfare schlägt Claude Kandidaten aus dem Sound-Index vor; **Cornelius wählt aus**. Die Sprachaufnahmen der Kombis (`fs_hand_*`) sagen die alten Namen und müssten neu aufgenommen oder weggelassen werden.

### Kurzanleitung (Entwurf für `howToPlay`)

1. Du bist ein junger Narr am Hof von König Nobel. Du hast 8 Karten auf der Hand. Wähle bis zu 5 aus und führe sie vor: Paar, Drilling, Straße, Farbe, Full House … bringen Witz und Lachen. Applaus = Witz × Lachen.
2. Jede Audienz hat ein Applaus-Ziel. Du hast 4 Vorführungen und 3-mal Tauschen. Ein Hoftag hat drei Audienzen: Morgenaudienz, Festmahl und Thronsaal, wo die Herrschaft eine Marotte hat. Morgenaudienz und Festmahl darfst du auslassen, dann schuldet dir der Hof einen Gefallen.
3. Nach jeder Audienz bekommst du Brezeln 🥨 für den Jahrmarkt: Narren helfen dir dauerhaft, Kunststücke verändern deine Karten, Übungen machen eine Kombi stärker, Bündel enthalten eine Auswahl, Privilegien gelten bis zum Ende.
4. Bringst du am achten Hoftag König Nobel zum Lachen, wirst du Hofnarr.
5. Zu mehreren spielt jeder seinen eigenen Lauf mit denselben Karten. Ab Hoftag 2 ersetzt ein Wettstreit den Thronsaal: Wer weniger Applaus bekommt, verliert ein Herz. Wer zuletzt noch Herzen hat, gewinnt.

### Umbau in Schritten

1. ✅ **Blatt und Kombis** (29.10.2026): Farben intern `h/s/d/c` (früher `r/y/b/g`: Rot → Herz, Blau → Pik, Gelb → Karo, Grün → Kreuz), Ränge 2–14 (`JACK`, `QUEEN`, `KING`, `ACE` in `src/cards.ts`), Witz = Rang, neue Kombi-Tabelle und -Namen. Mods, Bosse, Zauber- und Traumkarten, die Farben oder Ränge nennen, zeigen auf das neue Blatt (Santa → Ass, Baby → 10 bzw. Bildkarte, „blaue Karte“ → Pik usw.). Die Karten zeigen Rang und Farbzeichen in vier Farben (♥ rot, ♠ schwarz, ♦ blau, ♣ grün); das eigentliche Hof-Aussehen folgt in Schritt 5. `ruleVersion` 2.
2. ✅ **Zahlen** (29.10.2026): Ziele, Rundenfaktoren (`ROUND_FACTORS` 1 / 1,5 / 2,2), Belohnungen (`ROUND_REWARDS` 3 / 4 / 6) und Ordnungsbonus (`BONUS_STEP` 6, `bonusCap` 4 / 8 / 16) wie in den Tabellen oben. **Messung** (100 Solo-Läufe, Bot mit 10 ms je Zug): vorher erreichte der mittlere Bot im Schnitt Level 3,6 und der schwere 3,3, jetzt 3,7 bzw. 3,5; kein Bot gewinnt einen Lauf, weder vorher noch nachher. Der Schwierigkeitsgrad ist also etwa gleich geblieben, das Ziel „schwer schafft Level 8 in 30 %“ verfehlt der Bot aber schon immer. Der schwere Bot ist sogar schwächer als der mittlere, und mehr Rechenzeit (500 ms) hilft kaum. Das ist eine eigene Baustelle (Laden- und Mod-Strategie des Bots), unabhängig vom Thema. Nachtrag: Bot überarbeitet, siehe Abschnitt „Bot“ (schwer jetzt Ø 5,4–6,3, Level 8 in 1–14 % je nach Stand).
3. ✅ **Namen und Texte** (29.10.2026): Spielname **Narrenhof** (🃏, id bleibt `color-sorter`), alle Begriffe der Tabelle oben in allen Texten, Kurzanleitung neu. Neue Einzelnamen: Übungen nach Disziplin (Grimasse … Königsnummer), Schneiderei (🪨 Pflasterstein, 🔔 Schellenbesatz, 💄 Schminke, 🧩 Flickenmuster, 🧵 Goldstickerei, 🫧 Glasperlen, 🛡️ Kettenhemd, 🍀 Kleeblatt), Glanz (✨ Vergoldet, 🦪 Perlmutt, 🪟 Buntglas, 👻 Unsichtbar), Wappen (🥨 Brezel, 🔁 Echo, 🦉 Eulen, 🪶 Feder), Bündel (🧺 Narrenkorb, 👝 Trickbeutel, 📚 Bücherbündel, 🏺 Wunderkiste, 🎴 Kartenbündel), Privilegien (Marktrecht, Hoflieferant, Kurze Wege, Zugabe, Kartentisch, Weite Ärmel, Größere Narrentasche, Vorratskammer, Zweite Narrenbank, Bittschrift/Gnadengesuch), Gefallen, Narrenkappen (Schlichte Kappe, Wandergaukler, Klosterschüler, Bäckerskind, Bauernkind, Puppenspieler, Zauberlehrling), Hofränge (Lehrling bis Narrenkönig), Aufkleber (Treu, Müde, Gastnarr), alle 48 übrigen Mods als Narren-Figuren (z. B. 🤡 Der Spaßmacher, 🥧 Der Rechenmeister, 🤪 Der Tollpatsch, 😇 Der Schutzengel), 25 Herrschaften und 20 Höflinge (z. B. König Nobel, Ritter Isegrim, Reineke Fuchs). Die Zauberkarte „Der Narr“ heißt „Da capo!“, damit sie nicht mit den Narren verwechselt wird; die übrigen Tarot- und Traumkarten-Namen folgen in Schritt 4. Kartenrücken „Harlekin“ und Tisch „Thronsaal“ sind die neuen Standards. **Intern bleiben die englischen Bezeichner** (`mods`, `tokens`, `spells`, `nails`, `dreams`, `tools`, `tags`, `stakes`, `drops`, `level`, `round`), damit Spielstände, Freischaltungen und Online-Räume weiter passen. Die 10 neuen Narren haben eigene Tests; gekaufte Freischaltungen ersetzter Mods gehen auf die neuen Narren an derselben Stelle über (`RENAMED_UNLOCKS` in `ui/progress.ts`). **Offen:** Die Sprachaufnahmen der Kombis (`fs_hand_*`) sagen noch die alten Namen („Duo“, „Triple“ …).
4. ✅ **Kataloge entbalatroisieren** (29.10.2026): umgesetzt wie in „Schritt 4: Kataloge“ oben, `ruleVersion` 3. Abweichungen von der Vorschlagsliste: **Purzelbaum** ohne Richtungsknopf (die linke gewählte Karte steigt, eine zweite fällt), **Zauberspiegel** verdoppelt den linken Narren statt eines frei gewählten, die **Sanduhr** wirkt in der nächsten Audienz (sonst wäre sie aus der Wunderkiste nicht benutzbar), **Freier Eintritt** macht die ersten zwei Angebote gratis. Kompass und Maskenball legen den Gefallen `masquerade` ab; im Thronsaal kommt die Herrschaft dann ohne Marotte und ohne Zielaufschlag (`RoundState.calm` nur zur Anzeige). Damit die Grundausstattung seltene Narren enthält, sind Königspaar und Doppelgesichtiger frei; gesperrt sind dafür der Hofzauberer und der Truppenführer. `pickModKey` weicht auf eine gewöhnlichere Seltenheit aus, statt Gesperrtes anzubieten. Gekaufte Freischaltungen entfallener Einträge gehen auf ihre Nachfolger über (`RENAMED_UNLOCKS`). **Bot-Messung** (100 Läufe, 10 ms je Zug): mittel Ø Hoftag 3,76 (vorher 3,71), schwer 3,69 (vorher 3,48), weiterhin kein Sieg.
5. **Optik** – Teil 1 ✅ (29.10.2026): Karten sind die gemeinsame `PlayingCard` aus `packages/ui` (Kartenbild französisch oder vierfarbig, je Gerät über den Knopf „Kartenbild“, `localStorage` `brett-und-blatt:farbensortierer:kartenbild`); Schneiderei und Wappen liegen als runde Abzeichen darüber, Glanz als Schimmer (`::after`). Tisch mit zarten Harlekin-Rauten in Weinrot, Senfgelb und Tannengrün (`--cs-wine`, `--cs-mustard`, `--cs-fir`), eigener Dunkelmodus, die Tisch-Themen färben nur die Rauten um (Schlossgarten, Hafenfest, Abendfest); Standard-Kartenrücken „Harlekin“. Gegneranzeige als Thron: Miene 😐 → 🙂 → 😄 → 😂 als Fortschritt (`moodOf`), Lachanfall beim Erreichen, Marotte als Spruchband, schmale Applauslinie mit Zahl; im Thronsaal goldener Rahmen. Bewegung entfällt bei `prefers-reduced-motion`. Teil 2 offen: Jahrmarktstände, Bündel aufschnüren, Wettstreit-Bühne, Witz × Lachen als Spruchband.
6. **`ruleVersion` 2** und Übernahme des Fortschritts: Farbtropfen werden zu Glöckchen im Verhältnis 1:1, Freischaltungen behalten ihre Schlüssel (`localStorage` bleibt `brett-und-blatt:farbensortierer`, „Sichern“-Texte `FS1:` weiter lesbar).
7. **Bot nachmessen**, Ziele justieren, `corepack pnpm check`, Rauchtest und Prüfstand.

### Schritt 4: Kataloge (vorgeschlagen und umgesetzt am 29.10.2026)

**Ziel:** Die Kataloge sind bisher eine Übersetzung von Balatro: dieselbe Anzahl, dieselben Paare, dieselben Wirkungen. Genre-übliche Grundbausteine dürfen bleiben (Karte bekommt eine Verzierung, +1 Vorführung, billiger einkaufen). Was wegfallen soll, sind die **vollständigen Eins-zu-eins-Sätze** und die markanten Einzelideen. Deshalb gilt: **weniger Einträge, eigene Gruppierung, eigene Zahlen und eine Reihe neuer Ideen aus der Narrenwelt.**

Legende: **bleibt** = Wirkung wie bisher, nur neuer Name. **angepasst** = Wirkung verändert. **neu** = eigene Idee. **entfällt** = fällt weg. Der Aufwand steht in Klammern, wenn neue Technik nötig ist.

#### Kunststücke (bisher 22 Tarot-Karten → 17)

Statt einer Tarotkarte je Verzierung gibt es drei Gruppen: Verkleiden, Kartentricks und Hofgeschäfte.

| Bisher (Balatro) | Vorschlag | Wirkung | |
|---|---|---|---|
| Der Magier (Lucky) | 🍀 **Glücksklee anstecken** | Bis zu 2 Karten bekommen ein Kleeblatt | bleibt |
| Die Herrscherin (Mult) | 💄 **Schminkkasten** | Bis zu **3** Karten bekommen Schminke | angepasst |
| Der Turm (Stone) | 🪨 **Pflastern** | 1 Karte wird Pflasterstein, **+2 🥨** | angepasst |
| Der Hierophant (Bonus) | 🔔 **Schellen annähen** | Bis zu 2 Karten bekommen Schellenbesatz | bleibt |
| Die Liebenden (Wild) | 🧩 **Flickschneiderei** | 1 Karte bekommt ein Flickenmuster | bleibt |
| Der Wagen (Steel) | 🛡️ **Rüstkammer** | 1 Karte bekommt ein Kettenhemd | bleibt |
| Die Gerechtigkeit (Glass) | 🫧 **Perlenschnur** | 1 Karte bekommt Glasperlen | bleibt |
| Der Teufel (Gold) | 🧵 **Goldfaden** | 1 Karte bekommt eine Goldstickerei | bleibt |
| Stern, Mond, Sonne, Welt (je eine Farbe für 3 Karten) | 🎨 **Färberei** | Bis zu 3 Karten bekommen die Farbe der **ersten gewählten** Karte | angepasst (4 → 1; Auswahlreihenfolge wie beim „Tod“) |
| Die Kraft (Rang +1) | 🤸 **Purzelbaum** | Bis zu 2 Karten steigen **oder fallen** um einen Rang (Richtung wählbar) | angepasst (Wahl-Knopf) |
| Der Tod (links wird Kopie von rechts) | 🔀 **Vertauscht!** | 2 Karten **tauschen ihre Ränge** | neu |
| Der Gehängte (2 Karten entfernen) | 🧹 **Ausmisten** | Bis zu 2 Karten verlassen das Deck, **+1 🥨 je Karte** | angepasst |
| Der Eremit (Brezeln verdoppeln) | 🌾 **Erntedank** | +2 🥨 je Herrschaft, die du schon zum Lachen gebracht hast (höchstens 16) | neu |
| Die Mäßigkeit (Verkaufswert der Narren) | – | – | entfällt |
| Das Rad (1/4: Narr bekommt Glanz) | 🧽 **Polierlappen** | Der **linke** Narr bekommt Perlmutt, wenn er noch keinen Glanz hat | angepasst (ohne Zufall) |
| Die Hohepriesterin (2 Übungen) | 📖 **Schulstunde** | Erzeugt die Übung deiner **meistgespielten** Kombi | angepasst |
| Der Herrscher (2 Kunststücke) | – | – | entfällt |
| Das Gericht (zufälliger Narr) | ✉️ **Einladung** | Ein zufälliger **gewöhnlicher** Narr kommt dazu | angepasst |
| Der Narr („Da capo!“) | 🔁 **Da capo!** | Wiederholt das letzte Kunststück oder die letzte Übung | bleibt |

#### Kuriositäten (bisher 18 Spectral-Karten → 14)

Fundstücke aus der Wunderkammer des Königs. Okkulte Namen fallen weg.

| Bisher (Balatro) | Vorschlag | Wirkung | |
|---|---|---|---|
| Familienfoto (Familiar) | 🖼️ **Ahnengalerie** | 1 Handkarte geht, 3 verzierte Bildkarten kommen | bleibt |
| Schneemann (Grim) | 🗡️ **Asse im Ärmel** | 1 Handkarte geht, 2 verzierte Asse kommen | bleibt |
| Zahlenzauber (Incantation) | 📜 **Zahlenrolle** | 1 Handkarte geht, 4 verzierte Zahlenkarten kommen | bleibt |
| Talisman, Déjà-vu, Trance, Medium (je ein Wappen) | 📕 **Wappenbuch** | **2** Karten bekommen je ein **zufälliges** Wappen | angepasst (4 → 1) |
| Aura (Edition) | 💎 **Polierstein** | 1 Karte bekommt zufälligen Glanz | bleibt |
| Spukgestalt (Wraith) | 🧞 **Flaschengeist** | Seltener Narr, deine Brezeln gehen auf 0 | bleibt |
| Farbwirbel (Sigil) | 🫕 **Färbekessel** | Alle Handkarten bekommen eine zufällige Farbe | bleibt |
| Gleichmacher (Ouija) | – | – | entfällt |
| Seifenblase (Ectoplasm) | 🎩 **Tarnkappe** | Ein Narr wird unsichtbar (+1 Narrenplatz), Handgröße −1 | bleibt |
| Großputz (Immolate) | 🔥 **Kehraus** | 5 Handkarten gehen, +20 🥨 | bleibt |
| Spiegel (Ankh) und Bannkreis (Hex) | 🪞 **Zauberspiegel** | Ein Narr deiner Wahl wird verdoppelt, ein **zufälliger anderer** geht | angepasst (2 → 1, milder) |
| Klon (Cryptid) | – | – | entfällt |
| Seele (Soul) | 👑 **Krone des Narrenkönigs** | Ein legendärer Narr | bleibt |
| Schwarzes Loch (Black Hole) | 🏛️ **Große Bibliothek** | Alle Kombis +1 Stufe | bleibt |
| – | ⏳ **Sanduhr** | +1 Vorführung **in dieser Audienz**, dafür −1 Handgröße dauerhaft | neu (Aufwand: im Spiel benutzbar) |
| – | 🧭 **Kompass** | Die nächste Herrschaft im Thronsaal hat **keine Marotte** | neu |

#### Narren

Cornelius' eigene Narren aus dem Emoji-Sortierer bleiben unverändert: Spaßmacher, Zahlenschreiber, Tollpatsch, Wortkarge, Nachtwächter, Rechenmeister, Einsundnuller, Sechs-Sieben, Lieblingsnarr, Lumpensammler, Meistermaler. Das gilt auch für die zehn neuen Narren und die Mehrspieler-Narren. Umgebaut werden die Balatro-Übersetzungen:

**Farb-Narren** – bei Balatro vier gleiche Joker („+3 je Karte der Farbe“), hier vier verschiedene Wirkungen:

| Narr | Vorschlag |
|---|---|
| 😍 Der Verliebte (♥) | +4 Lachen je gewertete Herz-Karte |
| 🌞 Die Sonnige (♦) | +2 🥨, wenn mindestens 3 Karo-Karten gewertet werden |
| 😎 Der Lässige (♠) | +20 Witz je Pik-Karte, die **in der Hand bleibt** |
| 🌿 Die Kräuterfrau (♣) | +1 Lachen **dauerhaft** je gewertete Kreuz-Karte (wächst) |

**Kombi-Narren** – bei Balatro elf Joker (je Kombi ein +Lachen-, ein +Witz- und ein ×Lachen-Joker), hier sechs mit eigener Wendung:

| Narr | Vorschlag | Statt |
|---|---|---|
| 💌 Der Kuppler | +6 Lachen bei einem Paar, ×2 bei Zwei Paaren | Kuppler, Reinekes Neffe |
| 👫 Das Tanzpaar | ×1,5 Lachen **je Paar** in der Vorführung (Paar ×1,5, Zwei Paare und Full House ×2,25) | Tanzpaar |
| 🧀 Der Dreikäsehoch | +40 Witz und +6 Lachen bei einem Drilling | Dreikäsehoch, Kleeblatt |
| 🏃 Der Läufer | +10 Lachen bei einer Straße, ×2 bei einer Farbstraße | Läufer, Zeremonienmeister |
| 🎨 Die Malerin | +8 Lachen bei einer Farbe, +2 je gewertete Bildkarte darin | Malerin, Stickerin, Fahnenschwinger |
| 👨‍👩‍👧‍👦 Die Gauklerfamilie | ×3 Lachen bei Vierling **oder** Full House | Gauklerfamilie |

**Weitere Balatro-Übersetzungen:**

| Narr | Bisher (Balatro-Vorbild) | Vorschlag |
|---|---|---|
| 🖼️ Der Hofmaler | +30 Witz je Bildkarte (Scary Face) | +3 Witz je Bildkarte **im ganzen Deck** (wächst mit dem Deck) |
| 🧍 Der Aufrechte | +4 Lachen je gerade Karte (Even Steven) | +12 Lachen, wenn **alle** gewerteten Karten gerade sind |
| 🙃 Der Querkopf | +31 Witz je ungerade Karte (Odd Todd) | +60 Witz, wenn **alle** gewerteten Karten ungerade sind |
| 🐌 Die Hofschnecke | +8 Lachen je Ass, 2, 3, 5, 8 (Fibonacci) | +1 Lachen **dauerhaft** je gewertete 2, 3, 5 oder 8 (Schneckenhaus wächst) |
| 🎯 Der Assjäger | +20 Witz, +4 Lachen je Ass (Scholar) | Das **erste** gewertete Ass jeder Vorführung: ×2 Lachen |
| 🗝️ Der Schatzhüter | ×1,5 je Ass in der Hand (Baron, dort Könige) | +1 🥨 je Ass in der Hand am Ende der Audienz |
| 🦜 Der Papagei | Erste Karte zählt doppelt (Hanging Chad) | Die **letzte** gewertete Karte zählt doppelt |
| 🎪 Der Truppenführer | +3 Lachen je Narr (Abstract) | +2 Lachen je Narr, ×1,5 bei voller Narrenbank |
| 🪴 Der Hofgärtner | +1 Lachen je gespielte Farbe (Runner-artig) | +2 Witz dauerhaft je gewertete Kreuz-Karte … **oder entfällt**, weil die Kräuterfrau Ähnliches tut |
| 🍌 Die Banane | ×3, wird zu 1/100 gegessen (Cavendish) | 🍎 **Der Apfel der Königin:** ×3 Lachen, nach 10 Vorführungen gegessen (ohne Zufall) |
| 👩‍🍳 Die Köchin | +4 🥨 je Audienz (Golden Joker) | +1 🥨 je Audienz, **+1 mehr je Hoftag** (wächst) |
| 🧘 Der Geduldige | +2 🥨 ohne Tauschen (Delayed Gratification) | bleibt (Zahl genre-üblich) |
| 🤖 Der Blechnarr | Zufall +20 Lachen / +5 🥨 | **Jede 4. Vorführung** +20 Lachen (Uhrwerk, ohne Zufall) |
| 🦄 Das Einhorn | ×1 je getauschte Bildkarte (Hit the Road) | **Alle Karten zählen als jede Farbe** (legendär) |
| 🧙 Der Hofzauberer | Asse zählen dreimal (Hack-artig) | **Bildkarten** zählen zweimal (legendär) |

Damit sinkt die Zahl der Narren von 58 auf etwa 52, und keine Gruppe entspricht mehr einem Balatro-Satz.

#### Privilegien (bisher 9 Balatro-Voucher-Paare → 14 einzelne)

Die zweite Stufe jedes Paares (Großes Marktrecht, Königlicher Hoflieferant, Abkürzung, Doppelte Zugabe, Großer Kartentisch, Zauberärmel, Große Vorratskammer, Gnadengesuch) **entfällt**. Dafür kommen eigene Privilegien dazu:

| Privileg | Wirkung | |
|---|---|---|
| 🎪 Marktrecht | +1 Angebot auf dem Jahrmarkt | bleibt |
| 🏷️ Hoflieferant | Alles 25 % günstiger | bleibt |
| 🚶 Kurze Wege | Weiterschlendern 2 🥨 günstiger | bleibt |
| 👏 Zugabe | +1 Vorführung je Audienz | bleibt |
| 🃏 Kartentisch | +1 Tauschen je Audienz | bleibt |
| 👘 Weite Ärmel | +1 Handgröße | bleibt |
| 👝 Größere Narrentasche | +1 Platz in der Narrentasche | bleibt |
| 🥫 Vorratskammer | Vorratsbonus bis 8 🥨 | bleibt |
| 🪑 Zweite Narrenbank | +1 Narrenplatz, **−1 Handgröße** | angepasst |
| 📜 Bittschrift | Herrschaft neu wählen (5 🥨) | bleibt |
| 📯 Hofherold | Auf jedem Jahrmarkt liegt die Übung deiner meistgespielten Kombi | neu |
| 🎓 Lehrbrief | Übungen bringen **+2 Stufen** statt +1 | neu |
| 🍞 Brotrecht | +1 🥨 je Audienz, in der du nicht getauscht hast | neu |
| 🎭 Wanderbühne | Beim Auslassen darfst du zwischen **zwei** Gefallen wählen | neu (Aufwand: Auswahl) |

#### Gefallen (bisher 8 Balatro-Tags → 8, davon 3 neu)

| Bisher (Balatro) | Vorschlag | Wirkung | |
|---|---|---|---|
| Narrenkorb, Trickbeutel, Bücherbündel gratis (Buffoon, Charm, Meteor) | 🎁 **Geschenkkorb** | Öffnet sofort ein **zufälliges** großes Bündel | angepasst (3 → 1) |
| Freier Eintritt (Coupon) | 🎟️ Freier Eintritt | Die nächsten **zwei** Käufe kosten nichts | angepasst |
| Seltener Fund (Rare) | ✉️ **Empfehlungsschreiben** | Ein seltener Narr gratis auf dem nächsten Jahrmarkt | bleibt |
| Perlmuttfund (Holo) | – | – | entfällt |
| Festschmaus (Investment) | 🍗 Festschmaus | **+3 🥨 je Audienz** bis zum nächsten Thronsaal | angepasst |
| Doppelte Ration (Economy) | 🥨 **Bäckerbesuch** | +1 🥨 je Narr (höchstens 10) | angepasst |
| – | 🗣️ **Lob des Königs** | Die nächste Audienz braucht 25 % weniger Applaus | neu |
| – | 📖 **Nachhilfe** | Deine **schwächste** Kombi steigt um 2 Stufen | neu |
| – | 🎭 **Maskenball** | Der nächste Thronsaal hat keine Marotte | neu |

#### Folgen und Aufwand

- **Spielstände:** `ruleVersion` 3. Gekaufte Freischaltungen entfallender Einträge gehen wie in Schritt 3 auf den Nachfolger über (zum Beispiel Großes Marktrecht → Hofherold).
- **Neue Technik:** wenig. Nötig sind die Auswahlreihenfolge (Färberei, gibt es beim „Tod“ schon), ein Richtungs-Knopf (Purzelbaum), eine „in dieser Audienz“-Wirkung (Sanduhr), „keine Marotte“ (Kompass, Maskenball), eine Zielverringerung (Lob des Königs) und eine Auswahl aus zwei Gefallen (Wanderbühne). Alles andere ist Daten plus kleine Wirkfunktion.
- **Tests:** je neue oder angepasste Wirkung einer.
- **Bot:** Er bewertet Kunststücke und Kuriositäten über Listen (`SAFE_NO_TARGET` u. a. in `bots.ts`); diese werden angepasst und danach nachgemessen.

### Offen für Cornelius

- Name: Narrenhof, Narrenblatt, Hofnarr oder anders?
- Brezeln 🥨 als Währung und Glöckchen 🔔 als Meta-Währung in Ordnung?
- König Nobel fest als letzte Herrschaft (Hoftag 8) oder zufällig wie bisher?
- Neue Sprachaufnahmen für die Kombi-Namen oder ohne Ansage?

## Karten

- **52 Karten:** 13 Ränge × 4 Farben.
  - Ränge: 1️⃣–9️⃣, 👶🏻 Baby, 👧🏻 Mädchen, 👦🏻 Junge, 🎅🏻 Santa (höchster Rang)
  - Farben: Rot 🔴, Gelb 🟡, Blau 🔵, Grün 🟢
  - Chips: Zahl = Wert, Bilder = 10, Santa = 11
- **Zahlen-Lauf:** fünf aufeinanderfolgende Ränge, Santa nur oben (kein Herumlaufen). Im Klon war Santa intern Rang 13, geprüft wurde aber 14; dadurch war FarbenLauf Deluxe unmöglich. Hier wird das von Anfang an getestet.
- Darstellung als SVG mit großen Emojis über den Karten-Baukasten aus `packages/ui/cards`; Farben zusätzlich mit Form (●, ▲, ■, ◆) unterscheidbar, für Farbenblinde.

## Regeln (Standard, Solo-Lauf)

- **Hand:** 8 Karten, davon 1–5 auswählen. Pro Runde **4× Abschicken** und **3× Verwerfen**.
- **Level** mit drei Runden: Vorhut (Ziel 300), Wächter (450), Boss (600). Ziel = Grundziel × 3^(Level−1) × Boss-Faktor. **8 Level** gewinnen den Lauf, danach Endlos-Modus.
- **Wertung:** Punkte = **Chips × Mult**. Reihenfolge: Grundwert der Kombination, dann jede gewertete Karte (Chips plus Veredelung, Folie), dann die Mods von links nach rechts. Jeder Schritt ist ein Ereignis, die Oberfläche animiert ihn.
- **Verloren:** Sind alle Hände verbraucht und das Ziel ist nicht erreicht, endet der Lauf (im Mehrspieler: Leben weg, siehe unten).
- **Auszahlung nach der Runde:** Grundbelohnung je Runde (3/4/5 T, im Klon angezeigt, aber nicht ausgezahlt), 1 T je übrige Hand, Ordnungsbonus 1 T je 5 T Guthaben, höchstens 5 T (Wert aus der alten Anleitung; die unbegrenzten Zinsen im Code wären zu stark).
- **Start:** 4 T, Standarddeck, keine Mods.

### Kombinationen

| Name | Chips | Mult | +Chips/Level | +Mult/Level | Nagelstudio |
|---|---|---|---|---|---|
| Einzel-Wert | 5 | 1 | 5 | 1 | – |
| Duo | 10 | 2 | 10 | 1 | 💅 Klarlack |
| Doppel-Duo | 20 | 2 | 10 | 1 | 🇫🇷 French Nails |
| Triple | 30 | 3 | 15 | 2 | 👶 Babyboomer |
| Zahlen-Lauf | 30 | 4 | 20 | 2 | 👠 Stiletto-Form |
| Farben-Satz | 35 | 4 | 20 | 2 | 🎨 Fullcover |
| Kombi-Satz | 40 | 4 | 25 | 2 | 🏗️ Acryl-Modellage |
| Quartett | 60 | 7 | 30 | 3 | 🖼️ Nail Art |
| Farb-Kombination | 100 | 8 | 30 | 3 | 🧵 Fiberglas-Technik |
| FarbenLauf Deluxe | 100 | 8 | 30 | 3 | (neu, z. B. 💎 Strass) |
| Quintett | 120 | 12 | 35 | 3 | (neu, z. B. 🌟 Glitzer) |

Gewertet werden nur die Karten der Kombination; beim Einzel-Wert nur die höchste. Werte wie im Klon; die Grundwerte liegen unter Balatro, deshalb nach den ersten Testläufen nachjustieren.

### Mods (Startumfang: die 10 aus dem Klon)

| Mod | Wirkung | Preis | Seltenheit |
|---|---|---|---|
| 🤡 Der Clown | +10 Mult, −2 Mult dauerhaft je verlorener Runde (nur Mehrspieler) | 5 T | gewöhnlich |
| 😎 Cool Guy | +2 Mult je blaue Karte | 6 T | gewöhnlich |
| 😍 Verliebt | +4 Mult je rote Karte | 7 T | gewöhnlich |
| 🤓 Nerd Face | Mult = Quersumme der bisherigen Rundenpunkte (wie der Text verspricht; im Klon pauschal +10) | 5 T | ungewöhnlich |
| 🐛 Der Bug | 1/4: ×2 Mult, 1/4: ×0 | 4 T | gewöhnlich |
| 🚫 404 | +15 Mult bei weniger als 5 Karten | 5 T | gewöhnlich |
| 🌑 Dark Mode | +50 Chips je grüne oder blaue Karte | 6 T | ungewöhnlich |
| 🥧 Pi | +3,14159 Mult | 6 T | gewöhnlich |
| 0️⃣ Binär | +10 Mult je Santa und je 👶🏻 Baby (Text anpassen) | 7 T | ungewöhnlich |
| 6️⃣7️⃣ 67 | +6,7 Mult | 10 T | selten |

Höchstens 5 Plätze, Reihenfolge per Ziehen oder Antippen-und-Ziel. Verkaufen bringt die Hälfte. Farb-Mods zählen alle gespielten Karten (wie im Klon). Später kommen weitere Mods aus `joker-ideen.md` dazu (ohne Casino-Kategorie), Ziel etwa 40 zum ersten Veröffentlichen. Mods sind **Daten plus kleine Wirkfunktion** in einer Tabelle (`src/mods.ts`), jede mit eigenem Test.

### Grundmechaniken (vollständig, Umfang wie Balatro)

| Mechanik | Farbensortierer | Umfang im Endausbau |
|---|---|---|
| Joker | Mods in vier Seltenheiten (gewöhnlich, ungewöhnlich, selten, legendär), 5 Plätze | etwa 150, eigene Namen und Emojis |
| Booster Packs | **Lieferungen:** Mod-Kiste, Zauber-Mappe (Tarot), Nagellack-Set (Planet), Traum-Schachtel (Spectral), Karten-Paket (Spielkarten); je normal, groß, riesig | 15 Sorten |
| Voucher | **Werkzeuge**, je Level eines im Laden, zweistufig (z. B. 🧲 Magnet → 🧲🧲 Supermagnet: +1 Ladenplatz) | 32 |
| Skip Blind + Tags | Vorhut oder Wächter **überspringen** und dafür einen **Sticker** bekommen (z. B. „nächste Lieferung gratis“) | etwa 24 |
| Tarot | Zauberkarten | 22 |
| Planet | Nagelstudio, inkl. der drei versteckten Kombis (Quintett, Kombi-Satz und Quintett in einer Farbe) | 12 |
| Spectral | Traumkarten (starke Wirkung mit Preis, z. B. Mod verdoppeln, dafür Handgröße −1) | 18 |
| Enhancements | Friseur-Salon | 8 |
| Editions | Druck-Technik: Heißfolie, Holo-Laminat, Irisierender Lack, dazu **Durchsichtig** (Negative: +1 Mod-Platz) | 4 |
| Seals | Abzeichen (z. B. 🏅 Gold: +3 T beim Spielen, 🔁 Rot: Karte zählt doppelt) | 4 |
| Decks | Kartensätze mit Startvorteil (z. B. „Rot-Satz“ +1 Verwerfen) | 15 |
| Stakes | Sortierstufen: jede Stufe erschwert den Lauf (höhere Ziele, Mods mit Aufklebern wie „angeklebt“ oder „vergänglich“) | 8 |
| Boss-Neuwahl, Endlos-Modus, Sammelalbum | Boss neu wählen per Werkzeug; Endlos nach Level 8; **Album** zeigt alle entdeckten Mods und Karten (nur lokal) | – |

Im Startumfang (Schritt 1) sind von jeder Mechanik einige Vertreter dabei, damit der Lauf vom ersten Tag an vollständig ist; der Rest kommt im Ausbau als Daten dazu.

### Meta-Währung: Farbtropfen 💧 (Arbeitstitel)

Über die Läufe hinweg sammelt man **Farbtropfen**. Sie bleiben, auch wenn ein Lauf verloren geht.

- **Verdienen nur durch Spielen:** je besiegtem Boss, je erreichtem Level, für erste Siege mit einem Kartensatz oder auf einer Sortierstufe, für Herausforderungen („Gewinne ohne Verwerfen“), im Mehrspieler für jedes Duell. Kein Tagesbonus mit Verfallsdruck, keine Serien, die man „nicht verlieren darf“.
- **Ausgeben im Atelier:** neue Kartensätze, neue Mods und Werkzeuge in den Zufallspool aufnehmen, Kartenrücken und Themen (Schmuck ohne Spielvorteil), Album-Seiten.
- **Atelier-Lieferungen:** Für Farbtropfen gibt es auch eine Meta-Lieferung (die „Lootbox“), die zufällig eine noch nicht freigeschaltete Sache enthält. Mit Spannung ausgepackt wie die Lieferungen im Lauf, Quoten offen. **Schutz:** keine Dubletten (jede Lieferung bringt etwas Neues, solange es noch Neues gibt), und alles ist alternativ auch gezielt kaufbar. So bleibt die Spannung, aber niemand muss „weiterdrehen“, um etwas Bestimmtes zu bekommen.
- **Nie für echtes Geld,** nicht übertragbar, kein Handel. Gespeichert lokal je Gerät (`localStorage`, mit Export/Import); ein Konto für mehrere Geräte kommt erst mit Profilen auf dem Server.
- **Mehrspieler fair:** Freischaltungen geben online keinen Vorteil. Die Raumleitung wählt den Pool: „Grundausstattung“ (Standard, für alle gleich) oder „alles freigeschaltet“. Schmuck zeigt jeder trotzdem.

### Laden, Zauberkarten, Veredelungen, Bosse

- **Sortier-Zentrale:** 2 Angebote (Mods oder Verbrauchsgegenstände), 2 Lieferungen, 1 Werkzeug. Neu sortieren 5 T, steigt um 1 T je Nutzung in derselben Runde. (Der Klon hatte 5 Angebote ohne Lieferungen und Werkzeuge.)
- **Zauberkarten** (2 Plätze): 🤡 Der Narr (wiederholt die letzte Zauberkarte, wie beschrieben), 🎩 Der Magier, 👸 Die Herrscherin, 🕍 Der Hierophant, 💀 Der Tod, 🌍 Die Welt – Wirkungen wie im Klon.
- **Nagelstudio:** +1 Level für eine Kombination, wirkt beim Kauf.
- **Friseur-Salon:** alle acht Veredelungen vollständig, auch die im Klon fehlenden (🌈 Ombré, 💰 Gold-Strähnen, 🛡️ Keratin-Kur, Bruch bei 🍷 Blondierung, Sternen-Welle 1/15 auf 20 T).
- **Druck-Technik:** 🔥 Heißfolie, 💿 Holo-Laminat, 🌈 Irisierender Lack – vergeben über Laden-Mods (bisher vergab sie nichts).
- **Bosse:** zum Start 12 eindeutige aus der Liste (Mutterspinne, Alpha-Wolf, Papa Bär, Kroko-Boss, Riesen-Schlange, Riesen-Affe, Kaktus-König, Schloss-Gespenst, Frosch-König, Wald-Wächter, Minotaurus, Uhu-Oma), danach die übrigen. Der Drache erhält die beschriebene Wirkung (Lieblings-Kombi zählt 0), nicht „Geld auf 0“. Die 80 normalen Gegner aus dem Klon geben Vorhut und Wächter Gesicht und Namen.

## Umsetzung (Oktober 2026)

Umgesetzt in `packages/games/color-sorter` (Schritte 1 bis 5 des Plans, lokal, Hot-Seat und online eingetragen). Abweichungen und Präzisierungen:

- **Umfang:** 50 Mods (die 10 aus dem Emoji-Sortierer plus 37 neue, 3 legendäre), alle 22 Zauberkarten, 12 Nagelstudio-Karten, 18 Traumkarten, 16 Werkzeuge, 8 Sticker, 7 Kartensätze, 8 Sortierstufen, alle 25 Bosse, 20 Tier-Gegner für Vorhut und Wächter.
- **Werte:** Grundwerte der Kombis wie im Klon, die Steigerung je Level und die Ziele je Level wie im Original (300, 800, 2.000 … 50.000; ab Sortierstufe Grün und Lila steiler). Mod-Werte sind an das Original angeglichen (z. B. Clown +4 statt +10 Mult). Ordnungsbonus wie in der alten Anleitung: 1 T je 5 T, höchstens 5 T (mit Sparbuch 10 bzw. 20).
- **Kombis:** Santa ist Rang 13 und nur oben im Lauf; Granit-Karten zählen nicht zur Kombi, werden aber immer gewertet. Wer gegen eine Boss-Regel spielt (Mutterspinne, Riesen-Schlange, Goldener Löwe), bekommt 0 Punkte – erlaubt ist die Hand trotzdem, sonst würde die Erlaubnis verdeckte Karten verraten.
- **Verdeckte Karten:** In der Sicht haben sie keine Kennung, und der Stapel erscheint nur als sortierte Zusammensetzung *einschließlich* der verdeckten Handkarten – so lässt sich nichts erschließen.
- **Gleicher Seed:** Alle Plätze haben eigene Zufallsströme mit demselben Startwert (Mischen, Laden, Effekte); Bosse und Sticker liegen für alle gleich im Spielstand. Gleiche Entscheidungen ergeben dieselben Karten und Läden.
- **Treffpunkt:** Wer das Duell erreicht, wartet (`wait`). Sind alle noch lebenden Plätze da, beginnt das Duell für alle gleichzeitig; jeder spielt alle Hände. Danach verlieren die mit den wenigsten Punkten ein Leben (bei Gleichstand aller niemand), alle bekommen 5 T Belohnung. Eine verlorene normale Runde kostet ebenfalls ein Leben.
- **Hot-Seat:** Die Spielleitung übergibt das Gerät, sobald der aktuelle Platz am Treffpunkt wartet – jeder spielt also bis zum nächsten Duell, nicht rundenweise.
- **Klänge:** Vollständige Übernahme der originalen Soundeffekte (`fs_pop`, `fs_mult`, `fs_coin`, `fs_coin_end`, `fs_shuffle`, `fs_game_over`, `ds_flipcard`, `ds_snip`, `ds_swipe`, `ds_punch1`), aller 11 Kombination-Sprachaufnahmen (`fs_hand_*`) beim Abschicken sowie der Boss-Tierstimmen aus `tiere/` synchron zur Wertungs-Animation und Interaktion.
- **Noch nicht umgesetzt:** der weitere Ausbau der Inhalte auf den Endumfang (etwa 150 Mods, 32 Werkzeuge, 15 Kartensätze).

### Ausbau (26.10.2026)

- **Endlos-Modus:** Option „Nach Level 8: Ende / Endlos“ (allein und bei Überleben). Nach dem Boss von Level 8 geht es weiter, die Ziele wachsen je Level etwa um das Dreifache. Ein Lauf, der Level 8 geschafft hat, zählt als gewonnen („Endlos bis Level N“).
- **Boss-Neuwahl:** Werkzeuge 🔭 Fernrohr (Boss einmal je Level neu wählen) und 🛰️ Satellit (beliebig oft), je 5 T, vor der Boss-Runde. Die Neuwahl gilt nur für den eigenen Lauf (`bossSwap`), die anderen behalten den gemeinsamen Boss. Der schwere Bot wählt nur sehr lästige Bosse neu (etwa den Kaktus), wenn er das Werkzeug hat.
- **Mehrspieler-Mods** (liegen nur zu mehreren im Laden, keiner schadet anderen): 🛡️ Abwehr (+25 Chips je verlorenes Leben), 🕊️ Pazifist (×2 Mult, im Duell ×0,5), 🕵️ Spion (sieht Duell-Punkte live), 🤝 Teamgeist (+3 Mult je Mitspieler im Spiel), 🐢 Aufholjagd (+30 Chips, +3 Mult je Level Rückstand), ❤️‍🩹 Zweite Chance (löst sich statt eines Lebensverlusts auf), 🏆 Duell-Champion (+3 Mult je gewonnenes Duell). Dafür sind **Duell-Punkte der anderen jetzt geheim**, bis abgerechnet ist (Sicht und Ereignisse), außer mit dem Spion.
- **Farbtropfen 💧** (`src/drops.ts`): 2 je geschafftes Level, 5 für einen gewonnenen Lauf bzw. eine gewonnene Partie, 1 je gewonnenes Duell, dazu einmalige Herausforderungen (erster Sieg je Kartensatz und Sortierstufe, ohne Verwerfen, mit höchstens 2 Mods, Hand ≥ 100.000, Endlos-Level 12, erstes Duell, erste Partie zu mehreren). Gutgeschrieben wird am Ende der Partie für die Plätze, die auf diesem Gerät gespielt wurden – je Partie nur einmal (Spielkennung `key`, abgeleitet vom Seed, verrät ihn aber nicht).
- **Atelier** (`src/unlocks.ts`, `src/ui/Atelier.tsx`): Gesperrt sind anfangs 17 Mods (vor allem seltene und legendäre), 4 Kartensätze und 8 Werkzeug-Stufen; dazu Schmuck ohne Spielvorteil (5 Kartenrücken, 3 Tisch-Themen). Alles ist gezielt kaufbar (Mods 4/6/10/20 💧 nach Seltenheit, Kartensatz 8, Werkzeug 6, Rücken 5, Thema 8). Die **Atelier-Lieferung** (5 💧) bringt eine zufällige noch gesperrte Sache: wackelt, reißt auf, Konfetti; nie eine Dublette, Quoten werden angezeigt.
- **Freischaltungen in der Partie:** Option „Freischaltungen: Meine / Grundausstattung / Alles“. Bei „Meine“ trägt die Oberfläche vor dem Start die Freischaltungen dieses Geräts in die verborgene Option `unlocks` ein (Hex-Code, `GameUi.prepareOptions`). Online lässt sich die verborgene Option nicht setzen – dort spielen alle mit der Grundausstattung, außer die Raumleitung wählt „Alles“. Ein gesperrter Kartensatz wird zum Standard-Satz; die Einrichtung weist darauf hin.
- **Album:** zeigt alle entdeckten Mods, Zauber-, Nagelstudio- und Traumkarten, Werkzeuge, Bosse und Kartensätze (Unentdecktes als ❔), Bestwerte und Herausforderungen. Kostenlos, keine Album-Seiten zum Kaufen.
- **Speicher:** alles in `localStorage` (`brett-und-blatt:farbensortierer`), mit „Sichern“ als kopierbarem Text (`FS1:…`) zum Umziehen auf ein anderes Gerät. Nie echtes Geld, kein Handel.
- **Neu in Engine und Oberfläche** (für alle Spiele nutzbar): `OptionSpec.hidden` und `OptionSpec.pattern` (verborgene Option mit freiem Wert), `GameUi.prepareOptions` (Optionen vor einem Start auf dem Gerät ergänzen) und `GameUi.SetupExtra` (eigener Abschnitt in der Einrichtung, hier: Atelier).
- **Online getestet** gegen den lokalen Spieleserver: zwei nachgebaute Browser (mit dem schweren Bot als Spieler) und ein Server-Bot im Duell bis zur Abrechnung in Level 2; verborgene Option abgewiesen, Grundausstattung aktiv, fremde Hände, Zufallsstände und Duell-Punkte verborgen, kein Seed in den Nachrichten, eine Spielnachricht etwa 9 KB.

## Mehrspieler

Vorbild ist die Balatro-Multiplayer-Mod: Jeder spielt **seinen eigenen Lauf**, aber alle mit **demselben Seed**. Gleiche Startkarten, gleiche Läden, gleiche Bosse – wer besser entscheidet, gewinnt. Interaktion entsteht an **Treffpunkten**.

### Modi (Lobby-Option)

| Modus | Ablauf | Spieler |
|---|---|---|
| **Duell** (Standard) | Jeder hat 4 Leben. Ab Level 2 ersetzt ein **Duell** die Boss-Runde: alle spielen gleichzeitig mit ihren Händen, die niedrigste Punktzahl verliert ein Leben (bei mehr als zwei: alle unter dem Mittelwert, oder nur der Letzte – Option). Eine verlorene normale Runde kostet ebenfalls ein Leben, statt den Lauf zu beenden. Wer kein Leben mehr hat, scheidet aus; die letzte Person gewinnt. | 2–8 |
| **Showdown** | Wie Duell, aber erst ab Level 4 – für Leute, die erst aufbauen wollen. | 2–8 |
| **Überleben** | Kein Duell; wer am weitesten kommt (Level, dann Punkte), gewinnt. Kein Warten aufeinander. | 2–8 |
| **Wettrennen** | Wer zuerst Level 8 schafft. Live-Stand der anderen sichtbar. | 2–8 |

Zusätzlich vorgesehen (später): **Mehrspieler-Mods**, die nur online im Laden liegen, z. B. „Abwehr“ (+Chips je verlorenes Leben), „Pazifist“ (×Mult, aber nie gegen jemanden gewinnen) oder „Spion“ (sieht die Duell-Punkte des Gegners live). Keine Mods, die anderen direkt schaden, damit es freundlich bleibt.

### Spielmodell für parallele Läufe (Plan)

Ein Spielstand enthält **alle Läufe**:

```ts
interface SorterState {
  rulesVersion: number;
  mode: 'solo' | 'duel' | 'showdown' | 'survival' | 'race';
  rng: { deal: RngState[]; shop: RngState; boss: RngState; effects: RngState[] }; // je Platz eigene Ströme für Ziehen und Effekte, aus demselben Seed abgeleitet
  runs: RunState[];                 // je Platz: Level, Runde, Phase, Deck, Hand, Mods, Zauber, Kombi-Level, Token, Leben
  meeting: Meeting | null;          // laufendes Duell: wer ist da, wer ist fertig, Punkte
}
```

- **Gleicher Seed, gleiche Folge:** Jeder Platz hat eigene Zufallsströme, die aber für alle gleich beginnen (abgeleitet aus Seed und Zweck, nicht aus dem Platz). So bekommt jeder dieselben Karten in derselben Reihenfolge, solange er gleich handelt. Laden-Angebote hängen am Level und an der Zahl der Neu-Sortierungen, nicht an der Zeit.
- **Gleichzeitig:** `currentPlayers` liefert alle Plätze, die gerade etwas tun können. Jeder spielt in seinem Tempo. Erreicht jemand ein Duell, wartet er dort („Wartet auf Anna …“), bis alle da sind; dann beginnt das Duell für alle zugleich.
- **Duell:** Jeder spielt seine Hände; fertig ist, wer alle Hände gespielt hat oder auf „Fertig“ tippt. Wenn alle fertig sind, werden Leben abgezogen (Ereignis für alle), danach geht es einzeln weiter.
- **Geheim (`playerView`):** eigene Hand, Deck und Laden nur für sich. Die anderen sehen Level, Runde, Leben, Token, Mods (offen wie in der Mod) und im Duell die Punkte. Zuschauer sehen alle Hände nicht. Der Seed geht nie an Browser – ein Blick in die Entwicklertools verrät also nicht die nächsten Karten.
- **Flüchtige Signale:** Live-Punkte während des Duells und „gerade im Laden“ laufen über den Signalkanal, nicht über den Spielstand.
- **Schummelschutz:** Online rechnet der Server jeden Zug; der Browser schickt nur Entscheidungen.

### Zeitlimits

| Voreinstellung | Runde | Laden | Duell |
|---|---|---|---|
| Aus (Standard Solo) | – | – | – |
| Locker (Standard online) | Zugzeit 60 s + Zeitbank 5 min | Phasen-Timer 90 s | Phasen-Timer 3 min |
| Flott | 30 s + 2 min | 45 s | 90 s |

Bei Zeitablauf spielt der Bot den Zug. Im Laden heißt Zeitablauf „Weiter“. Wer am Treffpunkt zu lange braucht, hält die anderen nicht auf: Nach dem Phasen-Timer übernimmt der Bot bis zum Duell.

### Hot-Seat

Parallele Läufe passen schlecht auf ein Gerät. Deshalb **rundenweise abwechselnd**: Jeder spielt eine Runde und einen Ladenbesuch, dann Übergabe-Bildschirm. Duelle ganz normal nacheinander, das Ergebnis wird erst gezeigt, wenn alle gespielt haben.

## Bot

- **Runde:** Für die Hand alle 218 Teilmengen (1–5 aus 8) werten und die beste Kombi mit allen Mods ausrechnen. Verwerfen: per Stichprobe aus dem Restdeck schätzen, ob sich Farben-Satz oder Zahlen-Lauf lohnt (mittel: Faustregeln, schwer: 200 Ziehungen je Kandidat).
- **Laden:** Bewertung „Punkte pro Token“ gegen das aktuelle Team; schwer simuliert die nächste Runde mit und ohne Kauf.
- **Ehrlich:** Der Bot kennt nur seine Sicht, also nicht die Reihenfolge des Decks.
- Stufen: leicht (beste Kombi, kauft zufällig), mittel (Faustregeln), schwer (Stichproben, Ladenplan). Ziel: schwer schafft Level 8 in mindestens 30 % der Läufe.

### Umsetzung und Messung (29.10.2026)

**Warum „schwer“ schlechter war als „mittel“:** Nagelstudio-Karten aus Abzeichen oder Zauberkarten blieben für immer im Platz liegen (die Benutzung ohne Ziel war für Nägel gesperrt). Mods wurden nach Seltenheit und Preis gekauft statt nach Nutzen, „schwer“ hielt dabei 10 T zurück und kaufte so weniger. Dazu kamen Fehler bei Bossen: Beim Schloss-Gespenst (erste Hand verdeckt) spielte der Bot nur Einzelkarten und warf verdeckte Karten ab, obwohl wieder verdeckte nachkamen; beim Goldenen Löwen und der Riesen-Schlange spielte er wertlose Hände, statt zu verwerfen; bei der See-Schlange verkaufte er nie einen Mod; bei Frosch und Hai spielte er verdeckte Karten sofort blind mit und verwarf gar nicht mehr.

**Was „schwer“ jetzt tut** (`src/bots.ts`):
- **Stärke per Stichprobe:** 40 feste Probehände je Ladenbesuch (immer dieselben, sonst schwankt die Schätzung von Zug zu Zug) aus je 12 Karten (Hand plus etwa das, was Verwerfen bringt). Gewertet werden nur sinnvolle Kombis (`quickBest`: höchste Karte, Paare bis Fünfling, Full House, Farben, Straßen) mit der echten Wertung. Ein Mod ist so viel wert, wie er diese Stärke hebt; Token-Mods (Sparschwein u. a.) und wachsende Mods bekommen einen Zuschlag.
- **Laden:** Erst die Mod-Plätze füllen, dann sparen – und nur, wenn das Team den nächsten Boss sicher schafft (Schätzung × 40 %, so viel kommt im Spiel wirklich an). Bei voller Leiste wird der schwächste Mod getauscht, wenn ein neuer klar mehr bringt. Nägel zählen doppelt, die Hauptkombi des Teams nochmals doppelt (Fokus statt verstreuter Stufen). Neu sortiert wird, wenn Platz frei ist oder ein schwacher Mod liegt. Mult-Faktor-Mods werden nach rechts geschoben.
- **Runde:** Verwerfen per Monte-Carlo – bis zu 200 Ziehungen aus dem Stapel für jeden Kandidaten (beste Kombi, Farbe, Straße, Paare, hohe Karten, jeweils alles oder nur zwei Karten abwerfen). Verwerfen wird über die Hände verteilt (vor der letzten Hand alles nutzen, sonst nur bei klarem Gewinn). Bei gleichen Punkten werden Füllkarten mitgespielt (Austausch ohne Verwerfen). Bossregeln: siehe oben, jeweils behoben.
- **Überspringen** von Vorhut oder Wächter (ab Level 2) für wertvolle Sticker (seltener Mod, Mod-Kiste, Nagel-Set, Rücklage …), wenn das Team die nächste Runde auch ohne Laden schafft. Boss-Neuwahl nur noch bei extremen Bossen (Kaktus); das Fernrohr kauft der Bot nicht gezielt – das hatte in der Messung geschadet.
- „mittel“ behält seine Faustregeln, bekommt aber die Fehlerbehebungen (Nägel, Gespenst, Löwe, See-Schlange).

**Messung** (100 Solo-Läufe, Seeds `m0`…`m99`, Standardoptionen; Skript `test/bot-strength.test.ts`, Aufruf im Kopf der Datei):

| Bot | Bedenkzeit | Level Ø | Level 8 geschafft |
|---|---|---|---|
| alt, mittel | 10 ms | 3,59 | 0 % |
| alt, schwer | 10 ms | 3,61 | 0 % |
| neu, leicht | 10 ms | 1,22 | 0 % |
| neu, mittel | 10 ms | 3,77 | 0 % |
| neu, schwer | 10 ms | 5,87 | 9 % |
| neu, schwer | 100 ms | 6,31 | 14 % |
| neu, schwer | 800 ms | 6,20 | 12 % |

Gemessen auf dem Narrenhof-Stand `d88204b` (Schritt 1–3). **Nach Schritt 4** (eigene Kataloge; Regenbogen, Banane, Ordnung und weitere Mult-Faktor-Narren fallen weg) auf `main`:

| Bot | Bedenkzeit | Level Ø | Level 8 geschafft |
|---|---|---|---|
| alt, mittel | 10 ms | 3,76 | 0 % |
| alt, schwer | 10 ms | 3,69 | 0 % |
| neu, leicht | 10 ms | 1,14 | 0 % |
| neu, mittel | 10 ms | 3,92 | 0 % |
| neu, schwer | 10 ms | 5,40 | 1 % |
| neu, schwer | 100 ms | 5,54 | 2 % |

Die Werte schwanken zwischen zwei Messungen um etwa ±0,2 Level und ±4 Prozentpunkte (die Bedenkzeit macht die Läufe nicht ganz wiederholbar). Mehr als etwa 100 ms bringt nichts mehr; die Stichprobe ist dann gesättigt.

**Ziel verfehlt:** „schwer“ ist jetzt klar besser als „mittel“, schafft Level 8 aber nur in gut 10 % (Stand `d88204b`) bzw. 1–2 % (nach Schritt 4) statt 30 % der Läufe. Die meisten Läufe enden am Boss von Level 5–7 mit etwa 60 % des Ziels. Getestete Stellschrauben ohne messbaren Gewinn: mehr Sparen oder gar nicht sparen, Schätz-Anteil 30/55 %, Poolgröße 10/14, Verwerf-Schwelle, freieres Neu-Sortieren, Boss-Neuwahl nach geschätzter Härte. Für 30 % bräuchte es entweder eine tiefere Planung (ganze Runden je Kauf simulieren) oder etwas leichtere Ziele ab Level 5 – das ist eine Abwägung für die Zahlen, nicht für den Bot.

**Rechenzeit:** Auf dem Spieleserver (Zähl-Uhr, Schrittweite 1 ms) rechnet „schwer“ im Schnitt etwa 0,1 s, höchstens etwa 0,85 s je Zug (lokal gemessen mit `BOT_STEP=1 BOT_BUDGET=800`, Stand nach Schritt 4); die langen Züge sind Ladenbesuche mit voller Narrenbank. Das liegt im Rahmen der anderen Spiele (auf Cloudflare Spitzen bis 1,6 s). Ein eigener Eintrag in `BOT_STEP_MS` ist nicht nötig. Im Laden ignoriert „schwer“ sehr kleine Budgets (etwa 45 ms je Zug bei 10 ms Budget).

## Oberfläche

- HTML/SVG und CSS-Animationen wie überall in Brett & Blatt (kein eigenes Canvas wie im Klon). Pixel-/CRT-Optik höchstens als Thema.
- **Hochformat:** Gegner (Tier mit Lebensbalken) oben, Mods darunter, Wertungsanzeige „Chips × Mult“ in der Mitte, Hand unten, Knöpfe Abschicken/Verwerfen. **Querformat:** Gegner und Mods rechts, Steuerung und Werte links (`flat:`-Variante).
- **Wertung als Angriff** wie im Klon: Karten heben sich, Zahlen poppen auf, der Treffer fliegt zum Gegner. Einstellbares Tempo, Tippen überspringt.
- **Mehrspieler:** Leiste mit PlayerChips (Leben als Herzen, Level, Live-Punkte), im Duell zwei Lebensbalken nebeneinander.
- Kurzanleitung `howToPlay` mit Kombitabelle; Tooltips für jeden Mod und Boss.
- Sounds kommen später, Cornelius wählt sie aus (im Klon gab es Sprach-Samples je Kombination und Tierlaute für Bosse).

## Umsetzung in Schritten

1. **Regelkern Solo** (`packages/games/color-sorter`): Deck, Kombi-Erkennung, Wertung als Ereignisliste, 10 Mods, Laden mit Lieferungen, Werkzeugen und Abkürzungen, Zauberkarten, Nagelstudio, Traumkarten, Farbtropfen mit einfachem Atelier, Friseur-Salon, Druck-Technik, Abzeichen, 3 Kartensätze, 2 Sortierstufen, 12 Bosse. Tests: jede Kombi inkl. Grenzfälle (Santa oben, weniger als 5 Karten), jede Mod-Wirkung, Determinismus, `gameContractChecks`. Spielbar offline gegen niemanden.
2. **Oberfläche Solo** mit Wertungs-Animation, Hoch- und Querformat. Im Browser durchspielen, Werte nachjustieren.
3. **Bot** in drei Stufen, Messung der Erfolgsquote. Tipp-Knopf nutzt den schweren Bot.
4. **Mehrspieler-Kern:** `runs[]`, Treffpunkte, Leben, Modi Duell und Überleben; Hot-Seat. Tests: gleiche Züge ergeben auf allen Plätzen gleiche Karten; Duell-Abrechnung; Sicht verrät nichts Fremdes.
5. **Online:** im Server eintragen (`apps/server/src/games.ts`, `package.json`), Bot-Schrittweite messen (`BOT_STEP_MS`), Phasen-Timer, Live-Punkte als Signal. Rauchtest mit zwei Browsern.
6. **Ausbau:** Mods auf etwa 150 (erst 40 zum Veröffentlichen), alle Lieferungen, Werkzeuge, Sticker, Traumkarten, Kartensätze und Sortierstufen, alle 25 Bosse, Album, Showdown und Wettrennen, Mehrspieler-Mods.

Neu in der Engine wird dafür vermutlich nur wenig nötig: gleichzeitige Züge und Phasen-Timer gibt es schon (Schiffe versenken, Bingo-Plan). Zu prüfen ist, ob der Bot-Ersatz mit mehreren gleichzeitig aktiven Plätzen sauber arbeitet und ob der Spielstand mit 8 Läufen klein genug für die Schnappschüsse bleibt (geschätzt unter 50 KB).

## Offene Punkte (für Cornelius)

- ✅ Name und Thema: **Narrenhof** mit allen Begriffen aus „Neues Thema: Narrenhof“ oben (29.10.2026); die Kennung `color-sorter` bleibt. Damit sind auch die früheren Fragen zu Ersatznamen, Token-Symbol und Meta-Währung erledigt (Brezeln 🥨, Glöckchen 🔔, Narrenschule).
- Standardmodus online: Wettstreit mit 4 Herzen.
- Planungsnotiz `~/code/emojiclicker/docs/farbsortierer-expansion.md` auswerten.
- ✅ Vorziehen: aus Etappe 6 vorgezogen und am 26.10.2026 fertig.
