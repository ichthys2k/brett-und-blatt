# Poker

| Steckbrief | |
|---|---|
| Spieler | 2–10 (Tischgröße bis 10 Plätze; Ein- und Ausstieg im laufenden Betrieb) |
| Dauer | 15–60 Minuten (Turnier oder offene Tischrunde) |
| Modi | Solo gegen Bots, Hot-Seat, online, gemischt |
| Muster | verdeckt (Handkarten), Zug um Zug, **Bluff**, Setzrunden mit Beträgen, **laufender Tischbeitritt (`joinMidGame`)** |
| Bausteine | Spielkarten (französisch, 52, auf Wunsch vierfarbig), Seed-Rng, `isLegal` für freie Beträge, **neu: Handbewertung, Setzrunde, Pots/Side-Pots, `joinSeat`/`leaveSeat` im laufenden Spiel** |
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

## Im laufenden Betrieb hinzukommen & verlassen (ab nächster Hand)

Damit sich Poker wie ein echter Spieltisch anfühlt, an den man sich jederzeit dazusetzen oder von dem man aufstehen kann:

- **Feste Tischplätze (bis zu 10 Stühle):** Ein Pokertisch hat `N` Stühle (Standard online: 6 Plätze, einstellbar 2–10). Jeder Stuhl hat einen Status:
  - `empty`: Platz ist frei – kann jederzeit von einem Menschen (oder lokal auch Bot) eingenommen werden.
  - `waiting`: Spieler hat sich während einer laufenden Hand hingesetzt (**„Spielt ab nächster Hand“**). Er hat bereits seinen Start-Stack (z. B. 100 BB), bekommt aber in der laufenden Hand noch keine Karten und zahlt noch keine Blinds.
  - `active`: Spieler spielt regulär mit.
  - `eliminated`: Spieler hat im Turniermodus alle Chips verloren (kann im offenen Tischmodus aufstehen oder für die nächste Hand neu einsteigen).
- **Systemzüge `joinSeat` und `leaveSeat` im Spielprotokoll (`session.log`):**
  - Setzt sich jemand auf Platz `seat`, führt `LocalSession` über `module.seatChangeMove` den Systemzug `{ type: 'joinSeat', seat }` aus. Weil dieser Zug im Log steht, bleibt `replay()` (z. B. beim Aufwachen des Cloudflare-Servers) zu 100 % deterministisch.
  - Beim Übergang zur **nächsten Hand** (`startHand`) wechseln alle Plätze mit Status `waiting` automatisch auf `active` und werden ganz normal mitgedealt.
- **Verlassen / Aufstehen (`leaveSeat`):**
  - Steht ein Spieler während einer laufenden Hand auf (oder verlässt den Raum):
    1. Ist er in der aktuellen Hand noch aktiv, wird seine Hand **sofort gepasst (`fold`)**. Bereits von ihm in dieser Hand gesetzte Chips bleiben im Pot. War er gerade am Zug, rückt der Zug sofort weiter; bleibt nur noch ein aktiver Spieler in der Hand übrig, gewinnt dieser den Pot.
    2. Sein Stuhl wechselt auf `empty` und wird in der **nächsten Hand** beim Austeilen und bei den Blinds übersprungen.
    3. Der Stuhl ist sofort wieder frei für neue Mitspieler.
- **Online-Raum & Startseite (`joinMidGame: true`):**
  - Freie Stühle bleiben beim Spielstart erhalten (über die versteckte Option `emptySeats`).
  - Öffentliche Poker-Räume bleiben auch während `phase === 'playing'` in der Liste „Offene Spiele“ auf dem Startbildschirm sichtbar, solange noch freie Stühle am Tisch sind.
  - Zuschauer im Raum können direkt auf einen freien Stuhl am Pokertisch klicken (**„Hinsetzen (nächste Hand)“** / `takeSeat`), sitzende Spieler jederzeit auf **„Aufstehen“** (`leaveSeat`).

## Grundregeln (für alle Varianten gleich)

- **Blatt:** 52 Karten, Ass hoch (in der Straße auch tief: A-2-3-4-5). Keine Farbenrangfolge beim Vergleich von Händen – Gleichstand teilt den Pot.
- **Rangfolge der Hände** (hoch → niedrig): Straight Flush (Royal Flush als höchster), Vierling, Full House, Flush, Straße, Drilling, Zwei Paare, Paar, Höchste Karte. Die besten **5** Karten zählen, Beikarten (Kicker) entscheiden.
- **Setzrunde:** Wer dran ist, kann **passen (Fold)**, **schieben (Check)** wenn nichts offen ist, **mitgehen (Call)**, **setzen (Bet)** oder **erhöhen (Raise)**, sowie **alles setzen (All-in)**. Die Runde endet, wenn alle Aktiven gleich viel gesetzt haben und jeder nach der letzten Erhöhung gehandelt hat.
- **Mindesterhöhung:** mindestens um den Betrag der letzten Erhöhung (mindestens ein Big Blind). Ein **zu kleines All-in** öffnet die Runde nicht neu für Spieler, die schon gehandelt haben.
- **Side-Pots:** Wer All-in ist, kann nur um so viel gewinnen, wie er selbst gesetzt hat (je Gegner). Überzählige Chips bei Teilung bekommt der erste Gewinner links vom Dealer.
- **Dealer-Knopf** wandert jede Hand eine Position weiter. **Heads-up (zu zweit):** Der Dealer ist Small Blind, handelt vor dem Flop zuerst, danach zuletzt.
- **Showdown:** Alle nicht gepassten Hände werden verglichen; die besten 5 Karten gewinnen den jeweiligen Haupt- bzw. Side-Pot. Geht keiner mit, gewinnt der letzte Setzer ohne Showdown.

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

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Einsatzstruktur (`structure`) | No Limit, Pot Limit, Fixed Limit | No Limit |
| Partieform (`mode`) | **Turnier** (steigende Blinds, Ausscheiden, Letzter gewinnt), **Offener Tisch (20 / 50 Hände)** | Turnier |
| Startchips (`stack`) | 50, 100, 200 Big Blinds | 100 BB |
| Blind-Tempo (`speed`, Turnier) | gemütlich (alle 15 Hände), normal (alle 10), schnell (alle 6) | normal |
| Ante (`ante`) | aus, ab Stufe 4, immer | ab Stufe 4 |
| Thema (`theme`) | Chips, Bohnen, Streichhölzer | Chips |
| Kartenbild (`deckStyle`) | klassisch, vierfarbig | vierfarbig |
| Lernhilfen (`aid`) | aus, Handname anzeigen | Handname |

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
  | { type: 'joinSeat'; seat: SeatId }   // Einstieg für die nächste Hand
  | { type: 'leaveSeat'; seat: SeatId }; // Ausstieg (laufende Hand wird gepasst, Platz ab nächster Hand frei)
