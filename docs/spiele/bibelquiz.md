# Bibel-Quiz (Emoji-Bibelquiz)

| Steckbrief | |
|---|---|
| Spieler | 1–30 |
| Dauer | 5–15 Minuten |
| Modi | Solo, Hot-Seat, online (simultan für Familien, Gruppen und Schulklassen) |
| Muster | gleichzeitig (`simultaneous`), verdeckte Eingabe (`hiddenInformation`, `privateViews`) |
| Ordner | `packages/games/bible-quiz` |

## Spielprinzip

- Biblische Geschichten, Personen, Gleichnisse und Verse werden durch eine Folge prägnanter Emojis dargestellt (z. B. 🌊🚢🦁🦒 für *Arche Noah*, 🍎🐍🌳👫 für *Der Sündenfall*, 👶🌟🐴👑 für *Geburt Jesu*, 🍞🍷🗓️💔 für *Das letzte Abendmahl*).
- Die Spieler wählen aus **vier Antwortmöglichkeiten** die passende Begebenheit aus.
- Nach der Beantwortung (bzw. sobald alle Teilnehmer ihre Antwort eingeloggt haben) wird die Auflösung eingeblendet:
  - Richtig ✅ oder Falsch ❌ mitsamt heiterem biblischen Lob („Amen!“, „Halleluja!“, „Göttlich!“, „Gesegnet!“, „Weise!“).
  - Ein fundierter **Erklärungstext** (`info`) mit Hintergründen zur Bibelstelle.
  - Ein direkter Verweis zum Nachlesen auf **BibelServer.com** (Hoffnung für alle).
- Am Ende des Quiz gibt es eine Gesamtauswertung mit dem erreichten Segen und Punkten.

## Optionen in der Einrichtung / Lobby

| Option | Werte | Standard |
|---|---|---|
| Fragenanzahl (`rounds`) | 5, 10, 15, 20, Alle (77) | 10 |
| Schwierigkeitsverlauf (`difficulty`) | Steigend (1–3), Bunt gemischt, Nur Leicht (⭐), Nur Mittel (⭐⭐), Nur Schwer (⭐⭐⭐) | Steigend |
| Thema / Kategorie (`category`) | Alle Themen, Altes Testament, Neues Testament, Gleichnisse, Personen, Verse | Alle Themen |

## Punktesystem

- **Leichte Frage (⭐):** 10 Punkte
- **Mittlere Frage (⭐⭐):** 20 Punkte
- **Schwere Frage (⭐⭐⭐):** 30 Punkte
- **Serie (Streak):** Ab 3 richtigen Antworten in Folge gibt es jeweils +5 Bonuspunkte.

## Bot („Bibelkenner“)

- **Leicht:** ca. 50 % Trefferquote, gelegentliches Raten.
- **Mittel:** ca. 75 % Trefferquote, solides Bibelwissen.
- **Schwer:** ca. 95 % Trefferquote, gelehrter Bibelkenner.

## Online & Mehrspieler

- Alle Spieler erhalten dieselben Fragen und Optionen (in identischer, deterministisch gemischter Reihenfolge).
- Die Abgabe erfolgt simultan und verdeckt: Andere Spieler sehen nur, dass ein Mitspieler geantwortet hat (`submitted: true`), aber nicht welche Antwort gewählt wurde.
- Die Auflösung erfolgt gemeinsam für alle. In Online-Räumen schaltet die Spielleitung (Platz 1) zur nächsten Frage weiter; solo kann jeder im eigenen Tempo weiterklicken.
