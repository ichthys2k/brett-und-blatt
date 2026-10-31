# Wölfe im Schafspelz (Werwolf-artig, W-021)

*Rollenspiel mit geheimen Rollen für 8–18 Spieler: Nachts versprengen Wölfe die Schafe der Herde, tags sucht der Herdenrat die Wölfe.*

> **Name:** Die Regeln folgen „Die Werwölfe von Düsterwald“ (Grundspiel), die Funktion jeder Rolle bleibt gleich. Name, Rollen, Texte und Gestaltung sind eigen; der Name des Vorbilds erscheint nicht in der App. Vor der Veröffentlichung prüft Cornelius das Rechtliche, dieser Plan ist keine Rechtsauskunft.

| Steckbrief | |
|---|---|
| Spieler | 8–18, mit Erzähler 9–19 (ohne Erzähler sind auch 19 Plätze möglich, mit 4 Wölfen; später bis 28, siehe Ausbau) |
| Modi | online (Hauptfall), Hot-Seat; allein nicht sinnvoll |
| Muster | verdeckt, gleichzeitig |
| Bausteine | vorhanden: `playerView`, `eventView`, `sampleHidden`, `timeoutMove`, `systemDelayMs`, Übergabe-Bildschirm; neu: `GameInfo.minHumans` |
| Aufwand | Regeln L, Oberfläche L, Bot M; zusammen etwa zwei Wochen ohne Klänge |
| Ordner | `packages/games/wolves-sheep`, CSS-Präfix `ws-` |

## Rollen

Funktionen wie im Original, nur Name und Deutung sind neu. Bibelstellen vor dem Einbau prüfen.

| Rolle | Vorbild | Funktion | Deutung |
| --- | --- | --- | --- |
| 🐺 **Wolf im Schafspelz** | Werwolf | wählt nachts mit den anderen Wölfen ein Schaf, das ausscheidet | Mt 7,15; das Schaf wird „versprengt“ |
| 🐑 **Schaf** | Dorfbewohner | berät und stimmt ab | Joh 10 |
| 🔍 **Prüfer** | Seherin | sieht jede Nacht die Rolle einer Person | „An ihren Früchten“, Mt 7,16 |
| 🧑‍🌾 **Hirte** | Hexe | sieht das Opfer der Nacht; rettet einmal je Partie das Opfer, weist einmal je Partie eine Person aus, auch beides in einer Nacht und auch für sich selbst | Hirtenruf (Lk 15), Hirtenstab (Ps 23,4) |
| 🐕 **Hütehund** | Jäger | nimmt beim Ausscheiden sofort eine weitere Person mit | packt zum Abschied noch jemanden |
| 🎀 **Bandstifter** | Amor | verbindet in der ersten Nacht zwei Personen, auch sich selbst | Pred 4,9–10 |
| 🐥 **Neugieriges Lamm** | Mädchen | darf nachts bei den Wölfen linsen; wird es erwischt, scheidet es statt des Opfers aus | siehe „Abweichung“ |
| 🐐 **Zugelaufenes Schaf** | Dieb | sieht zu Beginn zwei übrige Karten und darf tauschen; sind beide Wölfe, muss es tauschen | stößt neu zur Herde |
| 🔔 **Leithammel** | Hauptmann | wird gewählt, Stimme zählt doppelt, bestimmt beim Ausscheiden den Nachfolger | trägt die Glocke; Zusatzamt, keine Karte |

Später aus den Erweiterungen: **Altes Schaf** (Der Alte) und **Wächter** (Leibwächter), siehe Ausbau.

## Regeln

**Ziel.** Die Herde gewinnt, wenn alle Wölfe ausgeschieden sind. Die Wölfe gewinnen, wenn das letzte Schaf ausgeschieden ist.

**Verbundene.** Sie kennen einander, aber nicht ihre Rollen. Scheidet einer aus, geht der andere sofort mit. Im Herdenrat darf keiner für den anderen stimmen. Sind ein Wolf und ein Schaf verbunden, ändert sich ihr Ziel: Sie gewinnen nur, wenn alle anderen ausgeschieden sind („Der Wolf wohnt beim Lamm“, Jes 11,6).

