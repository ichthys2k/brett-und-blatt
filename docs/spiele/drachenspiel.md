# Drachenspiel

| Steckbrief | |
|---|---|
| Spieler | 2 |
| Dauer | 10–20 Minuten |
| Modi | Solo gegen Bot, Hot-Seat, online |
| Muster | verdeckt (Handkarten, Deck) mit gleichzeitiger Startphase (Deckwahl, Mulligan) |
| Bausteine | Karten-Baukasten, Phasen-Timer, flüchtige Signale |
| Aufwand | Regeln L, Oberfläche L, Bot M |
| Etappe | 6 (Eigene Spiele) |
| Vorlage | Cornelius' Klon „Drachenspiel“ (`~/code/emojiclicker/minigames/drachenspiel/`, nur als Vorlage lesen) |

Sammelkarten-Duell nach dem Vorbild von Hearthstone mit Tierkarten, Mana-Kristallen von 1 bis 10 und 30 Leben für jeden Helden. Ohne Glücksspiel-Anmutung, mit kinderfreundlicher Sprache („geht vom Feld“ 💨 statt stirbt).

## Regeln

- **Helden:** Jeder startet mit 30 Lebenspunkten. Sinkt ein Held auf 0 oder weniger, gewinnt der andere.
- **Mana:** Zu Beginn jeder Runde erhält der aktive Spieler einen neuen Manakristall (bis maximal 10) und füllt sein gesamtes Mana auf.
- **Deck & Hand:** 
  - Jedes Deck enthält 30 Karten.
  - Handkartenlimit: 7 Karten. Wer eine Karte bei voller Hand ziehen müsste, verbrennt sie.
  - Leeres Deck: Müdigkeit fügt dem Helden 1, 2, 3 … Schaden pro überzogenem Zug zu.
- **Start:**
  - Wer beginnt, entscheidet der Zufall (Seed).
  - Spieler 1 erhält 3 Karten.
  - Spieler 2 erhält 4 Karten plus ⭐ Sternschnuppe (0 Mana: +1 Manakristall für diese Runde).
  - **Mulligan:** Beide Spieler dürfen gleichzeitig beliebig viele ihrer Startkarten einmalig ins Deck zurücklegen und neue ziehen.
- **Kampf & Ablauf:**
  - Eigene Tiere können gegnerische Tiere oder direkt den gegnerischen Helden angreifen.
  - **Einsatzpause:** Neu ausgespielte Tiere dürfen erst in der nächsten Runde angreifen (außer bei ⚡ Flink).
  - **Schadensausgleich:** Beim Angriff von Tier gegen Tier tauschen beide ihren Angriffswert als Schaden aus.
  - Schaden bleibt auf Tieren bestehen. Sinkt das Leben eines Tiers auf 0 oder weniger, geht es vom Feld 💨.

### Fähigkeiten (Stichwörter)

| Zeichen | Name | Wirkung |
|---|---|---|
| 🛡️ | Beschützer | Muss angegriffen werden, bevor andere Ziele gewählt werden dürfen. |
| ⚡ | Flink | Darf direkt in der Runde des Ausspielens angreifen. |
| 🫧 | Schutzblase | Verhindert die erste Schadensinstanz komplett, platzt danach. |
| 🧪 | Giftig | Jedes Tier, das von diesem Tier Schaden nimmt, geht sofort vom Feld. |
| 🌙 | Versteckt | Kann nicht als Ziel gewählt werden, bis es selbst einmal angreift. |
| 🎺 | Auftritt | Löst beim Ausspielen einen Soforteffekt aus. |
| 👋 | Abschied | Löst einen Effekt aus, wenn das Tier das Feld verlässt. |

### Themendecks

- 🌳 **Wald:** Ausgewogene Tiere, Biber, Igel, Eule, Fuchs und Drache.
- 🌊 **Meer:** Schutzblasen und Zähigkeit (Krabbe, Kugelfisch, Tintenfisch, Krake).
- 🚜 **Bauernhof:** Gegenseitige Verstärkung und Schnelligkeit (Hahn, Hund, Schwein).
- 🌍 **Wildnis:** Große, wuchtige Tiere für das späte Spiel (Elefant, Nashorn, Nilpferd).
- 🐜 **Krabbeltiere:** Schnelle Angriffe, Gift und Flinkheit (Ameise, Mücke, Spinne, Skorpion).

## Spielmodell

```ts
export type Phase = 'deckSelection' | 'mulligan' | 'play' | 'ended';

export interface DrachenspielState {
  phase: Phase;
  activeSeat: SeatId;
  turn: number;
  players: [PlayerState, PlayerState];
  startingSeat: SeatId;
  nextEntityId: number;
  rng: RngState; // aus dem Seed abgeleitet, nie in einer Sicht
  queue: QueuedEffect[]; // Warteschlange der Effekte, am Ende jeder Aktion leer
  options: Options;
}
```

## Bots

- **Leicht:** Legt und greift wahllos an, beendet den Zug nur selten vorzeitig.
- **Mittel:** Plant den ganzen Zug mit kurzer Strahlsuche und der einfachen Bewertung `evaluate`, findet so auch tödlichen Schaden über mehrere Angriffe.
- **Schwer:** Plant den ganzen Zug über drei Stichproben der verdeckten Karten (`src/planner.ts`), bewertet aus den Kartendaten und prüft die besten Pläne gegen eine einfache Antwort des Gegners.

## Umsetzung (Oktober 2026)

