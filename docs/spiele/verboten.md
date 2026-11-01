# Verboten!

*Teamspiel für 4–30 Spieler: Einer umschreibt einen Begriff, das eigene Team rät – die Sperrwörter legt das andere Team fest.*

> **Eigene Fassung, kein Nachbau:** „Tabu“ ist eine Marke von Hasbro. Hier gibt es keine gedruckten Sperrwortkarten; das gegnerische Team wählt die Sperrwörter selbst, im Schreib-Modus zählen weniger Hinweise mehr Punkte. Der Name **„Verboten!“** ist von Cornelius festgelegt (1.11.2026, vorher Arbeitstitel „Umschreibe-Duell“); id `describe-duel`, W-038.

| Steckbrief | |
|---|---|
| Spieler | 4–30 in zwei Teams (Team Sonne ☀️, Team Mond 🌙) |
| Modi | Schreiben (online, mit Bots), Sprechen (am Tisch, im Klassenzimmer), Hot-Seat |
| Muster | verdeckt (Begriff), gleichzeitig (Sperrwörter vorschlagen), Teams |
| Bausteine | neu: Teams in der Lobby (`teams.ts`, `GameInfo.teams`), `forbiddenWordIn`, `rankProposals`, `WordInput` |
| Ordner | `packages/games/describe-duel`, Begriffe in `content/wortspiele/begriffe.json` |

## Regeln

1. **Sperrwörter:** Das andere Team sieht den Begriff und schlägt gleichzeitig je bis zu 3 Wörter vor; die meistgenannten 3 werden gesperrt.
2. **Erklären (Schreiben):** Die erklärende Person schreibt kurze Hinweise (höchstens 40 Zeichen, höchstens 8 Hinweise). Ein Hinweis darf weder den Begriff noch ein Sperrwort enthalten – auch nicht als Teil, in anderer Form (Plural, Umlaut) oder mit einem Tippfehler. Das eigene Team hat je Hinweis bis zu 2 Rateversuche.
   - Punkte: 3 (mit höchstens 2 Hinweisen), 2 (3–4 Hinweise), 1 (mehr). Überspringen gibt 0.
3. **Erklären (Sprechen):** Laut erklären, das Team ruft. Die erklärende Person tippt „Erraten!“ (2 Punkte) oder „Überspringen“. Sagt sie ein Sperrwort, drückt jemand vom anderen Team „Gesagt!“ – 1 Punkt für das andere Team.
4. Die Teams erklären abwechselnd, innerhalb des Teams reihum. Nach 8/12/20 Begriffen gewinnt das Team mit mehr Punkten.

## Teams

In der Online-Lobby trägt jeder Platz ein Team (Chip zum Umschalten, „🔀 Teams zufällig verteilen“ für die Raumleitung). Beim Start wird die Zuordnung als verborgene Option `teams` („0,1,0,1“) über die endgültigen Plätze mitgegeben, weil der Raum freie Plätze beim Start entfernt. Hot-Seat und ohne Angabe: abwechselnd. Jedes Team braucht mindestens 2 Personen.

## Spielmodell und Geheimnisse

Phasen `block` → `explain` → `done`. Züge `block`, `clue`, `guess`, `pass`, `skip`, `correct`, `buzz`. Ratende und Zuschauer sehen weder Begriff noch Sperrwörter; Vorschläge der anderen bleiben bis zum Sperren verborgen. „Gesagt!“ geht auch außer der Reihe (Freigabe in `LocalSession` und Online-Client wie `callUno`).

## Bot „Wortakrobat“

Schlägt die naheliegendsten Wörter als Sperrwörter vor, erklärt mit den Umschreibungen aus dem Katalog (und meidet dabei Sperrwörter) und rät den Begriff des Pakets, dessen Merkwörter am besten zu den Hinweisen passen; je Stufe langsamer bzw. schneller. Im Sprech-Modus kann er nicht erklären und überspringt.

## Oberfläche

Punktetafel der Teams, Begriffskarte für die, die ihn sehen dürfen, Sperrwort-Formular, Hinweis- und Rateeingabe (`WordInput` mit Live-Prüfung), Knöpfe für den Sprech-Modus, Teamlisten. Klassenpräfix `ud-`.

## Umsetzung (1.11.2026)

Regeln, Bot, Oberfläche, Tests (`test/describe-duel.test.ts`), Prüfstand. Begriffe (Alltag, Natur, Schule, Bibel; je Begriff Name, Aliasse, 5 naheliegende Wörter, 3 Bot-Hinweise) sind von Cornelius freigegeben (1.11.2026); sie kommen vom Spieleserver (`GET /wortspiele/begriffe`), Rückfall `wortspiele/begriffe.json`.

## Offene Punkte

- Klänge sind aus dem vorhandenen Katalog gewählt; eigene Klänge nur nach Auswahl.
