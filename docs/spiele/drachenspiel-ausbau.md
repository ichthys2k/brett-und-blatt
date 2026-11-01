# Drachenspiel: Ausbauplan zum vollwertigen Sammelkarten-Duell

Fassung 1 vom 01.11.2026 (W-044). Grundlage sind der Code auf Commit `95218ef`, die Fehlerliste (F-007 bis F-009) sowie das Hearthstone-Kompendium im privaten Repo (`brett-und-blatt-klaenge/kompendium/hearthstone/`). Die Vorschläge zu Thema und Karten warten auf Cornelius' Entscheidung.

**Stand für Mitwirkende (01.11.2026):** Phase 0, Phase 1 (Regelkern, `ruleVersion` 4), Phase 2 (Bedienung, Bot-Planer) Phase 3 (Held und Grundregeln, `ruleVersion` 5), Phase 4 (dauerhafte Stichwörter, `ruleVersion` 6) und Phase 5 (Entscheidungen, `ruleVersion` 7) sind umgesetzt; Stand in [`drachenspiel.md`](drachenspiel.md). Als Nächstes käme Phase 6 (Tierfamilien und Grundset), sie ist noch nicht begonnen.

**Weiterarbeiten, auch an einem anderen Rechner:** Alles Nötige liegt in GitHub. `git pull`, `corepack pnpm install`, einen neuen Zweig von `main` anlegen, dann diesen Plan (Phase 6 in Kapitel 11) und die Abschnitte zu Phase 2 bis 5 in [`drachenspiel.md`](drachenspiel.md) lesen. Das Kompendium und der Recherchebericht liegen unter `kompendium/hearthstone/` im privaten Repo `ichthys2k/brett-und-blatt-klaenge` und gehören nie in dieses öffentliche Repo (Blizzard-Namen); abrufen mit `gh repo clone`. Offene Punkte aus Phase 2: echte Online-Partie mit zwei Geräten (Lunte, Tierrufe, Rechenzeit auf Cloudflare), Vertonung der Tierrufe nach Auswahl durch Cornelius, F-010 prüfen. Das Kompendium ist nur für Berechtigte im privaten Klang-Repo erreichbar; Regelideen übernehmen wir, Namen, Texte und Bilder nicht.

## 1. Kurzfassung

**Ziel:** Das Drachenspiel soll Stück für Stück alles können, was Hearthstones Duell ausmacht, aber mit eigener Welt, eigenen Karten und ohne Kaufsystem.

**Kernaussage:** Neue Karten wären heute die falsche erste Arbeit. Die Regeln kennen nur fest verdrahtete Einzelfälle, der Spielstand hat keinen Zufallsspeicher, und ein Zug kann nicht mitten in einem Effekt auf eine Wahl warten. Darum kommt zuerst ein neuer **Regelkern**, danach lässt sich jede Mechanik als kleiner Baustein ergänzen.

**Reihenfolge:**

| Phase | Inhalt | Ergebnis für Spielende |
|---|---|---|
| 0 | Fehler beheben, Ausgangslage messen | fair gemischt, ehrliche Texte |
| 1 | Regelkern neu, Verhalten unverändert | nichts sichtbar, alles vorbereitet |
| 2 | Bedienung und Bot-Planer | Zielpfeil, Spielverlauf, Bot plant den ganzen Zug |
| 3 | Held und Grundregeln | Heldenkraft, Rüstung, Waffen, Hand 10 |
| 4 | Dauerhafte Stichwörter | Sprinter, Doppelschlag, Lebenskraft … |
| 5 | Entscheidungen | Zielwahl, Fährte suchen, Wahlkarten |
| 6 | Tierfamilien und erstes Grundset | 5 Häuser mit etwa 180 Karten |
| 7 | Neue Kartentypen | Bauten, Fallen, Aufgaben, Winterschlaf |
| 8 | Deckbau ohne Kauf | eigene Decks und Deck-Codes |
| 9 | Solo-Modi | Übungsweg, Wanderschaft, Turnier |
| 10 | Dauerhafter Ausbau | 6 weitere Häuser, Jahres-Sets, Sonderregeln |

Das Turnier-Thema (W-025) läuft unabhängig daneben. Jede Phase lässt sich einzeln veröffentlichen, und danach kann die Arbeit jederzeit enden.

## 2. Leitplanken

- **Regeln ja, Ausdruck nein:** Spielideen übernehmen wir als Mechanik. Namen wie Hearthstone oder Warcraft, Figuren, Kartentexte, Bilder und die genaue Kartenliste übernehmen wir nicht. Karten bekommen eigene Namen, Werte und Texte. Das ist eine vernünftige Arbeitsregel, keine Rechtsberatung. Ob die Nähe zum Vorbild am Ende unbedenklich ist, sollte vor einer großen Veröffentlichung eine fachkundige Person ansehen.
- **Jugendschutz:** keine Packs, kein Staub, kein Pass, keine Zufallsbelohnung, keine Dämonen, Untoten oder Leichen. Tiere sterben nicht, sie gehen vom Feld.
- **Kein Frust durch Ohnmacht:** Stehlen, erzwungenes Abwerfen und Sieg-in-einem-Zug-Ketten bleiben aus oder sehr selten. Team 5 strich nicht konterbare Mechaniken aus demselben Grund.
- **Wenige gut gestützte Mechaniken je Set:** Blizzard selbst warnt vor zu vielen Schlüsselwörtern. „Vollständig“ heißt: Die Maschine kann alles, jede Partie zeigt nur einen Teil.
- **Handy zuerst:** Sieben Tiere und zehn Handkarten müssen bei 390 px Breite bedienbar sein, nur mit Tippen und auch per Tastatur.
- **Klänge nach Auswahl:** Neue Effekte und Stimmen wählt Cornelius aus.

## 3. Was heute trägt und was nicht

### Ist-Stand im Code