- `packages/games/drachenspiel/src/cards.ts`: 54 Tierkarten-Definitionen (Angriff, Leben, Mana, Zitate, Fähigkeiten, Klangzuordnungen) plus Sternschnuppe ⭐ und Token (Ameise, Schmetterling).
- `packages/games/drachenspiel/src/decks.ts`: 5 balancierte Themendecks à 30 Karten (Wald, Meer, Bauernhof, Wildnis, Krabbeltiere).
- `packages/games/drachenspiel/src/rules.ts`: Vollständige Spielregeln (Deckauswahl, Mulligan, Rundenphasen mit Manazuwachs, Ausspielen, Kampf mit Beschützer/Schutzblase/Giftig/Versteckt/Auftritt/Abschied, Müdigkeit, reines JSON für Zustand und Sichten, `playerView`, `sampleHidden`, `eventView`).
- `packages/games/drachenspiel/src/bots.ts`: Drachenhüter-Bot in drei Schwierigkeitsstufen (leicht, mittel, schwer) mit Bedenkpausen (`delayMs`) für Angriffe (600–750 ms) und Kartenausspielen (400–500 ms) zur vollständigen Visualisierung von Zügen.
- `packages/games/drachenspiel/src/ui/`: Arena-Oberfläche mit Deckauswahl, Mulligan-Tausch-Auswahl, Mana-Anzeige, Helden-Porträts, Tier-Kampffeld, Zielauswahl-Hervorhebung und Zug-beenden-Button. Zielgerichtete Vektor-Angriffsanimationen (Karten bewegen sich direkt auf die angegriffene Figur bzw. den Helden zu), synchrone Erhaltung besiegter Tiere zur Anzeige von Schaden und Treffer-Shake vor dem sanften Verblassen, aufsteigende Schadens- und Heilungsanzeigen, platzende Schutzblasen und Karteneffekte (Drop beim Ausspielen, Deal beim Ziehen).
- Sound-Effekte: Vollständige Übernahme der Originalsounds aus dem Vorlagen-Klon (`ds_snip`, `ds_swipe`, `ds_punch1`, `ds_punch2`, `ds_flipcard`) sowie Tierstimmen on-demand (`klaenge/tiere/`, Zuordnung in `ui/audio.ts`, nicht jedes Tier hat eine) beim Ausspielen, Angreifen, Ableben und Anklicken auf dem Spielfeld (Easter-Egg).
- Server-Registrierung: In `apps/server/src/games.ts` und `apps/server/package.json` als Online-Mehrspieler-Spiel registriert.

## Offene Punkte

- Ausbauplan zum vollwertigen Sammelkarten-Duell: [`drachenspiel-ausbau.md`](drachenspiel-ausbau.md) (W-044).
- ✅ Zauberkarten (31.10.2026, W-004, siehe unten). Offen: Heldenkräfte (Stufe D), eigener Zauberklang (derzeit `stapel-fertig`, Auswahl durch Cornelius).

## Zauberkarten (31.10.2026, W-004, `ruleVersion` 2)

Neun eigene Naturzauber (`SPELLS_DB` in `src/cards.ts`, Kennungen `s_…`), einmalig, gehen nach dem Wirken aus dem Spiel. Option „Zauberkarten“ (Standard an): Jedes Themendeck tauscht drei Tierpaare gegen drei Zauberpaare (`spellSwap` in `src/decks.ts`), das gemischte Deck hat 24 Tiere und 6 Zauber.

| Zauber | Mana | Ziel | Wirkung | Decks |
|---|---|---|---|---|
| ⚡ Blitzschlag | 2 | gegnerisches Tier oder Held | 3 Schaden | Wildnis, Krabbeltiere |
| 🍯 Honigtopf | 1 | eigenes Tier | +2/+2 | Wald, Bauernhof |
| 🍃 Rückenwind | 1 | eigenes Tier | +1 Angriff, darf sofort angreifen | Wildnis, Krabbeltiere |
| 🫧 Seifenblase | 1 | eigenes Tier | Schutzblase | Meer |
| 🌱 Wachstumsschub | 3 | – | alle eigenen Tiere +1/+1 | Wald, Bauernhof |
| 🌦️ Sommerregen | 2 | – | Held +3 Leben, eigene Tiere ganz geheilt | Meer, Bauernhof |
| 🍀 Glücksklee | 2 | – | zwei Karten ziehen | Wald, Krabbeltiere |
| 🌊 Flutwelle | 3 | gegnerisches Tier | zurück auf die Hand des Besitzers (Spielsteine und volle Hand: weg) | Meer |
| 🌪️ Wirbelsturm | 4 | – | 2 Schaden an allen gegnerischen Tieren | Wildnis |

- **Zug:** `{ type: 'playCard', handIndex, target? }`; `legalMoves` liefert je Ziel einen Zug (`spellTargets`). Versteckte Gegner sind kein Ziel, Schutzblasen fangen Blitzschlag und Wirbelsturm ab. Ereignis `spellCast`.
- **Oberfläche:** Zauberkarten violett mit Regeltext. Zauber ohne Ziel antippen oder aufs Feld ziehen; Zauber mit Ziel antippen (Hinweisleiste mit „Abbrechen“) und das leuchtende Ziel antippen – oder die Karte direkt aufs Ziel ziehen.
- **Bots:** Leicht zufällig, mittel nach Kosten, schwer bewertet jeden Zug samt Ziel mit `evaluate`.

## Fundament-Korrekturen (01.11.2026, Phase 0 des Ausbauplans, `ruleVersion` 3)

