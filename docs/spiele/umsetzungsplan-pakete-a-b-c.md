> Übernommen aus dem Claude-Dokument https://claude.ai/artifact/NwAG5AvLJ2d3XH95wcxLAU am 1.11.2026, damit andere Agenten den Plan lesen können. **Diese Datei ist ab jetzt die maßgebliche Fassung.**

# Umsetzungsplan: acht neue Spiele für viele Spieler

Oct 31, 2026 · @Cornelius Lipponer

## Kurzfassung

Ich würde die acht Spiele in drei Paketen bauen, zusammen etwa sechs Wochen Arbeit. **Paket A** sind schnelle Klassiker auf vorhandenen Bausteinen: Nicht ärgern! zu sechst, Elfer raus und Sternhalma. **Paket B** sind die Wortspiele Kategorien-Sprint, Wer bin ich? und Sag's anders; sie brauchen zuerst einen gemeinsamen Baustein für Texteingabe und Teams. **Paket C** sind Reihenbauer und Landschaftsleger.

Die wichtigste Entscheidung vorab betrifft drei Spiele mit Verlagsvorbild: Reihenbauer (6 nimmt!), Landschaftsleger (Carcassonne) und Sag's anders (Tabu). Diese würde ich nicht nachbauen, sondern als deutlich eigene Spiele mit eigener Kernregel entwerfen. Die Entwürfe stehen unten; sie brauchen dein Ja, bevor Paket C beginnt. Bei Sag's anders reicht der eigene Schreib-Modus, damit kann es schon in Paket B kommen.

## Die acht Spiele

| Spiel | Form | Herkunft | Spieler | Bot | Aufwand | Paket |
| --- | --- | --- | --- | --- | --- | --- |
| Nicht ärgern! zu sechst | Brettspiel | alt und frei | 2–6 | vorhandener Würfelmeister, angepasst | 2–3 Tage | A |
| Elfer raus (34) | Kartenspiel | alt und frei | 2–6 | neu, einfach | 2 Tage | A |
| Sternhalma (30) | Brettspiel | alt und frei | 2, 3, 4, 6 | neu, Suche über Sprungketten | 4 Tage | A |
| Kategorien-Sprint (3) | Wortspiel | alt und frei (Stadt, Land, Fluss) | 2–30 | antwortet aus Wortlisten | 3–4 Tage | B |
| Wer bin ich? (5) | Wortspiel | alt und frei | 3–10 | nur im Katalog-Modus | 3 Tage | B |
| Sag's anders (32) | Wortspiel | Vorbild Tabu, eigene Fassung | 4–30 | nur im Schreib-Modus | 4 Tage | B |
| Reihenbauer (18) | Kartenspiel | Vorbild 6 nimmt!, eigener Entwurf | 2–10 | neu, Stichproben | 1 Tag Entwurf, 3 Tage Bau | C |
| Landschaftsleger (31) | Legespiel | Vorbild Carcassonne, eigener Entwurf | 2–5 | neu, Bewertung je Lage | 2 Tage Entwurf, 7 Tage Bau | C |

Dazu kommen 2 bis 3 Tage für die gemeinsamen Bausteine und je ein halber Tag Inhalte prüfen (Begriffe, Wortlisten). Die Zeiten sind Schätzungen für eine Claude-Sitzung mit Tests, Prüfstand und Blick im Browser.

## Eigene Fassungen der drei Spiele mit Vorbild

Jede Fassung behält die Spielart, ersetzt aber die Kernregel des Vorbilds durch eine eigene. Namen, Karten und Texte sind ohnehin neu. Die Entwürfe sind Vorschläge; vor dem Bau prüfe ich mit Bot-Partien im Prüfstand, ob sie spannend und ausgewogen sind.

### Reihenbauer wird „Marktstände“

