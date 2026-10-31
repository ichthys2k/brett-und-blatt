# Planung – Wünsche und Fehler

Gemeinsame Liste für alle, die an Brett & Blatt mitarbeiten – Menschen wie Agenten (Claude Code, Antigravity/Gemini, Codex u. a.). Hier landen **Wünsche** (neue Funktionen, Änderungen) und **Fehler** (etwas funktioniert nicht wie gedacht). Der ausführliche Projektstand bleibt in [`CLAUDE.md`](CLAUDE.md), die Pläne der Spiele in [`docs/spiele/`](docs/spiele/README.md).

## So funktioniert die Liste

- **Melden ohne Schreibrechte:** Wer keinen Zugriff aufs Repo hat, meldet über [GitHub Issues](https://github.com/ichthys2k/brett-und-blatt/issues/new/choose) (Vorlagen „Fehler melden“ und „Wunsch oder Idee“). Agenten übernehmen neue Issues mit Verweis (`#123`) in diese Liste; geschlossen wird das Issue, wenn der Eintrag erledigt ist.
- **Neuer Eintrag:** Vorlage unten kopieren, ans Ende des passenden Abschnitts setzen und die nächste freie Nummer nehmen (`W-…` für Wünsche, `F-…` für Fehler). Nummern werden nie neu vergeben.
- **Status:** `offen` → `in Arbeit` → `erledigt` (oder `verworfen` mit kurzer Begründung). Bei `in Arbeit` steht dabei, wer daran sitzt und auf welchem Zweig, damit niemand doppelt arbeitet.
- **Erledigt:** Status auf `erledigt` setzen, Datum und Commit oder PR eintragen und den Eintrag nach „Erledigt“ ans Ende der Datei verschieben. Dort bleibt er zum Nachschlagen stehen.
- **Priorität:** `hoch`, `mittel` oder `niedrig`. Ohne Angabe gilt `mittel`.
- **Wer entscheidet:** Cornelius legt fest, was als Nächstes drankommt. Agenten nehmen einen Eintrag nur auf Auftrag in Arbeit und schlagen Änderungen erst vor (siehe Regeln in `AGENTS.md`).
- **Kurz halten:** Ein Eintrag beschreibt das Problem oder den Wunsch, nicht die ganze Lösung. Längere Pläne gehören in den Plan des Spiels unter `docs/spiele/`, der Eintrag verweist dann dorthin.

### Vorlage Wunsch

```md
### W-000 · Kurzer Titel
- **Status:** offen
- **Spiel/Bereich:** z. B. Schach, Startseite, Online, alle Spiele
- **Priorität:** mittel
- **Eingetragen:** JJJJ-MM-TT von Name

Was soll sich ändern und warum? Wie sieht es aus, wenn es fertig ist?
```

### Vorlage Fehler

```md
### F-000 · Kurzer Titel
- **Status:** offen
- **Spiel/Bereich:** z. B. Skat, Online-Lobby
- **Priorität:** mittel
- **Gerät/Browser:** z. B. Android-Handy, Chrome; Desktop, Firefox
- **Eingetragen:** JJJJ-MM-TT von Name

**Schritte zum Nachstellen:**
1. …
2. …

**Erwartet:** …
**Tatsächlich:** … (Fehlermeldung, Screenshot oder Raumcode, falls vorhanden)
```

## Wünsche

### W-001 · Vierer-Schach-Bot mit Vorausschau
- **Status:** offen
- **Spiel/Bereich:** Vierer-Schach
- **Priorität:** mittel
- **Eingetragen:** 2026-10-31 von Cornelius (aus Fahrplan Schritt E)

Der Bot soll mehr als einen Zug vorausdenken, statt nur die aktuelle Stellung zu bewerten. Plan in `docs/spiele/vierer-schach.md`.

### W-002 · Binokel am Vierertisch und Kreuzbinokel
- **Status:** offen
- **Spiel/Bereich:** Binokel
- **Priorität:** mittel
- **Eingetragen:** 2026-10-31 von Cornelius (aus Fahrplan Schritt E)

Binokel zu viert (zwei gegen zwei) und als Kreuzbinokel spielbar machen. Plan in `docs/spiele/binokel.md`.

### W-003 · Pflichtsoli im Doppelkopf
- **Status:** offen
- **Spiel/Bereich:** Doppelkopf
- **Priorität:** mittel
- **Eingetragen:** 2026-10-31 von Cornelius (aus Fahrplan Schritt E)

Jede Person muss in einer Serie einmal ein Solo spielen (Pflichtsolo), wie es Turnierregeln vorsehen; als Option. Plan in `docs/spiele/doppelkopf.md`.

### W-004 · Zauberkarten im Drachenspiel
- **Status:** offen
- **Spiel/Bereich:** Drachenspiel
- **Priorität:** mittel
- **Eingetragen:** 2026-10-31 von Cornelius (aus Fahrplan Schritt E)

Neben den Tierkarten auch Zauberkarten (einmalige Effekte). Plan in `docs/spiele/drachenspiel.md`.

### W-005 · Sprachaufnahmen der Kombis im Narrenhof
- **Status:** offen
- **Spiel/Bereich:** Narrenhof
- **Priorität:** niedrig
- **Eingetragen:** 2026-10-31 von Cornelius

Die Ansagen der Kombis (`fs_hand_*`) sagen noch die alten Namen („Duo“, „Triple“ …). Neue Aufnahmen mit den Narrenhof-Namen; Auswahl der Stimmen durch Cornelius (Werkzeuge im Klang-Repo). Plan in `docs/spiele/farbensortierer.md`.

### W-006 · Stärkerer Narrenhof-Bot
- **Status:** offen
- **Spiel/Bereich:** Narrenhof
- **Priorität:** niedrig
- **Eingetragen:** 2026-10-31 von Cornelius

Der schwere Bot erreicht im Schnitt Level 5,4–6,3 und gewinnt nur 1–14 % der Läufe; Ziel war Level 8 in etwa 30 %. Ansatzpunkte (Laden- und Narren-Strategie) im Abschnitt „Bot“ in `docs/spiele/farbensortierer.md`.

### W-007 · Eigene Musik je Kartenseite bei Flip
- **Status:** offen
- **Spiel/Bereich:** Eins!
- **Priorität:** niedrig
- **Eingetragen:** 2026-10-30 von Cornelius

Im Modus Flip soll je nach Kartenseite (Hell/Dunkel) ein eigener Soundtrack laufen. Neue Stücke dürfen dafür erzeugt werden (Auswahl durch Cornelius).

### W-008 · Große Siegerehrung am Rundenende
- **Status:** offen
- **Spiel/Bereich:** alle Spiele
- **Priorität:** niedrig
- **Eingetragen:** 2026-10-30 von Cornelius

Am Rundenende eine Siegerehrung über den ganzen Bildschirm, für alle sichtbar. Die bisherige Siegermeldung ist zu dezent.

### W-009 · Ente schwimmt von selbst
- **Status:** offen
- **Spiel/Bereich:** Enten-Rallye
- **Priorität:** niedrig
- **Eingetragen:** 2026-10-30 von Cornelius

Die Ente schwimmt auch ohne richtige Antworten langsam nach vorn. Eine richtig beantwortete Aufgabe gibt ihr einen Schub und beschleunigt sie.

### W-010 · Würfelwurf eindrucksvoll animieren
- **Status:** offen
- **Spiel/Bereich:** alle Würfelspiele (Würfelblock, Mäxle, Nicht ärgern! …)
- **Priorität:** mittel
- **Eingetragen:** 2026-10-30 von Cornelius

Der Wurf soll richtig gut aussehen, Vorbild Baldur's Gate, und höchstens etwa eine Sekunde dauern.

### W-011 · Figuren ziehen sichtbar
- **Status:** offen
- **Spiel/Bereich:** Nicht ärgern!
- **Priorität:** niedrig
- **Eingetragen:** 2026-10-30 von Cornelius

Figuren springen nicht, sondern ziehen sichtbar Feld für Feld (hüpfend), ähnlich wie das Gleiten im Schach.

### W-012 · Schlagen deutlich animieren
- **Status:** offen
- **Spiel/Bereich:** Nicht ärgern!
- **Priorität:** niedrig
- **Eingetragen:** 2026-10-30 von Cornelius

Wird eine Figur geschlagen, soll das deutlich animiert sein (z. B. Figur fliegt zurück in den Stall).

### W-013 · Kernabläufe aller Spiele befriedigender machen
- **Status:** offen
- **Spiel/Bereich:** alle Spiele
- **Priorität:** hoch
- **Eingetragen:** 2026-10-30 von Cornelius

Für jedes Spiel die Kernschleife betrachten: Welche Züge macht man immer wieder? Wie fühlen sie sich mit Animationen, Klängen und anderen Ideen richtig gut an? Ergebnis ist zunächst ein umfassender Plan, der dann Spiel für Spiel umgesetzt wird.

### W-014 · Mehr Lieder in den Playlists
- **Status:** offen
- **Spiel/Bereich:** alle Spiele
- **Priorität:** mittel
- **Eingetragen:** 2026-10-30 von Cornelius

Die Playlists sollen mehr Stücke bekommen (Auswahl durch Cornelius, Ablage in `musik/` im Klang-Repo).

### W-015 · Bauernumwandlung in jede Figur
- **Status:** offen
- **Spiel/Bereich:** Schach, Vierer-Schach
- **Priorität:** mittel
- **Eingetragen:** 2026-10-30 von Cornelius

Bei der Umwandlung auch Turm, Läufer oder Springer wählen können, nicht nur die Dame. Als Spieloption, standardmäßig an.

### W-016 · Balatro-Joker als Narren übertragen
- **Status:** offen
- **Spiel/Bereich:** Narrenhof
- **Priorität:** mittel
- **Eingetragen:** 2026-10-30 von Cornelius

Alle Joker aus Balatro recherchieren, überlegen, wie sie sich ins Narrenhof-Thema übertragen lassen (mit eigenen Namen und Ideen, keine Kopien), und einbauen. Plan in `docs/spiele/farbensortierer.md`.

### W-017 · Vielfalt an Gegnern mit Porträts
- **Status:** offen
- **Spiel/Bereich:** Narrenhof
- **Priorität:** mittel
- **Eingetragen:** 2026-10-30 von Cornelius

Viele Gegner, die zum Narrenhof passen. Jeder bekommt ein echtes Profilbild im Stil mittelalterlicher Gemälde, dabei überzeichnet und lustig. Erst Gegner recherchieren und einen Umsetzungsplan machen.

### W-018 · Fortschritt geräteübergreifend sichern
- **Status:** offen
- **Spiel/Bereich:** Narrenhof
- **Priorität:** niedrig
- **Eingetragen:** 2026-10-30 von Cornelius

Freischaltungen und Käufe liegen nur im Browser (plus Sicherung als Text). Optionen erkunden, den Fortschritt mit Zugangsdaten abgesichert zu speichern: datenschutzfreundlich ohne Konto, mit Microsoft-365- oder mit Google-Konto. Ergebnis zunächst ein Vergleich.

### W-019 · Kartenzahl der Mitspieler sichtbar
- **Status:** offen
- **Spiel/Bereich:** Kartenspiele (v. a. Eins!, Mau-Mau)
- **Priorität:** niedrig
- **Eingetragen:** 2026-10-30 von Cornelius

Man soll auch optisch sehen, wie viele Karten jemand auf der Hand hat (z. B. kleiner verdeckter Fächer am Spieler).

### W-020 · Spieler rund um einen Tisch
- **Status:** offen
- **Spiel/Bereich:** Layout (Desktop, Tablet)
- **Priorität:** niedrig
- **Eingetragen:** 2026-10-30 von Cornelius

Bei genug Platz sitzen die Spieler wie beim Poker um einen Tisch, in der Mitte findet das Spielgeschehen statt. Nicht auf dem Handy. Erst einen Umsetzungsplan machen.

### W-021 · Neues Spiel: Werwolf
- **Status:** offen
- **Spiel/Bereich:** neues Spiel
- **Priorität:** niedrig
- **Eingetragen:** 2026-10-30 von Cornelius

Werwolf (ähnliche Mechaniken wie Among Us) recherchieren und einen Plan erstellen, wie es sich einbauen lässt.

## Fehler

### F-001 · Handkarten teils verdeckt
- **Status:** offen
- **Spiel/Bereich:** Eins!
- **Priorität:** mittel
- **Gerät/Browser:** Mobilgerät
- **Eingetragen:** 2026-10-30 von Cornelius

**Schritte zum Nachstellen:**
1. Partie auf dem Handy spielen.
2. Viele Karten auf die Hand bekommen.

**Erwartet:** Alle Karten sind so gestapelt, dass man sie immer alle sieht.
**Tatsächlich:** Ein Teil der Karten ist verdeckt.

### F-002 · Figuren stehen zu hoch im Feld
- **Status:** offen
- **Spiel/Bereich:** Nicht ärgern!
- **Priorität:** mittel
- **Gerät/Browser:** –
- **Eingetragen:** 2026-10-30 von Cornelius

**Schritte zum Nachstellen:**
1. Partie starten und Figuren auf dem Brett ansehen.

**Erwartet:** Der Boden der Figur steht leicht unterhalb der Feldmitte, sodass die Figur optisch mittig steht.
**Tatsächlich:** Der Boden der Figur steht genau in der Feldmitte, die Figur wirkt zu hoch.

### F-003 · Schlagpflicht standardmäßig an
- **Status:** offen
- **Spiel/Bereich:** Nicht ärgern!
- **Priorität:** mittel
- **Gerät/Browser:** –
- **Eingetragen:** 2026-10-30 von Cornelius

**Schritte zum Nachstellen:**
1. Neues Spiel einrichten und die Optionen ansehen.

**Erwartet:** Schlagpflicht ist standardmäßig aus.
**Tatsächlich:** Schlagpflicht ist standardmäßig an.

### F-004 · Wurf scheinbar für den nächsten Spieler
- **Status:** offen
- **Spiel/Bereich:** Nicht ärgern!
- **Priorität:** mittel
- **Gerät/Browser:** –
- **Eingetragen:** 2026-10-30 von Cornelius

**Schritte zum Nachstellen:**
1. Partie bis kurz vor Schluss spielen.

**Erwartet:** Jeder würfelt für die eigenen Figuren.
**Tatsächlich:** Manchmal scheint man für den nächsten Spieler zu würfeln. Muss erst mit Tests bestätigt werden.

## Erledigt

_Noch nichts. Erledigte Einträge kommen mit Datum und Commit/PR hierher._