- **Absturz beim Partiestart behoben (F-009):** `Board` rief Hooks nach bedingten Rücksprüngen auf. Sobald die Partie nach Deckwahl oder Kartentausch begann, blieb die Seite leer. Jede Phase ist jetzt eine eigene Komponente; der Rauchtest spielt bis auf die Spielfläche (`firstSteps` in `scripts/rauchtest.mjs`).
- **Mischen (F-007):** Der Spielstand führt den Zufallsstrom `rng`; Deckwahl und Kartentausch mischen daraus. Vorher waren Starthand und Deckanfang je Thema und Startspieler in jeder Partie gleich.
- **Texte (F-008):** Flink darf ausdrücklich auch den Helden angreifen, der Kugelfisch trifft gegnerische Tiere.
- **Gemischtes Deck:** Thema `mixed`, höchstens zwei Kopien, Fuchs und Drache je eine.
- **Anzeige:** Hinweis bei Verbrennen und Müdigkeit, Heilzahl am Helden mit der wirklich geheilten Menge, Zauber im Kartentausch mit Text.

### Startvorteil (300 Bot-Partien je Zeile, Standardoptionen)

Abruf: `DRACHEN_BALANCE=1 corepack pnpm exec vitest run packages/games/drachenspiel/test/balance --disable-console-intercept`

| Paarung (Deckwahl zufällig) | Startspieler gewinnt | Ø Züge gesamt |
|---|---|---|
| Schwer gegen Schwer | 58 % (vorher 77 %) | 14,7 |
| Mittel gegen Mittel | 54 % (vorher 63 %) | 21,0 |
| Leicht gegen Leicht | 47 % | 30,7 |

Stufen: Schwer schlägt Mittel zu 90 %, Mittel schlägt Leicht zu 73 %. Festes Deck, Schwer gegen Schwer: Wald 65 %, Wildnis 65 %, Bauernhof 58 %, Krabbeltiere 54 %, Meer 53 %. Die Stichprobe ist klein (bei 300 Partien etwa ±6 Prozentpunkte), und es sind nur Bots. Der frühere Wert von 77 % ging großteils auf den Mischfehler zurück. Bei guten Bots bleibt ein leichter Vorteil, das Ziel 45–55 % ist also noch nicht ganz erreicht.

## Regelkern (01.11.2026, Phase 1 des Ausbauplans, `ruleVersion` 4)

- **Karten sind Daten:** `keywords`, `triggers` und bei Zaubern `effects` aus dem Wortschatz in `types.ts` (`Effect`, `Selector`). Eine neue Karte aus vorhandenen Effekten braucht keinen Regelcode.
- **Texte werden erzeugt:** `core/text.ts`; handgeschriebene Regeltexte gibt es nicht mehr.
- **Ablauf:** `core/effects.ts` arbeitet die Warteschlange ab. Danach gehen alle Figuren ohne Leben gleichzeitig vom Feld, und ihre Abschiede folgen nach `playOrder`, bis niemand mehr fällt. Sieg, Unentschieden und Zuggrenze (Zug 89) werden nur in `settle` geprüft.
- **Werte:** `refreshStats` berechnet Angriff und Leben aus Grundwert, `enchantments` und `damage`. Die Felder `attack`, `health` und `maxHealth` bleiben als berechnetes Ergebnis für Oberfläche und Bot erhalten.
- **Verdeckte Karten:** `sampleHidden` verteilt ohne Zurücklegen und zieht offen liegende Karten ab.
- **Alte Online-Räume:** `upgradeState` ergänzt fehlende Felder.
- **Schutz vor Regeländerungen:** `test/golden/karten.json` hält fest, was jede Karte mit jedem Ziel bewirkt. Die Datei wurde vor dem Umbau erzeugt und blieb dabei unverändert.
- **Sichtbare Änderungen:** Die Sternschnuppe zeigt ihren Text und meldet sich als `spellCast`, einige Zaubertexte sind neu formuliert, und „Feld voll“ wird angezeigt.
- **Messung nachher (300 Partien, Deckwahl zufällig):** Startspieler im Spiegel „schwer“ 57 %, „mittel“ 55 %, „leicht“ 49 %; Schwer schlägt Mittel zu 92 %, Mittel schlägt Leicht zu 75 %.

## Bedienung und Bot-Planer (01.11.2026, Phase 2 des Ausbauplans, Regeln unverändert)

- **Animationsreihe:** `ui/sequence.ts` zerlegt die Ereignisse eines Zugs in Schritte mit eigenem Feldzustand, `ui/useBeats.ts` spielt sie ab. Eine Reihe dauert höchstens 2,2 s; der nächste Zug unterbricht sie, die Regeln warten nie auf die Wiedergabe. Klänge der Plattform laufen weiter gleichzeitig, nur die Tierstimmen folgen den Schritten.
- **Spielverlauf:** aufklappbar, aus denselben Schritten, ohne gezogene Karten. Er lebt nur in der geöffneten Seite und ist nach einem Neuladen leer.
- **Bedienung:** Zielpfeil beim Ziehen und mit der Maus, große Karte (lange drücken, Rechtsklick, Taste `i`), Tastatur auf Karten und Tieren, Lunte ab 15 s Restzeit, verstärkte Werte grün, verletzte rot, Tipp-Knopf markiert den Vorschlag.
- **Plattform:** `BoardProps.clock`, `GameUi.phrases`, neue Schnellnachrichten `wow` und `grr`. `Play.tsx` übergibt Ereignisse und Sicht jetzt im selben Durchlauf.
- **Tierrufe:** vorerst nur online und als Text über die vorhandene Schnellnachrichten-Leiste, mit dem allgemeinen Nachrichtenklang. Die Vertonung fehlt, neue Klänge wählt Cornelius aus.
- **Aufteilung:** `ui/PlayBoard.tsx`, `ui/phases.tsx`, `ui/parts.tsx`; `index.tsx` hält nur noch die Anbindung.
- **Messung:** Neuer gegen alten „schwer“ 84 von 100 Partien. Rechenzeit bei 800 ms Budget: Median 11 ms, Spitze 407 ms; mit der Zähl-Uhr des Servers (`BOT_STEP_MS` 0,15) höchstens 150 ms, lokal gemessen, nicht auf Cloudflare.
- **Stufen und Startvorteil (150 Partien je Zeile, etwa ±8 Prozentpunkte):** Schwer schlägt Mittel zu 79 %, Mittel schlägt Leicht zu 97 %. Startspieler bei zufälliger Deckwahl: schwer 60 %, mittel 52 %, leicht 53 %. Festes Deck, schwer: Wald 52 %, Meer 53 %, Bauernhof 51 %, Wildnis 65 %, Krabbeltiere 45 %. Partien im Spiegel „schwer“ dauern jetzt im Schnitt 18,4 statt 14,7 Züge.