- **Karten:** 60 Karten mit den Zahlen 1 bis 60 in vier Waren (Brot, Käse, Äpfel, Fisch), jede mit 0 bis 2 Sternen.
- **Ablauf:** Alle wählen gleichzeitig eine Karte, dann wird von der kleinsten Zahl an gelegt. Anders als beim Vorbild wählt jeder **selbst**, an welchen der vier Stände er legt. Erlaubt ist ein Stand, dessen oberste Karte kleiner ist oder dieselbe Ware zeigt.
- **Abräumen:** Wer die fünfte Karte an einen Stand legt oder nirgends legen darf, nimmt die Karten des Standes in seine Vorratskammer.
- **Wertung:** Genommene Karten sind nicht automatisch schlecht. Je Ware zählen deine Sterne als Pluspunkte, wenn du in dieser Ware die meisten Karten hast, sonst als Minuspunkte. So wird Abräumen manchmal zum Ziel.

### Landschaftsleger wird „Grafschaft“

- **Plättchen:** Sechseckige Landschaftsplättchen (Wald, Wiese, Feld, Teich, Dorf, Berg), manche mit Fluss, Weg oder Mühle. Es gibt keine Kanten, die zueinander passen müssen, und keine Spielfiguren auf Landschaften.
- **Jahrmarkt:** Fünf Plättchen liegen offen aus; wer am Zug ist, nimmt eines und legt es an die gemeinsame Karte.
- **Aufträge vom Hof:** Jeder hat drei geheime Aufträge von Narrenhof-Höflingen, etwa „Die Gans will drei Teiche nebeneinander“ oder „Der Müller will eine Mühle am Fluss“. Erfüllte Aufträge bringen Punkte, neue kommen nach.
- **Vielfalt:** Dörfer punkten für jede verschiedene Landschaft um sie herum.

### Sag's anders wird „Umschreibe-Duell“

- **Eigene Sperrwörter:** Es gibt keine Karten mit festen verbotenen Wörtern. Vor jedem Begriff tippt das gegnerische Team in 20 Sekunden selbst drei Sperrwörter.
- **Schreib-Modus (online, Bot möglich):** Der Erklärer tippt Hinweise. Ein Filter blockt Sperrwörter, den Begriff selbst und deren Wortstämme automatisch, und das eigene Team rät per Eingabe.
- **Sprech-Modus (am Tisch, im Klassenzimmer):** Der Erklärer spricht, das gegnerische Team drückt „Gesagt!“, wenn ein Sperrwort fällt.
- **Begriffe:** Eigene Listen, darunter ein Mathe-Paket für Klasse 5 und 6, geprüft von dir.

### Neu: Handelsspiel „Marktflecken“ (Wunsch vom 31.10. abends)

