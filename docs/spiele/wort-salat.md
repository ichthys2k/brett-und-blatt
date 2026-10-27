# Wort-Salat

## Steckbrief

- **ID:** `word-salad`
- **Name:** Wort-Salat (`🥗`)
- **Spielerzahl:** 1–30 (Solo, Hot-Seat, Online & Klassenraum)
- **Muster:** Gleichzeitig (`simultaneous`) mit verdeckten eigenen Funden während der Runde
- **Herkunft:** Adaptiert aus dem Battle-Royale-Minispiel *Wort-Salat* (`br_words`, ID 104) aus *Der Große Preis*

## Regeln

- In jeder Runde erscheint ein langes **Stammwort** (9–16 Buchstaben, z. B. `SONNENBLUME`, `TASCHENLAMPE`, `SCHMETTERLING`, `KOORDINATENSYSTEM`).
- Aus den Buchstaben dieses Stammwortes bilden die Spielerinnen und Spieler möglichst viele gültige deutsche **Teilwörter**:
  - Jeder Buchstabe darf in einem Teilwort höchstens so oft vorkommen wie im Stammwort selbst.
  - Das Stammwort selbst darf nicht als Teilwort eingereicht werden.
  - Die Mindestwortlänge beträgt je nach Einstellung **3** oder **4** Buchstaben.
- **Punkte nach Wortlänge:**
  - 3 Buchstaben: **1 Punkt**
  - 4 Buchstaben: **2 Punkte**
  - 5 Buchstaben: **4 Punkte**
  - 6 Buchstaben: **7 Punkte**
  - 7 oder mehr Buchstaben: **11 Punkte**
- **Spielmodi:**
  - **Wörterjagd (`classic`):** Jedes gefundene gültige Wort bringt sofort seine Längenpunkte.
  - **Exklusiv-Bonus (`unique`):** Wie *Wörterjagd*, aber am Ende einer Runde erhalten alle Wörter, die **nur von einer einzigen Person** am Tisch gefunden wurden, **doppelte Punkte** (⭐ Exklusiv-Fund).
- Eine Runde endet, sobald alle Plätze auf **„Fertig für diese Runde“** geklickt (oder bereits alle möglichen Teilwörter gefunden) haben – oder wenn die Rundenzeit abläuft.

## Optionen

| Schlüssel | Name | Werte | Standard |
|---|---|---|---|
| `mode` | Spielmodus | `classic` (Wörterjagd), `unique` (Exklusiv-Bonus ×2) | `classic` |
| `category` | Wortpaket | `mix` (Bunter Mix), `natur` (Natur & Tiere), `mathe` (Mathe & Geometrie Kl. 5/6) | `mix` |
| `rounds` | Runden (Stammwörter) | `1` (Schnellrunde), `3` (Standard), `5` (Turnier) | `3` |
| `minLength` | Mindestwortlänge | `3` (ab 3 Buchstaben), `4` (ab 4 Buchstaben) | `3` |

## Spielmodell & Sicherheit (`playerView`)

- Während einer laufenden Runde sieht jeder Sitzplatz in `playerView` nur die **eigenen** gefundenen Wörter (`foundWords`) sowie die Gesamtzahl der möglichen Teilwörter (`totalPossible`).
- Von den Mitspielerinnen und Mitspielern sind während der Runde nur die **Anzahl** der gefundenen Wörter (`foundCount`), der Zwischenstand (`score`) und der Fertig-Status (`done`) sichtbar – so kann niemand am Nachbarbildschirm oder über das Netzwerk Wörter abschreiben.
- Nach Abschluss einer Runde wird eine vollständige **Runden-Zusammenfassung** (`lastRoundSummary`) mit allen gefundenen Wörtern aller Plätze, den ⭐-Exklusiv-Treffern und einer Auswahl der schönsten unentdeckten Wörter veröffentlicht.

## Bot „Wortakrobat“

- Nutzt `delayMs` für natürliche Denkpausen im gleichzeitigen Modus:
  - **Leicht:** Findet alle 4–6 Sekunden ein kurzes Teilwort (3–4 Buchstaben) und schließt die Runde nach 5–7 Wörtern ab.
  - **Mittel:** Findet alle 3–4,5 Sekunden ein Teilwort (auch 5–6 Buchstaben) bis 9–12 Wörter.
  - **Schwer:** Findet alle 2–3,5 Sekunden auch lange Teilwörter (6+ Buchstaben) bis 14–18 Wörter.

## Oberfläche

- Interaktive **Buchstaben-Kacheln** des Stammwortes zum Antippen oder Eingeben per Tastatur (`A–Z`, `Ä`, `Ö`, `Ü`, `Backspace`, `Enter`).
- Bereits im aktuellen Wort-Entwurf verwendete Kacheln werden markiert.
- Lokaler **„🔀 Mischen“**-Knopf zum Umsortieren der Stammwort-Kacheln für neue Geistesblitze.
- Übersichtlich gruppierte **Wort-Sammlung** (eigene Funde mit Punktzahl) und Runden-Auswertung mit Exklusiv-Sternchen ⭐.