## Held und Grundregeln (01.11.2026, Phase 3 des Ausbauplans, `ruleVersion` 5)

- **Hauskraft:** Zug `heroPower`, 2 Mana, einmal je Zug, als Daten in `src/powers.ts`. Eichenkraft (Wald: +1 Angriff im Zug, +1 Rüstung), Gezeitenruf (Meer: zufällig Muschel, Garnele oder Seepferdchen), Kükenruf (Bauernhof), Dickes Fell (Wildnis: 2 Rüstung), Kleiner Stachel (Krabbeltiere: Rüstzeug 1 Angriff, 2 Angriffe). Namen sind Vorschläge. Das gemischte Deck bekommt eine Kraft aus dem Seed. Kräfte, die ein Tier rufen, gehen nicht bei vollem Feld.
- **Rüstung** fängt jeden Schaden an Helden vor den Leben ab, auch Müdigkeit.
- **Heldenangriff:** Zug `heroAttack`, einmal je Zug, mit denselben Zielregeln wie Tiere. Ein angegriffenes Tier schlägt zurück, Gift wirkt nicht auf Helden. Rüstzeug nutzt sich auch beim Angriff mit Zusatzangriff ab.
- **Grundregeln:** Hand 10, Sternschnuppe darf 11 Mana geben. **Neu:** Wer als Zweiter beginnt, startet mit 5 Rüstung.
- **Kein „Zug zurück“ mehr** (`noUndo`): Gezogene Karten und Zufall ließen sich sonst durch Zurücknehmen ausspähen.
- **Handy:** Die Hand überlappt ab etwa sechs Karten statt zu scrollen, Tiere schrumpfen, sodass sieben aufs Feld passen. Unter 480 px entfällt der Name in der Heldenleiste (er steht im Spieler-Chip). Im Browser bei 375 × 812 mit zehn Handkarten und sechs Tieren angesehen, Querformat nicht einzeln geprüft.
- **Messung (Bots, 200 Partien je Zeile, etwa ±7 Prozentpunkte):** Startspieler bei freier Deckwahl schwer 54 %, mittel 52 %, leicht 46 %. Festes Deck schwer/mittel: Wald 50/56, Meer 46/39, Bauernhof 62/41, Wildnis 59/60, Krabbeltiere 41/49. Schwer schlägt Mittel zu 86 %, Mittel schlägt Leicht zu 99 %. Verglichene Ausgleiche (300 Partien, schwer/mittel, ohne Ausgleich 63/61): 5 statt 4 Startkarten 39/57, kein Ziehen im ersten Zug 38/52, zwei Sternschnuppen 45/58, Rüstung 3: 56/59, 5: 51/53, 8: 48/43. Die Rechenzeit auf Cloudflare ist nicht neu gemessen.
- **Noch offen:** Echte Online-Partie mit zwei Geräten (auch der Wandler für laufende Räume ist nur per Test geprüft), Auswahl eigener Klänge (Hauskraft nutzt vorerst `stapel-fertig`).

## Dauerhafte Stichwörter (01.11.2026, Phase 4 des Ausbauplans, `ruleVersion` 6)

- **Neu:** 🏃 Sprinter (sofort, im ersten Zug nur Tiere), ✌️ Doppelschlag, 💚 Lebenskraft, ❄️ Kältestarre, 😌 Beruhigen, 🌱 Zweite Chance, 🌿 Naturkraft, 🌀 Eingerollt (bis zum eigenen nächsten Zug), 🍃 Scheu, 🔄 Tauschen (1 Mana), ⏳ flüchtige Karten. Flink bleibt Sofortangriff auch auf den Helden.
- **Felder:** Die neuen Figurenfelder sind optional und nur gesetzt, wenn sie zutreffen. Ältere Spielstände laufen deshalb ohne Wandler weiter.
- **Überarbeitete Tiere (Angriff/Leben):**
  - Sprinter: Ratte, Kaninchen 3/3, Nashorn 8/5.
  - Doppelschlag: Fliege 1/1.
  - Lebenskraft: Hummer 2/3, Lama 4/5.
  - Kältestarre: Tintenfisch 1/3, Fisch 2/2.
  - Zweite Chance: Frosch 1/2, Katze 3/2, Ziege 3/3.
  - Naturkraft +1: Maus, Eichhörnchen 2/3, Eule.
  - Eingerollt: Schnecke 1/2, Nilpferd 7/6.
  - Scheu: Hirsch 5/4, Giraffe 7/6, Grille.
  - Tauschen: Truthahn, Ochse, Kamel.
  - Auftritt: Schaf 2/5 beruhigt alle anderen Tiere; flüchtige Karte geben Waschbär 3/2 (Rückenwind), Affe 3/4 (Blitzschlag), Schwein 3/4 (Honigtopf).
