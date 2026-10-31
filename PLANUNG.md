# Planung – Wünsche und Fehler

Gemeinsame Liste für alle, die an Brett & Blatt mitarbeiten – Menschen wie Agenten (Claude Code, Antigravity/Gemini, Codex u. a.). Hier landen **Wünsche** (neue Funktionen, Änderungen) und **Fehler** (etwas funktioniert nicht wie gedacht). Der ausführliche Projektstand bleibt in [`CLAUDE.md`](CLAUDE.md), die Pläne der Spiele in [`docs/spiele/`](docs/spiele/README.md).

## So funktioniert die Liste

- **Melden ohne Schreibrechte:** Wer keinen Zugriff aufs Repo hat, meldet über [GitHub Issues](https://github.com/ichthys2k/brett-und-blatt/issues/new/choose) (Vorlagen „Fehler melden“ und „Wunsch oder Idee“). Agenten übernehmen neue Issues mit Verweis (`#123`) in diese Liste; geschlossen wird das Issue, wenn der Eintrag erledigt ist.
- **Neuer Eintrag:** Eine Zeile unten an die passende Tabelle anhängen und die nächste freie Nummer nehmen (`W-…` für Wünsche, `F-…` für Fehler). Nummern werden nie neu vergeben. Leere Musterzeilen stehen unter „Vorlagen“.
- **Tabellenregeln:** Jeder Eintrag ist genau eine Zeile. Kein `|` im Text (sonst `\|`), Zeilenumbrüche innerhalb einer Zelle mit `<br>`. Der Wunsch beginnt mit einem fett gesetzten Kurztitel.
- **Status:** `offen` → `in Arbeit` → `erledigt` (oder `verworfen` mit kurzer Begründung). Bei `in Arbeit` steht dabei, wer daran sitzt und auf welchem Zweig, z. B. `in Arbeit (Cornelius, claude/wuerfel)`, damit niemand doppelt arbeitet.
- **Erledigt:** Die Zeile aus ihrer Tabelle löschen und in der Tabelle „Erledigt“ mit Datum und Commit oder PR eintragen. Dort bleibt sie zum Nachschlagen stehen.
- **Priorität:** `hoch`, `mittel` oder `niedrig`. Ohne Angabe gilt `mittel`.
- **Wer entscheidet:** Cornelius legt fest, was als Nächstes drankommt. Agenten nehmen einen Eintrag nur auf Auftrag in Arbeit und schlagen Änderungen erst vor (siehe Regeln in `AGENTS.md`).
- **Kurz halten:** Ein Eintrag beschreibt das Problem oder den Wunsch, nicht die ganze Lösung. Längere Pläne gehören in den Plan des Spiels unter `docs/spiele/`, der Eintrag verweist dann dorthin.

### Vorlagen

```md
| W-000 | Spiel/Bereich | **Kurzer Titel:** Was soll sich ändern und warum? | mittel | offen | JJJJ-MM-TT, Name |
| F-000 | Spiel/Bereich | Kurzer Titel | 1. …<br>2. … | Was sollte passieren? | Was passiert stattdessen? | Gerät, Browser | mittel | offen | JJJJ-MM-TT, Name |
| W-000 | Kurzer Titel | JJJJ-MM-TT | #PR oder Commit |
```

Die dritte Zeile ist für die Tabelle „Erledigt“.

## Wünsche

| Nr. | Spiel/Bereich | Wunsch | Prio | Status | Eingetragen |
| --- | --- | --- | --- | --- | --- |
| W-001 | Vierer-Schach | **Vierer-Schach-Bot mit Vorausschau:** Der Bot soll mehr als einen Zug vorausdenken, statt nur die aktuelle Stellung zu bewerten. Plan in `docs/spiele/vierer-schach.md`. | mittel | offen | 2026-10-31, Cornelius (aus Fahrplan Schritt E) |
| W-002 | Binokel | **Binokel am Vierertisch und Kreuzbinokel:** Binokel zu viert (zwei gegen zwei) und als Kreuzbinokel spielbar machen. Plan in `docs/spiele/binokel.md`. | mittel | offen | 2026-10-31, Cornelius (aus Fahrplan Schritt E) |
| W-003 | Doppelkopf | **Pflichtsoli im Doppelkopf:** Jede Person muss in einer Serie einmal ein Solo spielen (Pflichtsolo), wie es Turnierregeln vorsehen; als Option. Plan in `docs/spiele/doppelkopf.md`. | mittel | offen | 2026-10-31, Cornelius (aus Fahrplan Schritt E) |
| W-004 | Drachenspiel | **Zauberkarten im Drachenspiel:** Neben den Tierkarten auch Zauberkarten (einmalige Effekte). Plan in `docs/spiele/drachenspiel.md`. | mittel | offen | 2026-10-31, Cornelius (aus Fahrplan Schritt E) |
| W-005 | Narrenhof | **Sprachaufnahmen der Kombis im Narrenhof:** Die Ansagen der Kombis (`fs_hand_*`) sagen noch die alten Namen („Duo“, „Triple“ …). Neue Aufnahmen mit den Narrenhof-Namen; Auswahl der Stimmen durch Cornelius (Werkzeuge im Klang-Repo). Plan in `docs/spiele/farbensortierer.md`. | niedrig | offen | 2026-10-31, Cornelius |
| W-006 | Narrenhof | **Stärkerer Narrenhof-Bot:** Der schwere Bot erreicht im Schnitt Level 5,4–6,3 und gewinnt nur 1–14 % der Läufe; Ziel war Level 8 in etwa 30 %. Ansatzpunkte (Laden- und Narren-Strategie) im Abschnitt „Bot“ in `docs/spiele/farbensortierer.md`. | niedrig | offen | 2026-10-31, Cornelius |
| W-007 | Eins! | **Eigene Musik je Kartenseite bei Flip:** Im Modus Flip soll je nach Kartenseite (Hell/Dunkel) ein eigener Soundtrack laufen. Neue Stücke dürfen dafür erzeugt werden (Auswahl durch Cornelius). | niedrig | offen | 2026-10-30, Cornelius |
| W-014 | alle Spiele | **Mehr Lieder in den Playlists:** Die Playlists sollen mehr Stücke bekommen (Auswahl durch Cornelius, Ablage in `musik/` im Klang-Repo). | mittel | offen | 2026-10-30, Cornelius |
| W-016 | Narrenhof | **Balatro-Joker als Narren übertragen:** Alle Joker aus Balatro recherchieren, überlegen, wie sie sich ins Narrenhof-Thema übertragen lassen (mit eigenen Namen und Ideen, keine Kopien), und einbauen. Plan in `docs/spiele/farbensortierer.md`. | mittel | offen | 2026-10-30, Cornelius |
| W-017 | Narrenhof | **Vielfalt an Gegnern mit Porträts:** Viele Gegner, die zum Narrenhof passen. Jeder bekommt ein echtes Profilbild im Stil mittelalterlicher Gemälde, dabei überzeichnet und lustig. Erst Gegner recherchieren und einen Umsetzungsplan machen. | mittel | offen | 2026-10-30, Cornelius |
| W-018 | Narrenhof | **Fortschritt geräteübergreifend sichern:** Freischaltungen und Käufe liegen nur im Browser (plus Sicherung als Text). Optionen erkunden, den Fortschritt mit Zugangsdaten abgesichert zu speichern: datenschutzfreundlich ohne Konto, mit Microsoft-365- oder mit Google-Konto. Ergebnis zunächst ein Vergleich. | niedrig | offen | 2026-10-30, Cornelius |
| W-020 | Layout (Desktop, Tablet) | **Spieler rund um einen Tisch:** Bei genug Platz sitzen die Spieler wie beim Poker um einen Tisch, in der Mitte findet das Spielgeschehen statt. Nicht auf dem Handy. Erst einen Umsetzungsplan machen. | niedrig | offen | 2026-10-30, Cornelius |
| W-021 | neues Spiel | **Neues Spiel: Werwolf:** Werwolf (ähnliche Mechaniken wie Among Us) recherchieren und einen Plan erstellen, wie es sich einbauen lässt. | niedrig | offen | 2026-10-30, Cornelius |

## Fehler

| Nr. | Spiel/Bereich | Fehler | Schritte zum Nachstellen | Erwartet | Tatsächlich | Gerät/Browser | Prio | Status | Eingetragen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Erledigt

| Nr. | Titel | Erledigt am | Commit/PR |
| --- | --- | --- | --- |
| W-022 | Emoji-Clicker als Link-Kachel im Abschnitt „Weitere Spiele“ auf der Startseite (neuer Tab, unverändert) | 2026-10-31 | `45a7f11` |
| W-009 | Enten-Rallye: Ente schwimmt von selbst (Strömung, Serien beschleunigen, auch online) | 2026-10-31 | #31 |
| W-015 | Bauernumwandlung in jede Figur (Vierer-Schach, Option „Umwandlung“; Schach konnte es schon) | 2026-10-31 | #31 |
| W-008 | Große Siegerehrung am Partieende (Pokal, Treppchen, Konfetti, online für alle; Rundenende als eigener Punkt im Kernschleifen-Plan) | 2026-10-31 | #33 |
| W-010 | Würfelwurf eindrucksvoll animieren (gemeinsamer 3D-Würfel in Würfelblock, Mäxle, Nicht ärgern!) | 2026-10-31 | #33 |
| W-013 | Kernschleifen-Plan für alle Spiele (`docs/spiele/kernschleifen.md`; Umsetzung Spiel für Spiel folgt) | 2026-10-31 | #33 |
| W-011 | Figuren ziehen sichtbar (Nicht ärgern!) | 2026-10-31 | #30 |
| W-012 | Schlagen deutlich animieren (Nicht ärgern!) | 2026-10-31 | #30 |
| F-002 | Nicht ärgern!: Figuren stehen zu hoch im Feld | 2026-10-31 | #30 |
| F-003 | Nicht ärgern!: Schlagpflicht standardmäßig an | 2026-10-31 | #30 |
| F-004 | Nicht ärgern!: Wurf scheinbar für den nächsten Spieler | 2026-10-31 | #30 |
| F-001 | Eins!: Handkarten teils verdeckt (Fächer bricht in Reihen um) | 2026-10-31 | #32 |
| W-019 | Kartenzahl der Mitspieler als kleiner verdeckter Fächer (Eins!, Mau-Mau) | 2026-10-31 | #32 |
