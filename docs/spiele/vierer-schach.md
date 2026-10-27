# Vierer-Schach

| Steckbrief | |
|---|---|
| Spieler | 4 (Plätze mit Menschen oder Bots) |
| Dauer | 20–60 Minuten |
| Modi | Solo gegen Bots, Hot-Seat, online, gemischt |
| Muster | offen, Zug um Zug |
| Bausteine | Gitterbrett (14 × 14, Kreuzform), Lupe für kleine Bildschirme |
| Aufwand | Regeln – (übernommen), Oberfläche M, Bot – (übernommen) |
| Etappe | 2, fertig und veröffentlicht |

**Übernahme** aus Cornelius' Projekt `4playerchess`. Regeln und Bot liegen unverändert und noch untypisiert unter `src/legacy/` (`engine.ts`, `bot.ts`). `src/rules.ts` bindet sie an die Spielmodul-Schnittstelle an. Dieser Plan beschreibt den gebauten Stand.

## Regeln (wie bei chess.com)

- **Brett:** 14 × 14 Felder ohne die 3 × 3-Ecken, also 160 Felder. Rot sitzt unten, Blau links, Gelb oben, Grün rechts.
- **Zugreihenfolge** im Uhrzeigersinn: Rot, Blau, Gelb, Grün (Platz 0–3).
- **Figuren** ziehen wie beim Schach, auch Rochade und en passant gibt es (en passant auch über Kreuz). Jeder König blickt auf die Dame gegenüber.
- **Matt und Patt** werden erst festgestellt, wenn die betroffene Farbe am Zug ist. Bis dahin kann ein anderer Spieler die Lage noch ändern.
- **Ein König im Schach**, der nicht geschützt ist, kann geschlagen werden. Das kann passieren, wenn ein Dritter dazwischen gezogen hat.

### Jeder gegen jeden (Standard)

- **Punkte fürs Schlagen:** Bauer 1, Springer 3, Läufer 5, Turm 5, Dame 9. Eine umgewandelte Dame bringt nur 1 Punkt.
- **Schach mehrerer Gegner** mit einem Zug: zwei Könige +5 (nur mit Damen +1), drei Könige +20 (nur mit Damen +5).
- **Matt:** +20 für den, der Schach gibt. Geben mehrere Schach, bekommt die Punkte, wer zuletzt gezogen hat. Der Mattgesetzte scheidet aus, seine Figuren bleiben als **graue Hindernisse** stehen. Sie greifen nicht an, versperren aber den Weg.
- **Patt:** Der Pattgesetzte scheidet aus und bekommt selbst +20.
- **Umwandlung** auf der 8. Reihe, immer zur Dame.
- **Sieg beanspruchen:** Sind nur noch zwei übrig und liegt jemand 21 Punkte oder mehr vorn, kann diese Person die Partie beenden. Der andere bekommt dann +20.
- **Unentschieden-Regeln** (dreifache Wiederholung, 50 Züge je aktivem Spieler ohne Schlagen und Bauernzug, nur noch Könige): Die Partie endet, alle Aktiven bekommen +10.
- **Ende:** Wenn nur noch einer übrig ist. Es gewinnt, wer die meisten Punkte hat; bei Gleichstand gewinnen mehrere.

### Teams

- **Rot und Gelb gegen Blau und Grün.** Partner sitzen sich gegenüber und können sich nicht schlagen. Ein Feld, das nur der Partner angreift, gilt bei der Rochade nicht als bedroht.
- **Das erste Matt entscheidet** (ebenso ein geschlagener König). Patt ist unentschieden.
- **Umwandlung** auf der 11. Reihe, Figur nach Wahl.
- Punkte gibt es keine.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Spielart | Jeder gegen jeden, Teams | Jeder gegen jeden |

## Spielmodell

```ts
type FourChessMove =
  | { t: 'm'; p: Color; f: number; to: number; pr?: 'Q' | 'R' | 'B' | 'N' }   // pr nur im Teammodus
  | { t: 'claim'; p: Color };                                              // Sieg beanspruchen
```

