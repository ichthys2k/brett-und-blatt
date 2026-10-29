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
- **Boss-Neuwahl:** Werkzeuge 🔭 Fernrohr (Boss einmal je Level neu wählen) und 🛰️ Satellit (beliebig oft), je 5 T, vor der Boss-Runde. Die Neuwahl gilt nur für den eigenen Lauf (`bossSwap`), die anderen behalten den gemeinsamen Boss. Der schwere Bot wählt lästige Bosse neu.
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

Die Vorschläge sind so umgesetzt und live (Stand 29.10.2026); offen ist nur noch die ausdrückliche Bestätigung:
- Name „Farbensortierer“ (Kennung `color-sorter`).
- Ersatznamen: Vorhut/Wächter statt Kleiner/Großer Blende, „Neu sortieren“, „Sternen-Welle“, „Ordnungsbonus“, Lieferung, Werkzeug, Sticker, Traumkarten, Sortierstufen.
- Token 🔩 statt Münze; Meta-Währung Farbtropfen 💧 mit Atelier.
- Standardmodus online: Duell mit 4 Leben.

Noch nicht erledigt:
- Planungsnotiz `~/code/emojiclicker/docs/farbsortierer-expansion.md` auswerten.
- ✅ Vorziehen: aus Etappe 6 vorgezogen und am 26.10.2026 fertig.
