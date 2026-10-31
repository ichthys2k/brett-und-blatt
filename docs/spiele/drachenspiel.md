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

- 🌳 **Wald:** Ausgewogene Tiere, Synergien, Biber, Igel, Bär.
- 🌊 **Meer:** Schutzblasen und Zähigkeit (Krabbe, Kugelfisch, Tintenfisch, Krake).
- 🚜 **Bauernhof:** Schwarm-Mechaniken und Schnelligkeit (Küken, Hahn, Hund, Schwein).
- 🌍 **Wildnis:** Große, wuchtige Tiere für das späte Spiel (Elefant, Nashorn, Gorilla).
- 🐜 **Krabbeltiere:** Schnelle Angriffe, Gift und Flinkheit (Ameise, Mücke, Spinne, Skorpion).

## Spielmodell

```ts
export type Phase = 'deckSelection' | 'mulligan' | 'play' | 'ended';

export interface DrachenspielState {
  phase: Phase;
  activeSeat: SeatId;
  turnNumber: number;
  players: [PlayerState, PlayerState];
  seed: string;
  // ...
}
```

## Bots

- **Leicht:** Spielt bezahlbare Handkarten und greift zufällig regelkonform an.
- **Mittel:** Greift vorteilhafte Trades an (eigenes Tier überlebt, gegnerisches Tier geht vom Feld), nutzt Mana effizient, greift den Helden an, wenn Feld gesichert ist.
- **Schwer:** Bewertet Zugfolgen (Sequenzen von Ausspielen und Angriffen) mit Stellungsbewertung und Determinisierung über die noch im gegnerischen Deck verbliebenen Karten.

## Umsetzung (Oktober 2026)

- `packages/games/drachenspiel/src/cards.ts`: 54 Tierkarten-Definitionen (Angriff, Leben, Mana, Zitate, Fähigkeiten, Klangzuordnungen) plus Sternschnuppe ⭐ und Token (Ameise, Schmetterling).
- `packages/games/drachenspiel/src/decks.ts`: 5 balancierte Themendecks à 30 Karten (Wald, Meer, Bauernhof, Wildnis, Krabbeltiere).
- `packages/games/drachenspiel/src/rules.ts`: Vollständige Spielregeln (Deckauswahl, Mulligan, Rundenphasen mit Manazuwachs, Ausspielen, Kampf mit Beschützer/Schutzblase/Giftig/Versteckt/Auftritt/Abschied, Müdigkeit, reines JSON für Zustand und Sichten, `playerView`, `sampleHidden`, `eventView`).
- `packages/games/drachenspiel/src/bots.ts`: Drachenhüter-Bot in drei Schwierigkeitsstufen (leicht, mittel, schwer) mit Bedenkpausen (`delayMs`) für Angriffe (600–750 ms) und Kartenausspielen (400–500 ms) zur vollständigen Visualisierung von Zügen.
- `packages/games/drachenspiel/src/ui/`: Arena-Oberfläche mit Deckauswahl, Mulligan-Tausch-Auswahl, Manakristall-Leiste, Helden-Porträts, Tier-Kampffeld, Zielauswahl-Hervorhebung und Zug-beenden-Button. Zielgerichtete Vektor-Angriffsanimationen (Karten bewegen sich direkt auf die angegriffene Figur bzw. den Helden zu), synchrone Erhaltung besiegter Tiere zur Anzeige von Schaden und Treffer-Shake vor dem sanften Verblassen, aufsteigende Schadens- und Heilungsanzeigen, platzende Schutzblasen und Karteneffekte (Drop beim Ausspielen, Deal beim Ziehen).
- Sound-Effekte: Vollständige Übernahme der Originalsounds aus dem Vorlagen-Klon (`ds_snip`, `ds_swipe`, `ds_punch1`, `ds_punch2`, `ds_flipcard`) sowie Einbindung der 368 Minion-Sprachausgaben on-demand (`klaenge/tiere/`) beim Ausspielen, Angreifen, Ableben und Anklicken auf dem Spielfeld (Easter-Egg).
- Server-Registrierung: In `apps/server/src/games.ts` und `apps/server/package.json` als Online-Mehrspieler-Spiel registriert.

## Offene Punkte

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