**Karten.** Standard ist die Einsteigermischung, alle weiteren Rollen schaltet die Raumleitung zu.

| Spieler | Wölfe | Prüfer | Schafe (ohne Sonderrollen) |
| --- | --- | --- | --- |
| 8–11 | 2 | 1 | 5–8 |
| 12–17 | 3 | 1 | 8–13 |
| 18 | 4 | 1 | 13 |

Jede zugeschaltete Sonderrolle ersetzt ein Schaf. Mit dem Zugelaufenen Schaf kommen zwei Schafkarten dazu; alle Karten werden gemischt und zwei bleiben übrig. Dabei können auch Wölfe in der Mitte landen.

**Ablauf**

1. **Erste Nacht, Vorrunde:** Zugelaufenes Schaf tauscht, dann verbindet der Bandstifter, und die Verbundenen erfahren voneinander.
2. **Nacht:** Der Prüfer schaut, die Wölfe erkennen einander und wählen, das Lamm darf linsen.
3. **Morgengrauen:** Der Hirte sieht das Opfer und entscheidet über Ruf und Stab.
4. **Morgen:** Das Ergebnis wird verkündet. Wer ausscheidet, deckt die Karte auf und schweigt fortan. Am ersten Morgen folgt danach die Wahl des Leithammels, falls er zugeschaltet ist.
5. **Beratung:** Alle dürfen bluffen und alles behaupten.
6. **Herdenrat:** Alle Lebenden stimmen gleichzeitig ab. Wer die meisten Stimmen hat, scheidet aus. Bei Gleichstand scheidet niemand aus.
7. Weiter mit Schritt 2.

Ausgeschiedene sehen im Original die Rollen und dürfen nichts verraten. Das gilt hier genauso.

## Wo das Regelheft nichts sagt

Diese Lücken fülle ich so; sie sind Entscheidungen, keine Originalregeln.

- **Zeitpunkt der Wahl:** am ersten Morgen. Bei Gleichstand gibt es vorerst keinen Leithammel, und am nächsten Morgen wird neu gewählt.
- **Hütehund:** Das Heft nennt Wölfe und Herdenrat. Neuere Ausgaben sagen „scheidet er aus“; das gilt hier, also auch bei Stab und Mitgehen.
- **Uneinige Wölfe:** Am Ende zählt die Mehrheit ihrer Wahl, bei Gleichstand das Los.
- **Alle scheiden gleichzeitig aus:** Die Partie endet ohne Sieger.
- **Verbundene und Wölfe:** Ein Wolf kann seinen Verbundenen nachts nicht wählen, andere Wölfe schon.

## Abweichung: das Neugierige Lamm

Blinzeln am Tisch gibt es in der App nicht, deshalb ist dies die **einzige angepasste Regel**. Das Lamm kann einmal je Nacht „linsen“: Es sieht einen zufälligen lebenden Wolf und wird mit einer Chance von 1 zu 3 erwischt (Zufall aus dem Seed). Dann ist es statt des gewählten Opfers das Opfer der Nacht. Der Hirte kann es wie jedes Opfer retten. Der Wert 1 zu 3 ist ein Startwert für den Prüfstand.

## Optionen

- **Rollen:** Hirte, Hütehund, Bandstifter, Lamm, Zugelaufenes Schaf, Leithammel (je an/aus; Standard aus, das ergibt die Einsteigermischung des Originals).
- **Beratung:** 2, 3 oder 5 Minuten, oder „bis zum Knopf“ (Standard 3).
- **Erzähler:** aus (die App erzählt) oder Platz 1 als menschlicher Erzähler wie im Original, ohne Rolle und mit Sicht auf alles (wie die Spielleitung bei Bingo).

## Spielmodell

