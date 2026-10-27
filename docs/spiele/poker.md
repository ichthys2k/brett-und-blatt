# Poker

| Steckbrief | |
|---|---|
| Spieler | 2–10 (je nach Variante, siehe Tabelle) |
| Dauer | 15–60 Minuten (Turnier, je nach Startchips und Blind-Tempo) |
| Modi | Solo gegen Bots, Hot-Seat, online, gemischt |
| Muster | verdeckt (Handkarten), Zug um Zug, **Bluff**, Setzrunden mit Beträgen |
| Bausteine | Spielkarten (französisch, 52, auf Wunsch vierfarbig), Seed-Rng, `isLegal` für freie Beträge, **neu: Handbewertung, Setzrunde, Pots/Side-Pots** |
| Aufwand | Regeln L, Oberfläche L, Bot XL |
| Etappe | 7 |
| Ordner | `packages/games/poker` |

## Jugendschutz und Rahmen

Laut Konzept: **Poker nur mit Spielgeld.** Konkret:

- Chips gibt es nur innerhalb einer Partie. **Kein Kontostand über Partien hinweg**, keine Meta-Währung, kein Nachkaufen mit irgendetwas, keine Bestenliste nach Chips.
- **Kein Casino-Look:** keine €/$-Zeichen, keine Spielautomaten-Effekte, kein Geldregen. Tisch neutral (Holz/Filz in gedeckten Farben).
- **Thema wählbar:** Chips, **Bohnen** oder **Streichhölzer** – wie früher am Küchentisch. Nur Optik, die Regeln bleiben gleich.
- In der Kurzanleitung ein Satz: „Gespielt wird nur um Spielchips – es gibt nichts zu gewinnen außer der Ehre.“
- Name „Poker“ und die Variantennamen (Texas Hold'em, Omaha, Stud …) sind Gattungsbegriffe, keine Marken.

## Grundregeln (für alle Varianten gleich)

- **Blatt:** 52 Karten, Ass hoch (in der Straße auch tief: A-2-3-4-5). Keine Farbenrangfolge beim Vergleich von Händen – Gleichstand teilt den Pot.
- **Rangfolge der Hände** (hoch → niedrig): Straight Flush (Royal Flush als höchster), Vierling, Full House, Flush, Straße, Drilling, Zwei Paare, Paar, Höchste Karte. Die besten **5** Karten zählen, Beikarten (Kicker) entscheiden.
- **Setzrunde:** Wer dran ist, kann **passen (Fold)**, **schieben (Check)** wenn nichts offen ist, **mitgehen (Call)**, **setzen (Bet)** oder **erhöhen (Raise)**, sowie **alles setzen (All-in)**. Die Runde endet, wenn alle Aktiven gleich viel gesetzt haben und jeder nach der letzten Erhöhung gehandelt hat.
- **Mindesterhöhung:** mindestens um den Betrag der letzten Erhöhung (mindestens ein Big Blind). Ein **zu kleines All-in** öffnet die Runde nicht neu für Spieler, die schon gehandelt haben.
- **Side-Pots:** Wer All-in ist, kann nur um so viel gewinnen, wie er selbst gesetzt hat (je Gegner). Überzählige Chips bei Teilung bekommt der erste Gewinner links vom Dealer.
- **Dealer-Knopf** wandert jede Hand eine Position weiter. **Heads-up (zu zweit):** Der Dealer ist Small Blind, handelt vor dem Flop zuerst, danach zuletzt.
- **Showdown:** Wer zuletzt gesetzt/erhöht hat, zeigt zuerst; danach im Uhrzeigersinn. Wer nicht gewinnen kann, darf seine Karten **verdeckt wegwerfen (muck)**. Geht keiner mit, gewinnt der letzte Setzer ohne Zeigen (Zeigen freiwillig).

## Varianten

| Variante | Handkarten | Gemeinschaftskarten | Plätze | Struktur-Standard | Schritt |
|---|---|---|---|---|---|
| **Texas Hold'em** | 2 | 5 (Flop 3, Turn, River) | 2–10 | No Limit | 1 |
| **Pineapple / Crazy Pineapple** | 3, eine abwerfen (vor bzw. nach dem Flop) | 5 | 2–10 | No Limit | 2 |
| **Omaha** | 4, **genau 2** davon + **genau 3** vom Board | 5 | 2–10 | Pot Limit | 2 |
| **Short Deck (6+)** | 2 | 5 | 2–6 | No Limit, Ante | 2 |
| **Five Card Draw** | 5, einmal tauschen | – | 2–6 | Fixed Limit oder No Limit | 3 |
| **Seven Card Stud** | 7 (3 verdeckt, 4 offen) | – | 2–7 | Fixed Limit, Ante + Bring-in | 3 |
| **Omaha Hi-Lo (8 or better)** | 4 | 5 | 2–10 | Pot Limit | 4 |
| **Seven Card Stud Hi-Lo** | 7 | – | 2–7 | Fixed Limit | 4 |

Besonderheiten:

- **Short Deck:** 36 Karten (2–5 entfernt). **Flush schlägt Full House**, A-6-7-8-9 ist die kleinste Straße. Option: Drilling schlägt Straße (Triton-Regel) oder umgekehrt. Statt Blinds nur Ante plus „Button-Blind“.
- **Omaha:** Die Pflicht „genau 2 + 3“ ist die häufigste Anfängerfalle – die Oberfläche zeigt deshalb immer die tatsächlich gewertete Hand.
- **Five Card Draw:** Nach der ersten Setzrunde tauscht jeder der Reihe nach 0–3 Karten (Option: 0–5, oder 4 nur mit Ass). Reicht der Stapel nicht, werden die Abwürfe neu gemischt. Hausregel **„Buben oder besser“** zum Eröffnen; eröffnet niemand, wird neu gegeben, die Antes bleiben im Pot.
- **Seven Card Stud:** Ante, die **niedrigste offene Karte** muss den Bring-in setzen (Gleichstand: Kreuz < Karo < Herz < Pik). Ab der 4. Karte beginnt die **höchste offene Hand**. 3./4. Karte kleiner Einsatz, 5.–7. großer Einsatz (offenes Paar auf der 4. Karte: großer Einsatz wahlweise). Reicht der Stapel für die 7. Karte nicht, kommt **eine Gemeinschaftskarte** in die Mitte.
- **Hi-Lo:** Der Pot wird geteilt zwischen der besten hohen und der besten tiefen Hand (fünf verschiedene Karten 8 oder niedriger, Straßen/Flushes zählen nicht, A-2-3-4-5 ist die beste). Ohne gültige tiefe Hand bekommt die hohe alles. Eine Hand kann beide Hälften gewinnen (Scoop); Viertelung bei Gleichstand.
- **Hausregeln (Schritt 4, nur in Draw):** Joker oder „Zweien wild“ (dann ist Fünfling die höchste Hand).

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Variante | siehe Tabelle | Texas Hold'em |
| Einsatzstruktur | No Limit, Pot Limit, Fixed Limit | je Variante |
| Partieform | **Turnier** (steigende Blinds, Ausscheiden, Letzter gewinnt), **Feste Handzahl** (z. B. 20/50 Hände, meiste Chips gewinnt) | Turnier |
| Startchips | 50, 100, 200 Big Blinds | 100 BB |
| Blind-Tempo (Turnier) | gemütlich (alle 15 Hände), normal (alle 10), schnell (alle 6) | normal |
| Ante | aus, ab Stufe X, immer | ab Stufe 4 |
| Nachkaufen (Rebuy) | aus, einmal in der ersten Stunde/den ersten 30 Händen | aus |
| Thema | Chips, Bohnen, Streichhölzer | Chips |
| Kartenbild | klassisch, vierfarbig | vierfarbig |
| Lernhilfen | aus, Handname anzeigen, Handname + Gewinnchance | Handname |
| Karten nach der Hand zeigen | erlaubt, nie | erlaubt |
| Variantenspezifisch | Pineapple: normal/crazy; Draw: Tauschgrenze, Buben oder besser; Short Deck: Drilling vs. Straße; Stud: offenes Paar | – |

Blinds steigen **nach Händen, nicht nach Uhrzeit** – das funktioniert gleich gut solo, im Hot-Seat und online und bleibt deterministisch.

## Spielmodell

```ts
type PokerMove =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'bet'; amount: number }      // erster Einsatz der Setzrunde
  | { type: 'raise'; to: number }        // erhöhen auf Gesamtbetrag der Runde
  | { type: 'allIn' }
  | { type: 'bringIn' } | { type: 'complete' }  // Seven Card Stud
  | { type: 'draw'; discard: CardId[] }  // Five Card Draw
  | { type: 'discard'; card: CardId }    // Pineapple
  | { type: 'show' } | { type: 'muck' }; // Showdown
```

- **Freie Beträge:** `legalMoves` liefert nur Beispiele (Min, ½ Pot, ¾ Pot, Pot, All-in), `isLegal` prüft beliebige Beträge – genau dafür gibt es `isLegal` in der Engine schon.
- **Geben ist kein Zug:** Karten kommen in `applyMove` aus dem Zufallsstrom im Spielstand (wie Mäxle/Eins!). Online rechnet das nur der Server; `playerView` nullt Stapel und Rng.
- **Zustand (reines JSON):** Variante und Optionen, Plätze (Chips, Handkarten, offen/verdeckt, gepasst, all-in, Einsatz dieser Runde/der Hand, ausgeschieden mit Platzierung), Dealer, Board, Stapel, Straße, Setzrunden-Status (am Zug, höchster Einsatz, letzte Erhöhung, wer seitdem gehandelt hat), Handnummer, Blind-Stufe, Protokoll der Hand, **Spielerbild** je Platz für den Bot (VPIP, Erhöhungsquote, Aggression, gezeigte Bluffs).
- **Geheim (`playerView`/`eventView`):** fremde Handkarten bis zum Showdown, gemuckte Karten für immer, Abwürfe in Draw/Pineapple. Offene Stud-Karten sind öffentlich. Zuschauer sehen keine Handkarten.
- **`sampleHidden`:** verteilt die unbekannten Karten zufällig (schwerer Bot: gewichtet nach geschätzter Range).
- **`result`:** Turnier – Platzierung nach Ausscheidereihenfolge (gleichzeitig Ausgeschiedene: mehr Chips vor der Hand = besser). Feste Handzahl – nach Chips.

### Aufbau im Paket

```
packages/games/poker/src/
  meta.ts, index.ts, rules.ts
  eval/high.ts      // 5–7 Karten, Bitmasken-Bewerter, ein Zahlenwert je Hand
  eval/low.ts       // A-5 Low (8 or better)
  eval/shortdeck.ts // geänderte Rangfolge
  betting.ts        // Setzrunde, Mindesterhöhung, Limit-Strukturen
  pots.ts           // Main-/Side-Pots, Teilung, Rest-Chip
  variants/         // holdem, pineapple, omaha, shortdeck, draw, stud – je Konfiguration + Straßen-Ablauf
  blinds.ts         // Turnier-Stufen
  bot/              // preflop-Tabellen, equity (Monte Carlo), ranges, Spielerbild, Bot
  ui/
```

Handbewertung, Setzrunde und Pots bleiben vorerst im Spielpaket; sollten sie später woanders gebraucht werden, wandern sie in die Engine.

## Bot

Name-Vorschlag: **„Pokerface“** (mit Spielerbild wie der Würfelfuchs). Der Bot bekommt nur seine `playerView`.

- **Vor dem Flop:** Starthand-Tabellen je Position und Stack-Tiefe (Hold'em: 169 Klassen; Omaha/Short Deck eigene Wertung). Im Turnier mit wenig Chips (< 15 BB) **Push-or-Fold** nach Tabellen.
- **Nach dem Flop:** Gewinnchance per **Monte-Carlo-Simulation** gegen die vermuteten Hände der Gegner, verglichen mit den **Pot Odds**. Dazu Draws (Flush-/Straßenchancen) für Semi-Bluffs.
- **Bluffen:** gemischte Strategie mit zufälliger, situationsabhängiger Quote (Position, Board, Anzahl Gegner), damit er nicht ausrechenbar ist.
- **Einsatzhöhe:** passend zur Board-Struktur und zur Hand (gleiche Größen für Bluff und Wert, sonst durchschaubar).
- **Draw/Stud:** Tauschtabellen; in Stud werden **tote Karten** (offen bei anderen) eingerechnet.

| Stufe | Verhalten |
|---|---|
| leicht | einfache Handstärke-Schwellen, passiv, blufft selten und auffällig, ignoriert Position |
| mittel | Equity gegen zufällige Hände, Pot Odds, Position, feste Bluffquote |
| schwer | Equity gegen **geschätzte Range** (wird mit jeder Aktion enger), Spielerbild der Gegner, gemischte Bluff-/Wertquote, Push-or-Fold, Semi-Bluffs |

Rechenbudget: Monte Carlo mit fester Anzahl Stichproben bzw. Zeitgrenze; Schrittweite auf dem Server in `apps/server/src/bots.ts` (`BOT_STEP_MS`) messen.

## Zeitlimits

| Voreinstellung | Pro Entscheidung | Zeitbank |
|---|---|---|
| gemütlich | aus | – |
| normal | 20 s | 60 s pro Partie |
| schnell | 10 s | 30 s |

**Bei Zeitablauf** (`timeoutMove`, wie am echten Tisch): schieben, wenn möglich, sonst passen. Dreimal in Folge → abwesend, Bot übernimmt (Plattformregel).

## Oberfläche

- **Ovaler Tisch** mit bis zu 10 Plätzen ringsum; Hochformat: eigene Karten groß unten, Gegner kompakt oben/seitlich (Chips, Einsatz, Status „gepasst/all-in“, Uhr-Ring). Querformat/Desktop: Tisch mittig, Seitenleiste mit Protokoll (vorhandenes `side:`-Layout).
- **Mitte:** Board-Karten, Pot(s) mit Betrag, Dealer-Knopf, SB/BB-Marken; Einsätze liegen vor den Plätzen und gleiten am Ende der Runde in den Pot.
- **Aktionsleiste:** Passen · Schieben/Mitgehen (mit Betrag) · Setzen/Erhöhen mit **Schieberegler** und Schnellknöpfen (Min, ½ Pot, ¾ Pot, Pot, All-in), dazu +/−. Tastatur: F/C/R, Enter.
- **Vorab-Knöpfe**, solange man nicht dran ist: „Schieben/Passen“, „Mitgehen (beliebig)“.
- **Lernhilfen:** Name der eigenen besten Hand („Zwei Paare, Damen und Siebenen“), optional Gewinnchance; jederzeit abrufbare **Rangliste der Hände**. Beim Showdown werden die 5 gewerteten Karten hervorgehoben.
- **Draw:** Karten antippen zum Tauschen, Knopf „3 tauschen“. **Stud:** offene Karten bei allen sichtbar, verdeckte nur eigene. **Pineapple:** Abwurfkarte antippen.
- **Kurzer Zwischenstand** nach jeder Hand (wer gewann womit), danach automatisch weiter; im Hot-Seat mit Knopf „Nächste Hand“.
- **Klänge:** vorerst vorhandene Kartenklänge (`ds_flipcard`, Mischen) – **Chip-Klänge brauchen neue Dateien, Auswahl durch Cornelius**. Musik: Playlist „Kartentisch“.

## Hot-Seat und Online

- **Hot-Seat ohne Übergabe-Bildschirm** wie bei Mäxle: Handkarten liegen verdeckt und sind nur sichtbar, solange man sie **gedrückt hält**. Kurzer Hinweis „Ben ist dran“. Lernhilfe „Gewinnchance“ im Hot-Seat nur beim Gedrückthalten.
- **Online:** Server gibt und hütet die Karten; Registrierung in `apps/server/src/games.ts` und `apps/server/package.json`. Emoji-Reaktionen gehören zum Bluffen dazu. Abwesende: Bot-Ersatz (Plattform), ausgeschiedene Spieler bleiben als Zuschauer.
- **Lernhilfe „Gewinnchance“ online** nur, wenn die Raumleitung es erlaubt (sonst wäre es ein Vorteil gegenüber Mitspielern ohne).

## Tests

- **Bewerter:** gegen eine einfache Brute-Force-Bewertung auf vielen Zufallshänden (5, 6, 7 Karten); alle 7.462 unterschiedlichen 5-Karten-Wertklassen; Häufigkeiten der Kategorien über alle 2.598.960 Hände (ggf. nur in einem langsamen, abrufbaren Test). Wheel, Kicker, Teilung.
- **Short Deck** (Flush > Full House, A-6-7-8-9), **Omaha** genau 2+3 (z. B. vier Herz auf dem Board ist kein Flush mit nur einer Herz-Handkarte), **Low** 8 or better inkl. Viertelung.
- **Setzrunde:** Mindesterhöhung, zu kleines All-in öffnet nicht neu, Pot-Limit-Höchstbetrag, Fixed-Limit-Deckel (4 Einsätze), Heads-up-Reihenfolge, Big Blind darf vor dem Flop noch erhöhen (Option).
- **Pots:** drei und mehr All-ins mit unterschiedlichen Stacks, Rest-Chip, Teilung im Side-Pot.
- **Stud:** Bring-in nach Farbe, höchste offene Hand beginnt, Gemeinschaftskarte bei leerem Stapel. **Draw:** Abwürfe neu mischen, Buben-oder-besser-Neugeben.
- **Turnier:** Blind-Stufen, Ausscheiden, Platzierung bei gleichzeitigem Ausscheiden, Spielende.
- `gameContractChecks`; `playerView` zeigt keine fremden Handkarten/gemuckte Karten; Zufallspartien mit ständigem Zeitablauf.
- **Bot:** schwer schlägt leicht und mittel statistisch deutlich (viele Turniere zu zweit und zu sechst); keine Absturz-/Endlosschleifen.

## Umsetzungsschritte

1. **Kern + Texas Hold'em:** Bewerter, Setzrunde (NL/PL/FL), Pots, Turnier- und Handzahl-Partie, Bot in drei Stufen, Oberfläche, Hot-Seat, Online-Registrierung. → erste Veröffentlichung.
2. **Gemeinschaftskarten-Varianten:** Pineapple/Crazy Pineapple, Omaha, Short Deck (wenig Mehraufwand, gleiche Oberfläche).
3. **Andere Abläufe:** Five Card Draw und Seven Card Stud (neue Tausch- bzw. Offene-Karten-Ansicht, Bring-in).
4. **Hi-Lo und Hausregeln:** Omaha Hi-Lo, Stud Hi-Lo, Wildcards in Draw.

Jeder Schritt mit `corepack pnpm check`, Browser-Test und Nachtrag in `CLAUDE.md`, `docs/spiele/poker.md` und `README.md` (Übersichtstabelle).

## Entscheidungen (27.10.2026)

Plan freigegeben; bis zu einer anderen Ansage gelten die Vorschläge:

- Erste Veröffentlichung: nur Schritt 1 (Texas Hold'em).
- Standard-Partieform: Turnier.
- Thema: Chips als Standard, Bohnen und Streichhölzer wählbar.
- Lernhilfe „Gewinnchance“ online aus.
- Klänge: vorerst vorhandene Kartenklänge; Chip-Klänge nur nach Auswahl durch Cornelius.
- Bot-Name: „Pokerface“.
- Weitere Varianten (2-7 Triple Draw, Razz, Badugi, Courchevel) vorgemerkt, nicht geplant.
