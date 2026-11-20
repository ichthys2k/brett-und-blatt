# Belohnungen – Konzept für Dauermotivation im Spielerpass (#324)

Stand: 20.11.2026, **entschieden von Cornelius** (Abschnitt 8), **Stand 20.11.2026: Schritte 1 bis 8 umgesetzt** (siehe „Stand der Umsetzung“ am Ende von Abschnitt 7). Grundlage ist der Code auf dem Zweig `claude/epic-bell-6ur7rs`. Kennzeichnung: **[Code]** ist im Quelltext belegt (mit Datei), **[Vorschlag]** ist neu und zur Feinabstimmung offen (Zahlen und Texte; die Richtung ist entschieden), **[fehlt]** gibt es noch nicht, **[später]** ist bewusst zurückgestellt. Umgesetzt wird in Schritten (Abschnitt 7), jeder als eigenes Unter-Issue von #324.

## 1. Kurzfassung und Grundsätze

Aus dem Partiebuch wird eine **Stufenleiter in fünf Stufen** (Neuling, Stammgast, Zunftmitglied, Meister, Hofrat). Jede Stufe zeigt einen Titel im Pass; neue Schmuckstücke (Rahmen, Tischflächen, Kulisse, Kartenrücken) kommen **später** dazu, zunächst gibt es keine neuen Bilder (Entscheidung 2). Daneben bleiben die vorhandenen Einzelziele (Kartenrücken, Wappenteile) bestehen und werden nur technisch in einen gemeinsamen Baustein zusammengeführt. Gemessen wird Vielfalt, Können, Gemeinsames und Lernen, nicht Spielzeit.

**Was bleibt frei [Code, `look.ts`, `Avatar`]:** 6 Tischflächen (Eiche, Nuss, grüner und roter Filz, Schiefer, Marmor, je hell und dunkel, dazu „automatisch“), 4 Raumkulissen (`tavern`, `castle`, `library`, `garden`), die Spiel-Kulissen als Seitenhintergrund (12 Motive, Schalter an/aus), 6 Lichtstimmungen im Hauptmenü, alle 76 Avatare, Taverne und Schlicht. Wer das heute wählen kann, kann es morgen noch. Die Ausgangsidee „Tische und Kulissen freischalten“ aus #324 trifft deshalb **nicht mehr** zu: Diese Bilder sind seit #313, #316 und #317 ausgeliefert und frei wählbar. Belohnungen sind darum nur **neue** Dinge; die Bestandsliste steht in Abschnitt 3.

