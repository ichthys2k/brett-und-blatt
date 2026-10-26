# Schafkopf

| Steckbrief | |
|---|---|
| Spieler | 4 |
| Dauer | 3–4 Minuten pro Spiel (kurzes Blatt: 2–3), eine Serie 30–90 Minuten |
| Modi | Solo gegen 3 Bots, Hot-Seat, online, gemischt |
| Muster | verdeckt: Hände und **im Sauspiel der Partner** sind geheim |
| Bausteine | Stich-Kern, Serien-Rahmen (aus [Skat](skat.md)), Kartenblatt deutsch/bayerisch |
| Aufwand | Regeln L, Oberfläche L, Bot XL |
| Etappe | 5, nach Skat |

**Regelgrundlage:** Bayerischer Schafkopf nach den Regeln der Schafkopfschule. Schafkopf hat viele regionale Varianten; die Referenz verhindert endlose Sonderfälle. Neben Sauspiel, Wenz und Solo sind Geier, Farbwenz, Bettel, Ramsch und das kurze Blatt wählbar.

## Regeln (Standard)

**Karten**

- 32 Karten (langes Blatt): Eichel, Gras, Herz, Schellen mit Sau (Ass), 10, König, Ober, Unter, 9, 8, 7. Jeder hat 8 Karten.
- Augen: Sau 11, 10 10, König 4, Ober 3, Unter 2. Zusammen 120.
- Die spielende Partei gewinnt mit 61 Augen. Schneider: Die Verlierer haben höchstens 30 Augen. Schwarz: Sie haben keinen Stich.

**Trumpf im Sauspiel und Farbsolo**

1. Ober: Eichel, Gras, Herz, Schellen
2. Unter: Eichel, Gras, Herz, Schellen
3. Die Trumpffarbe: Sau, 10, König, 9, 8, 7. Im Sauspiel ist das immer Herz.

**Spielansage**

- Reihum ab Vorhand sagt jeder „weiter“ oder „ich würde spielen“.
- Wollen mehrere spielen, gewinnt das ranghöhere Spiel. Bei gleichem Rang entscheidet die Sitzfolge.
- Rangfolge (Referenz prüfen): Sauspiel < Bettel < Wenz / Geier / Farbwenz < Farbsolo < Tout-Spiele.

**Spielarten**

- **Sauspiel (Rufspiel):** Der Spieler ruft eine Sau (nicht die Herz-Sau), deren Farbe er selbst führt, ohne die Sau zu haben. Wer die gerufene Sau hat, ist sein **geheimer Partner**.
  - Wird die Ruffarbe angespielt, muss die Rufsau fallen.
  - Der Partner darf mit mindestens 4 Karten der Ruffarbe „davonlaufen“, also unter der Sau ausspielen.
  - Die Rufsau darf nicht geschmiert werden, solange die Ruffarbe nicht gespielt ist.
- **Wenz:** Nur die vier Unter sind Trumpf. Ober stehen in ihrer Farbe zwischen König und 9.
- **Geier** (Option): Nur die vier Ober sind Trumpf.
- **Farbwenz** (Option): Unter plus eine gewählte Farbe sind Trumpf.
- **Farbsolo:** Ober, Unter und eine gewählte Farbe sind Trumpf. Der Spieler steht allein gegen drei.
- **Bettel** (Option): kein Trumpf; der Spieler darf keinen einzigen Stich machen. Die Reihenfolge der Karten wird nach der Referenz geprüft.
- **Tout:** Ansage, alle Stiche zu machen; verdoppelt den Wert.
- **Ramsch** (Option, wenn alle „weiter“ sagen): Jeder spielt für sich mit Trumpf wie im Sauspiel. Wer die meisten Augen hat, verliert. Die Sonderfälle „Jungfrau“ und „Durchmarsch“ richten sich nach der Referenz.

**Verdoppeln:** Die Gegenpartei darf „stoßen“ (Kontra), die spielende Partei antworten (Retour). Jede Stufe verdoppelt den Wert.

**Abrechnung in Punkten (kein Geld)**

- Tarif: Sauspiel, dazu Zuschläge für Schneider, Schwarz und jeden Laufenden.
- Laufende: lückenlose höchste Trümpfe einer Partei. Gezählt wird ab 3 im Sauspiel und Solo, ab 2 bei Wenz und Geier.
- Im Sauspiel bekommt jeder Gewinner den Wert, jeder Verlierer zahlt ihn.
- Im Solo bekommt bzw. zahlt der Solist den dreifachen Wert.
- Im Ramsch zahlt der Verlierer jedem der anderen.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Blatt | lang (32 Karten), kurz (24 Karten, ohne 7 und 8, je 6 Karten) | lang |
| Zusatzspiele | Geier, Farbwenz, Bettel | alle aus |
| Wenn alle weiter sagen | neu geben, Ramsch | neu geben |
| Stoß und Retour | an, aus | an |
| Tarif (Punkte) | 10/50, 10/20, 20/50 (Sauspiel / Solo; Zuschläge = kleiner Wert) | 10/50 |
| Spiele pro Serie | 4, 8, 12, 24 | 12 |
| Kartenbild | bayerisch, französisch mit Übersetzungshilfe (Lernhilfe für Neue) | bayerisch |

## Spielmodell

**Phasen:** `deal` → `bidding` (weiter / ich würde spielen) → `contract` (Spielart, Rufsau bzw. Farbe, ggf. Tout) → `play` mit Stoß-Fenster → `scoring`. Im Ramsch geht es direkt nach `bidding` zu `play`.

