# Präsident (bekannt als „Arschloch“)

*Kartenspiel für 3–8 Spieler: Wer zuerst alle Karten los ist, wird Präsident – wer als Letzter übrig bleibt, wird Bettler und muss in der nächsten Runde seine besten Karten abgeben.*

> **Name:** Das Spiel ist unter vielen Namen bekannt: „Arschloch“, „Präsident“ (international *President*), „Bettler und König“, „Bürgermeister“, „Scheißkopf“ (dort eigentlich ein anderes Spiel). **„Präsident“** ist der gebräuchlichste neutrale Name und schul- und kindertauglich. id `president`. In der Ideenliste im Konzept stand „Präsident“ schon.

| Steckbrief | |
|---|---|
| Spieler | 3–8 (am besten 4–6) |
| Modi | Solo gegen Bots, Hot-Seat (mit Übergabe-Bildschirm), online |
| Muster | Zug um Zug, verdeckt (Hand), Kartentausch zwischen den Runden |
| Bausteine | `PlayingCard` (französisch/vierfarbig/deutsch), Handfächer, Serien-Abrechnung (`packages/engine/src/series.ts`), `sortHand`-Idee aus dem Stich-Kern |
| Aufwand | Regeln S, Oberfläche M, Bot M |
| Ordner | `packages/games/president` |

## Regeln (Grundform, wie in Deutschland verbreitet)

- **Blatt:** 32 Karten (7 bis Ass) für 3–5 Spieler, 52 Karten ab 6 Spielern (Option). Alle Karten werden verteilt.
- **Rangfolge:** 7 (bzw. 2) niedrigste … Bube, Dame, König, Ass höchste. Farben sind egal.
- **Ausspielen:** Der Startspieler legt eine Einzelkarte, ein Paar, einen Drilling oder einen Vierling. Reihum muss jeder **gleich viele Karten mit höherem Rang** legen oder passen.
- **Stich abräumen:** Passen alle anderen, ist der Stich vorbei; wer zuletzt gelegt hat, beginnt den nächsten frei.
- **Wer passt, darf im selben Stich später wieder legen** (Standard). Strengere Variante: Wer passt, ist für diesen Stich draußen.
- **Rundenende:** Wer zuerst keine Karten mehr hat, wird **Präsident**, der zweite **Vizepräsident**, dann **Bürger** …, der vorletzte **Vize-Bettler**, der letzte **Bettler**. Wer fertig ist, setzt aus; ist er mit dem letzten Stich ausgegangen, beginnt der Nächste frei.
- **Tausch vor jeder weiteren Runde:** Der Bettler gibt dem Präsidenten seine **zwei besten** Karten und bekommt zwei beliebige zurück; Vize-Bettler und Vizepräsident tauschen je **eine** Karte. Bei 3 Spielern nur Präsident ↔ Bettler mit einer Karte. Der Bettler beginnt die neue Runde (und mischt).
- **Plätze am Tisch** wechseln im Original nach Rang – digital nur als Anzeige (Rang-Abzeichen im Spieler-Chip).

## Optionen (Hausregeln)

- **Blatt:** 32 / 52 Karten, Kartenbild französisch, vierfarbig, deutsch.
- **Höchste Karte:** Ass (Standard) oder 2 (international, dann 3 niedrigste).
- **Passen:** darf wieder einsteigen (Standard) / ist für den Stich draußen.
- **Gleich legen:** Wer dieselbe Kartenzahl mit *gleichem* Rang legt, lässt den Nächsten aussetzen (beliebte Hausregel).
- **Achter räumt:** Eine 8 (bzw. 10) beendet den Stich sofort, der Leger beginnt neu.
- **Revolution:** Wer vier Gleiche legt, kehrt die Rangfolge bis zum Rundenende um.
- **Joker** (nur 52er-Blatt, 2–3 Stück): ersetzen jede Karte.
- **Partiedauer:** 3 / 5 / 10 Runden oder bis Punktzahl. Punkte je Runde: Präsident 2, Vize 1, Bürger 0, Vize-Bettler −1, Bettler −2 (angezeigt als Tabelle).
- **Titel:** „Präsident … Bettler“ (Standard) oder **Königshof** (König, Prinz, Bürger, Knecht, Bettler) für Kinder.

## Spielmodell

- **Phasen:** `exchange` (Bettler gibt automatisch die besten Karten, Präsident wählt die abzugebenden; gleichzeitig mit `currentPlayers` = alle Tauschenden), `play`, `roundEnd` (`ready`), `gameEnd`.
- **Züge:** `play` (Kartenkennungen, alle gleichen Rangs bzw. mit Joker), `pass`, `give` (Tauschkarten), `ready`.
- **Sicht:** eigene Hand offen, fremde Hände als Anzahl, laufender Stich und Ablage offen. Beim Tausch sehen nur die beiden Beteiligten die getauschten Karten. `rng` genullt, `sampleHidden` verteilt unbekannte Karten (unter Beachtung der bekannten Tauschkarten).
- Serie über den Serien-Rahmen: Rangfolge und Punkte je Runde.

## Bot

„Kartenkanzler“:

- **leicht:** legt die niedrigste passende Kombination, passt selten absichtlich.
- **mittel:** Faustregeln – Paare nicht aufbrechen, hohe Karten und Asse zum Abräumen aufheben, niedrige Einzelkarten früh loswerden, am Ende so planen, dass der letzte Zug ein Abräumer ist.
- **schwer:** wie mittel plus Kartenzählen (welche hohen Karten sind schon gefallen) und eine kleine Stichprobensuche (`sampleHidden` + Ausspielen bis Rundenende) für die letzten ~8 Karten.
- Tausch: Präsident-Bot gibt seine schwächsten Einzelkarten ab.