| Bereich | Befund | Beleg | Folge |
|---|---|---|---|
| Effekte | Jeder Auftritt, Abschied und Zauber ist ein eigener Code-Zweig, Spielsteine stehen doppelt im Code | `rules.ts:484-527`, `:613-687`, `:728-763` | Jede Karte mit neuer Wirkung braucht neuen Regelcode |
| Figuren | Stichwörter sind einzelne Ja/Nein-Felder, `baseAttack` wird nie gelesen | `types.ts:65-86` | Keine Dauereffekte, kein Beruhigen (Silence), keine ablaufenden Verstärkungen |
| Angriffe | `canAttack` und `hasAttacked` | `types.ts:83-84` | Kein Doppelschlag, kein „Sprinter“ (nur Tiere) |
| Zufall | Seit Phase 0 ist `rng` im Spielstand, aber kein Effekt nutzt ihn | `types.ts` | Zufällige Effekte sind jetzt möglich, brauchen aber noch den Kern |
| Wahl im Effekt | `Phase` kennt nur vier Zustände, ein Zug läuft in einem Stück durch | `types.ts:102`, `rules.ts:331` | Kein Entdecken, keine Auftritte mit Ziel |
| Tod | Erst alle Tiere von Platz 0, dann Platz 1, rekursiv | `rules.ts:714-778` | Reihenfolge nicht regelgerecht, Heldentod in Kette nicht bedacht |
| Sieg | `checkGameOver` steht verstreut hinter Aktionen | `rules.ts:408`, `:427`, `:530`, `:579` | Neue Wege übersehen es leicht |
| Texte | Regeltexte von Hand, im Widerspruch zum Code | `ui/traits.ts:13`, `:48` | F-008 |
| Bot | „Schwer“ bewertet nur einen Zug voraus, Gegnerdeck wird mit Zurücklegen geraten | `bots.ts:94-113`, `rules.ts:890` | Kein Plan für einen ganzen Zug |
| Oberfläche | Eine Datei mit fast 1000 Zeilen; der Hook-Absturz ist in Phase 0 behoben (F-009) | `ui/index.tsx` | Vor dem Ausbau weiter aufteilen |
| Tests | 12 Regeltests | `test/drachenspiel.test.ts` | Vor dem Umbau Verhalten festschreiben |
| `ruleVersion` | Wird in der Plattform bisher nur deklariert | `packages/engine/src/types.ts:30` | Altes Format laufender Online-Räume eigens prüfen |

### Warum die Partie heute flach wirkt

- **Keine Mana-Senke:** Ohne Heldenkraft verfällt Restmana.
- **Zu wenig Karten:** Nur Glücksklee zieht Karten, die Hand läuft leer.
- **Wenig Entscheidungen:** 27 von 54 Tieren haben keine Fähigkeit, und kein Tier wählt ein Ziel.
- **Kaum Identität:** Die Decks unterscheiden sich vor allem durch Werte, nicht durch einen Plan.
- **Kurze Partien, leichter Startvorteil:** Nach Phase 0 gewinnt der Startspieler im Spiegel „schwer“ 58 % (vorher 77 %, großteils durch F-007). Die Partie dauert dort rund 7 Züge je Spieler, große Karten kommen daher selten zum Zug. Das sind nur Bot-Messungen.

## 4. Die Spielschleifen

| Schleife | Dauer | Heute | Soll | Eingeführt in |
|---|---|---|---|---|
| **Aktion** | Sekunden | Tippen, Treffer, Zahl | Ziel wählen, Pfeil, Wucht, Klang | Phase 2 |
| **Zug** | unter 1 min | Mana ausgeben, meist eindeutig | Rätsel: Mana genau nutzen, Reihenfolge, Abtausch oder Heldentreffer | 3–5 |
| **Partie** | 10–20 min | Wer zuerst legt, gewinnt oft | Früh Brett, Mitte Tempo, spät große Karten und Comebacks; Startspieler 45–55 % | 3–6 |
| **Deck** | Abende | Thema wählen | Deck bauen, testen, anpassen, teilen | 8 |
| **Lauf** | 30–60 min | fehlt | Wanderschaft: Gegner, Beute, Deck wächst, neu versuchen | 9 |
| **Langzeit** | Wochen | fehlt | Turnierbuch: Häuser kennenlernen, Kosmetik nur durch Spielen, nie zufällig | 9 |
| **Gemeinsam** | Partie, Klasse | Online, Hot-Seat | Tierrufe statt Chat, Zuschauen, Klassenturnier | 2, 9 |

**Maßstab für jede neue Mechanik:** Sie muss im Zug mindestens eine echte Entscheidung schaffen und nach einer Niederlage verständlich bleiben. Sonst bleibt sie weg.

## 5. Der neue Regelkern (Phase 1)

Der Kern ist das Herzstück dieses Plans. Alle Daten bleiben reines JSON, damit Online, Speichern und Bots weiter funktionieren.

### 5.1 Figuren und Veränderungen

Alle Dinge auf dem Tisch werden zu Objekten mit einer **Spielreihenfolge** (`playOrder`, eine laufende Nummer). Sie entscheidet, was bei gleichzeitigen Ereignissen zuerst geschieht.

```ts
interface Character {
  id: string;
  cardId: string;
  owner: SeatId;
  playOrder: number;
  damage: number;                 // Schaden statt Restleben
  attacksThisTurn: number;
  summonedOnTurn: number;
  enchantments: Enchantment[];    // Grundlage aller Veränderungen
}

interface Enchantment {
  id: string;
  source: string;
  attack?: number;
  health?: number;
  keywords?: KeywordId[];
  triggers?: Trigger[];
  expires?: 'endOfTurn' | 'startOfOwnTurn';
}
```

Werte werden **berechnet**: Grundwert der Karte plus Veränderungen plus Dauereffekte. Beruhigen ist danach nur noch „Veränderungen und Kartentext löschen“. Schaden bleibt dabei stehen, wie im Vorbild.

### 5.2 Karten als Daten

Eine Karte beschreibt, **wann** und **wen** etwas **wie** trifft. Der Regelkern versteht einen kleinen Wortschatz.

```ts
{
  id: 'w_badger', type: 'minion', cost: 3, attack: 2, health: 4,
  families: ['burrower'], rarity: 'common',
  keywords: ['taunt'],
  triggers: [{
    on: 'played',
    target: { side: 'enemy', kind: 'minion', choose: true },
    do: [{ effect: 'damage', amount: 2 }],
  }],
}
```

| Wortschatz | Erste Fassung |
|---|---|
| **Auslöser** | gespielt, geht vom Feld, Zugbeginn, Zugende, nach Zauber, nach Schaden, wenn angegriffen, beim Ziehen |
| **Ziele** | selbst, gewählt, zufällig, alle, Nachbarn, eigener oder gegnerischer Held; gefiltert nach Seite, Art, Familie, Kosten, verletzt |
| **Bedingungen** | Familie auf Brett oder Hand, Hand leer oder voll, Mana mindestens, Karte zuvor in diesem Zug, verletzt |
| **Effekte** | Schaden, Heilen, Rüstung, Ziehen, Rufen, Verstärken, Stichwort geben, Vernichten, Verwandeln, Zurück auf die Hand, Beruhigen, Einfrieren, Karte erzeugen, Ins Deck mischen, Kosten ändern, Mana, Wahl anbieten |

**Zwei wichtige Folgen:** Der Regeltext wird aus den Daten **erzeugt**, damit F-008 nie wiederkommt. Und ein Test prüft jede Karte auf gültige Werte, erklärbaren Text und Werte-Maßstab.

### 5.3 Der Ablauf einer Aktion

Eine Warteschlange im Spielstand arbeitet jede Aktion gleich ab:

1. **Vorher-Auslöser**, etwa Fallen und „wenn angegriffen“.
2. **Wirkung** der Aktion; Schaden wird gleichzeitig verrechnet.
3. **Dauereffekte neu berechnen.**
4. **Tod:** Alle Figuren mit 0 Leben gleichzeitig vom Feld, dann Abschiede in Spielreihenfolge. Das wiederholt sich, bis niemand mehr fällt.
5. **Nachher-Auslöser.**
6. **Siegprüfung** an genau einer Stelle. Fallen beide Helden gleichzeitig, ist es unentschieden.

