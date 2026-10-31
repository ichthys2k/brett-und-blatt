# Etappe 7 – Gestaltungskonzept Taverne (W-026) und Drachenspiel im Mittelalter (W-025)

Oct 31, 2026 · @Cornelius Lipponer

## Kurzfassung

Ich empfehle, Brett & Blatt als **Gasthaus im Königreich** zu gestalten: Die Taverne ist der Rahmen um alle Spiele, der Narrenhof ist die Burg, das Drachenspiel wird zum Turnier der Wappentiere. Die Taverne wirkt vor allem auf Startseite, Lobby, Siegerehrung und Klang; die Spielfelder bleiben klar lesbar und bekommen nur auf Wunsch eine Holz- oder Filzoberfläche.

Das Drachenspiel behält seine Regeln und Tiere. Neu sind mittelalterliche Begriffe, eine Burgmauer statt Lebenszahl und als eigene Wendung ein **Drachenei**, das im Lauf der Partie schlüpft. Beides zusammen ist in vier Schritten von je zwei bis vier Tagen machbar; eine „Schlichte Ansicht“ bleibt für Unterricht und Barrierefreiheit wählbar.

## Leitidee: eine Welt

Die drei Wünsche passen zusammen, wenn sie eine gemeinsame Welt teilen: ein Königreich der Fabeltiere, wie es der Narrenhof schon zeigt. Wer die App öffnet, betritt das Gasthaus „Zum Brett & Blatt“ am Fuß der Burg.

| Ort | Spiele | Bildsprache |
| --- | --- | --- |
| Schankstube (Startseite) | alle, nach Räumen sortiert | Holz, Kerzenlicht, Wirtshausschilder als Kacheln |
| Spielstube | Strategie- und Brettspiele | ruhige Holztische, Steinboden |
| Kartentisch | Karten- und Stichspiele | grüner Filz, Laterne |
| Festsaal | Familien- und Gesellschaftsspiele, Spiele für viele | Girlanden, lange Tafel |
| Schreibstube | Mathe- und Rechenspiele | Pergament, Tafel, Kreide |
| Hinterzimmer | Online-Lobby, offene Runden | Türen mit Tischzeichen (Raumcode) |
| Burg | Narrenhof | Thronsaal, Harlekin-Rauten (vorhanden) |
| Turnierplatz | Drachenspiel | Banner, Wappen, Zuschauertribüne |

Die **Wirtin** führt als Begleitfigur durch die App: eine Dachsdame im Stil der Narrenhof-Porträts, die neue Spiele vorstellt, Tipps gibt und bei der Siegerehrung den Pokal reicht. Sie ersetzt keine Bedienelemente, sie gibt nur Gesicht und Stimme.

## Taverne für alle Spiele (W-026)

Das Thema wirkt in sechs Ebenen, von außen nach innen immer zurückhaltender.

### 1. Rahmen der App

- **Farben:** Hell = Tag in der Taverne (Pergament `#f3e9d2`, dunkles Eichenholz `#5a3b22`, Waldgrün als Akzent, Kupfer für Hinweise). Dunkel = Abend am Kamin (Rußbraun, warmes Kerzengelb als Akzent). Alles über die vorhandenen Theme-Tokens, damit jedes Spiel sie erbt.
- **Schrift:** Überschriften in einer freien, gut lesbaren Zierschrift (zum Beispiel Cinzel oder IM Fell English, beide OFL, selbst ausgeliefert, kein Google-CDN). Fließtext und Spielfelder bleiben in der Systemschrift.
- **Formen:** Holzleisten statt Rahmenlinien, Knöpfe wie geprägtes Leder, Kacheln als hängende Wirtshausschilder mit dem Spiel-Emoji als Wappen.

### 2. Startseite als Schankstube

Die vier Rubriken werden zu Räumen (siehe Tabelle oben), die Schnellfilter zu Türschildern. Oben begrüßt die Wirtin mit einem wechselnden Satz („Heute Abend ist der Kartentisch voll!“ bei vielen offenen Runden). Offene Online-Runden hängen als Zettel am Schwarzen Brett.

### 3. Lobby und Siegerehrung

- **Raum = Tisch:** Der Raumcode heißt Tischzeichen, Plätze sind Stühle um einen runden Tisch (passt zu W-020 „Spieler rund um einen Tisch“).
- **Siegerehrung als Festbankett:** Pokal wird Siegerkelch, Treppchen wird Ehrenbank, Konfetti wird Blütenregen und Wimpel.

