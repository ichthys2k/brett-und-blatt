# Go

| Steckbrief | |
|---|---|
| Spieler | 2 |
| Dauer | 9×9: 10–20 Minuten, 19×19: 45 Minuten bis mehrere Stunden; Fernpartie über Tage |
| Modi | Solo gegen Bot, Hot-Seat, online, Fernpartie |
| Muster | offen, Zug um Zug, mit einer **Auszählphase**, in der sich beide einigen |
| Bausteine | Gitterbrett, **zoombares Brett** (neu), MCTS, **Byo-yomi** (neu) |
| Aufwand | Regeln M, Oberfläche L, Bot L |
| Etappe | 4 |

## Regeln (Standard)

- **Brett:** 9×9 (Einstieg), 13×13 oder 19×19. Schwarz beginnt; abwechselnd wird ein Stein auf einen freien Schnittpunkt gesetzt.
- **Freiheiten und Schlagen:** Zusammenhängende Steine einer Farbe bilden eine Gruppe. Ihre Freiheiten sind die freien Nachbarpunkte. Hat eine gegnerische Gruppe nach einem Zug keine Freiheit mehr, wird sie geschlagen.
- **Selbstmord** (eigene Gruppe ohne Freiheit, ohne zu schlagen) ist verboten.
- **Ko:** Keine Gesamtstellung darf sich wiederholen. Das ist die „Positional Superko“-Regel: eindeutig und leicht zu prüfen.
- **Ende:** Passen beide nacheinander, beginnt die **Auszählphase**:
  1. Beide markieren tote Steine; der Bot macht einen Vorschlag.
  2. Beide bestätigen.
  3. Sind sie uneins, wird weitergespielt.
- **Wertung (chinesische Flächenwertung):** Jeder bekommt Punkte für seine lebenden Steine und für das von ihm umschlossene Gebiet. Weiß bekommt **Komi** 7,5 Punkte als Ausgleich für den Nachzug. Die Flächenwertung lässt sich verlässlicher automatisch auszählen als die japanische Gebietswertung.
- **Vorgabe:** 2–9 Steine für Schwarz, dann Komi 0,5.

## Optionen in der Lobby

| Option | Werte | Standard |
|---|---|---|
| Brettgröße | 9×9, 13×13, 19×19 | 9×9 |
| Variante | Go, **Atari-Go** (wer zuerst einen Stein schlägt, gewinnt, der Einstieg für Kinder und die Schule) | Go |
| Komi | 0,5, 5,5, 6,5, 7,5 | 7,5 |
| Vorgabe | 0, 2–9 Steine | 0 |
| Gebietsanzeige | aus, während des Spiels einblenden (Lernhilfe) | aus |

## Spielmodell

```ts
type GoMove =
  | { type: 'place'; point: number }
  | { type: 'pass' }
  | { type: 'resign' }
  | { type: 'toggleDead'; point: number }   // Auszählphase: Gruppe als tot/lebend markieren
  | { type: 'acceptScore' }
  | { type: 'resume' };                     // Auszählung abbrechen, weiterspielen
```

- **Zustand:** Belegung, gefangene Steine, Stellungs-Prüfsummen für den Superko (Zobrist-Hashing: eine schnelle Prüfsumme je Stellung), Passen in Folge, Phase (`play` oder `scoring`), Tot-Markierungen und Zustimmungen.
- **Auszählphase:** Beide Spieler dürfen gleichzeitig markieren (`currentPlayers` liefert beide). Die Phase endet, wenn beide dieselbe Markierung bestätigt haben.
- **SGF:** Import und Export im Smart Game Format, dem Standardformat für Go-Partien. Damit lassen sich Partien in anderen Go-Programmen nachspielen.

## Bot

- **MCTS** mit leichten Zufallspartien. In den Zufallspartien füllt der Bot keine eigenen Augen und schlägt bevorzugt in Atari (wenn eine Gruppe nur noch eine Freiheit hat).
- **RAVE** als Verbesserung: Züge, die in vielen Zufallspartien gut waren, werden früh bevorzugt.
- Die MCTS liefert zugleich eine **Gebietsschätzung** (wem welcher Punkt am Ende gehört). Sie dient als Vorschlag in der Auszählphase und als Lernhilfe.

| Stufe | Verhalten |
|---|---|
| Atari-Go | einfache Regeln: schlagen, Atari vermeiden |
| leicht | wenige Durchläufe, für Anfänger auf 9×9 |
| mittel | mehr Durchläufe, ordentlich auf 9×9, schwach auf 19×19 |
| schwer | so viele Durchläufe wie die Zeit erlaubt |

**Später, optional:** KataGo (MIT-Lizenz) ist ein sehr starker Go-Bot mit neuronalem Netz. Er braucht viel Rechenleistung und läuft nicht im Cloudflare-Gratis-Tarif. Möglich wäre warpdrive als „Bot-Server“; das ist vor dem Bau zu prüfen.

## Zeitlimits

**Byo-yomi** (japanisch für „Sekunden lesen“): Nach der Hauptzeit muss jeder Zug innerhalb einer festen Zeit kommen. Man hat mehrere solcher Perioden; wer eine überschreitet, verbraucht sie.