- **Neue Zauber:** Raureif (1 Mana, Kältestarre, zieht eine Karte; im Meer statt Sommerregen), Stille Stunde (2 Mana, beruhigt, zieht eine Karte; im Bauernhof statt Sommerregen). Doppelschlag ist nur schwach besetzt; dazu kommen später eigene Karten.
- **Messung (Bots, 200 Partien je Zeile, etwa ±7 Prozentpunkte):** Startspieler bei freier Deckwahl schwer 53 %, mittel 52 %, leicht 49 %. Festes Deck schwer/mittel: Wald 50/56, Meer 41/44, Bauernhof 66/46, Wildnis 51/61, Krabbeltiere 43/49. Schwer schlägt Mittel zu 86 %, Mittel schlägt Leicht zu 99 %. Der Ausgleich von 5 Rüstung blieb unverändert.
- **Noch offen:** Test mit Kindern (der Plan sieht ihn ab Phase 4 vor: sind die vielen Abzeichen verständlich?), eigene Klänge, Online-Partie mit zwei Geräten. Im Browser angesehen sind Tauschen, Abzeichen und Verlauf im Hochformat; die übrigen Stichwörter sind per Regeltest geprüft.

## Entscheidungen (01.11.2026, Phase 5 des Ausbauplans, `ruleVersion` 7)

- **Warten auf eine Wahl:** `state.pending` hält die Warteschlange an (`settle` kehrt zurück), `resolveChoice` macht nach dem Zug `choose` weiter. Solange die Wahl offen ist, sind nur `choose`-Züge des Wählenden erlaubt; bei Zeitablauf gilt die erste Möglichkeit. Fremde Sichten sehen nur die Anzahl (`pending.count`), die Möglichkeiten bleiben geheim. Eine Wahl aus einem Abschied gehört dem Besitzer des Tiers, auch im fremden Zug.
- **Auftritte mit Ziel:** `targeting` gilt jetzt auch für Tiere. Ohne mögliches Ziel lässt sich das Tier trotzdem legen, der Auftritt verpufft. Scheu schützt auch vor Auftritten.
- **Neu im Wortschatz:** Fährte suchen (`discover`), Wahlkarte (`chooseOne`), Anpassen (`adapt`, 3 aus 8 Verbesserungen), Ziel `self`, Bedingungen `combo` (🐺 Rudeltaktik) und `outcast` (🦡 Einzelgänger), `overload` (🔒 Erschöpfung).
- **Überarbeitete Karten (Angriff/Leben):**
  - Auftritt mit Ziel: Krake 2/3 (Kältestarre), Otter 3/3 und Pferd 4/5 (+1/+1), Elefant 6/8 (2 Schaden), Spinne 2/1 (Kältestarre).
  - Rudeltaktik: Mücke, Skorpion, Grille, Hund.
  - Einzelgänger: Fledermaus, Schlange (Karte ziehen), Igel (+2 Leben).
  - Erschöpfung: Ochse 5 Mana (1), Känguru 4 Mana (2), Hummer 1 Mana (1).
  - Fährte suchen: Eule 2/3.
  - Wahlkarte: Eichhörnchen (dafür ohne Naturkraft).
  - Anpassen: Eidechse 1/2, Schildkröte 1/3.
- **Neue Zauber:** Spurenlesen (1 Mana, Fährte suchen nach Tieren; in den Krabbeltieren statt Rückenwind), Mondscheinernte (2 Mana, Wahlkarte; im Wald statt Glücksklee).
- **Messung (Bots, 200 Partien je Zeile, etwa ±7 Prozentpunkte):** Startspieler bei freier Deckwahl schwer 52 %, mittel 45 %, leicht 49 %. Festes Deck schwer/mittel: Wald 53/56, Meer 51/49, Bauernhof 56/39, Wildnis 51/46, Krabbeltiere 48/42. Schwer schlägt Mittel zu 84 %, Mittel schlägt Leicht zu 100 %. Zu Beginn eines Zugs gibt es in 89 bis 98 % der Fälle mindestens zwei verschiedene Aktionen (40 Partien je Deck, Bot „mittel“).
- **Im Browser angesehen (375 × 812):** Wahlfenster mit Fährte suchen, Krake mit Zielwahl. Wahlkarte im Fenster, Einzelgänger und Erschöpfung nur per Regeltest.
- **Bekannte Lücke:** Fällt ein Held, während eine Wahl offen ist, endet die Partie laut `result` sofort, die Wahl entfällt.
- **Noch offen:** Test mit Kindern, Online-Partie mit zwei Geräten (auch die offene Wahl im Raum), eigene Klänge.

## Grundset (01.11.2026, Phase 6 des Ausbauplans, `ruleVersion` 8)

