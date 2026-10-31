# Etappe 7 – Spiele für viele Spieler (W-027) und Werwolf (W-021)

31.10.2026 · Fassung 2, am Code geprüft · Vorschlag, wartet auf Entscheidung von Cornelius

## Kurzfassung

**Ja, das lässt sich umsetzen.** Plätze, gleichzeitige Züge, geheime Sichten und Zeitgeber sind vorhanden. Fassung 1 war aber in drei Punkten zu optimistisch: Freitext und Zeichnungen wären in öffentlichen Räumen ein Chat mit Fremden, Zeichnen im Spielzustand überlastet den Server, und Werwolf mit 30 Kindern dauert viel länger, als eine Schulstunde verträgt.

Deshalb ändert sich die Reihenfolge: Erst kommen Spiele **ohne freie Eingabe**, die mit Inhaltspaketen auskommen, dann Abstimmung und Werwolf, dann Freitext, zuletzt Zeichnen. Malstube und Kategorien-Sprint rücken aus dem Start nach hinten.

| Welle | Spiele | Neu nötig | Risiko |
| --- | --- | --- | --- |
| 1 Sofort für die ganze Klasse | Schätzmeister, Zeitstrahl, Emoji-Rätsel, Mehrheitsfrage (mit Vorgaben) | gemeinsame Tafel, Runden-Zeitgeber | gering |
| 2 Abstimmen und Rollen | Wölfe im Schafspelz (8–18), Der Fremde, Codewörter | Abstimmung, Teamwahl | mittel |
| 3 Freitext, nur in privaten Räumen | Wortbrücke, Kategorien-Sprint, Wahr oder geflunkert | Texteingabe, Pflicht zum privaten Raum | mittel |
| 4 Zeichnen | Stille Post gemalt, dann Malstube | Zeichenfläche, flüchtiger Kanal | hoch |

Jede Welle ist für sich nutzbar. Nach Welle 1 und 2 wird neu entschieden, ob Welle 3 und 4 den Aufwand lohnen.

## Was der Code hergibt

### Passt schon

- **30 Plätze, 40 Mitglieder:** `MAX_SEATS`, `MAX_MEMBERS`. Bibel-Quiz und Bingo laufen damit.
- **Gleichzeitige Züge:** `currentPlayers` nennt alle, die noch handeln müssen; `stillValid` nimmt Züge trotz veralteter Version an.
- **Zeitablauf:** `systemDelayMs` weckt die Spielleitung, und ein gestellter Wecker bleibt stehen, wenn andere ziehen. Er überlebt das Schlafen des Servers.
- **Geheime Sichten:** `playerView` und `eventView` je Platz; der Server schickt nie den ganzen Zustand.
- **Spielleitung ohne Rolle:** Bingo setzt die Lehrkraft auf Platz 1 („zieht nur“). Dasselbe Muster trägt die Werwolf-Spielleitung.

### Muss sich gegenüber Fassung 1 ändern

| Annahme in Fassung 1 | Was der Code zeigt | Änderung |
| --- | --- | --- |
| Freie Texte sind „nur im Raum sichtbar“ | Räume sind standardmäßig öffentlich (`isPublic = true`) und stehen auf der Startseite. Fremde können also mitlesen. | Spiele mit freier Eingabe erzwingen private Räume |
| Der Spitznamen-Filter reicht für Texte | `cleanName` kürzt auf 16 Zeichen und prüft Wortteile. „Marsch“ und „Barsch“ fielen durch („arsch“), Beleidigungen ohne Listenwort kämen durch. Sein Kommentar sagt selbst, dass er nicht alles abfängt. | Eigene Texteingabe in der Engine, dazu Ausblenden durch die Raumleitung |
| Schnellnachrichten „mit Spielerwahl“ | `say` erlaubt nur sieben feste Sätze aus `PHRASES`, ohne Parameter | Verdacht wird ein Spielzug, kein Signal |
| Striche als JSON im Zustand | Jeder Zug speichert den ganzen Raum (`storage.put`) und schickt die ganze Sicht an alle; eine Nachricht vom Browser darf höchstens 16 KB haben. | Striche laufen über einen flüchtigen Kanal, siehe Welle 4 |
| Lehrkraft „sieht alle Rollen“ als Raumleitung | Sichten kennen nur Plätze und einen gemeinsamen `'spectator'`. Hätte der alles, sähen es alle Zuschauer. | Spielleitung als eigener Platz wie bei Bingo |
| Inhalte vom Server schützen die Lösungen | `prepare` lädt den Katalog weiterhin in den Browser (beim Bibel-Quiz so vermerkt) | Nur für kleineres Paket sinnvoll, nicht als Schutz |
| Tafelansicht als fast fertiger Baustein | Die Tafel steckt fest im Bingo-Code (`bg-wall`) | Zuerst nach `packages/ui` herauslösen |
| Bots „nur als Ersatz“ | Der Vertrag verlangt mindestens einen Bot, und die Web-App wertet `modes` nirgends aus. Man könnte also allein gegen fünf Bots Werwolf starten. | Kleine Ergänzung: `GameInfo.minHumans` |

