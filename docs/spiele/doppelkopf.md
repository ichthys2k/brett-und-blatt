# Doppelkopf

| Steckbrief | |
|---|---|
| Spieler | 4 aktiv; am Fünfertisch setzt der Geber aus |
| Dauer | 4–6 Minuten pro Spiel, eine Serie 45–120 Minuten |
| Modi | Solo gegen 3 Bots, Hot-Seat, online, gemischt |
| Muster | verdeckt: Hände **und Teams** sind geheim |
| Bausteine | Stich-Kern, Serien-Rahmen, Kartenblatt französisch (aus [Skat](skat.md)) |
| Aufwand | Regeln XL, Oberfläche L, Bot XL |
| Etappe | 5, nach Skat und Schafkopf |

**Regelgrundlage:** Turnierspielregeln (TSR) des Deutschen Doppelkopf-Verbands (DDV) mit 48 Karten. Einzige wählbare Zusatzregel: **Pflichtsolo**. Die TSR-Details unten sind beim Bau gegen den Regeltext zu prüfen (siehe offene Punkte).

## Regeln (Standard)

**Karten und Teams**

- 48 Karten: 9, 10, Bube, Dame, König, Ass je zweimal in vier Farben. Jeder bekommt 12 Karten.
- Normalspiel: Wer eine Kreuz-Dame hat, spielt „Re“, die anderen „Kontra“. Die Teams sind zu Beginn geheim.

**Trumpf (Normalspiel), von hoch nach tief**

1. Herz-10 („Dulle“)
2. Damen: Kreuz, Pik, Herz, Karo
3. Buben: Kreuz, Pik, Herz, Karo
4. Karo: Ass, 10, König, 9

Fehlfarben: Kreuz und Pik mit Ass, 10, König, 9; Herz mit Ass, König, 9. Bei zwei gleichen Karten sticht die zuerst gespielte.

**Augen und Gewinn**

- 240 Augen insgesamt. Re gewinnt mit 121, Kontra mit 120, solange niemand angesagt hat.
- Mit Ansagen verschieben sich die Grenzen nach TSR.

**Ansagen und Absagen**

- „Re“ bzw. „Kontra“ ist erlaubt, solange man noch mindestens 11 Karten hat.
- Danach jeweils eine Karte später: „keine 90“, „keine 60“, „keine 30“, „schwarz“.
- Ansagen sind **jederzeit innerhalb dieser Fenster** möglich, auch wenn man gerade nicht am Zug ist.

**Wertung**

- Gewonnen +1, dazu je +1 für keine 90, keine 60, keine 30, schwarz.
- Ansage Re +2, Kontra +2, jede Absage +1.
- „Gegen die Alten“ +1, wenn Kontra das Normalspiel gewinnt.
- Sonderpunkte im Normalspiel: Fuchs gefangen (Karo-Ass des Gegners), Doppelkopf (Stich mit mindestens 40 Augen), Karlchen (Kreuz-Bube macht den letzten Stich).

**Vorbehalte** (vor dem ersten Stich fragt jeder reihum „gesund“ oder „Vorbehalt“)

- **Hochzeit:** Wer beide Kreuz-Damen hat, sucht einen Partner. Partner wird, wer innerhalb der ersten drei Stiche als Erster einen Stich macht. Gelingt das nicht, spielt der Hochzeiter allein.
- **Stille Hochzeit:** Wer beide Kreuz-Damen hat und schweigt, spielt ein verstecktes Solo.
- **Soli:**
  - Damensolo und Bubensolo: nur Damen bzw. Buben sind Trumpf.
  - Farbsoli Kreuz, Pik, Herz, Karo: Dulle, Damen, Buben, dann die gewählte Farbe.
  - Fleischloser: kein Trumpf.
- Der Solist spielt gegen drei. Seine Wertung zählt dreifach, Sonderpunkte gibt es nicht.
- Rangfolge der Vorbehalte nach TSR: Solo vor Hochzeit; bei Gleichrang entscheidet die Sitzfolge.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Tisch | 4 Spieler, 5 Spieler (Geber setzt aus) | 4 |
| Spiele pro Serie | 4, 8, 12, 24 (Turnier) | 12 |
| Pflichtsolo | aus, an (jeder muss pro Serie ein Solo spielen, sonst „Vorführung“ am Ende) | aus |
| Lernhilfen | erlaubte Karten hervorheben, Trumpfreihenfolge einblenden, Augen mitzählen | Hervorheben an |

Nicht vorgesehen (bewusst): ohne Neunen, zweite Dulle sticht erste, Armut, Schmeißen.

