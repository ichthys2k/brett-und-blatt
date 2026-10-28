# Binokel

| Steckbrief | |
|---|---|
| Spieler | 3 aktiv; am 4er-Tisch setzt der Geber aus (optional: Kreuzbinokel 2 gegen 2) |
| Dauer | 4–6 Minuten pro Spiel, eine Serie auf 1000/1500 Punkte ca. 30–60 Minuten |
| Modi | Solo gegen 2 Bots, Hot-Seat, online, gemischt |
| Muster | verdeckt (Hände, Dabb, gedrückte Karten), Phasenablauf mit Vorbehalten |
| Bausteine | Stich-Kern, Serien-Rahmen, Kartenblatt württembergisch/deutsch (oder französisch/vierfarbig), TrickTable |
| Aufwand | Regeln L, Oberfläche L, Bot XL |
| Etappe | 7, nach Eins! und Dame |
| Ordner | `packages/games/binokel` |

**Regelgrundlage:** Traditionelles schwäbisches Binokel (Benoggl) nach den gängigen Turnier- und Vereinsregeln (u. a. Binokel-Palast, D'Benoggler Tübingen, TSV Kleinengstingen, Naturfreunde Metzingen).

---

## 1. Regeln (Standard)

### Karten und Werte
Gespielt wird mit einem **doppelten Blatt**:
- **Standard (40 Karten, ohne Siebener):** Je zwei Sau/Ass, 10, König, Ober (Dame), Unter (Bube) in den vier Farben Herz, Schippe/Grün, Eichel, Schellen.
- **Variante mit Siebenern (48 Karten):** Zusätzlich je zwei 7er (Augenwert 0); eine Trumpf-7 bringt als „Dissle“ 10 Meldepunkte.

**Augenwerte im Stichspiel:**
- Sau (Ass): 11 Augen
- 10: 10 Augen
- König: 4 Augen
- Ober (Dame): 3 Augen
- Unter (Bube): 2 Augen
- (7: 0 Augen)
- Letzter Stich: **10 Extrapunkte**
- Gesamtaugen im Spiel: **250 Augen** (240 Kartenaugen + 10 für den letzten Stich).

Bei zwei identischen Karten im selben Stich sticht stets die **zuerst gespielte**.

---

### Sitzordnung und Geben
- 3 aktive Spieler. Am Vierertisch setzt der Geber aus (oder spielt als Partner im Kreuzbinokel).
- Spielrichtung: Im Gegenuhrzeigersinn (schwäbische Tradition: der Spieler rechts vom Geber ist Vorhand).
- Austeilen bei 40 Karten: Vorhand, Mittelhand und Hinterhand erhalten je 12 Karten (z. B. 4 – Dabb 2 – 4 – Dabb 2 – 4); 4 Karten wandern verdeckt als **Dabb** (Tapp) in die Tischmitte.
- Austeilen bei 48 Karten: Jeder erhält 15 Karten (5 – Dabb 3 – 5 – 5); 3 Karten im Dabb.

---

### Reizen (Steigern)
Die Spieler bieten darauf, wer Alleinspieler wird und wie viele Gesamtpunkte (Meldepunkte + erspielte Stichaugen) er garantiert zu erzielen.
- Mindestgebot: 150 Punkte (in der Lobby konfigurierbar: 150 / 200 / 250 / 300).
- Vorhand beginnt und muss das Mindestgebot ansagen oder passen („weg“).
- Mittelhand reizt Vorhand in 10er-Schritten (160, 170, ...). Vorhand hält („hab ich“) oder passt.
- Der Sieger dieses Duells reizt gegen Hinterhand.
- Wer am Ende das höchste Gebot hält, gewinnt das Reizen und wird **Spielmacher**.
- Passen alle drei Spieler sofort, wird neu gemischt und gegeben (oder optional Ramsch gespielt).

---

### Dabb aufdecken, Tauschen und Drücken
1. Der Spielmacher dreht die Karten des Dabbs für alle sichtbar um (wichtige taktische Information für alle Spieler!).
2. Er nimmt die Dabb-Karten auf seine Hand (hat nun 16 bzw. 18 Handkarten).
3. Er drückt verdeckt dieselbe Anzahl an Karten (4 bzw. 3 Karten) wieder weg.
   - Die gedrückten Karten zählen am Ende zu seinen Stichaugen.
   - Sie dürfen **nicht** in seine Meldungen einfließen.
4. Der Spielmacher sagt die **Trumpffarbe** an (Eichel, Grün/Schippe, Herz oder Schellen).
5. **Abgehen (Aufgeben vor dem Spiel):** Erkennt der Spielmacher nach dem Dabb, dass sein Gebot unerreichbar ist, kann er vor dem Melden „abgehen“. Sein Gebot wird ihm einfach (statt doppelt) abgezogen; die Gegenspieler erhalten ihre gemeldeten Punkte sowie je eine Pauschale (z. B. 50 Punkte).

---

### Melden (Meldbilder)
Bevor der erste Stich gespielt wird, legen alle Spieler ihre Meldungen offen auf den Tisch.
Eine Karte kann einmal pro Gruppe verwendet werden:

#### Gruppe 1: Paare, Familien und Rundgang
- **Einfaches Paar** (König + Ober einer Fehlfarbe): **20 Punkte**
- **Trumpf-Paar** (König + Ober in Trumpf): **40 Punkte**
- **Familie in Fehlfarbe** (Ass, 10, König, Ober, Unter): **100 Punkte**
- **Familie in Trumpf** (Ass, 10, König, Ober, Unter): **150 Punkte**
- **Rundgang** (4 Paare – König + Ober aller 4 Farben): **240 Punkte** (140 Punkte für 4 Paare + 100 Punkte Bonus)
- **Doppelte Trumpffamilie** (beide kompletten Sätze in Trumpf): **1000 Punkte**

*(Hinweis: Eine Familie schließt das einfache Paar derselben Farbe ein; es gibt dafür nicht noch einmal extra 20 bzw. 40 Punkte, es sei denn, man hält ein zweites Paar aus den verbliebenen Karten).*

#### Gruppe 2: Gleiche Ränge (Vierer-Tand)
Je eine Karte der 4 verschiedenen Farben:
- **4 Asse:** **100 Punkte**
- **4 Könige:** **80 Punkte**
- **4 Ober:** **60 Punkte**
- **4 Unter:** **40 Punkte**
- **Alle 8 Karten eines Rangs:** **1000 Punkte**

#### Gruppe 3: Binokel
- **Einfacher Binokel** (Schippe/Grün-Ober + Schellen-Unter bzw. Pik-Dame + Karo-Bube): **40 Punkte**
- **Doppelter Binokel** (beide Schippe-Ober + beide Schellen-Unter): **300 Punkte**

#### Gruppe 4 (nur bei 48 Karten): Dissle
- Je gehaltene Trumpf-7: **10 Punkte** (zwei Dissle: **20 Punkte**).

#### Die fundamentale Stich-Bedingung („Stich machen“)
**Meldepunkte zählen nur, wenn der Spieler im Stichspiel mindestens einen Stich gewinnt!**
Macht ein Spieler keinen einzigen Stich, verfallen all seine gemeldeten Punkte restlos („gemeldet ist nicht gestochen“).

---

### Das Stechen (Stichspiel)
Vorhand spielt zum ersten Stich aus. Es gelten drei strikte Pflichten:
1. **Farbzwang:** Die angespielte Farbe muss bedient werden.
2. **Stechzwang / Überstichzwang:** Wer die Farbe bedient, muss nach Möglichkeit eine höhere Karte spielen als die aktuell höchste im Stich.
3. **Trumpfzwang:** Wer die angespielte Farbe nicht besitzt, **muss** einen Trumpf spielen. Liegt bereits ein Trumpf im Stich, muss nach Möglichkeit ein höherer Trumpf gelegt werden (Überstichzwang auf Trumpf).
4. Nur wer weder bedienen noch trumpfen kann, darf eine beliebige Fehlfarbe abwerfen.

Den Stich gewinnt der höchste Trumpf, oder mangels Trümpfen die höchste Karte der angespielten Erstfarbe. Der Gewinner zieht die Karten ein und spielt zum nächsten Stich aus.

---

### Sonderspiel: Durch (Durchmarsch)
Der Spielmacher kann nach dem Dabb statt einer Trumpffarbe einen **Durch** ansagen:
- Er verpflichtet sich, **alle Stiche** der Runde allein zu gewinnen.
- Es gibt **keinen Trumpf**, und es darf **nichts gemeldet** werden.
- Der Spielmacher spielt die erste Karte aus (unabhängig von der Vorhand).
- Sobald ein Gegenspieler auch nur einen einzigen Stich macht, ist das Spiel sofort verloren.
- Wertung: Einfacher Durch **1000 Punkte**, Offener Durch (Karten liegen offen) **1500 Punkte**, Hand-Durch **2000 Punkte**.

---

### Abrechnung und Spielziel
Am Ende einer Runde:
- **Gegenspieler:** Haben sie mindestens einen Stich gemacht, erhalten sie ihre Stichaugen + ihre gemeldeten Punkte. Ohne Stich schreiben sie 0.
- **Spielmacher:**
  - Erreicht er sein Reizgebot (Meldungen + Stichaugen + Dabb-Augen ≥ Gebot): Alle erzielten Punkte werden gutgeschrieben.
  - Verfehlt er sein Gebot: Der **doppelte Reizwert** wird als Minuspunkte abgezogen (bei vorherigem „Abgehen“ wird der einfache Reizwert abgezogen). Stichaugen und Meldungen verfallen für ihn.
- **Partieziel:** Typischerweise **1500 Punkte** (oder 1000 Punkte). Wer die Zielmarke zuerst erreicht, gewinnt. Bei gleichzeitigem Überschreiten gewinnt der Spielmacher; liegen Gegenspieler vorn, gewinnt die höhere Punktzahl.

---

## 2. Optionen in der Lobby

| Option | Werte | Standard | Beschreibung |
|---|---|---|---|
| **Tischformat** | 3 Spieler, 4 Spieler (Geber setzt aus), 4 Spieler (Kreuzbinokel) | 3 Spieler | Dreiertisch oder Vierertisch mit wechselndem Aussetzen bzw. Partnerspiel |
| **Kartendeck** | 40 Karten (ohne 7er), 48 Karten (mit 7er / Dissle) | 40 Karten | Modernes schwäbisches Blatt oder Traditionsblatt mit 7ern |
| **Kartenbild** | Württembergisch/Bayerisch, Französisch (vierfarbig) mit Hilfssymbolen | Württembergisch | Eichel/Gras/Herz/Schellen oder Kreuz/Pik/Herz/Karo |
| **Mindestgebot** | 150, 200, 250, 300 | 150 | Startwert für die Reizphase |
| **Zielpunktzahl** | 1000 Punkte, 1500 Punkte, 6 Spiele, 12 Spiele | 1500 Punkte | Siegbedingung der Partie |
| **Durch-Ansage** | An (1000/1500/2000), Aus | An | Ermöglicht Durchmarsch-Ansagen ohne Trumpf |
| **Gutschrift bei Abgehen** | 50 Punkte für Gegner, Halbes Gebot für Gegner, 0 Punkte | 50 Punkte | Entschädigung für Gegenspieler beim Aufgeben des Alleinspielers |
| **Lernhilfen** | Melde-Assistent an/aus, Legale Karten hervorheben, Augen mitzählen | Melde-Assistent an, Hervorheben an | Hilft Anfängern beim Finden aller Meldbilder und bei der Überstichpflicht |

---

## 3. Spielmodell

### Phasenablauf
`deal` → `bidding` → `dabbDecision` (Tausch & Drücken) → `trumpChoice` → `meld` → `play` (12 bzw. 15 Stiche) → `scoring` → nächstes Spiel der Serie.

```ts
type BinokelMove =
  | { type: 'bid'; value: number }                      // Reizen: Wert bieten
  | { type: 'pass' }                                    // Passen („weg“)
  | { type: 'takeDabb' }                                // Dabb aufnehmen
  | { type: 'discard'; cards: CardId[] }                // 4 bzw. 3 Karten drücken
  | { type: 'declareTrump'; suit: Suit }                // Trumpffarbe bestimmen
  | { type: 'declareDurch'; variant: 'simple' | 'open' | 'hand' } // Durchmarsch
  | { type: 'fold' }                                    // Abgehen (Aufgeben vor dem Spiel)
  | { type: 'confirmMelds'; melds: DeclaredMeld[] }     // Meldebilder auslegen
  | { type: 'play'; card: CardId };                     // Karte in den Stich spielen
```

### Erweiterung des Stich-Kerns (`packages/engine/src/tricks.ts`)
Binokel benötigt über die bisherige Bedienpflicht hinaus:
1. **`mustOvertake: boolean`**: Pflicht, eine höhere Karte derselben effektiven Farbe zu spielen, wenn möglich.
2. **`mustTrump: boolean`**: Pflicht, mit Trumpf zu stechen, wenn die angespielte Erstfarbe nicht bedient werden kann.
3. **`overtakeTrump: boolean`**: Pflicht, einen bereits liegenden Trumpf zu übertrumpfen, wenn möglich.

Diese Parameter werden sauber als optionale Konfiguration `TrickRulesConfig` in `tricks.ts` integriert, wovon künftig auch andere traditionelle Spiele (z. B. Gaigel, Tarock) profitieren.

### Automatischer Melde-Algorithmus (`src/melds.ts`)
Ein deterministischer Optimierungs-Algorithmus ermittelt für jede Hand die punkthöchste Aufteilung in die drei disjunkten Meldegruppen:
- Dynamische Programmierung / Greedy-Suche mit Vorrang für 1000er-Vollserien, Doppelten Binokel (300) und Trumpffamilien (150).
- Ausgabe als strukturierte Meldeobjekte für die UI und den Bot.

---

## 4. Bot („Schwaben-Ass“)

Der Binokel-Bot ist in drei Stufen unterteilt:

1. **Reizen:**
   - Berechnet den Handwert: sichere Meldeunkte auf der Hand + statistische Wahrscheinlichkeit, im Dabb passende Ergänzungskarten zu finden (z. B. zweiter Schellen-Unter für doppelten Binokel) + erwartete Stichaugen (~60–90).
   - Stufe `easy`: Reizt vorsichtig bis max. 220, schätzt den Dabb kaum.
   - Stufe `medium`: Bewertet Dabb-Wahrscheinlichkeiten realistisch, reizt bis zu 80 % des Erwartungswerts.
   - Stufe `hard`: Vollständige Rollout-Simulation unter Berücksichtigung der Spielerposition und der Chance, als Vorhand den ersten Stich zu kontrollieren.

2. **Drücken:**
   - Bewertet alle möglichen Drück-Kombinationen (bei 16 Karten 4 drücken = 1820 Kombinationen).
   - Ziel: Fehlfarben blank machen (um früh mit kleinen Trümpfen stechen zu können), Augen (Zehnen/Asse) sicher im Dabb parken, aber keine wertvollen Meldekarten zerstören.

3. **Kartenspiel:**
   - **Determinisierte Monte-Carlo-Baumsuche (PIMC)**:
     - Verteilt die unbekannten Karten konsistent mit den offenen Meldungen, dem gezeigten Dabb und bisherigen Farbabwürfen.
     - Kennt die Stech- und Trumpfpflicht der Mitspieler und nutzt Überstich-Situationen gezielt aus.
     - **Taktische Priorität für Gegenspieler:** Frühzeitig mindestens einen Stich machen, um die eigenen Meldepunkte abzusichern!
     - **Taktische Priorität für Spielmacher:** Gezielt einen Gegenspieler stichlos halten („schwarz spielen“), wenn dieser eine hohe Meldung (z. B. 100 oder 300) liegen hat.

---

## 5. Zeitlimits

| Voreinstellung | Reizen / Drücken | Zugbedenkzeit | Bank |
|---|---|---|---|
| gemütlich | 60 s | 30 s | aus |
| normal | 30 s | 15 s | aus |
| schnell | 15 s | 8 s | 1 Minute Schachuhr |

---

## 6. Oberfläche (Web & Mobil)

- **Spielfeld:** Stimmungsvolle Wirtshaustisch-Atmosphäre (Filz-/Holzoptik) mit 3 Spielerplätzen (Benutzer unten, Gegenspieler schräg links und rechts).
- **Dabb in der Mitte:** Aufdecken mit sanfter 3D-Drehanimation; beim Drücken intuitive Kartenauswahl mit Kontrollzähler („Noch 2 Karten drücken“).
- **Melde-Phase:**
  - Nach der Trumpfwahl öffnet sich die Meldeübersicht: Vor jedem Spieler liegen seine Meldebilder als Kartenfächer mit Punkt-Badges (`Binokel +40`, `Familie +150`).
  - Ein Klick auf „Bestätigen“ übernimmt die Punkte; Tooltips erklären jedes Meldebild.
- **Stich-Tisch (`TrickTable`):**
  - Zeigt gespielte Karten um den Mittelpunkt.
  - Karten, die nach Farb- oder Überstichzwang nicht legal sind, werden ausgegraut; bei Berührung zeigt ein dezenter Hinweis den Grund („Du musst Grün mit einer höheren Karte überstechen“).
  - Kurze Anzeige des fertigen Stichs mit Einzugsanimation zum Stichgewinner.
- **Anschreibtafel:**
  - Original schwäbische Kreidetafel / Anschreibeblock als ausklappbares Panel:
  - Spalten für die 3 Spieler mit Zeilen je Spiel: `[Meldung] + [Stiche] = [Rundensumme] | [Gesamtstand]`.

---

## 7. Tests & Verifikation

- **Melde-Engine:** Vollständige Test-Suite für alle Meldekombinationen (einfacher/doppelter Binokel, Rundgang, Trumpf-/Fehlfamilie, 4/8 Gleiche, Dissle, Mehrfachnutzung von Karten über Gruppengrenzen hinweg).
- **Stichlogik & Zwangsprüfung:** Tests für Farbzwang, Überstichzwang, Trumpfzwang und Übertrumpfungszwang.
- **Dabb & Drücken:** Prüfung auf exakte Kartenzahlen und korrekte Verrechnung der gedrückten Augen.
- **Stich-Bedingung:** Verifikation, dass stichlose Spieler 0 Meldepunkte gutgeschrieben bekommen.
- **Durch-Regeln:** Vorzeitiges Partiende bei Stichverlust im Durchmarsch.
- **Vertragsprüfung:** Standardmäßige `gameContractChecks` (deterministischer Rng, Replay-Fähigkeit, Serialization-Integrität).

---

## Umsetzungsstand (28.10.2026, Neufassung)

Die erste Fassung war nicht spielbar (Platzhalter-Oberfläche, Zustand mit `Set`, Kartenkennungen ohne Kopie-Nummer, offene Sicht, keine Tests). Sie wurde in Etappe 3 des Korrekturplans neu geschrieben:

- `src/cards.ts`: doppeltes Blatt als `C1.1`, `C1.2` … (40 oder 48 Karten), Rangfolge, Stichvertrag mit Farb-, Überstich-, Trumpf- und Übertrumpfzwang (`binokelContract`).
- `src/melds.ts`: Meldungen je Gruppe ohne Doppelzählung innerhalb einer Gruppe – Familie 100/150, doppelte Trumpf-Familie 1000, Paar 20/40, Rundgang +100 (auf vier freie Paare), vier Gleiche 100/80/60/40, acht Gleiche 1000, Binokel 40, doppelter Binokel 300, Dissle je 10.
- `src/rules.ts`: Reizen reihum (jeder bietet oder ist „weg“), offener Dabb für den Spielmacher, Drücken, Trumpf/Durch/Abgehen, Meldungen automatisch, Stichspiel, Abrechnung wie oben (Meldungen nur mit Stich, verfehltes Gebot doppelt, Abgehen einfach plus Gutschrift, Durch ±1000). Partie bis 1000/1500 Punkte, spätestens nach 24 Spielen. Sicht verdeckt fremde Hände, den Dabb bis zum Aufdecken und die gedrückten Karten; `sampleHidden` lässt gemeldete Karten beim Besitzer.
- `src/bot/index.ts`: „Schwaben-Ass“ – Handwert je Trumpf (Meldungen + geschätzte Augen), reizt bis zu dieser Schätzung (leicht ×1,1, mittel ×0,95, schwer ×0,9), drückt Karten kurzer Farben, geht bei hoffnungslosem Blatt ab, im Stich Faustregeln (Gegenspieler sichern zuerst einen Stich für ihre Meldung, schmieren dem Mitspieler).
- `src/ui/index.tsx`: Reizknöpfe, Dabb, Drückauswahl, Trumpfwahl mit Meldevorschau, Meldeübersicht, Stichtisch, Abrechnungstabelle.
- `test/binokel.test.ts`: Vertragsprüfungen, Meldungen, Stichregeln, ganze Partien der Bots, Gewinnquote der Spielmacher.

**Noch offen:** Vierertisch und Kreuzbinokel, offener Durch und Hand-Durch, Melden von Hand statt automatisch, Lernhilfen als Optionen, Bot mit Suche (PIMC).