- **Felder als Zahl** 0–195 (Zeile × 14 + Spalte), Zeile 0 oben bei Gelb.
- **Zustand** (aus der alten Engine): Brett, Farbe am Zug, aktive Farben, Grund des Ausscheidens, Punkte, Rochaderechte, offene En-passant-Möglichkeiten, Zähler für die 50-Züge-Regel, Stellungszähler, Protokoll und Ergebnis. Er ist reines JSON.
- **Kopie vor jedem Zug:** Die alte Engine verändert ihren Spielstand direkt. Deshalb arbeitet `applyMove` auf einer Kopie (`structuredClone`). Die Schnittstelle bleibt so rein.
- **Umwandlung:** Im Teammodus liefert `legalMoves` vier Einträge pro Umwandlungszug, sonst einen ohne Angabe (immer Dame).
- **Ereignisse:** `moved` (mit geschlagener Figur), `claimed` und `over`.
- Keine Geheimnisse: `playerView` gibt den ganzen Spielstand zurück.

## Bot

Der **Faustregel-Bot** aus `4playerchess` (`src/legacy/bot.ts`). Er rechnet nicht voraus, sondern bewertet jeden erlaubten Zug für sich:

- Material gewinnen, besonders Könige und ungedeckte Figuren
- nichts einstellen (bedrohte eigene Figuren, Zielfeld angegriffen?)
- Schach und Matt geben
- Figuren entwickeln, zur Mitte ziehen, rochieren, umwandeln

Ein Sieganspruch wird immer genutzt, wenn er möglich ist.

| Stufe | Verhalten |
|---|---|
| leicht | in 40 % der Fälle ein zufälliger Zug, sonst Faustregeln |
| mittel | Faustregeln mit spürbarem Zufall |
| schwer | Faustregeln mit wenig Zufall (Zufall auf 30 % gedämpft) |

Die allgemeine MCTS wäre bei vier Spielern auf 160 Feldern zu langsam. Der Zufallsbot bleibt zum Testen. Einen Tipp-Knopf gibt es nicht (`hints` ist aus).

## Zeitlimits

| Voreinstellung | Modell |
|---|---|
| gemütlich | aus |
| normal | 30 s pro Zug + 60 s Zeitbank |
| schnell | Schachuhr 5 Minuten + 3 s pro Zug |

**Bei Zeitablauf** zieht der Bot.

## Oberfläche

- **Kreuzbrett** über das Gitterbrett. Es ist so gedreht, dass die eigene Farbe unten sitzt. Im Hot-Seat ist das die Farbe am Zug, online der eigene Platz.
- **Figuren** als Textzeichen in den vier Farben; ausgeschiedene Figuren sind grau.
- **Ziehen:** Figur antippen, dann das Ziel (oder durch Antippen eines freien Feldes abwählen). Figuren gleiten flüssig über das 14×14-Raster (`useGridMoveAnimation`, inkl. aller 4 Perspektiven und Rochade). Im Teammodus erscheint bei einer Umwandlung eine Auswahl mit Abbruchmöglichkeit (Hintergrundklick oder ✕).
- **Hervorhebungen:** letzter Zug, schlagbare Figuren, Zielpunkte.
- **Schach- & Fesselungswarnung:** Versucht man eine gefesselte Figur zu bewegen oder den König ins Schach zu ziehen, erklärt ein kurzer Warnhinweis (z. B. mit Angabe von Angreiferfigur, gegnerischer Farbe und Feld) den Grund. Auf dem Kreuzbrett werden die gefesselte Figur, der eigene König und die gegnerische Angreiferfigur farblich hervorgehoben.
- **Lupe** (🔍 in der freien Ecke oben rechts) ab Feldern unter 36 px. Sie vergrößert das Brett auf 170 % in einem verschiebbaren Ausschnitt, der unten in der Mitte beginnt. Die Einstellung merkt sich jedes Gerät in `localStorage`.
- **Knopf „🏆 Sieg beanspruchen“**, sobald das erlaubt ist.
- **Spieler-Chips** mit Farbe und Punkten bzw. Team, dazu der Grund des Ausscheidens. Im Querformat stehen sie bei drei oder mehr Spielern kompakt zu zweit (`data-crowded`).