Der komplette Regelapparat des Vorbilds ist nicht nötig. Es reichen dieser Kern und eine Grenze von zum Beispiel 200 Schritten gegen Endlosketten.

### 5.4 Warten auf eine Wahl

Der Ablauf muss anhalten können, wenn ein Effekt fragt: „Welche von drei Karten?“

```ts
interface PendingChoice {
  seat: SeatId;
  kind: 'discover' | 'target' | 'chooseOne' | 'adapt';
  options: ChoiceOption[];
}
```

`DrachenspielState` bekommt `pending` und die Warteschlange (`queue`). Liegt eine Wahl an, liefert `legalMoves` nur `{ type: 'choose', index }`. Danach läuft die Warteschlange weiter. `timeoutMove` wählt bei Zeitablauf die erste Möglichkeit, `playerView` und `eventView` zeigen die Möglichkeiten nur dem Wählenden.

### 5.5 Zufall und Geheimnisse

- **Zufall:** `state.rng` wird wie `dealRng` bei den Stichspielen aus dem Partie-Seed abgeleitet, in Sichten genullt und vom Bot nie gelesen.
- **Geheimes:** Fallen zeigen dem Gegner nur ihre Anzahl. Offen gezeigte Karten werden als solche markiert (`revealedTo`), damit ein Mitspieler weiß, was er schon gesehen hat.
- **`sampleHidden`:** verteilt die wirklich noch möglichen Karten ohne Zurücklegen statt zufälliger Ziehungen und berücksichtigt offen gezeigte Karten.
- **Zurücknehmen:** Ein Zug, der neue Informationen zeigt, darf nicht zurücknehmbar sein. Das Drachenspiel setzt heute kein `noUndo`, der Knopf „Zug zurück“ ist also aktiv (`apps/web/src/screens/Play.tsx:418`). Spätestens mit Entdecken und Zufallseffekten wäre das Ausnutzen möglich: `noUndo` setzen oder Zurücknehmen auf Züge ohne neue Information begrenzen.

### 5.6 Dateiaufteilung

```text
packages/games/drachenspiel/src/
  core/        state.ts, queue.ts, combat.ts, stats.ts, triggers.ts, effects.ts, selectors.ts
  cards/       schema.ts, text.ts, tokens.ts, sets/<set>.ts
  decks/       themes.ts, validate.ts, codes.ts
  bots/        plan.ts, evaluate.ts, mulligan.ts
  modes/       duel.ts, run.ts, draft.ts, brawl.ts
  ui/          Board, Hand, Hero, Minion, Targeting, ChoiceOverlay, TurnLog, animations
```

`rules.ts` schrumpft zum dünnen Adapter auf `GameModule`.

### 5.7 So wird umgebaut, ohne das Spiel zu beschädigen

1. **Verhalten festschreiben:** Tests für alle 66 Karten und alle Sonderfälle gegen den heutigen Code, nachdem Phase 0 die gewollten Korrekturen enthält.
2. **Kern daneben bauen**, alte Karten in Daten übertragen, Tests müssen gleich bleiben.
3. **Abweichungen bewusst benennen:** Die neue Tod-Reihenfolge ist eine gewollte Änderung und bekommt eine `ruleVersion`.
4. **Alt löschen**, sobald `corepack pnpm check`, Rauchtest und Prüfstand grün sind.
5. **Online absichern:** Server und Web-App ziehen in einem CI-Lauf um. Für gespeicherte Räume wird ein Wandler oder ein sauberer Abbruch mit Hinweis gebaut.

**Phase 1 ist fertig, wenn** alle Karten als Daten laufen, Regeltexte erzeugt werden, in `rules.ts` keine kartenspezifische Abfrage mehr steht und eine neue einfache Karte ohne Regelcode auskommt.

## 6. Abdeckung: Was aus Hearthstone wohin kommt

Spalte „Name hier“ ist ein Vorschlag. Englische Begriffe bleiben im Code möglich.

### 6.1 Kartentypen und Held

| Vorbild | Name hier | Phase | Anmerkung |
|---|---|---|---|
| Diener | Tier | ✅ | |
| Zauber | Zauber oder Kniff | ✅ | je Schule |
| Heldenkraft | Hauskraft | 3 | eine je Haus, Kern der Identität |
| Rüstung | Rüstung | 3 | |
| Waffe | Rüstzeug (Lanze, Horn, Krallenschuh) | 3 | zeitlich begrenzter Heldenangriff; passt zum Turnier |
| Ort | Bau (Bienenstock, Biberdamm, Nest) | 7 | belegt einen Feldplatz, Abklingzeit |
| Geheimnis | Falle | 7 | im Hot-Seat nur mit Verdeckt-Bildschirm |
| Quest, Nebenquest | Aufgabe | 7 | Belohnung knapp halten |
| Inaktiv | Winterschlaf, Ei, Kokon | 7 | Raupe → Schmetterling, Drachenei |
| Heldenkarte | Ausgewachsener Herr | 10 | erst nach Bot-Messung |
| Titan, Alter Gott, Mehrfach-Fähigkeit | Sagentier | 10 | nur wenige Prachtkarten |

### 6.2 Dauerhafte Stichwörter

| Vorbild | Name hier | Phase | Vorbild-Tier |
|---|---|---|---|
| Spott | Beschützer | ✅ | Igel |
| Ansturm | Flink | ✅ | Gepard |
| Gottesschild | Schutzblase | ✅ | Krabbe |
| Verstohlenheit | Versteckt | ✅ | Luchs |
| Giftig | Giftig | ✅ | Skorpion |
| Kampfschrei | Auftritt | ✅, Ziel in 5 | |
| Todesröcheln | Abschied | ✅ | |
| Eifer | Sprinter | 4 | Hase |
| Windzorn | Doppelschlag | 4 | Kolibri |
| Lebensentzug | Lebenskraft | 4 | Blutegel |
| Einfrieren | Kältestarre | 4 | Pinguin |
| Schweigen | Beruhigen | 4 | Schaf |
| Wiederkehr | Zweite Chance | 4 | Eidechse, Katze |
| Zauberschaden | Naturkraft +X | 4 | Eule |
| Immun | Eingerollt | 4 | Gürteltier |
| Flüchtig | Scheu | 4 | Reh |
| Handelbar | Tauschen | 4 | Elster |
| Temporär | Flüchtige Karte | 4 | |
| Entdecken | Fährte suchen | 5 | Spürhund |
| Wählt aus | Wahlkarte | 5 | Wald-Haus |
| Combo | Rudeltaktik | 5 | Wolf |
| Überladung | Erschöpfung | 5 | Ochse |
| Außenseiter | Einzelgänger | 5 | Dachs; nur wenn auf dem Handy gut bedienbar |
| Kontern | – | zurückgestellt | Ohnmachtsgefühl |
| Spielbeginn | Turnierbeginn | 8 | mit Deckbau sinnvoll |