**Regeln für Kinder und Klassen [Vorschlag, aus #324 übernommen]:**

- Kein Druck: keine Tagesaufgaben, keine Serien („Tage in Folge“), nichts verfällt, keine Stufe sinkt.
- Kein Zufall: keine Truhen, keine Überraschungsbelohnung; Schwellen stehen vorher da.
- Nichts zu kaufen, keine Werbung; Freischaltung nur durch Spielen.
- Ruhige Rückmeldung: ein Hinweis am Partieende, kein Vollbild, kein Klang außer bei eingeschalteten Effekten.
- Kein Rangabzeichen für andere: Der Titel erscheint nur im eigenen Pass. In Klasse und Raum sieht man höchstens einen Rahmen, dessen Motive gleichwertig aussehen (Efeu, Sterne, Laterne), nicht Bronze, Silber, Gold.
- In Klassen sind Rahmen und Titel **standardmäßig aus**; die Leitung kann sie für ihre Klasse einschalten (Entscheidung 8). Jeder Pass kann „Belohnungen nicht anzeigen“ wählen. Schlicht und erhöhter Kontrast blenden Schmuck aus, Titel bleiben als Text lesbar.

## 2. Stufenleiter mit Schwellen

Gezählt werden nur **gewertete Partien** (Mindestdauer, siehe unten). Eine Stufe gilt, wenn **alle** Zeilen ihrer Spalte erfüllt sind; nur in der letzten Zeile genügt eine der beiden Bedingungen („Gemeinsam oder Lernen“), damit auch Kinder ohne Online-Zugang aufsteigen. Die Stufe wird aus den Zählern **abgeleitet**, nie gespeichert; da die Zähler nur wachsen, sinkt sie nicht [Code: `mergeBooks` nimmt je Zahl den größeren Wert].

| Zähler | 0 Neuling | 1 Stammgast | 2 Zunftmitglied | 3 Meister | 4 Hofrat |
| --- | ---: | ---: | ---: | ---: | ---: |
| Partien insgesamt | 0 | 10 | 40 | 120 | 500 |
| Verschiedene Spiele gespielt | 0 | 3 | 8 | 20 | 40 |
| Spiele mit Sieg gegen Bot „mittel“ oder „schwer“ | – | – | 1 | 5 | 15 |
| Spiele mit Sieg gegen Bot „schwer“ | – | – | – | 1 | 5 |
| Rubriken komplett (jedes Spiel einmal gespielt) | – | – | – | 1 | 2 |
| Partien mit Menschen (Hot-Seat, online, Turnier) **oder** | – | – | 5 | 20 | 60 |
| Lerntage im Karteikasten | – | – | 3 | 10 | 30 |

**Herkunft der Zähler:**

| Zähler | Quelle [Code] | Anmerkung |
| --- | --- | --- |
| Partien insgesamt | `totals(book).played`, `apps/web/src/lib/partiebuch.ts`; künftig nur gewertete (Zähler `rated`, **[fehlt]**) | Summe über alle Geräte und Modi |
| Verschiedene Spiele | `stampsFor(book, id)`, Stempel `first`, `apps/web/src/lib/stamps.ts` | Spieleliste aus `CATEGORIES` in `screens/Home.tsx` (55 Spiele: Strategie 11, Karten 17, Familie 23, Mathe 4) |
| Sieg gegen mittel/schwer | Stempel `win-medium`, `win-hard` je Spiel (`stamps.ts`), Eimer `bots/<Stufe>` in `counts` | zählt Spiele, nicht Siege: Eine Partie Tic-Tac-Toe ersetzt kein Können in zehn Spielen; Sieg und Spiel zählen nur aus gewerteten Partien (Zähler `ratedWon` im Eimer `bots/<Stufe>`, **[fehlt]**) |
| Rubriken komplett | `categoryStamp(...).earned`, schon als `categoriesComplete` in `crestProgress()`, `apps/web/src/lib/crestStore.ts` | |
| Partien mit Menschen | `totals(book, undefined, 'hotseat' / 'online' / 'tournament')`, gewertete Partien | Eimer `hotseat/-`, `online/-`, `tournament/-`; Hot-Seat zählt mit (Entscheidung 7) |
| Lerntage | `loadLearnBook().days.length`, `apps/web/src/lib/learnStore.ts` | wie bei `library-ink`; ob Lernpartien (`recordGameLearning`) einen Lerntag setzen, vor Umsetzung prüfen |

**Zähler, die fehlen [fehlt]:**

- **Spieltage und Wochen:** Das Partiebuch kennt keinen Tageszähler; `recent` hält nur die letzten 50 Partien (`MAX_RECENT`). Das ist gewollt: Ohne Tageszähler kann keine Serie abreißen. Alle Schwellen oben kommen ohne ihn aus.
- **Spielzeit:** `durationMs` steht nur in `recent`. Spielzeit soll nach #324 ohnehin nicht zählen.
- **Gewertete Partien** (`rated`, `ratedWon` je Eimer): Das Partiebuch zählt heute jede Partie; für die Mindestdauer kommen zwei Zähler dazu, die beim Aufzeichnen nach den Regeln unten gesetzt werden und beim Zusammenführen wie die übrigen Zähler nur wachsen (`mergeBooks`, `sanitizeBook` mitziehen). Altbestand: `rated = played` und `ratedWon = won` (Entscheidung 9).
- **Erreichbare Stempel je Spiel** (nur für den „vollen Stempelbogen“ der Spielränge): **[später]**, solange es keine Spielränge gibt (Entscheidung 10).
- **Klassenmitgliedschaft** als Zähler: liegt in der Merkliste `brett-und-blatt:klassen` (`lib/classes.ts`), nicht im Partiebuch. Wird hier bewusst **nicht** verwendet.
- **Zuletzt gezeigte Stufe** (damit „neu freigeschaltet“ am Partieende genau einmal erscheint): ein Anzeige-Zustand je Pass, am besten im Block `einstellungen` (`settingsBlock.ts`). Der Stand selbst bleibt abgeleitet.
- **Gäste** („Gast“-Pass) zeichnen nichts auf [Code, `spielerpass.md` Abschnitt 4] und haben deshalb keine Stufe; der Hinweis „Mit einem Pass bleibt dein Fortschritt“ gehört in die Gast-Ansicht.

**Mindestdauer je Partie (Entscheidung 6) [Vorschlag zur Feinabstimmung]:** Eine Partie ist „gewertet“, wenn sie beim Partieende **beide** Bedingungen erfüllt:

- **Dauer** (`durationMs`, Zeit seit dem Start des Tisches, `passRecorder.ts`) mindestens **60 Sekunden**;
- **Züge** im Zuglog der lokalen Sitzung (`session.snapshot().log`, derselbe Weg wie `rememberReplay`) mindestens **6**. Online kennt der Browser den Zuglog nicht (siehe #99); dort zählt nur die Dauer.

Für Spiele mit sehr kurzen Partien (etwa Tic-Tac-Toe) wäre das zu streng: Sie bekommen im Steckbrief ein optionales Feld `ratedAfter: { ms, moves }` mit **20 Sekunden und 3 Zügen**. Welche Spiele das betrifft, wird beim Umsetzen aus dem Partiebuch (`recent[].durationMs` je Spiel) abgeleitet: Liegt die mittlere Dauer einer normalen Partie unter etwa zwei Minuten, gilt der kleine Wert. Alle Zahlen sind Vorschläge und ein Feld je Spiel, keine feste Verdrahtung.

Nicht gewertete Partien zählen für das Stempelheft, die Pokale und das Partiebuch wie bisher, nur nicht für die Stufen. Der Titel ist kein Vorteil im Spiel; die Mindestdauer soll nur Durchklicken ausschließen, nicht Fleiß bremsen.

## 3. Belohnungen je Stufe

**Zunächst gibt es nur die Titel** (Entscheidung 2); alle Bilder in der Tabelle sind **[später]** und werden erst nach Kosten und Lust gemalt. Bis dahin bringt eine Stufe den Titel, die Anzeige im Pass und den vorhandenen Kartenrücken `castle-banner`.

Spalte „Stand“: **vorhanden** = Bild und Code liegen im Repo, **neu** = muss gemalt bzw. gebaut werden (Auftrag im Stil von `docs/grafik/STILBIBEL.md`, Original ins private Repo `brett-und-blatt-grafik`), **#306** = im Grafik-Vorhaben geplant.

| Stufe | Titel | Neue Belohnungen (Vorschlag, Bilder später) | Stand |
| --- | --- | --- | --- |
| 1 Stammgast | „Stammgast“ im Pass und auf der Passkarte | Kartenrücken `castle-banner` (heute schon „10 Partien“, `cardBacks.ts`); Avatar-Rahmen „Efeu“ | Rücken vorhanden; Rahmen und Titel **neu** |
| 2 Zunftmitglied | „Zunftmitglied“ | Tischfläche „Leder, dunkelrot“; Avatar-Rahmen „Sterne“ | **neu** (beide) |
| 3 Meister | „Meister“ | Tischfläche „Samt, nachtblau“; Raumkulisse „Zunftstube“; Avatar-Rahmen „Laterne“ | **neu** (alle drei) |
| 4 Hofrat | „Hofrat“ | Tischfläche „Intarsien mit Goldadern“; Kartenrücken „Hofsiegel“; Avatar-Rahmen „Krone aus Ähren“ | **neu** (alle drei) |

Insgesamt wären das 3 Tischflächen (je hell und dunkel, nach dem Muster der Dateien in `apps/web/src/assets/tische/`), 1 Raumkulisse, 1 Kartenrücken (500 × 700, punktsymmetrisch wie in #314) und 4 Rahmen als neue Bilder; ein Hinweis zum Rahmen: Dass `PlayerCrest` (#491) schon einen `ring` kennt, ist ein fester Medaillonrand, kein wählbarer Rahmen [Code, `docs/CHRONIK.md`]; Rahmen gibt es also **[fehlt]**. Titel brauchen kein Bild. Entschieden ist, die Stufen zunächst nur mit Titel und den vorhandenen Rücken zu betreiben (Entscheidung 2); die Bilder sind ein späteres Vorhaben und noch kein Unter-Issue.

**Bestehende Einzelziele, die bleiben und in den Baustein ziehen [Code]:**

| Belohnung | Regel heute | Datei |
| --- | --- | --- |
| Kartenrücken `bavarian-gold` | 3 Stempel in Skat, Schafkopf, Doppelkopf, Binokel (`stampCount(book, TRICK_GAMES) >= 3`) | `cardBacks.ts` |
| `jester-velvet` | 1 Partie im Narrenhof (`color-sorter`) oder gespeicherter Narr im Atelier (liest `localStorage` direkt) | `cardBacks.ts` |
| `dragon-scale` | 1 Sieg im Drachenspiel | `cardBacks.ts` |
| `castle-banner` / `library-ink` / `garden-rose` | 10 Partien / 5 Lerntage / 3 verschiedene Familienspiele | `cardBacks.ts` (#314) |
| `fairground` / `night-sky` | 1 Sieg im Narrenhof / 1 Turnier gespielt | `cardBacks.ts` (#314) |
| Wappenteile (Schildform, Teilung, Farben, Zier) | zwischen 3 Stempeln und 25 Partien, 3 bis 5 Pokale, 1 Turniersieg, 1 Rubrik | `packages/engine/src/player-crest.ts` (`CrestProgress`: `stamps`, `trophies`, `wins`, `played`, `tournamentWins`, `categoriesComplete`) |

Frei von Anfang an: `classic-red`, `classic-blue`, `tavern-oak`, `royal-crest`, `tavern-lantern`. Zusammen sind es 13 Rücken, davon 8 mit Regel.

## 4. Sammelziele je Rubrik und je Spiel

Dieser Abschnitt bleibt als **[später]** stehen: Neue Kartenrücken („Spielbrett“, „Rechenschiefer“) brauchen Bilder (Entscheidung 2), und Spielränge je Spiel werden vorerst nicht eingeführt (Entscheidung 10). Die vorhandenen Sammelziele und Wappenzier-Regeln ziehen mit Schritt 1 in den Baustein.

Sammelziele sind einzelne, sichtbare Aufgaben ohne Reihenfolge. Sie stehen im Stempelheft (`StampBook.tsx`) und zählen **nicht** für die Stufen, es sei denn, eine Zeile aus Abschnitt 2 sagt es.

| Rubrik (Spiele) | Sammelziel [Vorschlag] | Belohnung |
| --- | --- | --- |
| Strategie & Brett (11) | alle 11 gespielt (Stempel „Rubrik komplett“, vorhanden) | Wappenzier `band` (vorhanden); neu: Kartenrücken „Spielbrett“ |
| Karten & Stich (17) | 3 Stichspiele-Stempel (vorhanden) und alle 17 gespielt | `bavarian-gold` und Wappenzier `band` (beide vorhanden) |
| Familie & Gesellschaft (23) | 3 verschiedene Spiele (vorhanden), später alle 23 | `garden-rose` (vorhanden) |
| Mathe, Kl. 5/6 (4) | alle 4 gespielt | Wappenzier `band`; neu: Kartenrücken „Rechenschiefer“ |
| Lernen (Karteikasten) | 5 Lerntage (vorhanden), 30 Lerntage | `library-ink` (vorhanden); 30 Lerntage zählen zur Stufe 4 |
| Gemeinsam | 1 Turnier, 1 Turniersieg, 10 Hot-Seat-Partien | `night-sky`, Wappenzier `lorbeer` (beide vorhanden) |

**Je Spiel** gibt es heute das Stempelheft mit 7 Stempeln (`first`, `win`, `win-easy`, `win-medium`, `win-hard`, `online`, `tournament`) und den Pokalschrank. **[später, vorerst nicht eingeführt]** Möglicher Ausbau: fünf Spielränge, rein als Anzeige in der Kachel des Stempelhefts, abgeleitet aus den Zählern `counts[…][spiel]`:

| Rang | Bedingung | Zähler |
| --- | --- | --- |
| Probiert | 1 Partie | `played > 0` [Code] |
| Geübt | 10 Partien | `totals(book, id).played` [Code] |
| Kenner | 10 Siege | `totals(book, id).won` [Code] |
| Könner | Sieg gegen „schwer“ | Stempel `win-hard` [Code] |
| Voller Bogen | alle erreichbaren Stempel | **[fehlt]**, siehe Abschnitt 2 |

Der Rang bringt keinen eigenen neuen Gegenstand, nur eine Plakette im Heft und im Profil (Darstellung aus Text und Emoji, kein Bild). Gemessen an der Zahl der Spiele (55) hätte ein eigener Gegenstand je Spiel zu viel Grafikaufwand.

## 5. Abschätzung: wie lange bis zur Stufe

**Annahmen [Vorschlag, nicht gemessen]**, damit Cornelius sie korrigieren kann:

| | Gelegenheitsspieler | Vielspieler | Schulklasse (je Schüler) |
| --- | --- | --- | --- |
| Partien je Woche | 3 | 20 (rund 3 je Tag) | 6 (eine Stunde, kurze Spiele) |
| Wochen je Jahr | 52 | 52 | 38 Schulwochen |
| Neue Spiele | jede 4. Partie bis 25 Spiele, danach jede 10. | jede 6. Partie bis 45 Spiele | 1 neues Spiel je Woche (Lehrkraft stellt vor) |
| Spiele mit Sieg gegen mittel/schwer | 25 % / 5 % der probierten Spiele | 60 % / 40 % | 30 % / 0 % |
| Partien mit Menschen | 20 % | 30 % | 100 % (Hot-Seat, Klassenraum) |

Rechnung je Stufe = größter Engpass aus den Zeilen von Abschnitt 2. Beispiel Gelegenheit, Stufe 3: Partien 120 : 3 = 40 Wochen; Vielfalt 20 Spiele nach 80 Partien (27 Wochen); Können 25 % von 20 = 5 Spiele (passt); Menschen 20 % von 120 = 24 (passt) – Engpass Partien, also **40 Wochen**.

| Stufe | Gelegenheit | Vielspieler | Schulklasse | Engpass |
| --- | --- | --- | --- | --- |
| 1 Stammgast (10 Partien, 3 Spiele) | 3 bis 4 Wochen | 3 bis 4 Tage | 2 Wochen | Partien |
| 2 Zunftmitglied (40, 8, 1, 5) | 13 Wochen (3 Monate) | 2 Wochen | 8 Schulwochen (2 Monate) | Partien; Klasse: Vielfalt (8 Spiele) |
| 3 Meister (120, 20, 5, 1, 1 Rubrik, 20) | 40 Wochen (9 bis 10 Monate) | 6 Wochen | 20 Schulwochen (ein Halbjahr) | Partien; Klasse zusätzlich Vielfalt (20 Spiele) |
| 4 Hofrat (500, 40, 15, 5, 2 Rubriken, 60) | über 3 Jahre, praktisch nein | 25 Wochen (6 Monate) | über 2 Schuljahre, nein | Können gegen „schwer“ (5 Spiele); Gelegenheit hat bei 40 Spielen erst 2 |

Lesart: Stufe 1 und 2 geben früh Erfolg (Wochen), Stufe 3 ist das Ziel eines normalen Jahres, Stufe 4 bleibt Vielspielern vorbehalten und Klassen erreichen sie bewusst nicht. Wenn Hofrat auch Gelegenheitsspielern offenstehen soll, wäre die Zeile „gegen schwer“ zu senken (Entscheidung 3: bewusst nicht). Die Annahmen zu Siegquoten und Bot-Stufen sind Schätzungen; eine Messung wäre aus den Pässen nicht möglich (der Server sieht nichts, `spielerpass.md`), nur an Testgeräten.

## 6. Auswirkungen auf Pass, Familie, Geräte und Online

**Pass und Geräte.** Die Stufe ist eine reine Funktion aus Partiebuch (Block `partiebuch`) und Lernbuch (Block `lernen`); beide reisen schon mit dem Pass [Code: `passBlocks.ts`, `mergeBooks`]. Es gibt keinen neuen Block für den Stand. Neu wären die zwei Zähler `rated`/`ratedWon` im Partiebuch (Abschnitt 2), der Anzeige-Zustand „zuletzt gesehene Stufe“ und die Wahl „Belohnungen ausblenden“, die beiden letzten in `einstellungen`. Ohne Pass gilt alles je Gerät (`counts[Gerät]`). Gewählte Rahmen, Tische und Rücken reisen wie `CARD_BACK_KEY` als Einstellung mit; ob eine Wahl noch freigeschaltet ist, prüft jedes Gerät lokal und fällt sonst auf den Standard zurück (so macht es `loadActiveCardBack` heute).

**Stolperstein im heutigen Code [Code]:** `garden-rose` liest die Familienspiele über `loadFamilyGames()` per dynamischem `import('../screens/Home')`; bis der Import fertig ist, ist die Liste leer und der Rücken kurz „gesperrt“. Der gemeinsame Baustein soll die Spieleliste synchron bekommen (Rubriken in ein kleines Modul ohne Oberfläche).

**Familie (#139).** Je Pass eine eigene Stufe und eigene Freischaltungen (`passes.ts`, aktiver Pass bestimmt Anzeige und Aufzeichnung). Im Hot-Seat schreibt jeder beteiligte Pass sein eigenes Ergebnis, also zählen Partien mit Geschwistern für jeden; Hot-Seat zählt als „Partie mit Menschen“ (Entscheidung 7).

**Rückwirkung (Entscheidung 9).** Die Stufe ist abgeleitet; wer schon 200 Partien hat, ist beim ersten Start mit der neuen Version Meister (sofern die übrigen Zeilen stimmen). Statt eines Hinweises je übersprungener Stufe erscheint **ein** gesammelter Hinweis („Du bist jetzt Meister – willkommen in der Zunft“); dafür wird beim ersten Start die berechnete Stufe als „zuletzt gesehen“ gespeichert. Der Hinweis am Partieende gilt nur für den aktiven Pass; Gast-Plätze bekommen keinen.

**Online.** Heute übertragen `hello` und `setName` (`packages/online/src/protocol.ts`) `name`, `avatar` (höchstens 20 Zeichen) und optional `crest` (höchstens 120 Zeichen); `MemberInfo` gibt diese an alle im Raum weiter, `PublicSeat` nur `name`, `avatar`, `level`. Kartenrücken, Tische und Stufe gehen **nicht** hinaus, jeder sieht seinen eigenen Rücken (Beschluss #314). Vorschlag:

- Nur der **Avatar-Rahmen** wird übertragen, als neues optionales Feld `frame?: string` (Kennung aus fester Liste, höchstens 20 Zeichen) in `hello`, `setName`, `MemberInfo` und `PublicSeat`. Ein neues optionales Feld erhöht `PROTOCOL_VERSION` nicht (`docs/protokoll.md`); danach `node scripts/protokoll-schema.mjs` ausführen und `tests/protokoll-schema.test.ts` mitziehen.
- Der Server kann **nicht prüfen**, ob ein Rahmen verdient ist (er sieht den Pass nicht). Das ist hinnehmbar: Rahmen sind Schmuck ohne Wettbewerbswert, der Server prüft nur Form und Kennung.
- Stufe und Titel werden nie übertragen. Die Klassenkarte (`classcard.ts`) bekommt **keinen** Abschnitt „Stufe“; bei Rahmen gilt der Schalter der Leitung, in Klassen standardmäßig aus (Abschnitt 1). Beim „Pass teilen“ (Schnappschuss) ist die Stufe eine Auswahlzeile, Vorgabe aus (Entscheidung 5). Solange es noch keine Rahmenbilder gibt (Entscheidung 2), bleibt `frame` ungenutzt; das Feld wird trotzdem früh angelegt, damit das Protokoll nicht später nachgezogen werden muss.
- Fremde Clients (offenes Protokoll #334) sehen das Feld nur, wenn sie es kennen; fehlt es, zeigen sie den Avatar ohne Rahmen.

**Datenschutz.** Neue Daten verlassen das Gerät nur über den Rahmen im Raum und die bestehenden Pass-Blöcke; `apps/web/src/screens/Legal.tsx` nennt den Rahmen als Teil des Raumprofils.

## 7. Umsetzungsschritte (Unter-Issues von #324)

Jedes Issue hat `status: Idee`; `Ready` gibt Cornelius. Ohne Bilder (Entscheidung 2) und ohne Spielränge (Entscheidung 10) bleiben acht Schritte. Abhängigkeiten stehen im Text der Issues.

1. **Freischalt-Baustein** `apps/web/src/lib/unlocks.ts`: ein `Progress`-Objekt (Zähler in einer Funktion, synchron, ohne dynamischen Import) und Regeln als Daten (`{ id, art, bedingungen[] }`, Fortschrittstext erzeugt der Baustein). `cardBacks.ts` und `CrestProgress`/`unlockOf` werden darauf umgestellt, **ohne** Verhaltensänderung (Tests vergleichen alte und neue Entscheidung für alle 13 Rücken und alle Wappenteile). Der Sonderweg über `localStorage` beim Narrenhof und der dynamische Import bei `garden-rose` entfallen.
2. **Gewertete Partien:** Zähler `rated`/`ratedWon` im Partiebuch, Mindestdauer und Mindestzüge im Recorder (Abschnitt 2), optionales Steckbrieffeld `ratedAfter`, Altbestand `rated = played`.
3. **Stufen berechnen:** `levelOf(progress)` mit Schwellen als Daten und Tests (Tabelle aus Abschnitt 2, Alternativzeile Menschen/Lerntage, Hot-Seat zählt). Hängt von 1 und 2 ab.
4. **Anzeige im Pass:** Stufe, Titel und „nächste Stufe: noch …“ je Zeile in `Pass.tsx`/`PassView.tsx` (auch als Text für Screenreader), Schalter „Belohnungen nicht anzeigen“, Titel auf der Passkarte, beim „Pass teilen“ die Stufe als Auswahlzeile (Vorgabe aus). Hängt von 3 ab.
5. **Hinweis am Partieende und Sammelhinweis:** ruhige Zeile „Neu freigeschaltet: …“ in `Ceremony.tsx` bzw. `passRecorder.ts`, Anzeige-Zustand „zuletzt gesehene Stufe“ im Block `einstellungen`, beim rückwirkenden Aufstieg **ein** gesammelter Hinweis. Hängt von 3 ab.
6. **Protokoll-Feld `frame`:** optionales Feld in `hello`, `setName`, `MemberInfo`, `PublicSeat`, Prüfung der Form im Server, Schema neu erzeugen, Tests; ohne neue Protokollversion. Unabhängig von 1 bis 5.
7. **Klassen-Schalter:** Leitung schaltet Rahmen und Titel für ihre Klasse ein (Standard aus), `ClassState`/`classroom.ts`, Anzeige beachtet den Schalter. Hängt von 6 ab.
8. **Abschluss:** `Legal.tsx` (Rahmen als Teil des Raumprofils), `docs/CHRONIK.md`, Rauchtest in Taverne, Schlicht und hohem Kontrast. Hängt von 1 bis 7 ab.

**Stand der Umsetzung (20.11.2026):** Umgesetzt sind Schritt 1 (#569), 2 (#570), 3 (#571), 4 (#573, ohne Auswahlzeile beim „Pass teilen“), 5 (#574), 6 (#572), 7 (#575) und 8 (#576, Datenschutztext in `Legal.tsx`, Chronik, Rauchtest der Pass-Seite). Dateipfade je Schritt stehen in `docs/CHRONIK.md`. **Offen:** Rahmenbilder (#598), die Auswahlzeile „Stufe“ beim „Pass teilen“ samt Passkarte (Vorgabe aus) und eine Quelle, aus der die Web-App einen Rahmen an den Server schickt.

**Später, noch ohne Issue:** Avatar-Rahmen, Tischflächen, Raumkulisse und neue Kartenrücken als Grafikaufträge (`.agent/workflows/grafik-erzeugen.md`), Sammelziele und Spielränge im Stempelheft samt „erreichbare Stempel je Spiel“.

## 8. Entscheidungen (20.11.2026)

Cornelius hat im Chat alle zehn Fragen entschieden.

1. **Stufenleiter:** fünf Stufen (Neuling, Stammgast, Zunftmitglied, Meister, Hofrat) mit den Schwellen aus Abschnitt 2, übernommen.
2. **Keine neuen Bilder zunächst:** nur Titel und Anzeige im Pass; Tischflächen, Kulisse und Kartenrücken später.
3. **Hofrat bleibt bewusst nur für Vielspieler** erreichbar.
4. **Bestehendes bleibt frei:** Tische, Kulissen, Lichtstimmungen und alle 76 Avatare für alle; Belohnungen sind nur Neues.
5. **Online nur der Avatar-Rahmen** (neues optionales Feld `frame`, ohne neue Protokollversion, Schema danach neu erzeugen); Stufe und Titel werden nie übertragen. Beim „Pass teilen“ ist die Stufe wählbar, Vorgabe aus.
6. **Mindestdauer je Partie** für die Stufen: Vorschlag 60 Sekunden **und** 6 Züge (online nur Dauer), für Kurzspiele 20 Sekunden und 3 Züge (Feld `ratedAfter` im Steckbrief); Feinabstimmung beim Umsetzen (Abschnitt 2).
7. **Hot-Seat zählt** als „Partie mit Menschen“.
8. **Klassen:** Rahmen und Titel standardmäßig aus, die Leitung kann sie einschalten.
9. **Rückwirkung:** Bestehende Spieler steigen nach ihrem Partiebuch auf, mit einem gesammelten Hinweis.
10. **Spielränge je Spiel** werden vorerst nicht eingeführt (spätere Erweiterung).
11. **Stufe teilen (Nachlieferung, 20.11.2026, #573):** Beim „Pass teilen“ (Link und Passkarte als Bild) ist „Stufe und Titel“ eine Auswahlzeile, Vorgabe aus. Sie ist nicht wählbar und wird nie eingepackt, wenn der aktive Pass ein Gast ist oder „Belohnungen nicht anzeigen“ gewählt hat. Im Schnappschuss steht nur die Stufenzahl (`level`), der Titel kommt beim Ansehen aus `LEVELS`. Die Klassenkarte bleibt ohne Stufe.
12. **Stufe 0 heißt „Neuling“,** nicht „Gast“ (der Gast-Pass ist etwas anderes und würde verwechselt).
13. **Zuletzt gesehene Stufe** (`stufe-gesehen`) wird beim Zusammenführen der Einstellungen nicht nach „jüngster Änderung“, sondern nach **höherer Stufe** entschieden (`mergeItems` in `settingsBlock.ts`), damit ein Gerät mit älterem Stand keinen Aufstieg zurücknimmt und der Hinweis nicht doppelt kommt.

## Quellen

Issue #324 und #314; `apps/web/src/lib/cardBacks.ts`, `partiebuch.ts`, `stamps.ts`, `crestStore.ts`, `learnStore.ts`, `look.ts`, `album.ts`, `pokale.ts`; `packages/engine/src/player-crest.ts`; `packages/online/src/protocol.ts`, `classroom.ts`, `classcard.ts`; `docs/spiele/spielerpass.md`, `kernschleifen.md`; `docs/grafik/BESTAND.md`; `docs/CHRONIK.md`.