Ein Handels- und Würfelspiel im Mittelalter statt eines Monopoly-Nachbaus. Monopoly ist eine geschützte Marke von Hasbro; Name, Felder und Karten scheiden aus. Die Spielart ist frei und älter als Monopoly („The Landlord's Game“, 1904).

- **Brett:** Ein Rundkurs um die Burg mit Handwerksbetrieben (Bäckerei, Schmiede, Mühle, Weberei) in sechs Zünften, dazu Markt, Kloster, Stadttor und Jahrmarkt. 2 bis 6 Spieler, Taverne- und Narrenhof-Optik.
- **Währung:** Brezeln wie im Narrenhof, nie Echtgeld, nichts zu kaufen.
- **Ablauf:** Würfeln und ziehen, Betriebe erwerben, Zunfthäuser bauen, wer auf fremden Betrieben landet, zahlt Brezeln für die Ware.
- **Eigene Wendungen gegenüber Monopoly:**
  - Kein Ausscheiden durch Pleite: Die Partie dauert eine feste Zahl von Jahren (etwa 4 Runden je Jahr, insgesamt 30 bis 45 Minuten). Am Ende gewinnt das höchste **Ansehen** aus Betrieben, Bauten und Spenden ans Kloster.
  - **Zunftaufträge:** Jede Zunft bringt Bonus-Ansehen, wenn ein Spieler ihre drei Betriebe besitzt oder zwei Spieler sich als Zunftpartner zusammentun. Handel und Partnerschaften statt nur Kaufen.
  - **Hofnachrichten** statt Ereigniskarten: offen ausliegende Ereignisse mit festen Wirkungen, die für eine Jahreszeit gelten (Missernte, Turnier, Pilgerzug). Kein verdecktes Zufallsziehen mit Geldgewinnen.
- **Jugendschutz:** keine Glücksspielfelder, keine Steuern- oder Gefängnis-Witze mit echtem Bezug, kein Bankrott eines Kindes vor allen anderen.
- **Bot:** Bewertung nach Rendite je Betrieb und Zunftnähe, Handel mit festen Grenzen.
- **Aufwand:** 2 Tage Entwurf mit Probepartien, etwa 8 Tage Bau (Handel und Verhandeln online brauchen eine eigene Oberfläche). Paket C, nach deinem Ja zum Entwurf.

### Neu: Laufspiel „Rübenacker“ (Wunsch vom 31.10. abends)

Eine eigene Fassung in der Art von Lotti Karotti. Lotti Karotti ist ein Spiel von Ravensburger; Name, Brett, Drehkarotte und Bilder scheiden aus. Die Spielart „Wettlauf mit Fallen“ ist frei.

- **Setting:** Im Königsgarten unter der Narrenhof-Burg wächst die Riesenrübe des Königs. Hasenfamilien wollen sie als Erste erreichen, doch Gärtner Maulwurf gräbt unter dem Beet seine Gänge.
- **Ablauf:** 2 bis 6 Spieler mit je 3 Hasen. Statt Würfeln zieht man eine Karte: 1, 2 oder 3 Felder vorwärts, oder „Maulwurf“.
- **Eigene Wendung:** Bei Lotti Karotti öffnen sich die Löcher überraschend durch Drehen. Hier sieht man den Maulwurf: Er wandert auf einer sichtbaren Spur unter dem Beet, ein Erdhügel zeigt, wo er beim nächsten „Maulwurf“-Zug auftaucht. Wer dann darauf steht, purzelt ins Loch. Kinder können also ausweichen und planen, statt nur Glück zu haben.
- **Kinderfreundlich:** Wer ins Loch fällt, kommt zurück zum letzten Zaunpfahl (Zwischenstation), nicht ganz an den Start. Als Option gibt es auch „Streng: zurück zum Start“.
- **Ende:** Wer zuerst einen Hasen an der Rübe hat, gewinnt. Option: alle drei Hasen ans Ziel.
- **Zielgruppe:** ab etwa 4 Jahren, kurze Partie (5 bis 10 Minuten), gut am Tablet zu mehreren.
- **Bot und Aufwand:** einfacher Bot, der Erdhügeln ausweicht. Etwa 3 bis 4 Tage, nach deinem Ja zum Entwurf. Passt in Paket A, weil es keine neuen Bausteine braucht.

## Gemeinsame Bausteine vorab

Drei Bausteine kommen vor Paket B in Engine, UI und Lobby. Danach braucht jedes Wortspiel nur noch seine Regeln und Inhalte.

| Baustein | Inhalt | gebraucht von |
| --- | --- | --- |
| Texteingabe mit Prüfung (`packages/engine/src/words.ts`, UI-Feld in `packages/ui`) | Eingabe normalisieren (Groß- und Kleinschreibung, ä/ae, ß/ss), Tippfehler bis Abstand 1 als gleich werten, Spitznamen-Filter, höchstens 30 Zeichen | Kategorien-Sprint, Wer bin ich?, Umschreibe-Duell |
| Abstimmung (`packages/engine/src/vote.ts`) | geheime oder offene Stimmen, Live-Stand, Gleichstand-Regel, Systemzug nach Ablauf | Kategorien-Sprint (Zweifelsfälle), Umschreibe-Duell (Sperrwörter) |
| Teams in der Lobby (`packages/online`) | zwei Teams, Wechsel per Antippen, „Zufällig verteilen“ wie „Alle verteilen“, Team im Zustand des Spiels | Umschreibe-Duell, später weitere |

Nicht ärgern! zu sechst braucht in der Engine nichts Neues: Die Bahnlänge (heute fest 40 Felder) wird von der Platzzahl abhängig, mit neuer `ruleVersion`.

## Pakete und Reihenfolge

1. **Nicht ärgern! zu sechst** (2–3 Tage): Option „Sechser-Brett“ ab 5 Spielern, sechsarmiges Brett mit 48 Feldern, zwei zusätzliche Farben mit eigenem Formsymbol, Bot und Klänge wie gehabt. Schneller Erfolg, den Familien sofort nutzen.
2. **Elfer raus** (2 Tage): 80 Zahlenkarten 1–20 in vier Farben, Anlegen ab der 11, Ziehen bis zu dreimal, Bot „Reihenkenner“. Nutzt `CardFan` und Drag & Drop.
3. **Bausteine** (2–3 Tage): Texteingabe, Abstimmung, Teams, je mit eigenen Tests.
4. **Kategorien-Sprint** (3–4 Tage): Buchstabe, fünf Kategorien aus Paketen (Allgemein, Tiere, Bibel, Mathe), gleichzeitiges Tippen, Stopp-Knopf oder Uhr, Doppelte zählen halb, Zweifelsfälle per Abstimmung, Tafelansicht.
5. **Wer bin ich?** (3 Tage): Freier Modus (andere antworten per Ja-, Nein-, Vielleicht-Knopf) und Katalog-Modus mit festen Fragen und Merkmalen je Begriff, in dem auch Bots mitspielen.
6. **Umschreibe-Duell** (4 Tage): Schreib- und Sprech-Modus, Teams, Begriffspakete.
7. **Sternhalma** (4 Tage): Sternbrett mit 121 Löchern, 2, 3, 4 oder 6 Spieler, Sprungketten mit Vorschau, Bot mit Abstandsbewertung und Vorausschau.
8. **Marktstände** (1 Tag Probepartien, 3 Tage Bau), nach deinem Ja zum Entwurf.
9. **Grafschaft** (2 Tage Probepartien, 7 Tage Bau), nach deinem Ja zum Entwurf. Passt optisch zur Taverne und zum Narrenhof.

10) **Marktflecken** (2 Tage Entwurf, 8 Tage Bau), nach deinem Ja zum Entwurf; danach sind es neun Spiele und etwa acht Wochen.