### 6.3 Erweiterungs-Mechaniken

Die Maschine soll sie alle tragen können, aber sie kommen als wechselnde Set-Themen ab Phase 10. Die erste Spalte nennt, was gut zum Thema passt.

| Eignung | Mechaniken (Vorbild → Name hier) |
|---|---|
| **Erste Sets** | Mutieren → Anpassen, Kolossal → Riesenwuchs, Minimieren → Jungtier, Manadurst → Reife, Finale → Punktlandung, Vorbereiten → Vorrat, Verwandt → Sippe, Ausgraben → Ausgraben, Zwillingszauber → Nachschlag, Raserei → Wütend, Jadegolem-Prinzip → Die Herde wächst |
| **Später** | Echo, Magnetisch → Huckepack, Rekrutieren → Herbeirufen, Bergen → Graben, Schmieden → Füttern, Schnellziehen, Ehrenhafter Sieg → Punktgenau, Verderben → Reifen, Zauberschub → Aufgeschreckt, Inspiration, Kündigt an → Rudelruf, Zurückspulen → Nochmal |
| **Nur umgedeutet** | Raumschiff → Nestbau, Dunkle Gabe → Gabe der Natur, Zusammenstellen → Mischwesen, Durchfluten → Trauerzug ohne Todesbild (etwa „Herdengedächtnis“) |
| **Nicht** | Leichen und Runen als Thema, Wutanfall (von Blizzard gestrichen), Tjost, Entzweien (Handordnung auf dem Handy), Touristen, Stehlen und Abwerfen im großen Stil |

### 6.4 Effektfamilien

Alle unter 5.2 genannten Effekte sind der erste Wortschatz. Damit decken wir laut Kompendium den Großteil der Familien ab: Rufen, Bedingung, Verstärken, Zufall, Ziehen, gezielter Schaden, Karten erzeugen, Kosten senken, Fläche, Vernichten, Heilen, Mana, Rüstung. **Sparsam** bleiben Kontrolle übernehmen, Eingriffe in die Gegnerhand und Kopieren gegnerischer Karten.

### 6.5 Grundregeln

| Regel | Heute | Plan | Phase |
|---|---|---|---|
| Handlimit | 7 | 10, Bedienung zuerst prüfen | 3 |
| Sternschnuppe bei 10 Mana | gedeckelt | darf 11 geben | 3 |
| Verbrennen, Erschöpfung | seit Phase 0 sichtbar | ✅ | 0 |
| Zuggrenze | seit Phase 1: unentschieden nach Zug 89 | ✅ | 1 |
| Helden greifen an | nein | mit Rüstzeug oder Hauskraft | 3 |
| Überzählige Tiere | seit Phase 1 mit Hinweis „Feld voll“ | ✅ | 1 |
| Zeit | 120/75/45 s plus Reserve | bleibt, dazu sichtbare Lunte | 2 |
| Zufallsdeck | seit Phase 0 höchstens 2 Kopien | ✅ | 0 |

## 7. Welt, Häuser und Familien

### 7.1 Die gemeinsame Sagenwelt

Brett & Blatt hat längst eine Welt, die nur noch verbunden werden muss: Das Konzept W-025 sieht das Gasthaus eines Fabeltier-Königreichs vor. **Vorschlag:** König Nobel, bekannt aus dem Narrenhof, ruft jedes Jahr das Turnier der Wappentiere aus, und wer es gewinnt, darf das Drachenei hüten. So bekommt auch der Name „Drachenspiel“ seinen Sinn, der in W-025 noch fehlt.

**Gäste aus unseren anderen Spielen** (eigene Kartenideen, keine neuen Regeln):

| Spiel | Beitrag |
|---|---|
| Narrenhof | König Nobel, Ritter Isegrim, Abt Esel, Eiskönigin und Hofnarr als Sagentiere; Faun, Waldfrau und Riese aus den Zauberwald-Gästen |
| Wölfe im Schafspelz | Hirte, Hütehund, Leithammel und Neugieriges Lamm; Karte „Wolf im Schafspelz“, die verkleidet erscheint |
| Enten-Rallye | Renn-Ente als schneller Spielstein |
| Mäxle, Würfelblock | Würfelfuchs als Bot-Figur und Zufallskarte mit klarer Anzeige |
| Schach, Dame, Mühle | „Springer“ als Pferd, das über den Beschützer greift; „Turm“ als Bau |
| Schiffe versenken | Admiral als Krabben-Kapitän, Flächenzauber „Breitseite“ |
| Skat, Schafkopf, Binokel | Eichel, Gras, Herz und Schellen als Wappen der vier Grundschulen |
| Wortgitter, Bibel-Quiz | Eule als Gelehrte, die Karten zieht; Abtei mit Physiologus-Tieren |

### 7.2 Quellen für freie Figuren

| Quelle | Inhalt | Status |
|---|---|---|
| **Reineke Fuchs** (Goethe, Tierepos) | Nobel Löwe, Reineke Fuchs, Isegrim Wolf, Gieremund Wölfin, Braun Bär, Hinze Kater, Grimbart Dachs, Lampe Hase, Henning Hahn | alt und frei; Lampe als Hase und einzelne Zuordnungen sind vor Gebrauch am Text zu prüfen |
| **Physiologus und Bestiarien** | Einhorn, Phönix, Pelikan, Greif, Basilisk, Taube, Hirsch; jeweils mit Moral verbunden | antike und mittelalterliche Überlieferung; moderne Ausgaben und Bilder nicht ungeprüft nutzen |
| **Heraldik** | Greif, Lindwurm, Doppeladler, Einhorn, Bär, Löwe; dazu Schildformen und Farben | Motive frei, konkrete Wappen nicht |
| **Äsop und Volksmärchen** | Hase und Igel, Rabe und Fuchs, Stadtmaus und Landmaus, Bremer Stadtmusikanten | Stoffe frei, moderne Übersetzungen nicht |
| **Sagen** | Riese, Zwerg, Faun, Dryade, Zentaur, Lindwurm von Klagenfurt | Narnia und andere moderne Fassungen bleiben außen vor |

Wegen der christlichen Schule passt der Physiologus besonders gut: Der Pelikan versorgt andere mit eigenem Leben, der Phönix kehrt zurück. Das lässt sich auch im Religionsunterricht aufgreifen. Das Haus Abtei soll einladen, aber nicht werten: kein Magieton, keine Glaubensaussage als Spielregel.

### 7.3 Ideen aus anderen Spielen

Das sind Anregungen aus meinem Vorwissen, nicht geprüfte Recherche; übernommen wird nur die Spielidee.

| Vorbild | Idee fürs Drachenspiel | Phase |
|---|---|---|
| Wingspan | Lebensräume: Karten sind Wald, Wiese oder Wasser zugeordnet; Tierwissen als Reiz | 6 |
| Root | Häuser spielen sich sehr verschieden | 6, 10 |
| Everdell, Cascadia | Bauten und Nachbarschaft als Belohnung | 7 |
| Slay the Spire | Wegekarte für den Solo-Lauf | 9 |
| Legends of Runeterra | Faire Zusatzkarten statt Kaufdruck | 8 |
| Marvel Snap | Wechselnde Turnierplätze mit Sonderregel | 10 |
| Gwent | Reihenplatz als Zusatzentscheidung; eher nicht, zu eng am Handy | geprüft, nein |