### Belastung des Servers

Ein Zug bei 30 Plätzen bedeutet 1 Speichervorgang und 30 Nachrichten. Geben alle in einer Runde einmal ab, sind das 30 Speichervorgänge und 900 Nachrichten. Das ist machbar, wenn jeder einmal je Runde abgibt, aber nicht bei einem Zug je Tastendruck oder Pinselstrich. Das Gratis-Kontingent der Durable Objects kann ausgehen (Fehler 1101, Reset täglich um 00:00 UTC).

**Regel für alle Spiele hier:** höchstens ein bis zwei Züge je Spieler und Runde. Vor Welle 2 messe ich eine Klassenpartie mit 30 nachgebauten Browsern (Ausbau von `apps/server/scripts/smoke.mjs`).

## Leitplanken

- **Jugendschutz:** Keine Einsätze, keine Wetten, keine Zufallsbelohnungen. Spiele mit freier Eingabe laufen nie in öffentlichen Räumen. Die Raumleitung kann jeden Text und jedes Bild ausblenden und Mitglieder entfernen.
- **Klasse:** Eine Runde dauert 5 bis 15 Minuten. „ganz“ heißt: läuft mit 20 bis 30 Kindern in einem Raum. „Gruppen“ heißt: mehrere Räume mit je wenigen Kindern. Fassung 1 hatte beides als „ja“ geführt.
- **Miteinander:** Nur wenige Spiele scheiden Kinder durch die Stimmen anderer aus (siehe Wölfe im Schafspelz). Wer ausscheidet, bleibt beschäftigt.
- **Gespräch:** Viele Spiele leben vom Reden. Sie funktionieren am Tisch, im Klassenzimmer oder mit Sprachkanal (W-024), aber nicht online ohne Stimme. Die Spalte „Reden“ markiert das; der Steckbrief soll es anzeigen.
- **Eigene Fassung:** Eigene Namen, Texte, Wortlisten und Gestaltung. Vor der Veröffentlichung prüft Cornelius die Namen naher Vorbilder; dieses Papier ist keine Rechtsauskunft.

## Bausteine

| Baustein | wofür | Welle | Aufwand |
| --- | --- | --- | --- |
| Tafel (aus Bingo herausgelöst, zeigt die Zuschauer-Sicht mit QR-Code und Rangliste) | alle ganzen Klassenspiele | 1 | S |
| Runden-Zeitgeber (Frage, Antwortzeit, Auflösung über `systemDelayMs`, früher Schluss, wenn alle abgegeben haben) | 1, 3, 4, 7, 8, 12 | 1 | S |
| Rangliste für 30 (wie bei Bingo: die Besten plus der eigene Platz) | alle ganzen Klassenspiele | 1 | S |
| Abstimmung in der Engine (geheim, Live-Stand wahlweise, Gleichstand-Regel) | 6, 12, 13, 14, 15, 23, 28 | 2 | M |
| Teamwahl in der Lobby (zwei Teams, zufällig wie „Alle verteilen“) | 11, 23, 27, 28, 32 | 2 | S |
| Texteingabe (Prüfung im Regelwerk auf dem Server, Vergleich trotz Tippfehlern, Ausblenden) | 2, 3, 6, 9, 10 | 3 | M |
| Pflicht zum privaten Raum (`GameInfo.privateRoomOnly`: Spiel erscheint nicht in `publicListing`, Schalter gesperrt) | Welle 3 und 4 | 3 | S |
| Zeichenfläche und flüchtiger Kanal | 9, 10 | 4 | L |