- **Karten:** `src/grundset.ts` enthält 100 neue Tiere, 15 neue Zauber und 4 Spielsteine als Daten; die älteren Karten bekommen dort Haus, Familien und Seltenheit. Je Haus rund 30 Karten, dazu rund 30 neutrale. Namen und Werte sind Vorschläge.
- **Neu im Wortschatz:** Familien (`families`), Zauberschulen (`school`), Seltenheit (`rarity`), Auslöser `turnEnd` (🌙 Zugende) und `spellCast` (✨ Nach Zauber), Bedingung `{ family }` (🐾 Sippe), Ziel `random`, Familienfilter bei `allMinions`. Fährte suchen bleibt beim eigenen Haus und neutralen Karten.
- **Zugende mit Wahl:** Wirkungen am Zugende dürfen selbst keine Wahl anbieten (Kartentest). Kommt eine aus einem Abschied, wartet `state.turnEnding` mit dem Zugwechsel.
- **Themendecks** neu aus Haus und neutralen Karten, höchstens zwei Kopien, Sagentiere einmal (`test/grundset.test.ts`). Oberfläche: große Karte nennt Familie, Schule und Seltenheit, Sagentiere leuchten, Karten ab 7 Mana lassen das Feld wackeln (nicht bei `prefers-reduced-motion`).
- **Häuser-Matrix (erstes Haus gewinnt, beide Plätze im Wechsel, „schwer“ 120 Partien je Paarung, „mittel“ 200, etwa ±9 bzw. ±7 Prozentpunkte):**

  | Paarung | schwer | mittel |
  |---|---|---|
  | Wald : Meer | 54 | 37 |
  | Wald : Bauernhof | 43 | 46 |
  | Wald : Wildnis | 54 | 66 |
  | Wald : Krabbeltiere | 43 | 22 |
  | Meer : Bauernhof | 41 | 33 |
  | Meer : Wildnis | 55 | 63 |
  | Meer : Krabbeltiere | 63 | 48 |
  | Bauernhof : Wildnis | 63 | 77 |
  | Bauernhof : Krabbeltiere | 29 | 35 |
  | Wildnis : Krabbeltiere | 59 | 41 |

  **Das Ziel 40–60 % ist nicht erreicht:** Bauernhof schlägt fast alle, verliert aber klar gegen Krabbeltiere; auf „mittel“ ist die Wildnis schwach und die Krabbeltiere sind stark, vermutlich weil der mittlere Bot Rüstung und Tempo schlechter nutzt. Das sind nur Bot-Messungen. Abrufbar mit `DRACHEN_MATRIX=forest:sea DRACHEN_MATRIX_STUFE=hard DRACHEN_BALANCE_SPIELE=100 corepack pnpm exec vitest run packages/games/drachenspiel/test/balance --disable-console-intercept`.
- **Startspieler (150 Partien je Zeile, etwa ±8 Prozentpunkte):** freie Deckwahl schwer 47 %, mittel 47 %, leicht 50 %. Festes Deck schwer/mittel: Wald 48/36, Meer 48/48, Bauernhof 57/54, Wildnis 42/55, Krabbeltiere 50/39. Schwer schlägt Mittel zu 83 %, Mittel schlägt Leicht zu 100 %.
- **Noch offen:** Häuser-Matrix, klickbare Feldecken, Bilder, Test mit Kindern, Online mit zwei Geräten. Die neuen Karten sind per Kartentest und Bot-Partien geprüft, im Browser nur stichprobenhaft angesehen.

## Balance-Runde nach dem Grundset (01.11.2026, nur Kartenwerte, keine neue `ruleVersion`)

- **Geändert (Angriff/Leben, Kosten nur wo genannt):** Küken 1/2, Eichelhäher 1/3, Wolf 3/4, Stier 5/4, Hütehund 2/3, Gans 2/3, Erdmännchen 1/3, Gepard 5/3, Gorilla 5/6, Tiger 6/5, Wespe 2/2, Hirschkäfer 2/6, Mutterspinne 4/6, Strudel 3 Mana.
- **Häuser-Matrix danach (erstes Haus gewinnt; „schwer“ 150 Partien je Paarung, „mittel“ 200; etwa ±8 bzw. ±7 Prozentpunkte; die Zahlen in Klammern sind der Stand vor dieser Runde):**

  | Paarung | schwer | mittel |
  |---|---|---|
  | Wald : Meer | 51 (54) | 33 (37) |
  | Wald : Bauernhof | 61 (43) | 52 (46) |
  | Wald : Wildnis | 49 (54) | 59 (66) |
  | Wald : Krabbeltiere | 45 (43) | 28 (22) |
  | Meer : Bauernhof | 41 (41) | 38 (33) |
  | Meer : Wildnis | 43 (55) | 60 (63) |
  | Meer : Krabbeltiere | 67 (63) | 55 (48) |
  | Bauernhof : Wildnis | 55 (63) | 62 (77) |
  | Bauernhof : Krabbeltiere | 31 (29) | 34 (35) |
  | Wildnis : Krabbeltiere | 59 (59) | 38 (41) |

- **Ergebnis: Das Ziel 40–60 % ist weiter verfehlt.** Außerhalb liegen auf „schwer“ 3 von 10 Paarungen wie zuvor, auf „mittel“ 6 statt 7. Die mittlere Abweichung von 50 sinkt auf „schwer“ von 9,2 auf 8,4 Punkte, auf „mittel“ von 14,4 auf 11,7. Der Rest ist ein Kreis um die Krabbeltiere: Sie schlagen den Bauernhof, das Meer schlägt sie. Einzelwerte verschieben das Problem nur noch, auch wegen des Messrauschens.
- **Versucht und verworfen:** Der mittlere Bot mit der Bewertung von „schwer“ änderte die Matrix kaum und senkte den Abstand zu „schwer“ von 83 auf 69 %. 3 Rüstung für Dickes Fell machte die Wildnis gegen Krabbeltiere zu stark (79 %).
- **Startspieler (150 Partien je Zeile, freie Deckwahl):** schwer 49 %, mittel 51 %, leicht 51 %. Schwer schlägt Mittel zu 82 %, Mittel schlägt Leicht zu 100 %.

## Neue Kartentypen (01.11.2026, Phase 7 des Ausbauplans, `ruleVersion` 9)