| Voreinstellung | 9×9 | 19×19 |
|---|---|---|
| gemütlich | aus | aus |
| normal | 5 min + 3 × 20 s | 20 min + 5 × 30 s |
| schnell | 2 min + 3 × 10 s | 10 min + 3 × 20 s |
| Fernpartie | 1 Tag pro Zug | 2 Tage pro Zug |

**Bei Zeitablauf:**

- Sind alle Perioden aufgebraucht, ist die Partie verloren (Go-üblich); wahlweise zieht der Bot.
- In der Auszählphase gilt der Vorschlag als bestätigt.
- Bei Fernpartien kommt vor Ablauf eine Erinnerung.

## Oberfläche

- **Kleine Bretter** (9×9, 13×13): direkt tippen setzt den Stein.
- **19×19 auf dem Handy:** Die Schnittpunkte sind nur etwa 18 px groß, Fehlgriffe sind leicht. Deshalb:
  - Tippen zeigt einen **Vorschau-Stein mit Lupe**.
  - Verschieben korrigiert die Position.
  - Der Knopf „Setzen“ oder ein zweites Tippen auf dieselbe Stelle bestätigt.
  - Zoomen und Verschieben mit zwei Fingern.
- **Anzeigen:** letzter Zug markiert, Ko-Punkt markiert, gefangene Steine je Seite, Byo-yomi-Perioden als Punkte am Uhr-Ring.
- **Auszählphase:** Gebiet als farbige Felder, tote Steine halb durchsichtig, Punkte-Rechnung zum Nachvollziehen.
- **Desktop:** Brett links, rechts Partieverlauf mit Zugnummern und SGF-Export.

## Hot-Seat und Online

- **Hot-Seat:** keine Geheimnisse. Die Auszählphase bestätigen beide nacheinander am selben Gerät.
- **Online:** Der Server prüft Züge und Superko und verwaltet die Einigung in der Auszählphase.
- **Fernpartien:** Der Durable Object speichert die Partie dauerhaft; Erinnerungen kommen als Benachrichtigung (später auch Push).

## Tests

- Schlagen: Einzelstein, Gruppe, mehrere Gruppen auf einmal, am Rand und in der Ecke.
- Selbstmord verboten; Schlagen mit dem letzten Freiheitspunkt erlaubt.
- Superko: einfacher Ko, ausgefallene Wiederholungen.
- Flächenwertung an bekannten Endstellungen; Komi; Vorgabe.
- **Atari-Go:** Sieg mit dem ersten Schlag.
- Auszählphase: Markieren, Einigung, Fortsetzung.
- SGF hin und zurück ohne Verlust.
- **Bot:** schlägt einen Stein in Atari, wenn möglich; der schwere Bot gewinnt auf 9×9 gegen den leichten fast immer.

## Umsetzung (Oktober 2026)

- `src/board.ts`: schnelles Brett (Gruppen, Freiheiten, Zobrist-Prüfsummen, Flächenwertung) und Zufallspartien (`Playout`, wiederverwendbar, eigener schneller Zufall aus dem Seed-Rng). Die Gebietsschätzung (`estimateOwnership`) liefert den Vorschlag für tote Steine und die Lernhilfe.
- `src/rules.ts`: Positional Superko über die Prüfsummen; `legalMoves` prüft schnell über die Freiheiten der Nachbargruppen. In der Auszählphase stehen dort nur Zustimmen und Weiterspielen, das Markieren prüft `isLegal`. Zeitablauf geht über `resignMove(…, 'time')`: im Spiel verloren, in der Auszählung gilt der Vorschlag als bestätigt. SGF-Export und SGF-Import (`loadFromSgf` in `src/rules.ts`, `SgfImport.tsx` mit Dateiupload, Textarea und Stellungsprüfung).
- `src/bots.ts`: MCTS mit RAVE und Vorwissen (Schlagen/Retten gut, Selbst-Atari und erste Linie schlecht, auf großen Brettern dritte/vierte Linie gut). Der Bot passt, wenn der Gegner gepasst hat und die Auszählung für ihn spricht oder wenn der beste Zug auf einem entschiedenen Punkt läge. Etwa 9 000 Zufallspartien/s auf 9 × 9, 2 000/s auf 19 × 19.
- Engine & Online: neue Zeitvorgabe `byoyomi` (Hauptzeit, dann Perioden) und `timePresetsFor(options)` – größere Bretter haben längere Zeiten. Fernpartien (Option `correspondence` mit 12h–2 Tagen pro Zug): 30 Tage Raum-Lebensdauer (`CORRESPONDENCE_ROOM_TTL_MS`), kein Bot-Ersatz nach kurzem Verbindungsabbruch und lokale Web Notifications („Du bist am Zug“).
- Oberfläche: Linien per CSS im `GridBoard`; unter 30 px pro Punkt erst Vorschau-Stein, dann „Setzen“ oder zweites Tippen; unter 26 px Lupe (190 %). Im Desktop- und Board-Menü SGF laden und speichern.

## Offene Punkte

- Prüfen, ob KataGo auf warpdrive sinnvoll läuft (CPU-Version).