## Spielmodell

**Phasen:** `deal` → `reservations` (gesund/Vorbehalt) → `reservationResolve` (Solo wählen, Hochzeit) → `play` (12 Stiche, mit Ansagefenstern) → `scoring`.

```ts
type DokoMove =
  | { type: 'healthy' }                              // gesund
  | { type: 'reservation' }                          // Vorbehalt anmelden
  | { type: 'chooseContract'; contract: DokoContract } // Solo-Art oder Hochzeit
  | { type: 'announce'; call: 're' | 'kontra' | 'no90' | 'no60' | 'no30' | 'schwarz' }
  | { type: 'play'; card: Card };
```

- **Ansagen außerhalb der Reihe:** Während `play` liefert `currentPlayers` den Spieler am Zug (für `play`) **und** alle, die gerade ansagen dürfen (für `announce`). Die Schnittstelle unterstützt das schon. Ansagen haben keine Uhr: Wer nichts sagt, sagt nichts an.
- **Zustand:** Hände, Teamzugehörigkeit (geheim), öffentlich bekannte Teamzugehörigkeiten, Vorbehalte, Vertrag, Ansagen mit Kartenstand, Stiche, Sonderpunkte, Serienliste, Pflichtsolo-Konto je Spieler.
- **Geheim (`playerView`):**
  - Jeder sieht die eigene Hand und kennt damit sein eigenes Team.
  - Fremde Teams werden erst sichtbar durch Ansage, durch eine gespielte Kreuz-Dame, durch die Hochzeitsklärung oder am Spielende.
  - Eine stille Hochzeit kennt nur der Solist.
- **Wiederverwendung:** Stich-Kern mit eigener Trumpfordnung je Vertrag; Gleichrang-Regel „erste gespielte sticht“; Serien-Rahmen mit Pflichtsolo-Sonderregel (der Geber bleibt nach einem Pflichtsolo).

## Bot

- **Vorbehalt:** Handbewertung für jede Solo-Art (Trümpfe, Asse, Fehlfarben) mit Schwellenwert. Mit Pflichtsolo gibt es eine Strategie, das Solo bei einer passenden Hand zu „ziehen“, statt auf die Vorführung zu warten.
- **Teams erschließen:** Der Bot führt Wahrscheinlichkeiten, wer Re ist. Grundlage: gespielte Damen, Ansagen und typische Spielweisen, z. B. wer den Fuchs schützt oder wer „schmiert“. Die Determinisierung verteilt die Karten immer so, dass genau zwei Kreuz-Damen im Spiel sind und alle öffentlichen Hinweise passen.
- **Ansagen:** Der Bot schätzt seine Gewinnwahrscheinlichkeit per Simulation und sagt an, wenn sie über einer stufenabhängigen Schwelle liegt.
- **Kartenspiel:** Determinisierte MCTS plus Faustregeln: Fuchs sichern bzw. fangen, Karlchen planen, Doppelkopf-Stiche füttern, als Kontra früh Trumpf ziehen.

| Stufe | Teamerkennung | Ansagen | Spielen |
|---|---|---|---|
| leicht | nur sichere Hinweise | nie | einfache Regeln |
| mittel | Wahrscheinlichkeiten | vorsichtig | MCTS, wenige Durchläufe |
| schwer | voll | mutig | MCTS, viele Durchläufe |

## Zeitlimits

| Voreinstellung | Vorbehalt | Karte spielen |
|---|---|---|
| gemütlich | aus | aus |
| normal | 10 s | 15 s + 60 s Zeitbank |
| schnell | 5 s | 8 s + 30 s Zeitbank |

**Bei Zeitablauf:** Beim Vorbehalt gilt „gesund“, außer ein Pflichtsolo ist fällig; dann wählt der Bot das Solo. Beim Kartenspiel spielt der Bot. Ansagen haben keine Uhr.

## Oberfläche

- **12 Karten im Hochformat:** überlappender Fächer, bei dem die angetippte Karte hochfährt. Wird es zu eng, Umschalten auf zwei Reihen (Trumpf oben, Fehl unten).
- **Ansage-Knopf** („Re!“, „keine 90“ …) ist sichtbar, solange er erlaubt ist, mit Hinweis „noch bis zu deiner 2. Karte“.
- **Teamanzeige:** Avatare bekommen ein Re- bzw. Kontra-Abzeichen, sobald es öffentlich bekannt ist. Das eigene Team sieht man immer.
- **Sonderpunkte** werden als kleine Feier eingeblendet (Fuchs gefangen, Karlchen, Doppelkopf).
- **Auflösung:** Augen, Ansagen, Sonderpunkte und Rechenweg; die Serienliste mit Pflichtsolo-Häkchen.

