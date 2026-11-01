# Marktstände – Bericht zur Bot-Probe (1.11.2026)

Probe vor dem Bau (W-039). Das Skript `scripts/marktstaende-probe.mjs` spielt den Entwurf aus [`umsetzungsplan-pakete-a-b-c.md`](umsetzungsplan-pakete-a-b-c.md) ohne Oberfläche durch. Cornelius hat den Vorschlag am 1.11.2026 freigegeben, das Spiel steht in [`marktstaende.md`](marktstaende.md).

```bash
node scripts/marktstaende-probe.mjs                                   # Entwurf
node scripts/marktstaende-probe.mjs --set="beste Ware, 3 Ausgaben"    # Vorschlag
```

Partien je Fall: 3000 bei den einfachen Bots, 300 sobald der rechnende Bot Krämer beteiligt ist. Bei 300 Partien schwanken die Anteile um etwa ±5 Prozentpunkte, kleine Unterschiede sagen also nichts.

## Ergebnis in Kürze

**Der Entwurf trägt so nicht:** Wer am meisten abräumt, gewinnt fast immer. **Mit einer Regeländerung und drei Ausgaben wird daraus ein ausgewogenes Spiel.**

| Vier Plätze | Entwurf | Vorschlag |
| --- | --- | --- |
| Meiste Karten gewinnt (fair 25 %) | ❌ 80 % | ✅ 21 % |
| Wenigste Karten gewinnt (fair 25 %) | ❌ 1 % | ✅ 19 % |
| Niedrigste Hand gewinnt (fair 25 %) | 🟡 38 % | ✅ 24 % |
| Geteilter Sieg | ✅ 4 % | ✅ 5 % |
| Abstand zwischen 1. und 2. | 9,6 Punkte | 4,9 Punkte |
| Krämer gegen drei Zufallsbots | 83 % | 81 % |
| Plätze mit Punktzahl unter 0 | 30 % | 46 % |

## Die wichtigsten Befunde

### 1. Im Entwurf ist Sammeln immer richtig

Wer in vielen Waren vorn liegt, bekommt alle ihre Sterne als Pluspunkte. Wer viele Karten nimmt, liegt in vielen Waren vorn. Deshalb gewinnt ein einzelner Zufallsbot gegen drei Bots, die das Abräumen meiden, in 94 % der Partien. Die Absicht des Entwurfs, Abräumen solle „manchmal“ ein Ziel sein, wird nicht erreicht: Es ist immer das Ziel.

### 2. Was nicht hilft

| Fassung (4 Plätze, Krämer an allen Plätzen) | meiste Karten gewinnt | wenigste Karten gewinnt |
| --- | --- | --- |
| Entwurf | 82 % | 1 % |
| Fünfte Karte bleibt am Stand liegen | 80 % | 1 % |
| Gleichstand zählt minus | 80 % | 3 % |
| Weniger Sterne | 83 % | 1 % |
| Je 3 Karten 1 Minuspunkt | 79 % | 2 % |
| Je 2 Karten 1 Minuspunkt | 74 % | 7 % |
| Die zwei besten Waren zählen plus | 71 % | 3 % |

### 3. Was hilft: Nur die beste eigene Ware zählt plus

**Neue Wertungsregel:** Nur die eigene stärkste Ware (die mit den meisten eigenen Karten, bei Gleichstand die mit den meisten Sternen) kann plus zählen, und nur, wenn man dort die meisten Karten aller Spieler hat. Alle anderen Sterne zählen minus.

Damit schadet ein gemischter Stand, und man muss entscheiden, wovon man lebt. Das ist auch als Regel leicht zu erklären: **Jeder Händler lebt von einer Ware.**

| Fassung (4 Plätze) | meiste Karten | wenigste Karten | geteilter Sieg | Abstand 1.–2. |
| --- | --- | --- | --- | --- |
| Nur beste Ware plus | 24 % | 19 % | 15 % | 2,2 |
| … fünfte Karte bleibt liegen | 33 % | 15 % | 13 % | 2,2 |
| … Gleichstand zählt minus | 33 % | 15 % | 15 % | 2,5 |
| … dazu je 3 Karten 1 Minuspunkt | 13 % | 41 % | 23 % | 2,2 |
| **… dazu drei Ausgaben** | **20 %** | **22 %** | **6 %** | **5,0** |