- **🏗️ Bauten** (`building`): liegen als Figur ohne Angriff auf dem Feld, sind angreifbar, wirken einmal je Zug per Antippen (`useBuilding`) und verlieren dabei 1 Leben. Erstarrt oder beruhigt wirken sie nicht. Biberdamm, Korallenriff, Nest, Wasserloch, Bienenstock, Turm.
- **💤 Winterschlaf und Eier** (`dormant`, `hatchesInto`): unangreifbar, kein Ziel, von Flächen nicht getroffen, schützen auch nicht als Beschützer; zählen an eigenen Zugbeginnen herunter. Murmeltier, Seeigelei, Hühnerei, Bärenjunges, Kokon, Drachenei (schlüpft nach 3 Zügen als Eidrache 7/7).
- **🪤 Fallen** (`trap`, in `PlayerState.traps`): zählen als Zauber, höchstens drei, jede nur einmal. Fremde Sichten und Ereignisse zeigen nur die Anzahl; `sampleHidden` lost mögliche Fallen aus, der Bot rechnet also nicht mit den echten. Lösen aus, wenn ein Tier den Helden angreift (vor dem Schlag), ein Tier gespielt oder ein Zauber gewirkt wird. Wurzelfalle, Treibnetz, Falscher Alarm, Fallgrube, Klebefalle, Maskerade.
- **📜 Aufgaben** (`quest`, `PlayerState.quest`): offen sichtbar, eine zur Zeit, kosten 1 Mana. Ziele: Tiere einer Familie spielen, Zauber wirken, Rüstung sammeln. Die Belohnung ist ein starker Spielstein auf der Hand.
- **Hot-Seat:** Die Plattform deckt wegen `privateViews` schon vor jedem Zug ab, darum bleiben Fallen auch am selben Gerät verdeckt. Getestet ist das hier nicht eigens.
- **Decks:** Jedes Themendeck enthält jetzt je einen Bau, eine Aufgabe, zwei Schläfer und zwei Fallen (die Fallen nur mit Zauberkarten). Dafür weichen je drei Paare bzw. Zauber; im Wald ersetzt außerdem die Katze den Siebenschläfer.
- **Behoben:** Der Kartentext nennt jetzt die Zahl gerufener Tiere („2× ein Küken“), auch bei älteren Karten wie dem Gänsemarsch. Beim Zielen zeigt die Leiste den Auftritt statt der ersten Fähigkeit.
- **Häuser-Matrix (erstes Haus gewinnt, je 150 Partien, etwa ±8 Prozentpunkte):**

  | Paarung | schwer | mittel |
  |---|---|---|
  | Wald : Meer | 35 | 34 |
  | Wald : Bauernhof | 44 | 67 |
  | Wald : Wildnis | 41 | 75 |
  | Wald : Krabbeltiere | 46 | 54 |
  | Meer : Bauernhof | 51 | 56 |
  | Meer : Wildnis | 49 | 65 |
  | Meer : Krabbeltiere | 69 | 73 |
  | Bauernhof : Wildnis | 60 | 61 |
  | Bauernhof : Krabbeltiere | 53 | 47 |
  | Wildnis : Krabbeltiere | 60 | 53 |

  Außerhalb von 40–60 % liegen auf „schwer“ 2 von 10 Paarungen, auf „mittel“ 6. Die mittlere Abweichung von 50 beträgt 7,8 bzw. 12,3 Punkte. Das Meer ist insgesamt etwas zu stark; das Phasenziel von Phase 6 bleibt offen.
- **Startspieler (150 Partien, freie Deckwahl):** schwer 45 %, mittel 48 %, leicht 47 %. Schwer schlägt Mittel zu 85 %, Mittel schlägt Leicht zu 98 %.
- **Im Browser angesehen (375 × 812):** Falle mit Abzeichen, Schlüpfen eines Kokons als Falter, Kartentexte. Nur per Regeltest geprüft: Bau antippen, Aufgabe abschließen, das Auslösen einer Falle. Online mit zwei Geräten weiter ungetestet.

## Deckbau ohne Kauf (01.11.2026, Phase 8 des Ausbauplans, `ruleVersion` 10)

- **Regeln** (`src/deckcode.ts`): 30 Karten aus einem Haus und neutrale, höchstens 2 Kopien, Sagentiere einmal. Alle Karten sind frei, es gibt nichts zu kaufen oder freizuspielen. Spielsteine und die Sternschnuppe gehören nicht dazu.
- **Deck-Code:** lesbarer Text wie `forest:c7*2,f_jay*2,…`, höchstens 600 Zeichen. Zug `chooseDeck` mit `code`; `isLegal` und `applyMove` prüfen ihn, online also die Spielleitung auf dem Server. Der Gegner sieht das eigene Deck nicht (`customDeck` nur in der eigenen Sicht), Ereignisse nennen nur das Haus.
- **Oberfläche** (`src/ui/DeckBuilder.tsx`): „🃏 Meine Decks“ in der Einrichtung, ohne Uhr; in der Deckwahl dasselbe mit Knopf „Spielen“ und dem Hinweis, dass die Uhr läuft. Haus wählen, Karten antippen, lange drücken zeigt sie groß, Filter und Suche, Kostenkurve, „🎲 Rest auffüllen“, Umbauen, Teilen mit Code und QR-Code, Löschen.
- **Vorschlagsdecks:** Waldfreunde, Küstenwache, Bunter Hof, Steppenzug, Flinker Schwarm, je Haus eines, einfach zu spielen, auch als Grundlage zum Umbauen. Sie sind nicht eigens auf Balance gemessen.
- **Vorgabe für eine Klasse:** Option `deckSelection=code` mit verborgener Option `deckCode`, per Link `#/neu/drachenspiel?deckSelection=code&deckCode=…` oder in der Einrichtung; beide Plätze spielen dieses Deck, ungültige Codes führen zur Wahl im Spiel. Online gilt das nicht, weil verborgene Optionen dort nicht gesetzt werden: Dort gibt jedes Kind den Code in der Deckwahl ein.
- **Zauberkarten-Option:** Sie gilt nur für Themendecks und das gemischte Deck. Ein eigenes Deck wird gespielt, wie es gebaut ist.
- **Sicherung (W-050):** `packages/ui/src/sync/` (`@brett-und-blatt/ui/sync`) enthält den früheren Narrenhof-Kern. Ein Code gilt für die ganze Plattform, jedes Spiel hat mit eigenem Salt einen eigenen Block; das Salt des Narrenhofs und der Speicherschlüssel `brett-und-blatt:farbensortierer:sicherung` sind unverändert, vorhandene Codes und Passkeys gelten weiter. Ein Code ist gültig, wenn irgendein Block dazu existiert; der eigene wird dann angelegt. Der Abgleich liest auch den Block des anderen Spiels und hält ihn so am Leben. Decks führt die jüngste Änderung je Kennung zusammen, Gelöschtes bleibt als Löschvermerk (`src/ui/deckStore.ts`, höchstens 80 Decks und 200 Vermerke, unter 64 KB). Datenschutzerklärung ergänzt.
- **Geprüft:** Regeln, Code, Zusammenführen und die Sicherung gegen einen nachgebauten Server mit den echten Serverregeln (`test/deckbau.test.ts`, `test/decksync.test.ts`). Im Browser (375 × 812) gegen den lokalen Spieleserver: Vorschlag übernehmen, speichern, Sicherungscode anlegen, Partie mit dem eigenen Deck; Neues Deck mit Auffüllen, Grenzen, Teilen mit QR-Code.
- **Noch offen:** Das Kriterium „ein Kind schafft es in unter 5 Minuten“ ist nicht gemessen. Eigene Decks in einer echten Online-Partie mit zwei Geräten, Passkey, das Einlösen eines Codes auf einem zweiten echten Gerät und der Link mit `sicherung=` sind nicht von Hand getestet. Die Häuser-Matrix misst nur die Themendecks.