### 7.4 Elf Häuser statt elf Klassen

Die fünf Themendecks werden die ersten Häuser. Ein Haus hat einen Herrn, eine Hauskraft (2 Mana, Ausnahme angegeben), eigene Karten und eine klare Schwäche. Ein Rahmen mit neutralen Tieren steht allen offen.

| Haus | Vorbild | Herr (Vorschlag) | Hauskraft | Plan | Schwäche | Phase |
|---|---|---|---|---|---|---|
| 🌳 Wald (Eichenhain) | Druide | Grimbart Dachs | +1 Angriff im Zug, +1 Rüstung | Wachsen, Wahlkarten, viel Mana | wenig Entfernung | 6 |
| 🌊 Meer (Seefahrer) | Schamane | Kapitän Krabbe | zufälliger Gezeitenhelfer | Riesenwuchs, Erschöpfung gegen Wucht | Glücksanteil | 6 |
| 🚜 Bauernhof (Hahnfeld) | Paladin | Henning Hahn | ruft ein 1/1-Küken | Schwarm, Verstärken, Schutzblase | anfällig für Flächen | 6 |
| 🌍 Wildnis (Karawane) | Krieger | Elefantin Oda | 2 Rüstung | Rüstung, Rüstzeug, Sprinter | wenig Karten | 6 |
| 🐜 Krabbeltiere (Moorbach) | Schurke | Spinnfrau Mira | Kleiner Stachel: 1/2-Rüstzeug | Rudeltaktik, Gift, billige Züge | zerbrechlich | 6 |
| 🦅 Himmel | Magier | Eule Sophia | 1 Schaden an beliebigem Ziel | Wetterzauber, Kältestarre | wenig Körper | 10 |
| 🦁 Savanne | Jäger | Ritter Löwe | 2 Schaden am gegnerischen Helden | Tempo, Raubtiere | geht früh die Puste aus | 10 |
| ⛪ Abtei | Priester | Abt Esel | 2 Leben heilen | Heilen, Pflegen, langer Atem | wenig Schaden | 10 |
| 🐸 Moor | Hexenmeister | Kröte Unka | 1 Karte für 2 eigene Leben | Risiko gegen Karten | eigener Schaden | 10 |
| 🌙 Nacht | Dämonenjäger | Luchs Lumen (1 Mana) | +1 Angriff im Zug | Heldenangriffe, Einzelgänger | wenig Heilung | 10 |
| ❄️ Winter | Todesritter | Eiskönigin | 1/1 mit Flink, geht am Zugende | Kälte, Vorrat statt Leichen | langsam | 10 |

Die Werte stammen aus dem Kompendium und sind der Start für die Balance, kein Ergebnis. Die Namen sind Platzhalter bis zur Entscheidung.

### 7.5 Tierfamilien

Sie ersetzen Diener-Typen. Ein Tier kann zwei Familien haben. Da alle Karten Tiere sind, reicht „Wildtier“ nicht, die Familien müssen feiner sein.

| Familie | Tiere | Eigenart | Vorbild |
|---|---|---|---|
| **Rudel** | Wolf, Hund, Schakal, Fuchs | Rudeltaktik, mehr je Rudelmitglied | Wildtier, Pirat |
| **Katzen** | Katze, Luchs, Löwe, Tiger, Gepard | Versteckt, Flink, Einzelgänger | Wildtier |
| **Herde** | Schaf, Ziege, Pferd, Hirsch, Ochse, Esel | Beschützer, Verstärken, „Die Herde wächst“ | Murloc |
| **Geflügel und Vögel** | Hahn, Gans, Krähe, Storch, Adler, Pelikan | Scheu, Fährte suchen, Karten ziehen | Elementar |
| **Gräber** | Maus, Hamster, Maulwurf, Biber, Eichhörnchen, Dachs | Vorrat, Ausgraben, Bauten | Quilboar |
| **Krabbler** | Ameise, Biene, Käfer, Spinne, Raupe | Schwarm, Gift, Ei und Kokon | Mech (Teile) |
| **Kriechtiere und Lurche** | Frosch, Kröte, Eidechse, Schlange, Schildkröte | Zweite Chance, Gift, Kältestarre | Naga |
| **Meerestiere** | Krabbe, Krake, Hai, Wal, Robbe | Riesenwuchs, Zurückspülen | Murloc, Naga |
| **Riesen** | Elefant, Nashorn, Nilpferd, Bär, Giraffe | teuer, Rüstung, Sprinter | Drache |
| **Bauten** | Bienenstock, Biberdamm, Ameisenhügel, Nest | keine Angriffe, Dauerwirkung | Totem, Ort |
| **Sagentiere** | Greif, Einhorn, Phönix, Basilisk, Lindwurm, Hippogryph | Prachtkarten mit Geschichte | Legendär |
| **Drachen** | Jungdrache, Drachenmutter, Eidrache | „Hast du einen Drachen auf der Hand?“, Drachenei | Drache |
| **Waldvolk** | Waldfrau, Faun, Waldschrat, Kobold | Helfer aus der Sagenwelt ohne dunkles Bild | Treant |

### 7.6 Zauberschulen und Beispielzauber

Acht Schulen, jede mit einem Hauptbereich. Vorhandene Zauber bleiben.

| Schule | Stärke | Haus | Beispiele (✓ vorhanden, Rest Vorschlag) |
|---|---|---|---|
| ⚡ **Sturm** | gezielter Schaden, verteilter Schaden | Himmel, Wildnis | ✓ Blitzschlag, ✓ Wirbelsturm, Hagelschauer, Kugelblitz |
| ❄️ **Frost** | Kältestarre, Tempo | Winter, Himmel | Raureif, Eisscholle, Lawine |
| 🌊 **Wasser** | Zurückspülen, Heilung | Meer | ✓ Flutwelle, ✓ Seifenblase, Strudel, Gezeitenwechsel |
| 🌿 **Kräuter** | Heilung, Gift | Abtei, Moor | Heilkraut, Tollkirsche, Kamillentee |
| 🌱 **Wachstum** | Verstärken, Mana | Wald, Bauernhof | ✓ Wachstumsschub, ✓ Honigtopf, Mondscheinernte, Saatkorn |
| ☀️ **Licht** | Schutz, Beruhigen | Abtei, Bauernhof | Sonnenaufgang, Morgentau, Stille Stunde |
| 🌙 **Mond** | Täuschung, Versteckt, Karten | Nacht, Krabbeltiere | Nebelbank, Traumfänger, Schattenspiel |
| 🔥 **Glut** | Fläche, Risiko | Savanne, Drachen | Funkenflug, Steppenbrand, Drachenatem |