11. **Rübenacker** (3 bis 4 Tage), in Paket A nach Sternhalma, nach deinem Ja zum Entwurf.

Paket A (Schritte 1, 2 und 7) und Paket B (Schritte 3 bis 6) berühren kaum dieselben Dateien und könnten in zwei Threads parallel laufen. Gemeinsam geändert werden nur `apps/server/src/games.ts` und `apps/server/package.json`; dort löst der zweite Merge den kleinen Konflikt.

## Arbeitsweise je Spiel

- **Plan zuerst:** `docs/spiele/<name>.md` mit Regeln und Optionen, dazu ein Eintrag in PLANUNG.md (W-032 bis W-039).
- **Eigener Zweig und PR,** angelegt mit `corepack pnpm neues-spiel`. Bei Mehrspieler-Spielen kommt ein Eintrag im Spieleserver dazu.
- **Tests:** Regeltests, `gameContractChecks` mit Geheimnis-Prüfung (verdeckte Hand bei Elfer raus und Marktstände, geheime Antworten bis zur Auflösung bei den Wortspielen), `corepack pnpm check`, Rauchtest und Prüfstand.
- **Aussehen:** Theme-Tokens, damit Taverne und Schlichte Ansicht von selbst passen. Eigenes Klassenpräfix je Spiel.
- **Klänge und Musik:** Zuordnung aus dem vorhandenen Katalog. Neue Klänge nur nach deiner Auswahl.
- **Veröffentlichen:** auf dein „deploy“, je Spiel oder je Paket.

## Offene Fragen an dich

- [ ] Sind die eigenen Fassungen Marktstände, Grafschaft und Umschreibe-Duell so in Ordnung, oder soll ich etwas anders entwerfen?
- [x] Passt die Reihenfolge, oder soll Paket B (Wortspiele für die Klasse) vor Paket A?
- [x] Sollen Paket A und B parallel in zwei Threads laufen?
- [x] Wer liefert die Begriffe und Wortlisten: ich als Entwurf zur Prüfung durch dich, oder hast du eigene Listen?
- [x] Sollen die Wortlisten wie beim Bibel-Quiz vom Server kommen?

**Entschieden (31.10.):** Reihenfolge bleibt. Paket A und B laufen parallel in zwei Threads. Begriffe und Wortlisten entwirft Claude, Cornelius prüft. Die Wortlisten kommen wie beim Bibel-Quiz vom Spieleserver. Offen ist noch die erste Frage zu den eigenen Fassungen.