## Hot-Seat und Online

- Keine Geheimnisse, also keine Übergabe. Das Brett dreht sich zur Farbe am Zug.
- Online ist jeder Platz einzeln mit Mensch oder Bot besetzbar. Fällt jemand aus, übernimmt nach 20 s der Bot.

## Tests

- `test/legacy-engine.test.ts` (übernommen und ergänzt): Startaufstellung, Zugreihenfolge, Rochade (auch seitlich und mit Teampartner als „Angreifer“), en passant über Kreuz, Umwandlung in beiden Spielarten, Matt und Patt in beiden Spielarten, König schlagen, Teampartner nicht schlagbar, Doppelschach-Punkte, Aufgeben, Sieg beanspruchen, Wiederholung, Zufallspartien mit exaktem Nachspielen, Bot findet Matt und schlägt eine ungedeckte Dame, Bot bewertet 1-Punkt-Dame mit 1 statt 9 Punkten, vier Bots spielen eine Partie zu Ende.
- `test/four-player-chess.test.ts`: Anbindung an die Schnittstelle (20 Eröffnungszüge, alter Spielstand bleibt unverändert, Bot-Züge im richtigen Format, En-Passant-Schlagereignis mit Klang), Aufgeben (nur die eigene Farbe scheidet aus, auch ohne am Zug zu sein; vorzeitiges Ausscheiden disqualifiziert vom Sieg; Teammodus: Team verliert; Nachspielen und Zurücknehmen), Zeitablauf mit Schachuhr (nur die eigene Farbe bzw. das Team scheidet aus) und `gameContractChecks`.
- `test/check-warning.test.ts`: Fesselungserkennung über Kreuz (auch über alle vier Himmelsrichtungen), Fesselungslinie, bestehendes Schachgebot und verbotener Zug ins Schach.

## Aufgeben

Aufgeben ist ein Spielzug `{ t: 'resign', p: Farbe }`, den die Spielleitung über `resignMove` aus der Schnittstelle erzeugt – jederzeit, auch ohne am Zug zu sein. Er steht nicht in `legalMoves`, damit Bots nie aufgeben. Im Modus „Jeder gegen jeden“ scheidet nur diese Farbe aus (Figuren werden grau, die Punkte bleiben), die anderen spielen weiter; wer aufgegeben hat oder wessen Zeit abgelaufen ist, kann die Partie nicht mehr gewinnen und wird im Endklassement hinter allen regulär verbliebenen Spielern platziert. Ist nur noch ein aktiver Spieler übrig, gewinnt dieser. Im Teammodus verliert das ganze Team. Läuft bei „Schnell“ die Schachuhr ab, geschieht dasselbe mit dem Grund „Zeit abgelaufen“ (`resignMove(state, seat, 'time')`, Zug mit `time: true`). Ausgeschiedene sehen keinen „Aufgeben“-Knopf mehr (`canResign`, online im Feld `canResign` der Spielnachricht).

## Offene Punkte

- **Protokoll anzeigen:** Die Engine schreibt Züge und Ereignisse mit Punkten ins `log`. Die Oberfläche zeigt es noch nicht.
- **Typisieren:** Erledigt – `src/legacy/engine.ts`, `bot.ts` und `test/legacy-engine.test.ts` sind vollständig in TypeScript typisiert (`@ts-nocheck` entfernt).
- **Stärkerer Bot:** eine flache Suche (zwei bis vier Halbzüge, „paranoid“ oder „max-n“) über den Faustregeln.