Eine Ausgabe allein ist zu knapp, jede siebte Partie endet geteilt. Bei **drei Ausgaben** wird nach jeder Ausgabe neu gemischt und ausgeteilt, die Vorratskammer bleibt, gewertet wird am Ende.

### 4. Der Vorschlag je Tischgröße

Krämer an allen Plätzen, drei Ausgaben, 300 Partien je Zeile.

| Plätze | Handkarten je Ausgabe | Abräumen je Partie | echte Wahl beim Legen | geteilter Sieg | meiste Karten gewinnt | wenigste Karten gewinnt | niedrigste Hand gewinnt | fair |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 10 | 11 | 84 % | 6 % | 56 % | 48 % | 51 % | 50 % |
| 3 | 10 | 18 | 84 % | 6 % | 30 % | 35 % | 35 % | 33 % |
| 4 | 10 | 24 | 83 % | 5 % | 21 % | 19 % | 24 % | 25 % |
| 5 | 10 | 30 | 83 % | 6 % | 18 % | 5 % | 25 % | 20 % |
| 6 | 9 | 32 | 84 % | 7 % | 19 % | 5 % | 17 % | 17 % |
| 8 | 7 | 32 | 85 % | 12 % | 20 % | 3 % | 14 % | 13 % |
| 10 | 5 | 28 | 87 % | 13 % | 22 % | 4 % | 10 % | 10 % |

Bis vier Plätze ist das Spiel in beide Richtungen ausgewogen. Ab fünf Plätzen hat Sammeln weiterhin keinen Vorteil, ganz wenig zu nehmen gewinnt aber nur noch selten. Das ist vertretbar: Wer kaum etwas sammelt, hat keine Plus-Ware, und vom Sammeln allein gewinnt man trotzdem nicht öfter als fair. Bei 8 und 10 Plätzen endet jede achte Partie geteilt; beim Bau braucht es eine Entscheidungsregel, etwa die meisten Sterne in der besten Ware.

### 5. Können zählt, aber keine Strategie gewinnt alles

Vorschlag, je einer gegen drei gleiche Bots auf vier Plätzen, fair 25 %.

| Der eine ↓ gegen die drei → | Zufall | Meider | Sammler | Krämer |
| --- | --- | --- | --- | --- |
| Zufall | – | 1 % | 7 % | 3 % |
| Meider | 73 % | – | 6 % | 5 % |
| Sammler | 65 % | 40 % | – | 10 % |
| Krämer | 81 % | 75 % | 51 % | – |

Überlegtes Spiel setzt sich klar durch: Der Krämer schlägt jeden anderen Stil, gegen Zufall auf allen Tischgrößen mindestens um das 1,8-Fache des fairen Werts. Zwischen Meider und Sammler gibt es keinen eindeutigen Sieger, sie gewinnen beide gegen Zufall, der Sammler aber deutlich gegen den Meider. Über Spannung am echten Tisch sagt das nichts.

### 6. Punkte unter null

Beim Vorschlag sind je nach Tischgröße 39–59 % der Plätze am Ende im Minus. Das passt zur Regel, aber es kann entmutigen, besonders Kinder. Das sollten Probepartien mit Menschen zeigen.

## Was die Probe nicht zeigt

- **Bots sind keine Menschen.** Der Krämer schaut nur einen Zug weit. Ob es Spaß macht und wie lange eine Partie dauert, lässt sich so nicht messen. Bei bis zu fünf Plätzen sind es 30 Züge je Spieler, das kann lang werden.
- **Startplatz:** Alle legen gleichzeitig, die Regeln bevorzugen keinen Platz. Die gemessenen Abweichungen liegen meist im Rauschen; ein Ausreißer zu zweit (8,7 Prozentpunkte) bleibt beim Bau im Prüfstand nachzumessen.
- **Sterne:** Die Verteilung (je Ware 5 × 0, 5 × 1, 5 × 2) ist eine Annahme, der Entwurf nennt nur „0 bis 2“.

## Vorschlag für den Bau

1. Wertung: Nur die stärkste eigene Ware kann plus zählen, alle anderen Sterne zählen minus.
2. Drei Ausgaben, Vorratskammer bleibt, Wertung am Ende. Kürzere Partie als Option: eine Ausgabe.
3. Die fünfte Karte kommt mit, der Stand ist danach leer (wie im Entwurf ausgelegt, das Liegenlassen war unausgewogener).
4. Gleichstand um die Führung in einer Ware zählt für alle plus.
5. Entscheidungsregel für geteilte Siege festlegen.
