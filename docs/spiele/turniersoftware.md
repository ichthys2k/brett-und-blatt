# Turniersoftware (W-058) – Recherche und Gesamtkonzept

Stand: Konzept vom 7.11.2026, noch nichts gebaut. Aufgabenstatus: [GitHub Issue #63](https://github.com/ichthys2k/brett-und-blatt/issues/63). Grundlage ist das vorhandene Turniersystem ([`turnier.md`](turnier.md), Issue #62).

## Auftrag

> Ich möchte das angefangene Turniersystem zu einer vollwertigen Turniersoftware ausbauen, die bei allen Spielen benutzt werden kann, die in Brett und Blatt gegeneinander gespielt werden können. Darüber hinaus soll sie auch unabhängig für Offline-Spiele benutzt werden können, die nichts mit den eigentlichen Brett-und-Blatt-Spielen zu tun haben (z. B. Tischkicker-, Fußball-, Volleyball-Turnier u. a.). […] Ziel ist tatsächlich, dass spiele.lipponer.de als vollwertige Turniersoftware verwendet und administriert werden kann.

## Kurzfassung

- Das heutige Turniersystem ist ein guter Kern: vier Formen (WM-Form, Schweizer System, K.-o., Doppel-K.-o.) als reine Logik, Live-Seite per WebSocket, Spielerausweis statt Konto. Es kennt aber nur **eine Art von Turnier**: zwei Menschen, ein Brett-&-Blatt-Spiel, Partien über Tage mit Stichtagen, Ergebnis kommt vom Spielraum.
- Für Vor-Ort-Turniere (Kicker, Fußball, Volleyball, Tischtennis, Spieleabend) fehlen vor allem: **Teilnehmer ohne Ausweis** (Namensliste, Teams), **Ergebnisse von Hand** mit Spielstand (Tore, Sätze), **Felder/Tische und Zeitplan**, **Helfer** zum Eintragen, **Beamer-Ansicht** und **öffentlicher Zuschaulink**, **Druck**.
- Vorschlag: Den Kern in **Format** (wer spielt gegen wen, wer kommt weiter) und **Austragung** (online im Spielraum oder vor Ort von Hand) trennen. Dann gelten alle Formen für beide Arten, und neue Formen (Liga, Gruppen mit Platzierungsspielen, Zufallspartner, Last One Standing, Tischrunden für Skat/Uno) kommen einmal für alle dazu.
- Reihenfolge: **Stufe 0** Umbau ohne neue Funktion → **Stufe 1** Vor-Ort-Turnier mit Grundfunktionen → **Stufe 2** Helfer, Zeitplan, Druck → **Stufe 3** Brett & Blatt für mehr Spiele (Tischrunden, Teams, Turnierabend) → **Stufe 4** weitere Formen → **Stufe 5** Verwaltung, Anmeldung, Serien und Ranglisten → **Stufe 6** offline ohne Netz.
- Vor dem Bau braucht es Entscheidungen von Cornelius (unten unter „Zu entscheiden“), vor allem zum öffentlichen Zuschaulink, zu Klarnamen und zur Aufbewahrungsdauer.

## Recherche

Gelesen wurden die öffentlichen Seiten der Anbieter (Startseiten, Funktionslisten, Preise, Änderungsprotokolle) am 7.11.2026. Handbuch-Unterseiten wurden nicht alle geöffnet; was dort steht, ist hier nicht geprüft.

### Kickertool (kickertool.de)

Für Tischkicker gebaut, laut eigener Seite auch für Darts, Badminton, Tischtennis, Fußball, Brettspiele, E-Sport und Bierpong genutzt; „kleine bis mittelgroße Turniere“. Kostenlos.

- **Acht Turniermodi:** Schweizer System, Jeder gegen Jeden in Gruppen (mit Rückrunde und anschließendem K.-o. nach Gruppenplatz), Runden-System (Jeder gegen Jeden mit fester Rundenzahl), „Jeder mit Jedem gegen Jeden“ (jeder spielt einmal mit jedem zusammen, braucht 4n oder 4n+1 Spieler), K.-o. (bis 64 Teams, Spiel um Platz 3), Doppel-K.-o., Last One Standing (feste Zahl an Leben, jede Niederlage kostet eins), Monster-DYP.
- **DYP** heißt „Draw Your Partner“: Die Software lost die Doppelpartner zu. Beim **Monster-DYP** bekommt jeder Einzelspieler in jeder Runde einen neuen Partner und neue Gegner; Punkte sammelt der Einzelne. Spät kommen und früh gehen geht („Punktedurchschnitt (fair)“ mit Abzug für Frühgeher). Danach optional ein K.-o. („Lord Have Mercy KO“ mischt die Teams jede Runde neu).
- **Spieler und Teams:** Einzel oder Doppel, Import „Name 1 / Name 2“, Nachmelden im Schweizer System in Runde 1, Abwesend-Markieren, Umbenennen, mehrere Disziplinen in einem Turnier, Anbindung an Spielerdatenbanken von Verbänden (DTFB, STF, ATSA).
- **Tische:** hinzufügen und entfernen, automatische Zuteilung, von Hand umsetzen, auch nach dem Aufruf.
- **Anzeige:** „Externe Ansicht“ für einen zweiten Bildschirm (laufende Partien nach Tisch, Tabelle); öffentliche Live-Seite unter live.kickertool.de fürs Handy oder für Streams.
- **Ergebnisse:** Turnierleitung trägt ein, Schnelleingabe, druckbare Spielzettel für bis zu 5 Sätze, Remis und Punkte für Sieg/Remis einstellbar. Ein Rollen- oder Helfersystem wird nicht beschrieben.
- **Wertung:** Punkte, Buchholz, „Punkte für knappes Spiel“ (einstellbare Tordifferenz). Keine Elo, keine Ligen.
- **Offline:** Desktop-Apps für Windows und Mac, Offline-Modus im Browser, Abgleich mit einer Cloud über ein Konto (Konflikte werden gemeldet).
- **Export:** eigene Datei, JSON, Sport-XML, Druck/PDF von Partien, Tabellen und K.-o.-Bäumen.

### meinturnierplan.de

Deutscher Planer für Mannschaftssport (Fußball, Handball, E-Sport, laut Startseite auch Darts, Tischkicker, Padel, Völkerball, Bierpong), „über 100 Spielmodi“. Konto nötig, Gastzugang zum Ausprobieren.

- **Formen:** bis 96 Teilnehmer in höchstens 16 Gruppen; Gruppenphase mit verschiedenen Endrunden; Liga mit automatischen Spieltagen; **Turniere verbinden** (Vorrunde → Zwischenrunde → Hauptrunde) mit Übernahme nach Gruppenplatz („2. Gruppe B“), nach Gesamtplatz („bester Dritter“) oder aus einer gruppenübergreifenden Rangliste; Gruppen mit Rundenbegrenzung; Spiele außer Konkurrenz; Turniere ganz ohne Rangliste (Bambini); Turnierschlüssel, u. a. DFB-Schlüssel.
- **Spielplan:** berechnet Spielzeiten und Spielfelder, Datum und Uhrzeit je Spiel, Reihenfolge und Teams umstellbar, Schiedsrichterplan.
- **Ergebnisse:** **Helferlinks** – Helfer tragen ohne Anmeldung Ergebnisse ein; mehrere Geräte gleichzeitig nur im Bezahltarif.
- **Anzeige:** Präsentationsseite mit „Stadionansicht“ und Vollbild für Monitor und Beamer; Einbetten per WordPress-Plugin oder iframe; Laufschrift; QR-Code je Turnier.
- **Druck:** PDF von Spielplan und Schiedsrichterkarten (gratis mit Wasserzeichen).
- **Wertung:** Platzierungsregeln je Gruppe einstellbar (direkter Vergleich, Punkte, Negativpunkte), Plätze von Hand änderbar. Torlose Turniere möglich.
- **Preise:** gratis bis 5 Turniere mit Werbung; Premium S ab 4,90 € im Monat (jährlich), Premium M ab 8,90 €.

### Challonge, Tournify, start.gg, Toornament

- **Challonge:** K.-o., Doppel-K.-o., Jeder gegen jeden, Schweizer System, zweistufig (Gruppen + Endrunde); Teilnehmer einzeln oder als Liste, Einladung per Mail, eigene Anmeldeseite, **Check-in**; Ergebnis-Eintragen an andere delegieren, Mail, wenn eine Partie spielbar wird; gestaltbare Bäume zum Einbetten.
- **Tournify** (Fußball, Volleyball u. a.): beliebige Kombinationen aus Gruppen, K.-o. und Freundschaftsspielen mit Neusetzen nach der Gruppenphase; Online-Anmeldeformular mit Bezahlung; **Spielplan per Ziehen und Ablegen** oder automatisch; Schiedsrichter aus einer Liste oder **Teams pfeifen gegenseitig**; Live-Ergebnisse, egal wer sie einträgt; Live-Seite, App und **Diaschau** für Bildschirme in der Halle; Mitorganisatoren.
- **start.gg** und **Toornament** zielen auf E-Sport (Anmeldung, Check-in, Ranglisten, Ligen, Schnittstelle für Entwickler). Die öffentlichen Seiten gaben kaum Einzelheiten her; für unser Ziel bringen sie nichts Neues über Challonge hinaus.

### Was daraus folgt

| Funktion | Kickertool | meinturnierplan | Challonge/Tournify | Brett & Blatt heute |
|---|---|---|---|---|
| K.-o., Doppel-K.-o., Schweizer System | ✓ | K.-o. ✓ | ✓ | ✓ |
| Gruppen + K.-o. | ✓ | ✓ (sehr flexibel) | ✓ | nur WM-Form, feste Gruppengröße |
| Liga / Jeder gegen jeden ohne K.-o. | ✓ | ✓ | ✓ | – |
| Zufallspartner (DYP), Leben (Last One Standing) | ✓ | – | – | – |
| Teams und Doppel | ✓ | ✓ | ✓ | – |
| Teilnehmer per Namensliste | ✓ | ✓ | ✓ | – (jeder braucht Ausweis) |
| Ergebnis mit Spielstand (Tore, Sätze) | ✓ | ✓ | ✓ | – (nur Sieger/Remis) |
| Felder/Tische, Zeitplan | Tische | ✓ mit Zeiten | Tournify ✓ | – |
| Helfer tragen ein | – | ✓ Helferlink | ✓ | – |
| Beamer-Ansicht | ✓ | ✓ | Tournify ✓ | große Ansicht für die Leitung |
| Öffentlicher Zuschaulink | ✓ | ✓ | ✓ | – (bewusst, 2.11.2026) |
| Druck/PDF | ✓ | ✓ | – | – |
| Offline ohne Netz | ✓ | – | – | – |
| Partien online spielen | – | – | (E-Sport extern) | ✓ **Alleinstellung** |
| Kein Konto nötig | (Konto für Cloud) | Konto | Konto | ✓ **Alleinstellung** |

Brett & Blatt hat zwei Dinge, die keiner der anderen hat: Die Partie wird **in der Software selbst gespielt** und meldet ihr Ergebnis selbst, und es braucht **kein Konto**. Beides soll bleiben. Für Vor-Ort-Turniere sind meinturnierplan (Mannschaftssport mit Zeitplan) und Kickertool (Kneipen- und Vereinsturnier mit Tischen) die Maßstäbe.

## Gesamtkonzept

### Zwei Arten, ein Kern

| | **Online-Turnier** (heute) | **Vor-Ort-Turnier** (neu) |
|---|---|---|
| Spiel | ein Brett-&-Blatt-Spiel | frei: „Tischkicker“, „Volleyball“ … oder ein Brett-&-Blatt-Spiel am Tisch |
| Teilnehmer | Menschen mit Spielerausweis | Namensliste, Einzel oder Teams; Ausweis freiwillig |
| Partie | im Spielraum, meldet sich selbst | wird gespielt, Ergebnis kommt von Hand |
| Takt | Stichtage über Tage | Runden in Minuten, Zeitplan, Aufruf an Tisch/Feld |
| Wer trägt ein | der Raum; Leitung bei Streit | Leitung, Helfer, optional die Spieler selbst |

Der Kern (`packages/online/src/tournament.ts`) wird zerlegt:

- **Format** (`tournament/formats/*.ts`): reine Funktionen „Teilnehmer + bisherige Ergebnisse → nächste Partien, Tabelle, Weiterkommende“. Jede Form ist ein eigener Baustein mit derselben Schnittstelle, ohne Wissen, ob online oder vor Ort gespielt wird. Phasen lassen sich hintereinander hängen (Vorrunde → Endrunde), wie bei meinturnierplan „Turniere verbinden“.
- **Wertung** (`tournament/scoring.ts`): Punkte für Sieg/Remis/Niederlage, Ergebnisart (nur Sieger, Tore, Sätze, Punkte), einstellbare Reihenfolge der Gleichstandsregeln (Punkte, direkter Vergleich, Tordifferenz, erzielte Tore, Siege, Buchholz, Los).
- **Austragung** (`tournament/play-online.ts`, `play-local.ts`): online wie heute (Bereit, Raum anlegen, `matchReport`, Stichtage, kampflos); vor Ort mit Feldern, Zeitplan, Aufruf und Eintragen von Hand.
- **Turnier** (Klasse `Tournament`): hält Zustand, Rollen, Fristen und Sichten und setzt die Teile zusammen. Der Durable Object `TournamentRoom` bleibt der dünne Adapter.

Der Zustand bleibt reines JSON mit Seed für alle Auslosungen. `TournamentSnapshot.version` geht auf 2; vorhandene Turniere werden beim Laden umgeschrieben (Migration im Kern, mit Test).

### Datenmodell (Erweiterung)

- **Teilnehmer** (`entrant`): `id`, `name`, `avatar`, optional `members` (Team aus Spielern), optional `token` (wenn mit Ausweis), `seed` (Setzplatz), `withdrawn`, `present` (Check-in).
- **Partie:** wie heute, dazu `field` (Tisch/Feld), `scheduledAt`, `calledAt`, `score` (z. B. `[[11,7],[9,11],[11,5]]` für Sätze oder `[3,1]` für Tore), `enteredBy` (Rolle und Name), `confirmedBy`, `referee` (Teilnehmer, der pfeift). Mehr als zwei Seiten (`slots` als Liste) für Tischrunden.
- **Sportart/Spiel:** `game: { kind: 'online', gameId, options }` oder `{ kind: 'local', name, result: 'winner' | 'goals' | 'sets' | 'points', draws: boolean, sets?: { best: 3, to: 11 } }`. Vorlagen für häufige Sportarten (Tischkicker, Fußball, Volleyball, Tischtennis, Darts, Brettspiel am Tisch) füllen die Werte vor.
- **Rollen:** `leaders` (Leitung und Mitleitung), `helpers` (Helfercodes mit Namen, widerrufbar), Teilnehmer, Zuschauer.

### Rollen und Zugang ohne Konto

- **Leitung:** wie heute über die Kennung des Anlegenden, dazu ein **Leitungslink** zum Übertragen auf ein zweites Gerät (wie `reissue`/`claim`) und **Mitleitung**. Der Leitungszugang liegt im Spielerausweis, also auch per Sicherungscode und Passkey wiederzufinden.
- **Helfer:** Einmal-Link oder QR-Code `#/turnier/<Code>?helfer=…` je Helfer, mit Namen. Darf Ergebnisse eintragen und Partien aufrufen, sonst nichts. Wie meinturnierplans Helferlink, aber auf beliebig vielen Geräten.
- **Teilnehmer:** sehen ihren Stand zuerst (wie heute). Vor Ort optional **Selbsteintragen**: Eine Seite trägt ein, die andere bestätigt; bei Widerspruch entscheidet die Leitung.
- **Zuschauer:** Lesezugriff über einen Zuschaulink. Heute ausdrücklich ausgeschlossen (Entscheidung 2.11.2026) – für Vor-Ort-Turniere aber der Normalfall (Eltern, Halle, Beamer). → zu entscheiden.

### Anzeigen

- **Turnierseite** wie heute (eigener Stand, Gruppentabellen, Baum, Handy-Ansicht je Runde), erweitert um Spielstände, Felder und Uhrzeiten.
- **Beamer-Ansicht** (`#/turnier/<Code>/tafel`): Vollbild, ohne Bedienelemente, große Schrift, wechselt selbst zwischen „Jetzt an den Tischen“, „Als Nächstes“, Tabellen und Baum (wie Tournifys Diaschau und Kickertools externe Ansicht). Nutzt die vorhandene Hibernation-Verbindung.
- **Leitstand** für Leitung und Helfer: Liste „läuft / als Nächstes / zu bestätigen“, Ergebnis mit wenigen Tipps eintragen, Partie aufrufen und Feld zuweisen, Spieler als abwesend markieren.
- **Druck** über eigene Druckansichten (`@media print`, Browser „Als PDF speichern“, kein PDF-Paket nötig): Spielplan, Spielzettel je Partie (Felder für Sätze), Tabellen, Baum, Urkunden für die Plätze 1–3.
- **Export:** JSON (vollständig, zum Wiedereinlesen) und CSV (Ergebnisse, Tabelle).

### Formen (Ausbau)

Vorhanden und bleibend: WM-Form, Schweizer System, K.-o., Doppel-K.-o. Neu:

1. **Jeder gegen jeden / Liga** ohne K.-o., optional mit Rückrunde; als Liga über Wochen mit Spieltagen.
2. **Gruppen + Endrunde frei:** Gruppenzahl und -größe wählbar, Weiterkommende je Gruppe, beste Dritte, Endrunde als K.-o. oder neue Gruppen, Spiel um Platz 3 und **Platzierungsspiele** für alle Plätze (5–8, 9–12 …).
3. **Setzliste:** Teilnehmer mit Setzplatz, K.-o.-Bäume nach Setzplatz statt Los, Freilose an die Besten.
4. **Zufallspartner (DYP, Monster-DYP):** Einzelspieler, je Runde neu geloste Doppel, Punkte für den Einzelnen, Nachkommen und Gehen jederzeit, faire Durchschnittswertung.
5. **Last One Standing:** jeder mit n Leben, Paarung wie im Schweizer System, Niederlage kostet ein Leben.
6. **Tischrunden für Spiele mit 3+ Plätzen** (Skat, Doppelkopf, Schafkopf, Uno, Würfelblock …): Runden mit Tischen zu 3–4 (bzw. bis zur Platzzahl), Punkte über alle Runden, Neusetzen nach Rangliste (wie bei Skatturnieren üblich: Serien an wechselnden Tischen). Online legt der Kern je Tisch einen Raum an; `setupMatch` bekommt dafür mehr als zwei Plätze, `matchReport` die Platzierung bzw. `seatScore`.
7. **Teams** in Online-Turnieren für Spiele mit `GameInfo.teams` (z. B. Kreuzbinokel 2 gegen 2): ein Teilnehmer = ein Team mit festen Plätzen.

### Brett-&-Blatt-Spiele: was sich ändert

- **Alle Spiele, die gegeneinander gehen:** `isTournamentGame` erlaubt heute nur Spiele mit zwei Plätzen. Mit Tischrunden (Form 6) kommen alle Mehrspieler-Spiele mit festen Plätzen dazu; Spiele mit `joinMidGame` (Poker) und Rollenspiele mit `minHumans` (Wölfe) bleiben draußen. Gleichzeitige Rennspiele (Kartenblitz, Enten-Rallye, Klassenspiele) passen als Tischrunde mit Platzierung.
- **Turnierabend:** Stichtage in Minuten statt Tagen („heute Abend, alle zugleich“). Rundenweise Auslosung, alle Partien einer Runde starten zusammen, Beamer zeigt die Runde. Das ist für Klassen und Spieleabende der häufigere Fall als das Wochenturnier.
- **Brett & Blatt am Tisch:** Ein Vor-Ort-Turnier kann ein Brett-&-Blatt-Spiel als Sportart wählen, das dann am echten Tisch oder im Hot-Seat gespielt und von Hand eingetragen wird.

### Technik und Grenzen

- **Speicher:** Ein Turnier ist ein Durable Object mit einem Schnappschuss. Bei 100 Teilnehmern und Spielständen dürfte er unter dem Größenlimit eines gespeicherten Werts bleiben (128 KiB beim klassischen Speicher, nicht gemessen); sonst Partien in eigene Schlüssel teilen. Obergrenze vorerst 128 Teilnehmer.
- **Kontingent:** Beamer und Zuschauer hängen schlafend am WebSocket (Hibernation) und kosten nur bei Änderungen. Vor großen Turnieren eine Testpartie messen (steht schon in `turnier.md` als offen).
- **Netz in der Halle:** Stufe 1–5 brauchen Netz am Gerät der Leitung bzw. der Helfer. Eintragen ohne Netz wird bis zur Verbindung im Browser gepuffert und dann nachgereicht (Versionsprüfung wie bei Spielzügen). Echte Offline-Leitung ist Stufe 6.
- **Freitext:** Turnier-, Team- und Spielernamen laufen durch den vorhandenen Namensfilter; kein Chat.
- **Datenschutz:** Vor-Ort-Turniere enthalten Namen von Menschen ohne eigenes Gerät, oft Kinder. Nur Spitznamen oder Vornamen empfehlen, keine Pflichtangaben außer Name, Löschung nach Frist, Abschnitt in der Datenschutzerklärung. Mit öffentlichem Zuschaulink sind die Namen für jeden mit Link sichtbar.

## Stufen

Jede Stufe ist für sich nutzbar und geht als eigenes Issue mit `status: Idee` an Cornelius.

### Stufe 0 – Umbau (M)
Kern in Format, Wertung und Austragung trennen, Schnappschuss Version 2 mit Migration, alle heutigen Tests und `apps/server/scripts/turnier.mjs` bleiben grün. Keine sichtbare Änderung. Ergebnis mit optionalem Spielstand.

### Stufe 1 – Vor-Ort-Turnier, Grundfunktionen (L)
- „Turnier für draußen“ beim Anlegen: Sportart frei oder aus Vorlage, Ergebnisart, Remis ja/nein, Punkte.
- Teilnehmer als Namensliste eintippen oder einfügen, Einzel oder Teams, Nachmelden bis zum Start, Abmelden während.
- Formen: K.-o., Doppel-K.-o., Jeder gegen jeden, Gruppen + K.-o. (frei), Schweizer System.
- Tische/Felder anlegen, nächste Partien automatisch aufs nächste freie Feld.
- Leitstand: Ergebnis eintragen und korrigieren (Folgepartien rechnen neu, solange sie nicht begonnen sind).
- Beamer-Ansicht und Zuschaulink (wenn so entschieden).
- Fertig, wenn: ein Kickerturnier mit 12 Doppeln im Schweizer System und ein Volleyballturnier mit 8 Teams in 2 Gruppen + Halbfinale komplett am Handy geleitet werden können, ohne dass ein Teilnehmer ein Gerät braucht.

### Stufe 2 – Helfer, Zeitplan, Druck (M)
- Helferlinks mit Namen, Mitleitung, Leitungslink.
- Zeitplan: Beginn, Spieldauer, Pause, Felder → Uhrzeiten je Partie; Verschieben per Ziehen; Verzug wird sichtbar.
- Schiedsrichter: aus Liste oder „Teams pfeifen gegenseitig“ (spielfreies Team).
- Selbsteintragen mit Bestätigung der Gegenseite.
- Druckansichten (Spielplan, Spielzettel, Tabellen, Baum, Urkunden), Export JSON und CSV.

### Stufe 3 – Brett & Blatt für mehr Spiele (L)
- Tischrunden für Spiele mit 3+ Plätzen (online: Raum je Tisch, Platzierung zurückmelden).
- Teams in Online-Turnieren (`GameInfo.teams`).
- Turnierabend: kurze Fristen, rundenweise Auslosung, gemeinsamer Rundenstart.
- Brett-&-Blatt-Spiel als Sportart eines Vor-Ort-Turniers.

### Stufe 4 – Weitere Formen (M)
Zufallspartner (DYP, Monster-DYP), Last One Standing, Liga mit Rückrunde und Spieltagen, Platzierungsspiele für alle Plätze, beste Dritte, Setzliste, beliebig viele Phasen hintereinander.

### Stufe 5 – Verwaltung und Dauer (M)
- „Meine Turniere“ als Verwaltung: kopieren, als Vorlage speichern, archivieren, löschen.
- Anmeldung über Link mit Freigabe durch die Leitung, Check-in vor Ort per QR-Code.
- Serien: mehrere Turniere mit gemeinsamer Rangliste (z. B. Kicker-Monatsturnier, Schuljahr); optional Elo über die Serie.
- Einbetten per iframe (eigene schlichte Ansicht), Web Push für „Du bist dran“ (eigene Entscheidung, siehe `turnier.md`).
- Längere Aufbewahrung für Ligen und Serien.

### Stufe 6 – Ohne Netz (L)
Leitung läuft vollständig im Browser (der Kern ist schon ohne Server lauffähig), Zustand lokal gespeichert, Abgleich mit dem Server, sobald Netz da ist; Helfer im selben Raum ohne Internet bleiben außen vor (bräuchte lokales Netz, nicht vorgesehen).

## Zu entscheiden (Cornelius)

1. **Ob und wie weiter:** Stufe 0 und 1 als nächste Aufträge freigeben, oder zuerst Stufe 3 (mehr Brett-&-Blatt-Spiele im Turnier)?
2. **Zuschaulink:** Für Vor-Ort-Turniere ein öffentlicher Lese-Link (Namen und Ergebnisse für jeden mit Link sichtbar)? Vorschlag: ja, von der Leitung je Turnier einschaltbar; für Online-Turniere bleibt es bei der Entscheidung vom 2.11.2026.
3. **Namen:** Klarnamen zulassen oder nur Spitznamen/Vornamen empfehlen? Vorschlag: Hinweis beim Eintippen, keine technische Sperre.
4. **Aufbewahrung:** 30 Tage nach Ende reichen für Einzelturniere; Ligen und Serien bräuchten länger (z. B. 1 Jahr nach letzter Aktivität).
5. **Größe:** Obergrenze 128 Teilnehmer statt heute 32?
6. **Druck:** Druckansichten im Browser genügen (kein PDF-Paket)?

## Offene Punkte

- Handbuch-Unterseiten von meinturnierplan (Turniermodi, Schiedsrichter, Platzierungsregeln) und Hilfeseiten von start.gg/Toornament wurden nicht im Einzelnen gelesen; vor Stufe 2 und 4 lohnt ein genauerer Blick auf meinturnierplans Platzierungsregeln und den DFB-Turnierschlüssel.
- Messen, wie groß ein Schnappschuss mit 128 Teilnehmern im Schweizer System wird.