### 4. Spieltische

Jedes Spiel bekommt eine passende Tischoberfläche (Holz für Brettspiele, Filz für Kartenspiele, Pergament für Mathe). Figuren, Karten und Felder ändern sich nicht von selbst. Für Schach, Dame, Mühle und Go kann es später ein „Tavernen-Brett“ als Wahl geben, ähnlich der Kartenbild-Wahl.

### 5. Klang

- Optionale Atmosphäre in der Schankstube: Kaminknistern, leises Stimmengemurmel, ein Türglöckchen beim Betreten eines Raums.
- Eine Playlist „Taverne“ mit mittelalterlich klingenden Stücken (Laute, Flöte, Trommel), passend zu W-014. Erzeugung und Auswahl wie bisher über das Klang-Repo.

### 6. Sprache

Nur dort, wo es nicht stört: Startseite, Lobby, Siegerehrung, Hinweise der Wirtin. Bedienwörter wie „Spielen“, „Optionen“, „Aufgeben“ bleiben sachlich, damit Kinder und Lehrkräfte sich sofort zurechtfinden.

| heute | in der Taverne |
| --- | --- |
| Startseite | Schankstube |
| Online spielen | Hinterzimmer |
| Raumcode | Tischzeichen |
| Raum erstellen | Tisch decken |
| Zuschauer | Gaffer am Tresen |
| Siegerehrung | Festbankett |
| Ton und Musik | Spielleute |

## Drachenspiel im Mittelalter (W-025)

Das Drachenspiel wird zum **Turnier der Wappentiere**: Zwei Burgherren schicken ihre Tiere in Rüstung auf den Turnierplatz. Regeln, Werte und die 368 Tierstimmen bleiben, damit der Umbau klein bleibt und der Bot weiter stimmt; wie beim Narrenhof bleiben die englischen Bezeichner im Code.

### Begriffe

| heute | neu | Bild |
| --- | --- | --- |
| Held mit 30 Leben | Burg mit 30 Mauersteinen | Mauer bröckelt sichtbar, Fahne sinkt |
| Manakristalle | Zauberkristalle im Turm | ein Turmfenster leuchtet je Kristall |
| Sternschnuppe | Glückssegen der Wirtin | Kerze |
| Beschützer | Schildwall | Schild mit Wappen |
| Flink | Ansturm | Lanze |
| Schutzblase | Schutzzauber | Runenkreis |
| Giftig | Bannfluch | violetter Rauch, kein Gifttrank |
| Versteckt | Tarnumhang | Kapuze |
| Auftritt | Fanfare | Trompete (vorhanden) |
| Abschied | Vermächtnis | Schriftrolle |
| geht vom Feld | verlässt den Turnierplatz | verbeugt sich und tritt ab |

### Decks als Wappenhäuser

| heute | Haus | Wappen |
| --- | --- | --- |
| Wald | Haus Eichenhain | Eiche auf Grün |
| Meer | Seefahrergilde | Anker auf Blau |
| Bauernhof | Dorfgemeinschaft Hahnfeld | Hahn auf Gelb |
| Wildnis | Fernländer Karawane | Elefant auf Ocker |
| Krabbeltiere | Schwarm vom Moorbach | Ameise auf Rot |

Die neun Zauberkarten passen fast unverändert (Blitzschlag, Honigtopf, Rückenwind); sie bekommen Pergamentrahmen statt Tierrahmen.

### Eigene Wendung: das Drachenei

Damit der Name trägt und sich das Spiel von seinem Vorbild abhebt, liegt neben jeder Burg ein Drachenei. Es wärmt sich jede Runde um einen Grad, schneller für jede Fanfare des eigenen Hauses. Bei fünf Graden schlüpft ein Jungdrache in der Farbe des Hauses mit einer eigenen Fähigkeit (Eichenhain heilt die Burg, Seefahrergilde verteilt Schutzzauber, Schwarm vom Moorbach spuckt Bannfluch). Das ist eine Regeländerung mit neuer `ruleVersion` und neuer Bot-Bewertung; sie kann auch als Option „Mit Drachenei“ starten.

### Bilder

