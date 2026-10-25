# Skat

| Steckbrief | |
|---|---|
| Spieler | 3 aktiv; am Vierertisch setzt der Geber aus |
| Dauer | 3–5 Minuten pro Spiel, eine Serie 30–90 Minuten |
| Modi | Solo gegen 2 Bots, Hot-Seat, online, gemischt |
| Muster | verdeckt (Hände, Skat), Zug um Zug |
| Bausteine | Stich-Kern, Serien-Rahmen, Kartenblatt französisch (vierfarbig wählbar) oder deutsch |
| Aufwand | Regeln L, Oberfläche L, Bot XL |
| Etappe | 5, erstes Stichspiel: baut Stich-Kern und Serien-Rahmen |

**Regelgrundlage:** Internationale Skatordnung (ISkO) mit Seeger-Fabian-Abrechnung. Ausdrücklich ohne Hausregeln: kein Kontra/Re, kein Ramsch, keine Bockrunden.

## Regeln (Standard)

**Karten und Geben**

- 32 Karten (7 bis Ass in Kreuz, Pik, Herz, Karo).
- Gegeben wird 3 – Skat 2 – 4 – 3. Jeder hat 10 Karten, 2 liegen verdeckt im Skat.
- Sitzordnung vom Geber aus: Vorhand, Mittelhand, Hinterhand. Der Geber wechselt im Uhrzeigersinn.

**Reizen**

- Mittelhand sagt Vorhand Werte an. Vorhand hört („ja“) oder passt.
- Danach sagt Hinterhand dem Sieger an.
- Passen alle, ist das Spiel eingepasst und wird neu gegeben. Ramsch gibt es nicht.
- Reizwerte: 18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44, 45, 46, 48, 50, 54, 55, 59, 60, … (alle möglichen Spielwerte). Sprünge sind erlaubt.

**Skat und Ansage**

- Der Alleinspieler nimmt den Skat auf und drückt 2 Karten, oder er spielt Hand.
- Danach sagt er das Spiel an:

| Spielart | Grundwert |
|---|---|
| Karo | 9 |
| Herz | 10 |
| Pik | 11 |
| Kreuz | 12 |
| Grand | 24 |
| Null | 23 |
| Null Hand | 35 |
| Null ouvert | 46 |
| Null ouvert Hand | 59 |

- Nur bei Handspielen dürfen zusätzlich Schneider, Schwarz oder Ouvert angesagt werden.

**Trumpf und Bedienen**

- Farbspiel: Kreuz-Bube, Pik-Bube, Herz-Bube, Karo-Bube, dann Ass, 10, König, Dame, 9, 8, 7 der Trumpffarbe.
- Grand: nur die vier Buben sind Trumpf.
- Null: kein Trumpf, Reihenfolge 7, 8, 9, 10, Bube, Dame, König, Ass. Der Alleinspieler darf keinen Stich machen.
- Bedienpflicht: Die ausgespielte Farbe muss bedient werden; Buben zählen dabei als Trumpf, nicht als ihre Farbe.

**Augen und Gewinn**

- Augenwerte: Ass 11, 10 10, König 4, Dame 3, Bube 2. Zusammen 120.
- Der Alleinspieler gewinnt mit mindestens 61 Augen; der Skat zählt für ihn.
- Schneider: höchstens 30 Augen beim Verlierer. Schwarz: keinen einzigen Stich.

**Spielwert**

- Spielwert = Grundwert × (Spitzen + Gewinnstufen).
- Spitzen: „mit“ bzw. „ohne“ so viele Trümpfe in lückenloser Folge ab Kreuz-Bube, Skat eingerechnet.
- Gewinnstufen: Spiel 1, dazu je +1 für Hand, Schneider, Schneider angesagt, Schwarz, Schwarz angesagt, Ouvert.
- Nullspiele haben feste Werte.

**Überreizt und verloren**

- Liegt der Spielwert unter dem Reizwert, ist das Spiel verloren. Gewertet wird dann das kleinste Vielfache des Grundwerts, das den Reizwert erreicht.
- Verlorene Spiele zählen doppelt negativ.

**Abrechnung (Seeger-Fabian)**

- Gewonnen: Spielwert + 50. Verloren: −2 × Spielwert − 50.
- Bei jedem verlorenen Spiel bekommen die anderen Spieler je 40 Punkte (Dreiertisch) bzw. je 30 Punkte (Vierertisch).

