# Mäxle

| Steckbrief | |
|---|---|
| Spieler | 2–10 (am schönsten ab 3) |
| Dauer | 5–15 Minuten |
| Modi | Solo gegen Bots, Hot-Seat, online, gemischt |
| Muster | verdeckt (der Wurf unter dem Becher), Zug um Zug, **Bluff** |
| Bausteine | **Würfel und Becher** (neu), flüchtige Signale (Emoji-Reaktionen) |
| Aufwand | Regeln S, Oberfläche M, Bot M |
| Etappe | 3 |

Bluff-Würfelspiel, auch „Meiern“ genannt. Gespielt wird mit **Leben** statt Getränken, damit es auch für Schule und Familie passt.

## Regeln (Standard)

- **Wurf:** zwei Würfel. Der höhere Würfel ist die Zehnerstelle: 4 und 2 ergibt 42.
- **Rangfolge** von niedrig nach hoch:
  1. 31, 32, 41, 42, 43, 51, 52, 53, 54, 61, 62, 63, 64, 65
  2. Pasche: 11, 22, 33, 44, 55, 66
  3. **Mäxle** (21), der höchste Wurf
- **Ablauf:**
  1. Wer am Zug ist, würfelt verdeckt, schaut heimlich und sagt einen Wert an, der **höher** sein muss als die vorige Ansage. Lügen ist erlaubt.
  2. Der Becher geht an den Nächsten. Er hat zwei Möglichkeiten:
     - **Glauben:** Er würfelt selbst (ohne den alten Wurf zu sehen) und muss höher ansagen.
     - **Anzweifeln:** Der Becher wird gehoben. Ist der Wurf niedriger als die Ansage (gelogen), verliert der Ansager ein Leben, sonst der Zweifler.
  3. Nach einem Lebensverlust beginnt der Verlierer eine neue Runde mit einer freien Ansage.
- **Mäxle angesagt:** Höher geht nicht mehr. Der Nächste kann glauben und verliert dann sofort ein Leben, ohne aufzudecken. Oder er zweifelt an: Ist es wirklich ein Mäxle, verliert er **zwei** Leben; war es gelogen, verliert der Ansager eins.
- Wer alle Leben verloren hat, scheidet aus. Der Letzte gewinnt.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Leben | 1–6 | 3 |
| Echtes Mäxle anzweifeln | kostet 2 Leben, kostet 1 Leben | 2 Leben |
| Blind weitergeben | aus, an (glauben und ohne zu würfeln eine höhere Zahl ansagen) | aus |
| Wertung | Leben (Ausscheiden), Strafpunkte (alle spielen bis zum Rundenende, wenigste Punkte gewinnt) | Leben |
| Schütteln | Würfeln per Handy-Schütteln, nur Knopf | Schütteln, wo verfügbar |

## Spielmodell

```ts
type MaexleMove =
  | { type: 'roll' }                              // Würfeln anstoßen; die Würfel selbst setzt die Spielleitung per Systemzug
  | { type: 'announce'; value: MaexleValue }
  | { type: 'believe' }
  | { type: 'doubt' }
  | { type: 'passBlind'; value: MaexleValue };    // nur mit Option „Blind weitergeben“
```

- **Würfeln ist ein Systemzug:** Der Spieler stößt das Würfeln an, die Spielleitung zieht die Zahlen aus dem Zufallsstrom „Würfel“. So kann online niemand seine Würfel selbst bestimmen.
- **Zustand:** aktueller Wurf unter dem Becher (geheim), letzte Ansage, Ansageverlauf der Runde, Leben bzw. Strafpunkte, aktiver Spieler, Ausgeschiedene.
- **Geheim (`playerView`):**
  - Den Wurf sieht nur, wer gerade gewürfelt hat. Beim Anzweifeln wird er für alle aufgedeckt.
  - Öffentlich sind Ansagen, Entscheidungen und Leben.