Dazu **Kniffe** ohne Schule: ✓ Rückenwind, ✓ Glücksklee, ✓ Sommerregen werden zugeordnet; Spurenlesen (Fährte suchen), Vorratskammer, Lockruf, Fallgrube (Falle), Maskerade (Falle), Falscher Alarm (Falle).

### 7.7 Werte-Maßstab für neue Karten

Aus dem Kompendium, als Startwert für den Kartentest:

| Kosten | Werte ohne Text | Werte mit Fähigkeit im Schnitt |
|---|---|---|
| 1 | 3–4 | 3 |
| 2 | 5 | 4–5 |
| 3 | 7 | 6 |
| 4 | 9 | 8 |
| 5 | 11 | 9 |
| 6 | 13 | 10 |
| 8 | 16 | 13–14 |
| 10 | 20 | 16–17 |

**Abschläge (Werte):** Beschützer etwa 1, Versteckt, Sprinter, Lebenskraft etwa 1, Zweite Chance, Giftig, Schutzblase, Doppelschlag etwa 2, Flink etwa 3. Diese Zahlen beruhen auf kleinen Stichproben. Der Prüfstand entscheidet am Ende.

**Seltenheit:** Gewöhnlich, Selten, Episch und Sagentier begrenzen nur den Deckbau und die Komplexität. Sie haben nichts mit Zufall zu tun.

## 8. Oberfläche und Spielgefühl

Das Vorbild trägt auch die Rahmung. Vieles davon kostet keine Regeln und lässt sich früh bringen.

| Baustein | Phase |
|---|---|
| `ui/index.tsx` weiter aufteilen (Phasen sind seit Phase 0 getrennt) | 2 |
| Zielpfeil beim Ziehen und Hervorhebung erlaubter Ziele | 2 |
| Karte groß ansehen (langes Drücken, Tastatur) | 2 |
| Spielverlauf der letzten Aktionen | 2 |
| Animationsreihe nach Ereignissen, damit lange Ketten nachvollziehbar bleiben; beschleunigte Wiedergabe | 2 |
| Verletzte Werte rot, verstärkte grün | 2 |
| Eigene Bilder für Rufen, Verstärken, Zurückspülen, Heilung, Verbrennen und Erschöpfung | 0, 2 |
| Lunte bei wenig Restzeit, leuchtender Zug-Knopf, wenn nichts mehr geht | 2 |
| Tierrufe: 6 vertonte Sätze statt Chat (Danke, Gut gemacht, Hallo, Wow, Hoppla, Grr) | 2 |
| Klickbare Feldecken je Haus (Hahn kräht, Biberdamm bricht) | 6 |
| Mehr Wucht bei teuren Karten: Einschlag, Kamerazittern, nur ohne `prefers-reduced-motion` | 6 |
| Wirtsstimme: Begrüßung, Ansage, Lob; nur nach Auswahl durch Cornelius | 9 |
| Stimmungstext je Karte: `quote` zum witzigen Flavor-Text ausbauen | 6 |
| Hand bis 10 mit dem `CardFan` (`minStep`), Feld bis 7 auf 390 px | 3 |
| Hot-Seat: Abdeckbildschirm vor jedem Zug, sonst sieht jeder alles | 7 |

**Bezug zu W-025:** Die dort offene Frage bleibt offen (Knappen oder Mana, Wimpel oder Leben). Durch die Texterzeugung aus Daten genügt später ein Wörterbuch; darum darf das Thema vor oder nach jeder Phase kommen.

## 9. Bot

Das Spiel wird nur so gut, wie ein Bot es vorführt. Das Hauptwerkzeug ist **ein Planer für den ganzen Zug**:

1. **Verdeckte Karten ziehen** mehrmals aus einem korrekten `sampleHidden`.
2. **Zugfolgen suchen** mit einer Strahlsuche: Nur die besten 8 bis 20 Zwischenstellungen werden weiterverfolgt.
3. **Bewerten:** Brett, Hand, Leben, Tod im nächsten Zug, Mana-Ausnutzung, je Stichwort und Karte eigene Werte. Die Bewertung wird aus den Karten abgeleitet, damit neue Karten nicht jedes Mal von Hand eingetragen werden.
4. **Erster Zug des besten Plans** wird gespielt. `BOT_STEP_MS` in `apps/server/src/bots.ts` bekommt einen gemessenen Eintrag.

| Stufe | Verhalten |
|---|---|
| Leicht | spielt plausibel, greift aber schlecht an und übersieht Chancen |
| Mittel | plant den Zug mit kurzer Suche und erkennt tödlichen Schaden |
| Schwer | mehrere Stichproben, bewertet auch die mögliche Gegenantwort, klug beim Kartentausch zu Beginn |

Für **Wahlen, Fallen und Dauereffekte** gibt es Regeln und Vertragsprüfungen in Phase 5 und 7. Der Bot darf nie den Zustand der Hand des Gegners oder den Zufallsspeicher lesen.

**Maßstab je Phase:** Schwer schlägt Mittel klar, Mittel schlägt Leicht klar, unter 1,5 s je Zug auch auf Cloudflare; der Prüfstand prüft das.

## 10. Prüfnetz und Balance

| Prüfung | Prüft | Ab |
|---|---|---|
| Kartentest über alle Karten | Schema, Regeltext, Werte-Maßstab, keine Waisen-Effekte | 1 |
| Reihenfolge-Tests | feste Ketten aus Tod, Abschied, Auslösern | 1 |
| Eigenschaftstests | Leben nie unbemerkt unter 0, höchstens 7 auf dem Feld, höchstens 10 auf der Hand, Partie endet, Warteschlange leer am Zugende | 1 |
| `gameContractChecks` | Geheimnisse, kein `rng` in Sichten, `sampleHidden` | laufend |
| Prüfstand: Häuser-Matrix | jede Paarung Haus gegen Haus über viele Partien | 3 |
| Startvorteil | 45–55 % bei gleichstarken Bots, je Paarung | 3 |
| Kartennutzung | Karten, die nie gespielt werden oder zu oft gewinnen | 6 |
| Rauchtest im Handy-Hochformat | sieben Tiere, zehn Karten, keine Überläufe | 3 |
| Test mit Menschen | Partie mit Kindern: Verstehen sie, warum sie verloren haben? | 4, 6, 9 |

Das bleibt Handarbeit: **Bots messen nur Bots.** Die Klasse 6c oder eine AG wäre der beste Test, wenn Cornelius das möchte.

## 11. Fahrplan im Einzelnen

Aufwand grob: **S** bis ein Arbeitsgang, **M** mehrere, **L** viele. Jede Phase bekommt einen Zweig, Tests, `corepack pnpm check`, `corepack pnpm rauchtest`, `PRUEFSTAND=1 PRUEFSTAND_SPIELE=drachenspiel corepack pnpm pruefstand` und einen Blick im Browser.

### Phase 0: Fehler und Messung (S) ✅ umgesetzt, Stand in `drachenspiel.md`