## Zeitlimits

Gemütlich (ohne Uhr), Normal 30 s je Zug, Schnell 15 s.

## Oberfläche

- Handfächer unten (sortiert nach Rang, gleiche Ränge gruppiert), mehrere Karten gleichen Rangs per Antippen auswählen, „Legen“/„Passen“.
- Mitte: aktueller Stich (oberste Kombination groß, darunter die vorige leicht versetzt), Hinweis „Paar höher als 9 nötig“.
- Mitspieler-Chips mit Kartenzahl und Rang-Abzeichen (👑 Präsident, 🎩 Vize, 🙂 Bürger, 🧹 Vize-Bettler, 🪣 Bettler – oder Königshof-Symbole).
- Tauschphase als eigener Dialog mit fliegenden Karten zwischen den Beteiligten.
- Klänge: `karte-legen`, `mischen`, Passen leiser Klopfklang (Auswahl durch Cornelius). Playlist „Kartentisch“.

## Hot-Seat und Online

- Hot-Seat mit Übergabe-Bildschirm (Hände sind geheim), wie bei Schwarzer Peter/Mau-Mau.
- Online-Eintrag in `apps/server/src/games.ts` und `apps/server/package.json`.

## Tests

- Rangfolge (Ass/2 hoch, Revolution), legale Kombinationen, Passen und Wiedereinstieg, Stich abräumen, Ausgehen mit dem letzten Stich, Rangvergabe, Tausch (beste Karten, Anzahl je Spielerzahl), Hausregeln einzeln.
- `gameContractChecks`, Prüfstand, Bot schwer gegen leicht.

## Umsetzung (29.10.2026)

Cornelius: „die üblichen Regeln“. Standard ist darum die verbreitete deutsche Form, alle Hausregeln sind abschaltbare Optionen und von Haus aus aus.

- `src/rules.ts`:
  - Blatt „automatisch“ (32 Karten bis fünf Spieler, 52 ab sechs) oder fest 32/52, reihum ausgeteilt. In der ersten Runde beginnt, wer die niedrigste Kreuzkarte hat.
  - Legen: gleich viele Karten höheren Rangs, Ass hoch. Wer gepasst hat, darf später wieder legen, solange der Stich läuft; mit Option „Für den Stich draußen“ nicht.
  - Ausgehen: Wer seine letzten Karten legt, ist draußen. Räumt sein Stich ab, beginnt der nächste Spieler, der noch Karten hat.
  - Die Runde endet, wenn nur noch einer Karten hat.
  - Punkte je Runde: +2 / +1 / 0 / −1 / −2 (Vize-Titel ab vier Spielern; zu dritt also +2 / 0 / −2). Spieldauer 3, 5 (Standard) oder 10 Runden; wer am Ende die meisten Punkte hat, gewinnt.
- **Tausch** ab Runde 2:
  - Der Bettler gibt automatisch seine zwei besten Karten ab, der Vize-Bettler (ab vier Spielern) seine beste.
  - Präsident, danach Vize wählen nacheinander, was sie zurückgeben (Phase `exchange`, Zug `give`). Danach beginnt der Bettler.
  - Die getauschten Karten sieht nur, wer beteiligt war. `sampleHidden` legt eigene abgegebene Karten zum Empfänger.
- **Optionen:** Titel „Präsident … Bettler“ oder Königshof (König, Prinz, Bürger, Knecht, Bettler), Kartenbild französisch/vierfarbig/deutsch, Gleich legen (Nächster setzt aus), Achter räumt, Revolution, „2 hoch“ (nur 52 Karten).
- **Bot „Kartenkanzler“** (`src/bots.ts`):
  - leicht: legt die schwächste passende Gruppe und passt manchmal grundlos.
  - mittel: Faustregeln – Gruppen nicht aufbrechen, Spitzenkarten aufheben, schwache Einzelkarten zuerst. Zählt Karten, um zu erkennen, wann der Rest sicher durchgeht.
  - schwer: zusätzlich ab sechs Handkarten eine Stichprobensuche, die die Runde mit Faustregeln zu Ende spielt (≤ 0,6 s).
  - Gemessen in 30 Partien zu viert: mittel schlägt leicht mit +92 Punkten, schwer schlägt mittel mit +70.
- **Oberfläche** (`src/ui/`, Präfix `prs-`):
  - weinroter Filz, Mitspieler mit Kartenzahl, Titel-Abzeichen und „passt“; in der Mitte die oberste und die vorige Legung mit Hinweis („Gesucht: Paar höher als 9“).
  - Hand nach Rang gruppiert. Antippen wählt beim Bedienen gleich die nötige Anzahl dieses Rangs, dann „Legen“/„Passen“.
  - Tausch mit Hinweis, was man bekommen hat. Zu Rundenbeginn steht kurz da, was getauscht wurde. Rundenende als Tabelle mit Titel, Rundenpunkten und Gesamtstand.
- **Klänge** aus dem Katalog: `karte-legen`, `poker-check` (Klopfen beim Passen), `karte-ziehen`, `mischen`, `ansage` (ausgegangen, Revolution). Playlist „Kartentisch“.
- Hot-Seat mit Übergabe-Bildschirm, online eingetragen.

## Offene Punkte

- Joker (52er-Blatt mit 2–3 Jokern) als Option.
- Tauschphase mit fliegenden Karten zwischen den Beteiligten.