- **Flüchtige Signale:** Emoji-Reaktionen (🤨 😏 😱) gehören zum Bluffen dazu. Sie laufen über den eigenen Kanal und werden nicht gespeichert.

## Bot

Der Bot kennt die **Wahrscheinlichkeiten**: Jeder normale Wurf kommt mit 2/36, jeder Pasch mit 1/36, das Mäxle mit 2/36.

- **Anzweifeln oder glauben:** Der Bot schätzt, wie wahrscheinlich die Ansage stimmt. Dabei berücksichtigt er:
  - die Grundwahrscheinlichkeit, dass ein Wurf mindestens so hoch ist
  - die Lage des Ansagers: Musste er lügen, weil die Vorgabe hoch war?
  - sein **Bild vom Spieler**: Wie oft hat diese Person in dieser Partie gelogen?

  Er zweifelt, wenn die Ansage wahrscheinlich gelogen ist oder wenn ihm Glauben selbst zu riskant wäre, weil er die Ansage kaum überbieten kann.
- **Ansagen:** Ist der eigene Wurf hoch genug, sagt der Bot meist die Wahrheit, manchmal aber auch etwas mehr (Tarnung). Sonst lügt er. Er nimmt dann bevorzugt einen Wert knapp über der Vorgabe, gelegentlich einen kühnen Sprung, **zufällig gemischt**, damit er nicht durchschaubar wird.

| Stufe | Verhalten |
|---|---|
| leicht | einfache Schwellen, lügt auffällig |
| mittel | Wahrscheinlichkeiten, feste Lügenquote |
| schwer | Wahrscheinlichkeiten plus Spielerbild, angepasste, zufällige Lügenquote |

## Zeitlimits

| Voreinstellung | Pro Entscheidung |
|---|---|
| gemütlich | aus |
| normal | 12 s |
| schnell | 6 s |

**Bei Zeitablauf** entscheidet der Bot für den Spieler.

## Oberfläche

- **Becher und Würfel** in der Mitte. Würfeln geht per Knopf oder durch Schütteln des Handys (Bewegungssensor; auf iPhones muss man das einmal erlauben).
- **Heimlich schauen:** Den Becher **gedrückt halten**, um die Würfel zu sehen; beim Loslassen sind sie wieder verdeckt. Das schützt vor neugierigen Blicken, genau wie am echten Tisch.
- **Ansage:** eine Leiter mit allen Werten in Rangfolge. Nur höhere Werte sind wählbar; Pasche und Mäxle sind deutlich abgesetzt.
- **Spielerleiste** mit Herzen als Leben; der Ansageverlauf der Runde ist als Streifen sichtbar.
- **Aufdecken:** Der Becher hebt sich, dann folgt eine kurze Wartepause, bevor Ergebnis und Lebensverlust erscheinen.

## Hot-Seat und Online

- **Hot-Seat** funktioniert besonders natürlich. Das Gerät wird wie der Becher weitergereicht. Die Entscheidung „glauben oder zweifeln“ trifft man offen, und den eigenen Wurf sieht man nur per Gedrückthalten. Ein eigener Übergabe-Bildschirm ist nicht nötig, nur ein kurzer Hinweis „Becher an Ben“.
- **Online:** Der Server würfelt und hütet den Wurf; Emoji-Reaktionen in Echtzeit.

## Tests

- Rangfolge vollständig: 21 Werte, Mäxle am höchsten, Pasche über allen normalen Werten.
- Die Wahrscheinlichkeitstabelle ergibt zusammen 36/36.
- Ansage muss höher sein; Glauben, Anzweifeln mit Wahrheit und mit Lüge.
- Mäxle-Sonderfall mit beiden Optionen; blind weitergeben.
- Ausscheiden, Sieger, Strafpunkte-Wertung.
- `playerView` zeigt den Wurf nur dem Würfelnden bis zum Aufdecken.
- **Bot:** Der schwere Bot schlägt den leichten deutlich (statistischer Test); keine feste Lügenquote, die sich leicht ausnutzen lässt.