- F-009: Absturz beim Partiestart; F-007: Mischen über den Partie-Seed; F-008: Texte richtigstellen.
- Zufallsdeck: Thema `mixed`, Kopiengrenze, `sampleHidden` aus dem richtigen Pool.
- Anzeige: Verbrennen, Erschöpfung, `heroHealed`; Zauber im Mulligan mit Text.
- Doku angleichen: Bär, Küken, Gorilla; Bot-Beschreibung; 30 Tierkarten.
- Startvorteil neu gemessen: 58 % im Spiegel „schwer“.

### Phase 1: Regelkern (L)

Siehe Kapitel 5. Keine neuen Karten, nur die gewollte Tod-Reihenfolge. **Fertig** gemäß 5.7.

✅ **Umgesetzt (01.11.2026, `ruleVersion` 4).** Bewusst verschoben, weil noch keine Karte es braucht: `pending` und der Zug `choose` kommen mit Phase 5, Auslöser neben „gespielt“ und „geht vom Feld“ sowie weitere Effekte mit der jeweils ersten Karte. Die Dateien liegen unter `src/core/`; `cards.ts`, `decks.ts` und `bots.ts` bleiben vorerst an ihrem Ort, statt die Aufteilung aus 5.6 schon ganz umzusetzen.

### Phase 2: Bedienung und Bot-Planer (M)

UI aufteilen, Zielpfeil, Verlauf, große Karte, Animationsreihe, Tierrufe, Lunte; Bot-Planer aus Kapitel 9. **Fertig, wenn** Schwer spürbar besser spielt und Ketten sichtbar nachvollziehbar sind.

✅ **Umgesetzt (01.11.2026).** Noch offen: Vertonung der Tierrufe (wartet auf Auswahl durch Cornelius), eigene Bilder für Verbrennen und Erschöpfung (bisher Hinweistext), Mittel schlägt Leicht mit 97 % sehr deutlich. Der Startspieler liegt im Spiegel „schwer“ noch bei 60 %; das ist Aufgabe von Phase 3.

### Phase 3: Held und Grundregeln (M)

Hauskräfte für die fünf Häuser, Rüstung, Rüstzeug, Heldenangriff, Hand 10. Neue Option „Klassische Regeln“ nur, wenn die Tests zeigen, dass der Wechsel Spielende verwirrt. **Fertig, wenn** der Startspieler im Bot-Spiegel zwischen 45 und 55 % liegt; sonst Sternschnuppe und Starthand nachjustieren.

✅ **Umgesetzt (01.11.2026, `ruleVersion` 5).** Startspieler bei freier Deckwahl: schwer 54 %, mittel 52 %, leicht 46 %. Dafür brauchte es einen Ausgleich, den der Plan nicht vorsah: Wer als Zweiter beginnt, startet mit 5 Rüstung. Rüstzeug gibt es bisher nur über die Hauskraft der Krabbeltiere, Rüstzeug-Karten kommen mit dem Grundset (Phase 6). Mit festem Deck streut der Startvorteil noch (siehe `drachenspiel.md`); das gehört zur Häuser-Matrix in Phase 6.

### Phase 4: Dauerhafte Stichwörter (M)

Sprinter, Doppelschlag, Lebenskraft, Kältestarre, Beruhigen, Zweite Chance, Naturkraft, Eingerollt, Scheu, Tauschen, Flüchtige Karte. Flink bleibt Sofortangriff, auch auf den Helden. Erste 3 bis 5 Karten je Stichwort, teils durch Überarbeiten textloser Tiere. **Fertig, wenn** kein Haus mehr als 30 % textlose Tiere hat.

✅ **Umgesetzt (01.11.2026, `ruleVersion` 6).** Namen wie in Kapitel 6.2, von Cornelius am 01.11.2026 freigegeben. Beruhigen und Kältestarre als gezielte Wirkung gibt es vorerst nur über Zauber, weil Auftritte mit Ziel erst mit Phase 5 kommen. Das Tierteil bleibt bei den Vorbildern des Plans teils anders besetzt (Plan-Tiere wie Pinguin oder Kolibri gibt es noch nicht), Karten dazu kommen mit dem Grundset.

### Phase 5: Entscheidungen (M)

Auftritte mit Ziel, Fährte suchen, Wahlkarten, Anpassen, Rudeltaktik, Erschöpfung, Einzelgänger, tierische Kartenzieher. Bot und Zeitablauf für `pending`. **Fertig, wenn** jedes Deck in fast jedem Zug eine echte Wahl bietet.

✅ **Umgesetzt (01.11.2026, `ruleVersion` 7).** Einzelgänger ist drin, weil die Hand jetzt ohne Scrollen sichtbar bleibt. Die Wahl-Messung ist grob: 89 bis 98 % der Züge beginnen mit mindestens zwei verschiedenen möglichen Aktionen (Bot „mittel“); ob sie sich auch für Menschen wie echte Entscheidungen anfühlen, misst das nicht.

### Phase 6: Familien und Grundset (L)

Etwa 30 Karten je Haus plus 30 neutrale, also rund 180 Karten; Familien, Schulen, Seltenheit, Sagentiere. Passende Themendecks neu. Feldecken und erste Bilder für die Häuser. **Fertig, wenn** die Häuser-Matrix ausgeglichen ist: keine Paarung außerhalb von 40–60 %.

### Phase 7: Neue Kartentypen (L)

Bauten, Fallen, Aufgaben, Winterschlaf und Ei, Abdeckbildschirm im Hot-Seat. Drachenei als Option oder Aufgabe mit dem eigenen W-025-Prüfschritt. **Fertig, wenn** Geheimnis-Prüfungen grün sind und der Bot Fallen nicht „durchschaut“.

### Phase 8: Deckbau ohne Kauf (M)