- **Schritt 1:** Emojis bleiben, bekommen aber einen Wappenrahmen, Helmzier oder Banner je Haus. Kein Bildaufwand, sofort einheitlich.
- **Schritt 2:** Gemalte Kartenbilder im Stil der Narrenhof-Porträts (Tiere in Rüstung, lustig überzeichnet), zuerst für die 10 stärksten Karten und die fünf Jungdrachen. Bei der Canva-Drosselung (ein Bild alle 4 bis 5 Minuten) dauern 15 Bilder etwa eine Stunde, alle 63 Karten etwa fünf Stunden.
- **Verbindung zum Narrenhof:** Einzelne Herrschaften (Löwe, Eiskönigin, Drache) treten als Turnierrichter auf und kommentieren mit ihren Sprüchen.

## Jugendschutz und Barrierefreiheit

- **Kein Alkohol:** Die Taverne schenkt Apfelschorle, Kakao und Kräutertee aus; keine Bierkrüge, kein Met, keine Betrunkenen. Das Wort „Taverne“ ist unproblematisch, die Bilder entscheiden.
- **Kein Glücksspiel-Bild:** Keine Würfelbuden mit Geldeinsätzen, keine Münzstapel als Gewinn. Poker bleibt bei Bohnen und Streichhölzern und steht im Kartentisch nicht im Vordergrund.
- **Keine Kaufanreize:** Im Drachenspiel gibt es weder Kartenpäckchen noch Zufallsbelohnungen. Falls später Karten freigeschaltet werden, dann nur fest und sichtbar durch Spielen, wie im Atelier des Narrenhofs.
- **Keine Gewalt:** Tiere verlassen den Turnierplatz, Burgen verlieren Mauersteine, niemand stirbt; kein Blut, keine Waffen im Angriff außer stumpfen Turnierlanzen.
- **Schlichte Ansicht:** Eine Einstellung schaltet Zierschrift, Holzoberflächen und Atmosphäre ab (für Beamer, Leseschwäche, Unterricht). Sie richtet sich auch nach `prefers-reduced-motion` und `prefers-contrast`.
- **Kontrast:** Die neue Palette muss WCAG AA erreichen (Text 4,5:1), auch Kupfer und Kerzengelb; das prüfe ich vor der Umsetzung mit einem Werkzeug.

## Technik und Schritte

Das Thema hängt an einem Attribut `data-look="taverne"` auf der Seite, das die Theme-Tokens überschreibt; Spiele, die nur Tokens nutzen, ziehen von selbst mit. Bilder kommen als WebP mit höchstens etwa 1,5 MB zusätzlich in den PWA-Vorabspeicher, größere wie Kartenbilder bei Bedarf wie die Tierstimmen. KI-Bilder werden wie beim Narrenhof in `THIRD_PARTY.md` gekennzeichnet.

1. **Rahmen und Startseite** (2 bis 3 Tage): Palette hell und dunkel, Schrift, Schankstube mit Räumen, Schlichte Ansicht. Danach Rauchtest aller Spiele, ob etwas unleserlich wird.
2. **Lobby, Siegerehrung, Wirtin** (2 bis 3 Tage): Tische und Stühle, Festbankett, Wirtin-Porträt in drei Stimmungen, Sprüche.
3. **Drachenspiel Teil 1** (3 bis 4 Tage): Begriffe, Burgmauer, Turmkristalle, Wappenrahmen, Turnierplatz, Narrenhof-Richter.
4. **Drachenspiel Teil 2 und Spieltische** (3 bis 4 Tage): Drachenei als Option mit Bot, gemalte Kartenbilder, Tischoberflächen je Raum, Klangatmosphäre und Playlist „Taverne“ nach deiner Auswahl.

## Offene Fragen an dich

- [ ] Soll die Taverne Standard sein, mit Schlichter Ansicht zum Abschalten, oder umgekehrt?
- [ ] Name des Gasthauses: „Zum Brett & Blatt“, oder ein anderer?
- [ ] Wirtin als Dachsdame, oder lieber ein anderes Tier oder eine Figur aus dem Narrenhof?
- [ ] Drachenspiel: Gefällt das Drachenei als eigene Regel, und soll es Standard oder Option sein?
- [ ] Kartenbilder: gemalt wie die Narrenhof-Porträts, oder Emojis im Wappenrahmen beibehalten?
- [ ] Sollen Klassenspiele (Mathe, Bingo, Quiz) die Taverne überhaupt zeigen, oder im Unterricht immer schlicht bleiben?