**Abkürzen**

Der Alleinspieler darf aufgeben oder offenlegen und die restlichen Stiche beanspruchen. Die Folgen einer falschen Beanspruchung richten sich nach der ISkO; beim Bau gegen den Regeltext prüfen.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Tisch | 3 Spieler, 4 Spieler (Geber setzt aus) | 3 |
| Spiele pro Serie | 3, 6, 12, 24, 36 (Turnier: 36 am Dreiertisch, 48 am Vierertisch) | 12 |
| Kartenbild | französisch, französisch vierfarbig (Turnierbild-Farben), deutsch | französisch vierfarbig |
| Lernhilfen | Augen mitzählen, erlaubte Karten hervorheben, Hinweis „warum nicht erlaubt“ | Hervorheben an, sonst aus |

Hausregeln (Kontra/Re, Ramsch, Bock) sind bewusst nicht vorgesehen. Die Schnittstelle erlaubt sie später als Optionen.

## Spielmodell

**Phasen:** `deal` (Systemzug: mischen und geben) → `bidding` → `skatDecision` → `discard` → `declare` → `play` (10 Stiche) → `scoring` → nächstes Spiel der Serie.

```ts
type SkatMove =
  | { type: 'bid'; value: number }          // ansagen (sagen)
  | { type: 'hold' }                        // hören: „ja“
  | { type: 'pass' }
  | { type: 'takeSkat' }
  | { type: 'playHand' }
  | { type: 'discard'; cards: [Card, Card] } // drücken
  | { type: 'declare'; game: SkatGame; schneider?: boolean; schwarz?: boolean; ouvert?: boolean }
  | { type: 'play'; card: Card }
  | { type: 'concede' }                     // aufgeben
  | { type: 'claimRest' };                  // offenlegen, Rest beanspruchen
```

**Zustand:** Sitzordnung und Geber, Hände, Skat, gedrückte Karten, Reizstand (wer gegen wen, aktueller Wert), Alleinspieler, Ansage, Stiche mit Gewinnern, Augen, Serienliste.

**Geheim (`playerView`):**

- Jeder sieht nur die eigene Hand.
- Den Skat sieht nur der Alleinspieler, und erst nach dem Aufnehmen. Die gedrückten Karten kennt nur er.
- Bei Ouvert liegt die Hand des Alleinspielers für alle offen.
- Öffentlich sind Reizverlauf, Ansage, gespielte Stiche und Serienliste.
- Die Augenstände sind öffentlich nur, wenn die Lernhilfe „Augen mitzählen“ an ist. Sonst muss man selbst zählen wie am echten Tisch.

**Stich-Kern** (`packages/engine/tricks`), so allgemein gebaut, dass Schafkopf, Doppelkopf und Binokel ihn wiederverwenden:

- `effectiveSuit(card, contract)`: Ein Bube ist im Farbspiel „Trumpf“, nicht „Kreuz“.
- `rank(card, contract)`: Rang einer Karte im aktuellen Spiel.
- `legalCards(hand, trick, contract)`: Bedienpflicht.
- `trickWinner(trick, contract)`: Bei gleichen Karten (Doppelkopf) gewinnt nach DDV die zuerst gespielte.

**Serien-Rahmen** (`packages/engine/series`): Geberwechsel, aussetzender Geber am Vierertisch, Liste, Abrechnungsregel als Funktion.

## Bot

Der aufwendigste Bot der Sammlung. Er hat drei Teile.

1. **Reizen:**
   - Stufe 1 bewertet die Hand mit Faustregeln: Buben, Asse, Zehnen, Länge der möglichen Trumpffarbe, blanke Fehlfarben, Null-Tauglichkeit.
   - Stufe 2 ist **simulationsbasiert**: Für jede Spielart werden viele Zufallsverteilungen der unbekannten 22 Karten durchgespielt, dazu gibt es eine Schätzung der Gewinnwahrscheinlichkeit. Der Bot reizt bis zum höchsten Wert, bei dem eine Spielart mit ausreichender Wahrscheinlichkeit gewinnt.