- **Phasen:** `preround`, `night`, `dawn`, `election`, `debate`, `vote`, dazu `pending` für Folgen und `done`.
- **Rollen nicht über `current` verraten:** Der Server schickt `current` an alle. Dürften nachts nur Rollenträger handeln, wären sie erkannt. Deshalb bestätigen in `preround`, `night` und `dawn` **alle Lebenden genau einmal**, und `current` schrumpft auf die, die noch nicht bestätigt haben. Wer nichts zu tun hat, tippt an, wer ihm verdächtig ist. Diese Notiz sieht nur der eigene Platz am Tag wieder.
- **Warum zwei Nachtrunden:** Der Hirte muss das Opfer kennen, also müssen die Wölfe fertig sein. Prüfer und Wölfe können gleichzeitig handeln, weil keiner das Ergebnis des anderen nutzen kann. Das ändert am Ausgang nichts gegenüber der Reihenfolge im Heft.
- **Züge:** `tap` (vorläufige Wahl, bei Wölfen für Wölfe sichtbar), `confirm`, `done`, `swap`, `bind`, `peek`, `shepherd` (Ruf und Stab), `vote`, `shoot` (Hütehund), `passBell`, `endDebate`.
- **Folgen als Warteschlange:** Ausscheiden löst Mitgehen, Hütehund und Glocke aus, auch als Kette. `pending` arbeitet sie der Reihe nach ab, und erst danach wird der Sieg geprüft.
- **Zeit:** Abstimmen und Nachtrunden laufen über `timePresets` je Zug; läuft die Zeit ab, gilt `timeoutMove` (vorläufige Wahl bestätigen, sonst Los). Die Beratung nutzt `systemDelayMs` mit `'system'` in `currentPlayers`, aber nur wenn eine Zeit gewählt ist, denn bei Wartezeit 0 würde der Systemzug sofort laufen. Den Knopf hat der Leithammel, sonst der erste Lebende, mit Erzähler dieser.
- **Sicht:** `playerView` enthält die eigene Rolle, aufgedeckte Karten, was die Rolle weiß (Prüfer-Ergebnisse, Wölfe und ihre Wahl ab `night`, Verbundene, Opfer nur für den Hirten). Ausgeschiedene und der Erzähler sehen alles; `'spectator'` sieht nur Öffentliches, damit die Tafel sicher ist. `rng` wird genullt.
- **`sampleHidden`:** verteilt die unbekannten Rollen passend zum Wissen des Platzes.
- **`eventView`:** Nachtereignisse sehen nur Berechtigte, damit keine Rolle über Ereignis oder Klang durchsickert.
- **Rest im Protokoll:** Online sieht jeder an der Versionsnummer, dass etwas passiert, und an `current`, wer schon bestätigt hat. Das verrät keine Rolle. Ein Hirte oder Wolf, der lange überlegt, fällt aber auf, deshalb zeigt die Oberfläche nachts keinen Fortschritt an.

## Bot

„Hütehelfer“ in drei Stufen, nur als Füllung und Ersatz für Abwesende. Er diskutiert nicht.

- **Leicht:** wählt zufällig unter den erlaubten Zielen.
- **Mittel:** Prüfer und Lamm stimmen nach ihrem Wissen, Wölfe stimmen nie für Wölfe, die anderen richten sich nach öffentlichem Wissen (aufgedeckte Karten, frühere Abstimmungen).
- **Schwer:** merkt sich zusätzlich, wer für aufgedeckte Wölfe oder Schafe gestimmt hat. Hirte rettet nur Personen mit gutem Wissensstand.

Wer die Abstimmungen sehen darf, ist im Original öffentlich (alle zeigen gleichzeitig), deshalb stehen sie nach dem Aufdecken in der Sicht. Schrittweite in `apps/server/src/bots.ts` ist wegen der einfachen Regeln unkritisch.

## Oberfläche

- **Dorfkreis:** alle Personen im Kreis als Tippziele, Aufgedeckte mit Karte und ausgegraut, bis 19 ohne Scrollen auf dem Handy.
- **Rollenkarte:** verdeckt, zum Ansehen gedrückt halten, damit Nachbarn nichts sehen.
- **Nacht:** dunkles Bild für alle gleich, gleiche Knopfanordnung für alle Rollen. Am Handy darf man niemandem ansehen, was er tut.
- **Tafel:** Phase, Zeit und Abstimmungsergebnis groß, nur die Zuschauer-Sicht; Lehrkraft bleibt Zuschauer oder Erzähler.
- **Erzähltexte:** alle Sätze eigen und ohne Tod („Die Herde schläft“, „Heute Nacht wurde … versprengt“). Klänge und Stimme nur nach Auswahl durch Cornelius; bis dahin läuft das Spiel still.
- **Playlist:** „Spielabend“.