```

- **Freie Beträge:** `legalMoves` liefert repräsentative Größen (Min, ½ Pot, ¾ Pot, Pot, All-in), `isLegal` prüft beliebige Beträge.
- **Geben ist kein Zug:** Karten kommen in `applyMove` aus dem Zufallsstrom im Spielstand. Online rechnet das nur der Server; `playerView` verbirgt Stapel, Rng und fremde verdeckte Handkarten.

## Bot („Pokerface“)

| Stufe | Verhalten |
|---|---|
| leicht | einfache Handstärke-Schwellen, passiv, blufft selten, ignoriert Position |
| mittel | Chen-Starthandbewertung + Monte-Carlo-Equity gegen zufällige Hände, Pot Odds, Position, feste Bluffquote |
| schwer | Equity gegen geschätzte Range, Spielerbild der Gegner (VPIP/PFR/Aggression), gemischte Bluff-/Wertquote, Push-or-Fold bei kleinen Stacks, Semi-Bluffs |

## Zeitlimits

| Voreinstellung | Pro Entscheidung | Zeitbank |
|---|---|---|
| gemütlich | aus | – |
| normal | 20 s | 60 s pro Partie |
| schnell | 10 s | 30 s |

**Bei Zeitablauf** (`timeoutMove`): schieben, wenn möglich, sonst passen.

## Oberfläche & Audio

- **Ovaler Tisch** mit bis zu 10 Plätzen ringsum; eigener Platz unten, Gegner kompakt oben/seitlich; freie Stühle mit direktem Knopf **„+ Hinsetzen (nächste Hand)“**, wartende Stühle mit Abzeichen **„Ab nächster Hand dabei“**.
- **Mitte:** Gemeinschaftskarten, Pot(s) mit Betrag, Dealer-Knopf, SB/BB-Marken.
- **Aktionsleiste:** Passen · Schieben/Mitgehen (mit Betrag) · Setzen/Erhöhen mit Schieberegler und Schnellknöpfen (Min, ½ Pot, ¾ Pot, Pot, All-in), dazu +/− sowie **„Aufstehen“**-Knopf zum Verlassen des Platzes.
- **Hot-Seat ohne Übergabe-Bildschirm** (`privateViews: false`): Handkarten liegen im Hot-Seat verdeckt und sind sichtbar, solange man „Karten ansehen“ gedrückt hält.
- **Ausführliche Soundeffekte:**
  - `deal`: echtes Kartenmischen (`fs-mischen`).
  - `street`: knackiges Aufdecken von Flop (2 Karten-Flips), Turn, River und All-in-Runouts (`drachen-karte-ziehen`, `karte-ziehen`).
  - `check`: kurzes, helles Klopfen auf den Tisch (`poker-check`).
  - `fold`: Karten verdeckt in den Muck schieben (`poker-fold`).
  - `call` & `bet`: gezielte Chip-Klänge in aufsteigender Tonhöhe (`poker-call`, `poker-bet`).
  - `raise`: Erhöhen mit höherem Münz-Ton und Akzent (`poker-raise`, `fs-pop`).
  - `allIn`: satter Tisch-Push + Chip-Kaskade (`poker-all-in`, `fs-auszahlung`).
  - `handEnd`: Pot-Gewinn ohne Showdown (`fs-auszahlung`, `paar`) bzw. mit Showdown mit Trommelwirbel und Gewinnglanz (`aufdecken`, `stapel-fertig`, `fs-auszahlung`).
  - `eliminated`: Ausscheiden bei Chipverlust (`leben-weg`).
  - `blindLevelUp`: Gong bei Blind-Erhöhung im Turnier (`schach`).
  - `joined` / `left`: Audio-Feedback beim Hinsetzen (`stein-heraus`) und Aufstehen (`karte-legen`).

## Entscheidungen (27.10.2026)

- Erste Veröffentlichung: Schritt 1 (Texas Hold'em inkl. laufendem Tisch-Ein- und Ausstieg).
- Thema: Chips als Standard, Bohnen und Streichhölzer wählbar.
- Lernhilfe: Handname als Standard.
- Klänge: Feine Abstufung aller Aktionen und Hand-Enden im Katalog (`catalog.json`); Playlist „Kartentisch“.
- Bot-Name: „Pokerface“.