Der Filter muss aus `packages/online` in die Engine wandern, denn Spiele hängen nur von der Engine ab und die Prüfung gehört ins Regelwerk. Mehr als 30 Plätze braucht keine Idee.

## Welle 1: Ohne freie Eingabe

Diese Spiele belegen die Klassentauglichkeit mit wenig Risiko. Alle nutzen Inhaltspakete unter `content/` und antworten mit genau einem Zug je Frage.

- **Schätzmeister:** Zahl eingeben, Zahlenleiste zeigt alle Tipps. Freie Zahlen prüft `isLegal`.
- **Zeitstrahl:** Reihenfolge wird als ein Zug abgegeben, nicht je Verschieben.
- **Emoji-Rätsel:** nur Auswahlantworten. Freie Eingabe käme erst mit Welle 3.
- **Mehrheitsfrage:** vier bis sechs Vorgaben statt Freitext. So entfällt das schwierige Zusammenfassen ähnlicher Antworten.

Bots wählen aus dem Katalog, damit Vertragsprüfungen und Ersatz für Abwesende funktionieren. Die Inhalte schreibe ich als Entwurf, Cornelius prüft sie (besonders die Bibel-Pakete).

## Welle 2: Wölfe im Schafspelz (W-021)

Der vollständige Spielplan steht in [`woelfe-im-schafspelz.md`](woelfe-im-schafspelz.md): Regeln und Rollen wie im Original, christliches Thema, 8–18 Plätze. Er ersetzt die früheren Abwandlungen (6–16 Plätze, kein Amor, Diebe im Dorf, Wiederfinden).

## Welle 3: Freitext

Nur in privaten Räumen. Texte gehen als ein Zug je Runde an den Server, nicht je Tastendruck.

- **Wortbrücke:** Doppelte Hinweise fallen weg (Vergleich mit dem Baustein). 3–12 Plätze, die Klasse spielt in Gruppen.
- **Kategorien-Sprint:** Ein Abstimmen über jede Antwort ist bei 30 Kindern mit fünf Kategorien (150 Antworten) unmöglich. Stattdessen werden Antworten automatisch gewertet, wo es geht (Wortliste aus Wortgitter, eigene Listen für Städte, Länder, Tiere); nur angefochtene Einträge gehen an die Raumleitung.
- **Wahr oder geflunkert:** Abstimmung über die Erklärungen, Ausblenden durch die Raumleitung vor dem Aufdecken.

## Welle 4: Zeichnen

**Stille Post gemalt zuerst:** Ein Bild ist ein Zug am Ende der Zeichenzeit, also ohne neuen Kanal. Die Datenmenge begrenzt die Plätze: 20 Ketten mit je 20 Schritten wären rund 200 Bilder und über 3 MB im Zustand. Deshalb 4–10 Plätze, Bilder höchstens 8 KB und in der Vorführung nur die gerade gezeigte Kette in der Sicht.

**Malstube danach:** Live-Striche brauchen einen flüchtigen Kanal neben den Zügen (wie `signal`, ungespeichert), mit gebündelten Strichen etwa jede Sekunde. Das fertige Bild kommt als ein Zug in den Zustand, sonst fehlt es Wiederkommenden.

Ein Filter sieht keine Bilder. Schutz bieten nur private Räume und das Ausblenden durch die Raumleitung.

## Alle 34 Ideen

Die Nummern bleiben wie in Fassung 1. Aufwand: S etwa 1 Tag, M 2 bis 4 Tage, L eine Woche oder mehr, jeweils ohne Inhalte. „Reden“: ohne Gespräch nicht spielbar. Welle „–“ heißt: vorerst zurückgestellt.