## Hot-Seat und Online

- **Online ist der Hauptfall:** jeder am eigenen Handy, Reden im Raum oder im Sprachkanal.
- **Hot-Seat:** Der vorhandene Übergabe-Bildschirm funktioniert, weil `current` schrumpft. Es bleiben aber etwa zwei Übergaben je Person und Nacht, also 24 bei 12 Spielern. Spielbar, aber zäh; ich empfehle es nur für kleine Runden.
- **Neu `GameInfo.minHumans` (hier 4):** Die Web-App und der Raum starten sonst auch mit einem Menschen und sieben Bots. `modes` wertet die Web-App heute nicht aus.
- **Server:** eintragen in `apps/server/src/games.ts` und `apps/server/package.json`.

## Tests

- `gameContractChecks` über alle Rollenkombinationen und Platzzahlen, dazu `tests/repo.test.ts`.
- **Regeltests:** Kartenmischung je Spielerzahl; Zugelaufenes Schaf mit zwei Wölfen muss tauschen; Hirte beide Tränke einmalig, auch selbst; Hütehund in Kette mit Verbundenen; Leithammel doppelt und Nachfolge; Gleichstand; alle Siegfälle einschließlich gemischter Verbundener.
- **Geheimnisse:** Keine lebende Sicht und kein Ereignis enthält fremde Rollen; `current` ist nachts für alle Rollen gleich aufgebaut.
- **Browser und Last:** `corepack pnpm rauchtest`, `PRUEFSTAND=1 PRUEFSTAND_SPIELE=wolves-sheep corepack pnpm pruefstand`, Probelauf mit 18 nachgebauten Browsern über `smoke.mjs`.
- **Ausgewogenheit:** Bot gegen Bot je Rollenmischung; Siegquote der Wölfe messen und Lamm-Wert prüfen. Die Regeln bleiben unverändert, auch wenn die Quote schief liegt; dann ändert sich nur die Empfehlung für die Mischung.
- **Echter Probelauf:** mindestens eine Runde mit Menschen vor der Freigabe.

## Schritte

1. ✅ **Regeln** mit Einsteigermischung und Tests.
2. ✅ **Oberfläche** für online und Hot-Seat, Server-Eintrag, `minHumans`.
3. ✅ **Alle Rollen des Grundspiels** samt Warteschlange.
4. ✅ **Erzähler, Tafel**, Prüfstand. Der Probelauf mit Menschen steht aus, siehe unten.
5. **Klänge** nach deiner Auswahl.

Veröffentlicht wird erst auf „deploy“.

### Stand

**Schritt 1 fertig (31.10.2026):** Regeln mit Einsteigermischung (Wölfe, Prüfer, Schafe), Bot „Hütehelfer“ in drei Stufen, Tests und eine schlichte Oberfläche; `draft: true`, also nur über `#/neu/wolves-sheep` erreichbar und noch nicht auf dem Spieleserver. Abweichend vom Entwurf oben: Eine Enthaltung gibt es nur bei Zeitablauf, und wer aufgibt, scheidet mit aufgedeckter Karte aus (`leave`); Wölfe, deren Wahl auf ihn fiel, wählen neu.

**Schritt 2 fertig (31.10.2026):** Das Spiel steht auf der Startseite und auf dem Spieleserver (kein `draft` mehr, weil der Server Entwürfe nicht anbietet). Neu in der Plattform: `GameInfo.minHumans`, `GameInfo.noUndo` und `GameUi.concealTurns` (keine Markierung und kein „denkt nach“ nachts und im Rat). Oberfläche: dunkle Nacht, Stimme mit Bestätigung, Wissen tags nur beim Drücken der Karte, Nachricht über Nacht und Rat, Countdown der Beratung (zählt ab dem Morgen auf dem jeweiligen Gerät).