2. **Skat und Drücken:** Alle 66 möglichen Druck-Paare werden bewertet, schnell mit Faustregeln (Fehlfarben blank machen, Zehnen schützen), stark per Simulation.
3. **Kartenspiel:** **Determinisierte MCTS.** Der Bot verteilt die unbekannten Karten passend zu allem Bekannten:
   - wer welche Farbe nicht bedienen konnte
   - was im Skat liegt, wenn er selbst Alleinspieler ist
   - was gereizt wurde

   Danach spielt er viele Verteilungen durch. Dazu kommen Faustregeln für Gegenspieler: dem Partner Augen „schmieren“, kurze Farben anspielen.

**Stufen:**

| Stufe | Reizen | Spielen |
|---|---|---|
| leicht | Faustregeln, vorsichtig | einfache Regeln, kein Kartenzählen |
| mittel | Faustregeln | MCTS mit wenigen Durchläufen, zählt Trümpfe |
| schwer | Simulation | MCTS mit vielen Durchläufen und vollständiger Schlussfolgerung |

## Zeitlimits

| Voreinstellung | Reizen | Skat, Drücken, Ansage | Karte spielen |
|---|---|---|---|
| gemütlich | aus | aus | aus |
| normal | 10 s | 30 s | 15 s + 60 s Zeitbank |
| schnell | 5 s | 15 s | 8 s + 30 s Zeitbank |

**Bei Zeitablauf:** Beim Reizen wird gepasst. Bei Skat-Entscheidung, Drücken, Ansage und Kartenspiel entscheidet der Bot.

## Oberfläche

- **Hochformat:**
  - Eigene 10 Karten als Fächer unten, nach Farbe und Rang sortiert, je nach angesagtem Spiel.
  - Die zwei Gegner sitzen oben links und oben rechts mit Kartenzahl, Rolle („Alleinspieler“) und Uhr-Ring.
  - Der Stich liegt in der Mitte.
- **Desktop:** Tisch in der Mitte, Seitenleiste mit Reizverlauf, Stichen und Serienliste.
- **Reizen:** große Knöpfe „18?“ / „Ja“ / „Passe“, dazu ein Schieber für Sprünge. Vorab-Option „Passe ab …“ für flüssiges Reizen.
- **Ansage-Dialog:** Spielarten als Kacheln mit dem jeweiligen Spielwert („Herz mit 2: 30“). Eine Warnung erscheint, wenn der Reizwert sicher nicht erreicht wird.
- **Spielen:** Karte antippen, dann noch einmal tippen oder nach oben wischen. Nicht erlaubte Karten sind abgedunkelt.
- **Nach dem Spiel:** Auflösung mit Augen beider Parteien, Spielwert-Rechnung zum Nachvollziehen, Eintrag in der Liste.
- **Lernmodus** (für Einsteiger und die Schule): Erklärt Reizwerte, Spitzen und Bedienpflicht in kurzen Einblendungen.

## Hot-Seat und Online

- **Hot-Seat:** Vor jeder eigenen Entscheidung kommt der Übergabe-Bildschirm. Weil beim Reizen ständig gewechselt wird, ist ein Vorab-Reizen möglich: Jeder legt verdeckt fest, „bis wohin“ er mitgeht. Das spart viele Übergaben.
- **Online:** Der Server mischt und gibt und hütet Hände und Skat. Ein Bot springt für Abwesende ein. Am Vierertisch kann der aussetzende Geber zuschauen.

## Tests

- **Reizwerte:** Die Liste stimmt mit allen möglichen Spielwerten überein.
- **Spielwerte:** Tabellenfälle mit Spitzen mit/ohne 1–4, mit und ohne Skat-Einfluss.
- Überreizen mit allen Gewinnstufen; Null-Werte.
- **Bedienpflicht:** Buben als Trumpf, Grand, Null.
- Stichsieger in allen Spielarten; Schneider- und Schwarz-Grenzen (30/31 und 90/91).
- **Seeger-Fabian** am Dreier- und Vierertisch.
- `playerView` verrät weder Skat noch gedrückte Karten noch fremde Hände.
- Bot-gegen-Bot-Serien laufen ohne Fehler durch.

## Offene Punkte

- ISkO-Text als Referenz beschaffen und Sonderfälle prüfen: falsches Beanspruchen, Aufgeben vor dem ersten Stich, Sonderfälle beim Reizen (z. B. wenn Mittel- und Hinterhand sofort passen).
- Deutsches Blatt (Eichel, Grün, Rot, Schellen) gestalten; dieselbe Vorlage dient Schafkopf.
