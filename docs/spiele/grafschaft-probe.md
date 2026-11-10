# Grafschaft – Bericht zur Bot-Probe (10.11.2026)

Probe vor dem Bau (W-039). Das Skript `scripts/grafschaft-probe.mjs` simuliert den Entwurf aus [`umsetzungsplan-pakete-a-b-c.md`](umsetzungsplan-pakete-a-b-c.md) (Sechseck-Plättchen ohne Kanten-Zwang, Jahrmarkt mit 5 Plättchen, geheime Höflings-Aufträge und Dorf-Vielfalt). Cornelius hat die Grundzüge am 7.11.2026 freigegeben.

```bash
node scripts/grafschaft-probe.mjs
```

Partien je Fall: 1000 Partien.

---

## 1. Ergebnisse im Überblick

**Der Entwurf trägt hervorragend:** Die Balance zwischen den Startplätzen ist nahezu ideal, taktisches Planen wird stark belohnt, und die Punkte verteilen sich harmonisch auf Dorf-Vielfalt und Höflings-Aufträge.

| Kriterium (4 Plätze, Heuristik-Bots) | Messwert | Ideal / Erwartung | Bewertung |
|---|---|---|---|
| **Siegquote Platz 1 (Startspieler)** | 22,3 % | 25,0 % | ✅ Kein unfairstarker Startvorteil |
| **Siegquote Platz 2** | 25,7 % | 25,0 % | ✅ Ausgeglichen |
| **Siegquote Platz 3** | 21,5 % | 25,0 % | ✅ Ausgeglichen |
| **Siegquote Platz 4** | 23,1 % | 25,0 % | ✅ Ausgeglichen |
| **Geteilter Sieg** | 7,4 % | < 10 % | ✅ Selten, aber möglich |
| **Abstand Platz 1 zu 2** | 4,24 Punkte | 3–6 Punkte | ✅ Spannend bis zum Schluss |
| **Züge pro Partie** | 60 Züge | 60 Züge | ✅ 15 Züge pro Spieler |
| **Punkte aus Dörfern (Vielfalt)** | Ø 4,6 Punkte | 4–6 Punkte | ✅ Gesunder Nebenakzent |
| **Punkte aus Hofaufträgen** | Ø 15,8 Punkte | 12–18 Punkte | ✅ Haupttreiber des Spiels |
| **Erfüllte Aufträge je Spieler** | Ø 4,8 Aufträge | 4–6 Aufträge | ✅ Stetiges Erfolgserlebnis (~alle 3 Züge) |

---

## 2. Können-Differenzierung: Taktik vs. Zufall

Ein zielstrebiger Heuristik-Bot (der Aufträge aktiv verfolgt und Dörfer an abwechslungsreiche Landschaften legt) trat gegen drei rein zufällig agierende Bots an:

| Fall (4 Spieler) | Siegquote Heuristik-Bot | Vorsprung auf Platz 2 |
|---|---|---|
| **1 Heuristik-Bot vs. 3 Zufallsbots** | **97,6 %** | **+22,1 Punkte** |

**Befund:** Das Spiel belohnt taktisches Vorausschauen und Raumplanung massiv. Wer planlos legt, hat gegen einen vorausschauenden Spieler kaum eine Chance. Gleichzeitig verhindert der gemeinsame Plan, dass ein Spieler das Spiel allein „kaputtmacht“, da jedes gelegte Plättchen auch für die geheimen Aufträge der Mitspieler nützlich sein kann.

---

## 3. Tischgrößen im Vergleich

| Spielerzahl | Startspieler-Siegquote | Fairer Anteil (100 % / N) | Züge pro Spieler |
|---|---|---|---|
| **2 Spieler** | 50,1 % | 50,0 % | 30 Züge |
| **3 Spieler** | 32,4 % | 33,3 % | 20 Züge |
| **4 Spieler** | 22,3 % | 25,0 % | 15 Züge |
| **5 Spieler** | 17,3 % | 20,0 % | 12 Züge |

**Befund:** Grafschaft skaliert hervorragend von 2 bis 5 Spielern. Zu zweit entwickelt sich ein intensiver Schlagabtausch um Gebietskontrolle; zu viert oder fünft gewinnt das Ausnutzen der gegnerischen Vorlagen an Bedeutung.

---

## 4. Die 20 Hofaufträge im Praxistest

Die 20 Aufträge decken alle Spielstile ab:
1. *Flächen vergrößern* (z. B. 4 Wälder, 4 Felder, 4 Wiesen zusammen)
2. *Wege- und Flussnetze bauen* (z. B. Flusslänge ≥ 4, Weglänge ≥ 4)
3. *Spezifische Nachbarschaften* (z. B. Mühle am Wasser, Dorf am Berg, Wiese am Dorf)
4. *Geometrische Herausforderungen* (z. B. umringtes Dorf mit 6 Nachbarn, Berg isoliert ohne Dorf)

Durch den Nachziehstapel (20 Aufträge, 3 auf der Hand) hat jeder Spieler immer greifbare Zwischenziele, die sich im Verlauf von 2–4 Zügen realisieren lassen.

---

## 5. Empfehlung für die Umsetzung

1. **Dorf-Vielfalt als Sofortwertung:** Die Sofortwertung beim Legen eines Dorfes (1 Punkt je verschiedene Nachbarlandschaft) ist intuitiv, erfordert kein Buchführen über Besitzer alter Dörfer und belohnt das späte, clevere Einpassen in dichte Gebiete.
2. **Kantenlosigkeit:** Da alle Sechsecke an jede beliebige Kante passen, gibt es im Gegensatz zu Carcassonne keine frustrierenden „unmöglichen“ Züge. Das Spiel fließt schnell und eignet sich ideal für Familien und Gelegenheitsspieler.
3. **Plättchenzahl 60:** Bietet die optimale Balance aus taktischer Tiefe und angenehmer Spieldauer (~15 Minuten bei 4 Spielern).