### Wissen und Raten

| Nr. | Idee | Art | Spieler | Kurzbeschreibung | Aufwand | Klasse | Reden | Welle |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Schätzmeister | Schätzquiz | 2–30 | Alle schätzen gleichzeitig eine Zahl, wer am nächsten liegt, punktet. Pakete Allgemein, Bibel, Mathe. | S | ganz | | 1 |
| 2 | Wortbrücke | Hinweisspiel | 3–12 | Einer rät, alle anderen schreiben je ein Hinweiswort, doppelte fallen weg. | M | Gruppen | | 3 |
| 3 | Kategorien-Sprint | Stadt-Land-Fluss-Art | 2–30 | Ein Buchstabe, fünf Kategorien, automatische Wertung mit Einspruch. | L | ganz | | 3 |
| 4 | Mehrheitsfrage | Umfrage-Raten | 3–30 | Punkte für Antworten, die viele andere auch wählen. Mit festen Vorgaben. | S | ganz | | 1 |
| 5 | Wer bin ich? | Ja-Nein-Fragen | 3–10 | Jeder hat einen Begriff, den alle außer ihm sehen. Fragen laut, Antwort über Knöpfe. | M | Gruppen | ja | – |
| 6 | Wahr oder geflunkert | Bluff-Erklärungen | 3–12 | Falsche Erklärungen erfinden, die echte finden. | M | Gruppen | | 3 |
| 7 | Zeitstrahl | Einsortieren | 2–30 | Ereignisse oder biblische Geschichten ordnen, alle gleichzeitig. | S | ganz | | 1 |
| 8 | Emoji-Rätsel | Bilderrätsel | 1–30 | Begriffe aus Emojis erraten, schnelle Antworten zählen mehr. Auswahlantworten. | S | ganz | | 1 |

### Zeichnen und Darstellen

| Nr. | Idee | Art | Spieler | Kurzbeschreibung | Aufwand | Klasse | Reden | Welle |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 9 | Malstube | Zeichnen und Raten | 3–20 | Einer zeichnet, alle raten per Eingabe. | L | ganz | | 4 |
| 10 | Stille Post gemalt | Satz-Bild-Kette | 4–10 | Abwechselnd schreiben und malen, am Ende alle Ketten vorführen. | L | Gruppen | | 4 |
| 11 | Pantomime-Uhr | Vorspielen im Raum | 4–30 | Handy zeigt dem Darsteller den Begriff, misst Zeit und Teampunkte. | S | ganz | ja | – |
| 32 | Sag's anders | Umschreiben mit Verboten | 4–30 | Begriff erklären, ohne fünf verbotene Wörter. Teams. | S | ganz | ja | – |

### Verborgene Rollen und Bluff

| Nr. | Idee | Art | Spieler | Kurzbeschreibung | Aufwand | Klasse | Reden | Welle |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 12 | Wölfe im Schafspelz | Rollen mit Abstimmung | 8–18 | Eigener Spielplan, siehe Welle 2. | L | Gruppen | ja | 2 |
| 13 | Der Fremde | Wer kennt das Wort nicht? | 4–12 | Alle sehen ein Wort, einer nicht. Reihum ein passendes Wort sagen, dann abstimmen. | M | Gruppen | ja | 2 |
| 14 | Spion im Schloss | Fragerunde mit Ort | 3–10 | Alle kennen den Ort, der Spion nicht. | M | Gruppen | ja | – |
| 15 | Tafelrunde | Aufträge mit Verrätern | 5–10 | Gruppen für fünf Aufträge wählen, Verräter lassen sie scheitern. | L | Gruppen | ja | – |
| 16 | Zöllner am Stadttor | Waren melden und bluffen | 3–6 | Verdeckte Waren anmelden, Zöllner prüft. Ehrenpunkte, keine Münzen. | L | nein | | – |
| 17 | Kröten-Bluff | Behaupten und weitergeben | 3–6 | Tierkarte verdeckt weitergeben mit Ansage. Wer vier gleiche sammelt, verliert. | M | Gruppen | | – |

### Karten, Würfel und Brett