Abweichend vom Entwurf: Nachts gibt es einen dritten Schritt „Weiter“ für alle (`done`), sonst sähe der Prüfer beim Hot-Seat sein Ergebnis nie. Der „Dorfkreis“ ist vorerst ein Raster.

**Schritt 3 fertig (31.10.2026):** Hirte, Hütehund, Bandstifter, Neugieriges Lamm, Zugelaufenes Schaf und Leithammel sind einzeln zuschaltbar, Standard bleibt die Einsteigermischung. Dazu die Warteschlange für Ketten aus Ausscheiden, Schuss und Glocke; der Sieg zählt erst danach.

Festlegungen beim Bau:

- Am Morgen heißt alles Nächtliche „versprengt“, auch Hirtenstab und erwischtes Lamm, damit niemand den Hirten daran erkennt.
- Hütehund und abtretender Leithammel handeln noch ohne das Wissen der Ausgeschiedenen.
- Wer aufgibt, schießt nicht; die Glocke geht dann an den ersten Lebenden.
- Liegt die Hirtenkarte in der Mitte, läuft das Morgengrauen trotzdem, damit das niemand merkt. Es entfällt erst, wenn der Hirte aufgedeckt fort ist.
- Hat ein Wolf nur noch Rudel und Verbundenen als Ziel, tippt er zum Schein; das zählt nicht.

**Bekannte Schwäche:** Trägt ein Computer die Glocke und läuft die Beratung „bis zum Knopf“, wartet er über eine Minute, damit er die Menschen nicht abschneidet. Menschen können nicht vorzeitig eröffnen.

**Schritt 4 fertig (31.10.2026), bis auf den Probelauf:** Option „Erzähler“ ab 9 Plätzen (Platz 1 spielt nicht mit, sieht alles und alle, die noch fehlen, eröffnet den Rat). Vorlesetexte in jeder Phase. Knopf „Tafel für den Beamer“ für Erzähler und Zuschauer; die Tafel liest nur öffentliche Felder, kann also auch beim Erzähler nichts verraten. Sie zeigt den Raumcode, aber keinen QR-Code, weil nach dem Start ohnehin niemand mehr einsteigt. Ohne Erzähler bleiben sprachlich gestaltete Ansagen aus, bis Klänge ausgewählt sind.

### Online-Tests (31.10.2026, lokaler Spieleserver)

Elf Partien bis zum Sieg mit nachgebauten Browsern (8, 9, 12 und 18 Plätze, alle Rollen und Einsteigermischung, mit Erzähler), dazu eine im menschlichen Tempo mit 12 Plätzen, eine mit 4 Menschen und 4 Bots und eine mit einem Spieler, der nicht reagiert (30 s je Zug). Jede ankommende Sicht wurde geprüft, auch die eines Zuschauers: **keine verratene Rolle, Wahl, Stimme oder Hirten- und Lamm-Angabe.** Im menschlichen Tempo gab es keine abgewiesenen Züge. Die Tafel lief als Zuschauer im Browser mit. Nicht geprüft: Cloudflare, Vollbild am echten Beamer, echte Menschen.

### Gemessene Siegquoten

Bots gegen Bots, Stufe „mittel“, je 150 Partien (`PRUEFSTAND=1 corepack pnpm exec vitest run packages/games/wolves-sheep -t "Bots gegen Bots" --disable-console-intercept`). **Die Bots beraten nicht**, die Zahlen sagen also wenig über Menschen. Sie zeigen vor allem, dass keine Mischung kippt, und die Partielänge.

| Plätze | Einsteiger: Wölfe / Herde | Alle Rollen: Wölfe / Herde / Paar | Nächte im Schnitt |
| --- | --- | --- | --- |
| 8 | 73 % / 27 % | 38 % / 53 % / 5 % | 3–5 |
| 12 | 76 % / 24 % | 48 % / 48 % / 3 % | 5–6 |
| 18 | 43 % / 57 % | 39 % / 61 % / 1 % | 8 |

Einzelne Sonderrollen verschieben die Quote nur wenig. Der Lamm-Wert 1 zu 3 bleibt vorerst: Mit Lamm liegen die Wölfe bei 8 Plätzen 8 Punkte tiefer, bei 12 und 18 etwa gleich. Regeln ändern sich dadurch nicht.