## Hot-Seat und Online

- **Hot-Seat-Vereinfachung:** Ansagen nur, wenn man selbst am Zug ist. Außerhalb der Reihe müsste man die eigene Hand sehen, und die liegt hinter dem Übergabe-Bildschirm.
- **Online:** Ansagen außerhalb der Reihe sind voll möglich. Der Server legt die Reihenfolge fest, falls Ansage und Karte gleichzeitig ankommen.

## Tests

- Trumpfordnung je Vertrag (Normalspiel, alle Soli, Fleischloser).
- Gleiche Karten: die erste sticht.
- Ansagefenster je Kartenzahl, auch nach einer Hochzeit.
- Gewinngrenzen mit und ohne Ansagen.
- Sonderpunkte: Fuchs, Karlchen, Doppelkopf; keine Sonderpunkte im Solo.
- Hochzeit: Partner gefunden bzw. nicht gefunden; stille Hochzeit.
- Pflichtsolo: Geber bleibt, Vorführung am Ende.
- `playerView` verrät keine fremden Teams vor der Aufdeckung.
- Bot-gegen-Bot-Serien.

## Umsetzung (Oktober 2026)

- `packages/games/doppelkopf/src/rules.ts`: DDV-Standard (48 Karten ohne Neunen / 9 bis Ass doppelt; Dulle H10 höchster Trumpf vor Kreuz-Damen; Vorbehaltsabfrage, Normalspiel mit geheimen Re-Parteien über Kreuz-Damen, Hochzeit mit Partnerfindung in den ersten drei Stichen, Soli: Damen-, Buben-, Fleischlos-, Farbsolo; Ansagen Re/Kontra, keine 90, keine 60; Sonderpunkte: Fuchs gefangen, Doppelkopf, Karlchen im 12. Stich; 4er- und 5er-Tisch mit Geberaussetzen).
- `packages/games/doppelkopf/src/bots.ts`: Doppelkopf-Bot mit Vorbehaltsevaluation (Hochzeit bei 2 Kreuz-Damen), Trumpf- und Fehlfarbenbedienung.
- `packages/games/doppelkopf/src/ui/index.tsx`: Vorbehaltsabfrage („Gesund“ / „Vorbehalt“), Solo-Auswahl, Ansage-Knöpfe vor Kartenausspielung, Anzeige der bekannten Re-Mitglieder, `TrickTable` und Abrechnung.
- Server-Integration in `apps/server/src/games.ts` für Online-Partien.
- **Pflichtsolo (31.10.2026, W-003, `ruleVersion` 3):** Option „Pflichtsolo“. Das erste Solo eines Spielers in der Serie ist sein Pflichtsolo: Der Solist kommt heraus, das Spiel zählt nicht als Spiel der Serie und der Geber gibt noch einmal (`mandatoryDone`, `contract.mandatory`). Weitere Soli sind Lustsoli (Vorhand kommt heraus, zählen normal). Ein fälliges Pflichtsolo hat Vorrang vor früheren Vorbehalten. **Vorführung:** Bleiben nicht mehr Spiele übrig, als Spieler ein Pflichtsolo schulden, entfällt die Vorbehaltsabfrage und der erste Schuldner ab Vorhand muss ein Solo wählen (`forcedSeat`, ohne Hochzeit). Die Serie endet erst, wenn alle Pflichtsoli gespielt sind (am 5er-Tisch notfalls mit einem Nachspiel, wenn der Schuldner gerade gibt). Der Bot zieht sein Pflichtsolo mit einer brauchbaren Hand früher (Schwelle −2, ab 7 Trümpfen) und wählt bei der Vorführung das beste Solo. Oberfläche: Pflichtsolo-Stand mit Häkchen, Hinweis bei der Vorführung, „Solo offen/✓“ im Spieler-Chip.

## Offene Punkte

- Stichproben-Suche (PIMC) getestet und **nicht übernommen** (29.10.2026): Bei 400 Blättern kein Gewinn (−0,15 ± 0,12 Punkte je Spiel), auch mit 80 Verteilungen nicht. Der Bot spielt weiter nach den Faustregeln. Behalten wurde die bessere Kartenverteilung in `sampleHidden` (Farbenlücken, Team nach Kreuz-Damen); `pimcMove` lässt sich bei Bedarf mit `dokoHeuristicBot` als Rollout-Bot wieder anschließen. Mögliche Ursache: Die Team-Unsicherheit macht die Schätzungen sehr verrauscht.