```ts
type SchafkopfMove =
  | { type: 'pass' }                                   // weiter
  | { type: 'wantToPlay' }                             // ich würde spielen
  | { type: 'declare'; contract: SchafkopfContract; calledSuit?: Suit; trumpSuit?: Suit; tout?: boolean }
  | { type: 'double' }                                 // stoßen bzw. Retour
  | { type: 'play'; card: Card };
```

- **Rufspiel-Regeln** sind als Zusatzprüfung im Stich-Kern umgesetzt: Rufsau zugeben, Davonlaufen, Schmierverbot.
- **Geheim (`playerView`):**
  - Jeder sieht die eigene Hand.
  - Den Partner im Sauspiel kennt nur der Partner selbst, bis die Rufsau fällt. Der Rufer kennt ihn nicht!
  - Öffentlich sind Ansagen, Stöße, Stiche und Liste.
- **Stoßen außerhalb der Reihe:** Wie die Ansagen bei Doppelkopf über mehrere `currentPlayers`. Das Fenster läuft bis zur ersten ausgespielten Karte, ohne Uhr.

## Bot

- **Spielwahl:** Handbewertung je Spielart.
  - Sauspiel: mindestens 4–5 Trümpfe und eine rufbare Farbe, in der man kurz ist.
  - Wenz: Unter plus Säue mit Längen.
  - Solo: etwa 6 Trümpfe oder mehr.
  - Bettel: nur niedrige Karten.

  Auf hoher Stufe wird per Simulation geprüft.
- **Sau rufen:** Der Bot wählt die Farbe, in der er nur eine Karte hält; so findet er den Partner schnell.
- **Partner erschließen:** Die Determinisierung legt die Rufsau immer zu einem der drei anderen. Weitere Hinweise: wer davonläuft, wer schmiert.
- **Kartenspiel:** Determinisierte MCTS plus Faustregeln: „Trumpf ziehen“ als spielende Partei, Partner schmieren, im Ramsch Augen meiden.
- **Stoßen:** wenn die eigene Gewinnwahrscheinlichkeit als Gegenpartei deutlich über 50 % liegt.

## Zeitlimits

| Voreinstellung | Spielansage | Karte spielen |
|---|---|---|
| gemütlich | aus | aus |
| normal | 10 s | 15 s + 60 s Zeitbank |
| schnell | 5 s | 8 s + 30 s Zeitbank |

**Bei Zeitablauf:** Bei der Ansage gilt „weiter“, beim Kartenspiel spielt der Bot. Stoß und Retour haben keine Uhr.

## Oberfläche

- **Bayerisches Blatt** im modernen Stil (siehe [Konzept](../KONZEPT.md#oberfläche)): große Zeichen (S, 10, K, O, U, 9, 8, 7), klare Farbsymbole für Eichel, Gras, Herz und Schellen, schlichte Bildkarten.
- **Ansage-Ablauf:** zuerst „weiter“ oder „ich würde spielen“, danach eine Kachelauswahl der erlaubten Spiele. Beim Sauspiel sind nur die rufbaren Säue wählbar.
- **Rufsau-Anzeige:** Die gerufene Sau steht sichtbar am Tisch, bis sie fällt.
- **Stoß-Knopf** sichtbar für die Gegenpartei bis zur ersten Karte.
- **Lernhilfe:** Einblendung der Trumpfreihenfolge je Spielart, Erklärung beim Davonlaufen.

## Hot-Seat und Online

- **Hot-Seat-Vereinfachung:** Stoßen nur, wenn man selbst am Zug ist (vor der eigenen ersten Karte).
- **Online:** Der Server hütet Hände und Partnerrolle.

## Tests

- Trumpfordnung für Sauspiel, Wenz, Geier, Farbwenz, Farbsolo, Bettel, Ramsch.
- Rufbarkeit von Säuen; Rufsau zugeben; Davonlaufen mit 4 Karten; Schmierverbot.
- Laufende je Spielart und mit kurzem Blatt; Schneider- und Schwarz-Grenzen; Tout.
- Stoß und Retour als Verdopplung; Abrechnung Sauspiel, Solo, Ramsch.
- `playerView` verrät den Partner nicht vor der Rufsau, auch nicht dem Rufer.
- Bot-gegen-Bot-Serien in allen Optionen.

## Umsetzung (Oktober 2026)

- `packages/games/schafkopf/src/rules.ts`: Bayerisches Schafkopf (Kurzes Blatt mit 24 Karten und langes Blatt mit 32 Karten; Sauspiel mit geheimer Rufsau und Rufbarkeitsprüfung, Davonlaufen mit 4 Karten der Ruffarbe, Schmierverbot, Wenz, Solo, Tout, Ramsch mit Jungfrau, Klopfen / Stoß mit Verdopplung, 8 Stiche, Serienabrechnung).
- `packages/games/schafkopf/src/bots.ts`: Schafkopf-Bot mit Handstärke-Bewertung für Sauspiel/Wenz/Solo, Rufsau-Findung und Stichspiel mit Partnerschmieren.
- `packages/games/schafkopf/src/ui/index.tsx`: Ansagedialog („Weiter“ / „Ich würde spielen“ mit Kacheln), Klopfen-Knopf, Anzeige der gerufenen Sau, `TrickTable`-Stichtisch mit bayerischem Kartenbild (Eichel, Gras, Herz, Schellen) und Serienliste.
- Server-Integration in `apps/server/src/games.ts` für Online-Partien.

## Offene Punkte

- Weitere Sondervarianten (Geier, Farbwenz, Bettel).