## Solo und Langzeit (01.11.2026, Phase 9 des Ausbauplans, `ruleVersion` 11)

- **Grundgedanke:** Jeder Solo-Kampf bleibt eine gewöhnliche Partie. Verborgene Optionen `scenario`, `deckCode` und `treasures` legen nur fest, wie sie beginnt (`src/modes/scenarios.ts`); Platz 0 ist der Mensch, Platz 1 der Bot, dessen Stärke das Szenario bestimmt. Sonderregeln entstehen allein aus der Startaufstellung, also ohne eigenen Regelcode. Der Tipp-Knopf rechnet weiter mit voller Stärke.
- **🎓 Übungsweg:** sieben Lektionen (Mana und Tiere, Abtausch, Beschützer, Hauskraft, Zauber, Wählen, erstes Duell) mit Hinweisen im Spiel. Die Lerndecks enthalten nur einfache Tiere, damit nichts vorgreift.
- **🗺️ Wanderschaft:** acht Gegner auf einer festen Strecke (Lampe, Henning, Hinze, Mira, Grimbart, Kapitän Krabbe, Isegrim, König Nobel) mit steigenden Leben und Sonderaufstellung. Start mit 15 Karten; nach jedem Sieg ein Bündel aus 3 von 3 Angeboten, nach dem zweiten und fünften Gegner ein Schatz. Eine Niederlage beendet den Lauf. Die Angebote stehen aus dem Lauf-Seed fest, Neuladen würfelt nichts neu.
- **🏇 Turnier:** Haus aus 3 Angeboten, Deck aus je 3 angebotenen Karten, bis 5 Siege oder 2 Niederlagen, kostenlos. Ab 3 Siegen spielt der Gegner auf „schwer“.
- **📖 Turnierbuch:** acht Aufgaben in fester Reihenfolge; Belohnung nur Kartenrahmen und Wappen, nie zufällig.
- **Fortschritt** (`src/modes/progress.ts`, im Sicherungsblock des Drachenspiels, W-050): Bestwerte zählen das Höchste, Lektionen bleiben, Lauf und Turnier nimmt die jüngste Änderung. Jede Partie bekommt eine Kennung (`playId`) und zählt einmal. Online gibt es keine Kennung, online zählt also nichts fürs Turnierbuch. Sicherungen aus Phase 8 bleiben lesbar.
- **Plattform:** `GameUi.endAction` ersetzt am Partieende „Revanche“ durch den nächsten Schritt; der Setup-Parameter `gegner=bot` setzt für einen Start einen Menschen gegen einen Bot, ohne die gespeicherten Einstellungen zu ändern.
- **Behoben (Fehler aus Phase 8):** Der Deck-Code ließ keine Großbuchstaben zu; eigene Decks mit Seifenblase oder Sommerregen ließen sich speichern, aber nicht spielen. Ein Test prüft jetzt alle baubaren Karten.
- **Geprüft:** Regeln, Angebote, Zähler und Zusammenführen per Test (`test/solo.test.ts`); jede Lektion gewinnt der Bot „schwer“ als Spieler in mindestens einer von sechs Partien. Im Browser (Hochformat) die erste Lektion bis zum Sieg und weiter zur zweiten, ein gewonnener erster Wanderschaftskampf bis zur Beutewahl, das Turnier bis zum ersten Kampf.
- **Grenzen:** „Neu starten“ und Aufgeben lassen sich im Lauf nicht ausschließen: Aufgeben zählt als Niederlage, Neu starten wiederholt den Kampf. Die Uhr aus den Einstellungen gilt auch im Solo-Kampf, die Lektionen haben also ein Zeitlimit. Wie schwer die Wanderschaft für Menschen ist, ist nicht gemessen, Mittelteil und Ende auch nicht gespielt. Beutewahl, Schatz, Rahmen und Wappen sind im Browser nicht bedient worden.