| Nr. | Idee | Art | Spieler | Kurzbeschreibung | Aufwand | Klasse | Reden | Welle |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 18 | Reihenbauer | gleichzeitiges Kartenlegen | 2–10 | Geheim eine Zahlenkarte wählen, aufsteigend an vier Reihen legen. | M | Gruppen | | – |
| 19 | Stille Zahlenreihe | kooperativ in Echtzeit | 2–8 | Zahlen ohne Absprache aufsteigend ablegen. Gemeinsame Leben. | M | Gruppen | | – |
| 20 | Würfelblock für alle | gleicher Wurf | 1–30 | Die Tafel würfelt für alle, jeder trägt ein. Der Würfelblock trägt heute 6 Plätze, Tabelle muss neu. | M | ganz | | – |
| 21 | Mogel-Stapel | ansagen und anzweifeln | 3–10 | Karten verdeckt mit Ansage ablegen, „Geflunkert!“ rufen. | M | Gruppen | | – |
| 22 | Gänsespiel | Würfelrennen | 2–8 | Altes Laufspiel mit Sonderfeldern. | S | Gruppen | | – |
| 23 | Flottenduell | Schiffe versenken in Teams | 4–30 | Zwei Teams, Mehrheit bestimmt den Schuss. Mathe-Koordinaten vorhanden. | M | ganz | | – |
| 30 | Sternhalma | Laufspiel auf Sternbrett | 2–6 | Figuren springend ins Gegenüber bringen. | M | Gruppen | | – |
| 31 | Landschaftsleger | Plättchen legen | 2–5 | Wege, Wiesen und Dörfer schließen und werten. | L | nein | | – |
| 33 | Durak | Angriff und Abwehr | 2–6 | Russischer Klassiker mit Angreifer und Verteidiger. | M | Gruppen | | – |
| 34 | Elfer raus | Reihen von 11 aus legen | 2–6 | Einfaches Familienspiel. | S | Gruppen | | – |

### Echtzeit und Party

| Nr. | Idee | Art | Spieler | Kurzbeschreibung | Aufwand | Klasse | Reden | Welle |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 24 | Minispiel-Marathon | Reaktionsaufgaben | 1–30 | Fünf-Sekunden-Aufgaben in Folge. Live-Liste nur alle paar Sekunden. | L | ganz | | – |
| 25 | Stuhltanz | Reise nach Jerusalem | 3–30 | Bei Stille tippen. Das Netz entscheidet mit, darum Zeitmessung im Gerät und Toleranzfenster. | M | ganz | | – |
| 26 | Schnick-Schnack-Turnier | Schere, Stein, Papier | 2–30 | Turnierbaum, Verlierer werden Anhänger des Siegers. | M | ganz | | – |
| 27 | Klassen-Tauziehen | Rechenduell in Teams | 2–30 | Richtige Aufgaben ziehen das Seil. Aufgabenstrom der Enten-Rallye. | M | ganz | | – |

### Kooperativ und Teams

| Nr. | Idee | Art | Spieler | Kurzbeschreibung | Aufwand | Klasse | Reden | Welle |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 28 | Codewörter | Team-Hinweisspiel | 4–30 | 25 Wörter im Gitter; der Hinweis wird laut gesagt, das Team stimmt ab. | M | ganz | ja | 2 |
| 29 | Turmrätsel | Escape-Rätsel | 2–8 | Jeder sieht andere Hinweise und beschreibt sie der Gruppe. | L | Gruppen | ja | – |

Zählung: 28 der 34 Ideen tragen 8 oder mehr Spieler, 15 tragen 20 bis 30. Fassung 1 zählte 28 und 17; Werwolf und Stille Post sind bewusst kleiner geworden.

## Offene Entscheidungen

- [ ] Passt die Reihenfolge der Wellen, besonders Malstube und Kategorien-Sprint erst später?
- [x] Wölfe im Schafspelz: ab 10 Jahren (Cornelius, 31.10.2026).
- [ ] Freitext und Zeichnen nur in privaten Räumen: einverstanden?
- [ ] Welche Ideen streichst du ganz?