### Probelauf mit Menschen

Einmal mit mindestens 8 Menschen an eigenen Geräten spielen, live nach dem Deployment.

1. **Einsteigermischung, App als Erzähler:** Findet sich jeder ohne Erklärung zurecht? Wie lang dauert eine Partie wirklich?
2. **Dieselbe Mischung mit menschlichem Erzähler und Tafel am Beamer.**
3. **Alle Rollen:** Sind Hirte, Bandstifter und Lamm verständlich? Reicht die Rollenkarte als Erklärung?

Darauf achten:

- Verrät jemand durch Tippen, Zögern oder den Bildschirm seine Rolle?
- Schweigen die Ausgeschiedenen, und wie lange langweilen sie sich?
- Stimmung in der Gruppe: Trifft das Hinauswählen jemanden persönlich?
- Passt die Beratungszeit, und reichen die Zeitvorgaben?
- Ist der Knopf „Linsen“ bei Sitznachbarn zu auffällig? (Nur das Lamm hat ihn.)

**Probelauf:** Cornelius testet live auf spiele.lipponer.de, sobald er „deploy“ sagt (31.10.2026). Das Spiel ist ab dann für alle sichtbar.

## Ausbau (nicht Teil der ersten Fassung)

- **Altes Schaf:** übersteht den ersten Wolfsangriff ohne Aufdecken. Scheidet es durch Herdenrat, Stab oder Hütehund aus, verlieren alle Schafe ihre Sonderfähigkeiten.
- **Wächter:** Die genauen Regeln aus der Erweiterung habe ich nicht am Heft geprüft; das muss vor dem Einbau geschehen.
- **Bis 28 Plätze:** Neuere Ausgaben nennen 8–28 Spieler mit höchstens einem Viertel Wölfe. Machbar nach dem Lastprobelauf, die Partie wird aber länger.
- **Thema als Option:** Das Modul lässt weitere Themen zu, etwa „Urgemeinde in Jerusalem“.

## Was Cornelius wissen sollte

- **Alter:** Ab 10 Jahren (von Cornelius entschieden, 31.10.2026). Das geprüfte Regelheft nennt ab 14 Jahren, ein aktueller Händlereintrag ab 10. Das Thema ist milder, der Kern bleibt: Kinder beschuldigen einander und stimmen sich hinaus. Darauf achtet der Probelauf besonders.
- **Lange Wartezeit:** Weil niemand zurückkehrt und die Regeln gleich bleiben, warten früh Ausgeschiedene bis zum Ende. Händler nennen rund 30 Minuten je Partie.
- **Ausgeschiedene sehen alles:** Im selben Raum können sie verraten, wer Wolf ist. Das Original verlässt sich auf ihr Schweigen.
- **Härtere Rollen:** Hirtenstab und Hütehund treffen auch Unschuldige. Für die erste Runde mit einer Klasse empfehle ich die Einsteigermischung.

## Quellen

- [Regelheft „The Werewolves of Millers Hollow“ (8–18 Spieler)](https://www.world-of-board-games.com.sg/docs/Werewolves-Millers-Hollow.pdf): maßgeblich für Rollen, Ablauf, Mischung und Sieg.
- [Regeln „Best of“ auf rulespal](https://rulespal.com/werewolves-miller-hollow-best-of/rulebook): Der Alte, Viertel-Regel, Hütehund-Wortlaut. Dort wird bei Gleichstand erneut abgestimmt; hier gilt das Grundspiel-Heft.
- [Regeln „The Village“ auf rulespal](https://rulespal.com/werewolves-miller-hollow-village/rulebook): Zugelaufenes Schaf.
- [Händlereintrag zur aktuellen Ausgabe](https://www.mydealz.de/deals/werwolfe-von-dusterwald-best-of-partyspiel-1135eur-deduktionsspiel-fur-8-28-spieler-30-min-mehr-als-5-mio-verkauft-amazon-prime-2844974): 8–28 Spieler, rund 30 Minuten, ab 10 Jahren.