- 30 Karten, höchstens 2 Kopien, 1 je Sagentier, ein Haus plus neutrale Karten.
- Alle Karten sind frei verfügbar. Es gibt keine Sammlung, die man kaufen muss.
- Decks in `localStorage`, teilen per Deck-Code und QR wie in der Lobby; online prüft der Server jedes Deck.
- **Sicherung über Geräte wie beim Narrenhof (W-050):** Sicherungscode, QR-Link und Passkey, im Browser verschlüsselt, ohne Konto. Gesichert werden ab hier die eigenen Decks, ab Phase 9 auch der Fortschritt.
  - **Wiederverwenden:** Der Server (`GET`/`PUT /sicherung/<Kennung>`, `BackupVault`) bleibt unverändert, denn er sieht nur verschlüsselte Blöcke. `syncCrypto.ts` und die Abläufe aus `sync.ts` liegen heute im Narrenhof und wandern in einen gemeinsamen Baustein; das Spiel liefert nur noch Speicherschlüssel, Zusammenführen und Link. Das Salt des Narrenhofs bleibt wortgleich, sonst wären dessen Sicherungen nicht mehr lesbar.
  - **Ein Code für alle Spiele (Entscheidung Cornelius, 01.11.2026):** Der Code gilt für die ganze Plattform, jedes Spiel legt aber einen eigenen Block ab. Der Narrenhof behält seine heutige Ableitung, das Drachenspiel leitet aus demselben Code mit eigenem Salt eine eigene Kennung und einen eigenen Schlüssel ab. Dadurch müssen vorhandene Sicherungen nicht umziehen, alte Codes und Passkeys gelten weiter, und die Spiele kommen sich weder bei der Größengrenze noch beim gleichzeitigen Schreiben (`rev`) in die Quere.
  - **Dafür ändert sich:** Code und Passkey-Liste gelten je Gerät für alle Spiele, der Speicherschlüssel `brett-und-blatt:farbensortierer:sicherung` wird dafür mitbenutzt oder mit Übernahme verlegt. Beim Eingeben eines Codes reicht ein Block irgendeines Spiels als Beleg, denn heute meldet `connectSync` sonst „keine Sicherung“, wenn der Code aus einem anderen Spiel stammt; fehlt der Block des aktuellen Spiels, wird er angelegt. Der QR-Link darf nicht mehr fest auf `color-sorter` zeigen, der Passkey-Name nicht mehr „Narrenhof-Fortschritt“ heißen. Verschwinden kann ein Block weiter einzeln nach 400 Tagen ohne Zugriff, der Abgleich sollte deshalb alle Blöcke des Geräts anfassen.
  - **Zusammenführen:** Decks je Kennung, die jüngste Änderung gewinnt; gelöschte Decks bleiben als Löschvermerk stehen, damit ein anderes Gerät sie nicht zurückbringt. Der Stand trägt eine Formatversion und muss unter die Grenze von 64 KB passen.
  - **Datenschutzerklärung** um das Drachenspiel ergänzen.
- Fertige Vorschlagsdecks für den Einstieg; Lehrkraft kann einer Klasse ein Deck vorgeben.
- **Fertig, wenn** ein Kind in unter 5 Minuten ein eigenes Deck spielen kann.

### Phase 9: Solo und Langzeit (L)

- **Übungsweg:** 6 bis 8 geführte Kämpfe, jeder führt eine Sache ein: Mana, Abtausch, Beschützer, Hauskraft, Zauber, Wahl.
- **Wanderschaft** nach Dungeon-Run-Art: Wegekarte durch das Königreich, 8 Gegner mit Sonderregeln, nach jedem Sieg Kartenbündel und Schatz, Niederlage beendet den Lauf. Der Stand läuft über die Sicherung aus Phase 8 (W-050). Fortschritt wie Turnierbuch und Bestwerte führt ein Zählerbuch je Gerät zusammen wie beim Narrenhof (`mergeProgress`), damit auf keinem Gerät etwas verloren geht.
- **Turnier** nach Arena-Art: aus je 3 angebotenen Karten ein Deck, bis 5 Siege oder 2 Niederlagen, kostenlos.
- **Turnierbuch:** Aufgaben („Gewinne mit jedem Haus“), Belohnung nur Kartenrahmen und Wappen, feste Reihenfolge, nie zufällig.
- **Klassenturnier:** Turnierbaum im Raum als Ausblick, nur nach eigener Prüfung; Online-Raum bleibt heute auf 2 Plätze begrenzt.

### Phase 10: Dauerhafter Ausbau (laufend)

Die sechs weiteren Häuser, jährliche Sets mit 2 bis 3 Mechaniken aus 6.3, Heldenkarten, Sagentiere mit mehreren Fähigkeiten, wöchentliche Sonderregeln wie Tavern Brawl. **Battlegrounds und Mercenaries** bleiben außen vor; beide sind praktisch eigene Spiele und könnten später eigene Module werden.

### Was man parallel laufen lassen kann

Sobald Phase 1 fertig ist, kann parallel an Thema, Oberfläche und Karten gearbeitet werden. Vorher nicht, denn jeder andere Umbau träfe Dateien, die Phase 1 neu schreibt.

## 12. Technische und inhaltliche Risiken

| Risiko | Gegenmittel |
|---|---|
| Phase 1 wird zu groß | Abbruchpunkte: erst Zufall und Queue, dann Veränderungen, dann Karten-Daten; nach jedem Schritt grün |
| Spielstand wächst, langsamer im Bot wegen `JSON`-Kopie | Messen, Karten nur per Kennung, Kopie gezielt statt ganzer Baum |
| Online: Server und Web-App laufen auseinander | gleicher CI-Lauf; Wandler oder Hinweis bei alten Räumen |
| Paketgröße | Kartendaten bleiben klein, Bilder bei Bedarf laden wie die Tierstimmen |
| Kinder überfordert | Häuser mit Stufenangabe („leicht zu spielen“); Regel-Option „Einsteiger“ ohne Fallen und Wahlkarten |
| Zu wenig Stimmen und Bilder | Emoji bleibt tragfähig; Stimmen und gemalte Karten sind freiwillig |
| Balance frisst Zeit | Prüfstand zuerst, Einzelwerte erst danach |
| Inhalt wird beliebig | je Karte ein Tierbezug, Humor über `quote`, Faktenbezug wie bei Wingspan |

## 13. Entscheidungen für Cornelius

| Frage | Mein Vorschlag | Ab wann nötig |
|---|---|---|
| Wie nah am Regelwerk? | Regeln wie im Vorbild, eigene Welt, Hand 10 | Phase 3 |
| Sprache: Mana oder Knappen, Leben oder Wimpel? | Mana und Leben behalten, Turnier nur als Rahmen; verständlicher für Kinder und im Unterricht | vor W-025 Schritt 3 |
| Namen der Stichwörter und Häuser | Tabelle in Kapitel 6 und 7 als Start | Phase 4 |
| Abtei und Physiologus im Spiel? | ja, mit Zurückhaltung | Phase 10 |
| Bilder: Emoji oder gemalte Karten? | erst Emoji, Sagentiere zuerst malen | Phase 6 |
| Kosmetik im Turnierbuch freischalten? | ja, nur durch Spielen | Phase 9 |

## 14. Quellen und Belege

- **Hearthstone:** Bericht und Kompendium im privaten Repo, dort mit einzelnen Quellen; Kartendaten von [HearthstoneJSON](https://hearthstonejson.com/).
- **Reineke Fuchs:** [Goethe bei Project Gutenberg](https://m.gutenberg.org/ebooks/2228), [Meyers Konversationslexikon bei Wikisource](https://de.wikisource.org/wiki/MKL1888:Reineke_Fuchs).
- **Bestiarien:** [Wikipedia: Bestiary](https://en.wikipedia.org/wiki/Bestiary), [Catholic Encyclopedia: Bestiaries](https://www.catholic.com/encyclopedia/bestiaries).
- **Nicht eigens recherchiert:** Heraldik, Äsop, Märchen und die Spiele aus 7.3 stammen aus Vorwissen. Rechte an einzelnen Ausgaben sind bei jeder Übernahme zu prüfen.
- **Zahlen:** Werte-Maßstab und Häuser-Werte sind Startwerte, Stichproben klein. Der Plan ist nicht gegen laufenden Code getestet, weil noch nichts davon gebaut ist.
