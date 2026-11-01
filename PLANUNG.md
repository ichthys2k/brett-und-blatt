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
| W-005 | Narrenhof | **Sprachaufnahmen der Kombis im Narrenhof:** Die Ansagen der Kombis (`fs_hand_*`) sagen noch die alten Namen („Duo“, „Triple“ …). Neue Aufnahmen mit den Narrenhof-Namen; Auswahl der Stimmen durch Cornelius (Werkzeuge im Klang-Repo). Plan in `docs/spiele/farbensortierer.md`. | niedrig | offen | 2026-10-31, Cornelius |
| W-007 | Eins! | **Eigene Musik je Kartenseite bei Flip:** Im Modus Flip soll je nach Kartenseite (Hell/Dunkel) ein eigener Soundtrack laufen. Neue Stücke dürfen dafür erzeugt werden (Auswahl durch Cornelius). | niedrig | offen | 2026-10-30, Cornelius |
| W-014 | alle Spiele | **Mehr Lieder in den Playlists:** Die Playlists sollen mehr Stücke bekommen (Auswahl durch Cornelius, Ablage in `musik/` im Klang-Repo). | mittel | offen | 2026-10-30, Cornelius |
| W-020 | Layout (Desktop, Tablet) | **Spieler rund um einen Tisch:** Bei genug Platz sitzen die Spieler wie beim Poker um einen Tisch, in der Mitte findet das Spielgeschehen statt. Nicht auf dem Handy. Erst einen Umsetzungsplan machen. | niedrig | offen | 2026-10-30, Cornelius |
| W-024 | Discord | **Discord-Anbindung:** Viele der Spiele lassen sich online theoretisch dadurch gut ergänzen, dass man mit seinen Freunden im Voice-Chat sitzt. z.B. über Discord. Wäre es möglich Discord in die App zu intergrieren? Das könnte in verschiedene Richtungen funktionieren: Discord irgendwie in "Brett und Blatt" zu integrieren oder umgekehrt: Brett und Blatt irgendwie als Plugin o.Ä. für Discord Server aufzubereiten. Recherchiere, wie so was aussehen könnte und stelle mir verschieden Konzepte vor, die man ausarbeiten könnte. | niedrig | zurückgestellt (Cornelius, 31.10.); Konzept: [Konzept](docs/spiele/discord.md) | 2026-10-31, Cornelius |
| W-025 | Drachenspiel | **Drachenspiel im Mittelalter-Thema:** Der Narrenhof hat das Mittelalterthema gut aufgearbeitet. Wäre es denkbar dieses Thema auch für das Drachenspiel aufzuarbeiten und entsprechen auszustaffieren. Reflektiere mal wie das aussehen könnte und entwickle ein Konzept | niedrig | Konzept Fassung 2 fertig (Claude, 31.10.): [Taverne + Drachenspiel](docs/spiele/taverne-und-drachenspiel.md), Begriffe warten auf Entscheidung von Cornelius | 2026-10-31, Cornelius |
| W-026 | alle Spiele | **Durchgängiges Thema „Mittelalterliche Taverne“:** Das Mittelalter Thema könnte man auch optisch für alle anderen Spiele anwenden. Man könnte es auch erweitern zu einer mittelalterlichen Taverne. Dann hätte Brett und Blatt ein durchgängiges Thema, das gestalterisch einen Rahmen setzt. | mittel | in Arbeit (Claude, claude/taverne-probe): Schritt 1 (`1ea69c2`) und Schritt 2 veröffentlicht, Taverne ist Standard; weitere Schritte in [Taverne + Drachenspiel](docs/spiele/taverne-und-drachenspiel.md) | 2026-10-31, Cornelius |
| W-027 | neue Spiele | **Spiele für viele Spieler:** Ich möchte mehr Spiele haben, die man mit vielen Spielern spielen kann. Also mindestens 4 Spielern, besser 8 oder 20 oder sogar 30 Spielen. Das könnten Partyspiele sein, gesellschaftsspiele oder andere Spiele die auch mit vielen Spielern kurzweilig zu spielen sind. Recherchiere dafür 20-40 Spielideen, die man umsetzen könnte und gib mir dafür eine kurze Beschreibung. | hoch | Konzept fertig (Claude, 31.10.): [Spiele für viele](docs/spiele/spiele-fuer-viele.md), wartet auf Entscheidung von Cornelius | 2026-10-31, Cornelius |
| W-039 | neue Spiele | **Marktstände und Grafschaft (Arbeitstitel, „Reihenbauer“ und „Landschaftsleger“):** eigene Entwürfe statt Nachbau von 6 nimmt! und Carcassonne; erst Entwurf mit Probepartien, Bau nach Cornelius' Ja. Paket C, [Umsetzungsplan](docs/spiele/umsetzungsplan-pakete-a-b-c.md). | mittel | offen | 2026-10-31, Cornelius |
| W-040 | neues Spiel | **Zeitband (Arbeitstitel):** eigenes Zeitstrahl-Spiel statt Hitster-Nachbau: alle legen gleichzeitig verdeckt auf ein gemeinsames Band, Engstellen-Wertung, Hinweisleiter; Pakete Erfindungen, Geschichte, Bibel (Reihenfolge), Musik nur aus eigenen Suno-Stücken und Gemeinfreiem (Spotify-Regeln verbieten Spiele, YouTube-Player darf nicht verdeckt werden). Denkbar: DJ-Modus (Spielleitung spielt selbst ab) und echtes Video erst nach der Auflösung. 1–30 Plätze, Tafel. [Plan](docs/spiele/zeitband.md) | niedrig | zurückgestellt (Idee, Cornelius denkt noch nach, 31.10.) | 2026-10-31, Cornelius |
| W-044 | Drachenspiel | **Ausbau zum vollwertigen Sammelkarten-Duell:** Regelkern, Hauskräfte, Stichwörter, Wahlen, Tierfamilien, Deckbau und Solo-Modi nach dem Vorbild Hearthstone, mit eigener Welt und ohne Kaufsystem. Plan in [`docs/spiele/drachenspiel-ausbau.md`](docs/spiele/drachenspiel-ausbau.md). | mittel | offen: Phase 0 bis 4 erledigt, als Nächstes Phase 5 | 2026-11-01, Cornelius |
| W-046 | Menüs | **Musik und Soundeffekte getrennt schalten:** Ich möchte, dass man Musik und Soundeffekte separat ein- und ausschalten kann | niedrig | offen | 2026-11-01, Cornelius |
| W-047 | Musik | **Suno-Playlists im Spiel einbetten:** Ich kann in Suno zwar viele Lieder erstellen, wenn ich sie aber downloaden will um sie in "Brett und Blatt" einzubauen ist die Anzahl der Lieder bei meinem Pro Konto stark limitiert. Wäre es möglich stattdessen mit Suno Playlists zu arbeiten, die direkt im Spiel eingebettet sind? Überlege, ob der Plan sinn macht und wie man ihn umsetzen könnte. | niedrig | offen | 2026-11-01, Cornelius |
| W-048 | Spielkarten | **Bildkarten mit Porträts:** Ich möchte, dass man man optional traditionelle Karten haben kann wo die Bildkarten (Bube, Dame, König) tatsächlich Portraitbilder haben. Sie sollen sich im Stil an denen vom Narrenhof orientieren. Recherchiere, wie typische Kartensets aussehen um gut Bilderprompts zu erstellen. Das ganze soll für alle bisherigen kartensets (Französisch, Deutsch, Turnierset) möglich sein. Die Funktion soll Optional sein. Im Desktop soll es standardmäßig aktiviert sein, mobil nicht. | mittel | offen | 2026-11-01, Cornelius |
| W-049 | Narrenhof | **Porträts für die 81 Narren:** Auf den großen Narren-Karten am Desktop (W-045) steht im Bildfeld noch das Emoji. Jeder Narr bekommt ein KI-Porträt im Stil der Herrschaften (Canva, eine Stimmung reicht), Einbau über `portraitUrl` wie bei den Gegnern. Canva drosselt auf etwa 1 Bild je 4–5 Minuten, also rund 6–7 Stunden Erzeugung. Dabei die vorhandenen Porträts (nur 161 × 200 px, auf der großen Karte weich) aus Canva in höherer Auflösung neu exportieren. | niedrig | offen | 2026-11-01, Cornelius |

## Fehler

| Nr. | Spiel/Bereich | Fehler | Schritte zum Nachstellen | Erwartet | Tatsächlich | Gerät/Browser | Prio | Status | Eingetragen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-010 | Drachenspiel | Spiel startet am Anfang oft nicht | Spiel Starten | Spiel beginnt | Bildschirm bleibt schwarz. Man muss die Seite mit "f5" neu laden, bevor das spielfeld erscheint. | Egal | mittel | nicht mehr nachstellbar (15 von 15 Starts sauber, 1.11.): gleiche Ursache wie F-009, wartet auf Cornelius' Bestätigung am Gerät | 2026-11-01, Cornelius |
| F-011 | Verschiedene Spiele | Bei manchen Spielen ist der untere Teil des Spielfelds nicht mehr sichtbar | Gerät mit kleinem Bildschirm benutzen (z.b. bei "Eins!"). Tritt vor allem dann ein, wenn es viele Spieler hat, die dann das Spielfeld nach untern verschieben | Alle Spielrelevanten UI Elemente sind auf dem Bildschirm zu sehen. | Die Elemente unten sind nur durch scrollen zu sehen. | Mobilgerät | mittel | behoben (8e6d2d2), wartet auf Cornelius' Blick am Handy. Bewusst noch rollend: Auswahllisten (Wer bin ich?, Drachenspiel-Deckwahl, Narrenhof-Vorbereitung), Poker-Erhöhen auf kleinen Bildschirmen. Eng: Poker zu zehnt im Handy-Querformat | 2026-11-01, Cornelius |

## Erledigt

| Nr. | Titel | Erledigt am | Commit/PR |
| --- | --- | --- | --- |
| W-041 | Marktplatz: Würfel- und Handelsspiel im Mittelalter, 2–6 Plätze, Bot „Krämer“, online; [Plan](docs/spiele/marktplatz.md), [Probe](docs/spiele/marktplatz-probe.md) | 2026-11-01 | 4817a5e |
| F-005 | Eins!: Handkarten im Querformat abgeschnitten | 2026-11-01 | 864ef49 |
| F-006 | Stichspiele: Handkarten überdecken die Knöpfe | 2026-11-01 | 864ef49 |
| W-042 | Rübenacker (Arbeitstitel): Hasenrennen zur Riesenrübe, Karten statt Würfel, sichtbarer Maulwurf-Hügel, Bot „Langohr“, online | 2026-11-01 | 193c3d9 |
| W-034 | Sternhalma: Sternbrett mit 121 Löchern für 2–6 Spieler, Sprungketten, Bot „Sternspringer“, online | 2026-11-01 | e9b152d |
| W-033 | Elf zuerst! (Elfer raus): Anlegespiel für 2–6 Spieler, 80 Zahlenkarten, Bot „Zahlenzwerg“, online | 2026-11-01 | a9eebe5 |
| W-038 | Neues Spiel: [Verboten!](docs/spiele/verboten.md) (früher Arbeitstitel „Umschreibe-Duell“) – Sperrwörter legt das gegnerische Team fest, Schreib- und Sprech-Modus; Begriffe freigegeben | 2026-11-01 | #44 |
| W-037 | Neues Spiel: [Wer bin ich?](docs/spiele/wer-bin-ich.md) – Katalog- und freier Modus; Kataloge freigegeben | 2026-11-01 | #44 |
| W-036 | Neues Spiel: [Kategorien-Sprint](docs/spiele/kategorien-sprint.md) – Stadt-Land-Fluss-artig, Abstimmung, Tafelansicht; Wortlisten freigegeben | 2026-11-01 | #44 |
| W-035 | Bausteine für Wortspiele: Texteingabe mit Prüfung, Abstimmung, Teams in der Lobby | 2026-11-01 | #44 |
| W-021 | Neues Spiel: [Wölfe im Schafspelz](docs/spiele/woelfe-im-schafspelz.md) (Werwolf-Regeln mit christlichem Thema); Live-Test durch Cornelius bestanden | 2026-11-01 | 0aea54b |
| W-017 | Narrenhof: Gegner mit Porträts – 30 Herrschaften und 38 Höflinge, je drei Stimmungen (schmunzelnd, lachend, Lachkrampf) | 2026-11-01 | #36, #39, #43 |
| W-043 | Narrenhof: mehrere Passkeys für die Sicherung (auf dem Handy bestätigt) | 2026-11-01 | #42 |
| W-045 | Narrenhof: Desktop mit großen Karten für Herrschaft und Narren (Narren-Porträts folgen später) | 2026-11-01 | be899ec |
| W-032 | Nicht ärgern! zu sechst: Sternbrett mit sechs Armen und 54 Feldern (ab 5 Spielern, bis 4 als Option), Lila ◆ und Türkis ✚; Figuren stehen mittig auf dem Feld | 2026-10-31 | d010251 |
| W-018 | Narrenhof: Fortschritt geräteübergreifend sichern (Sicherungscode und Passkey; Microsoft/Google zurückgestellt) | 2026-10-31 | #41 |
| W-028 | Startseite: Filter nach Spielerzahl („Wie viele spielt ihr?“) | 2026-10-31 | #40 |
| W-029 | Raumleitung nimmt Abwesende vom Platz, Zuschauer übernehmen ihn | 2026-10-31 | #40 |
| W-030 | Name und Emoji in der Lobby ändern | 2026-10-31 | #40 |
| W-031 | Raumleitung legt Namen und Emojis fest und kann das Umbenennen sperren | 2026-10-31 | #40 |
| W-003 | Pflichtsolo im Doppelkopf (Option, Vorführung, Geber bleibt, Bot zieht sein Solo) | 2026-10-31 | #38 |
| W-001 | Vierer-Schach-Bot mit Vorausschau über eine Runde (schwer gewinnt 40 % statt 25 %, im Teammodus 18 von 20) | 2026-10-31 | #38 |
| W-002 | Binokel zu viert: Geber setzt aus oder Kreuzbinokel 2 gegen 2 | 2026-10-31 | #38 |
| W-004 | Drachenspiel: neun eigene Zauberkarten (Option, Standard an) | 2026-10-31 | #38 |
| W-016 | Narrenhof: 29 neue eigene Narren nach Balatro-Vorbild (81 insgesamt) | 2026-10-31 | #36 |
| W-006 | Narrenhof: späte Ziele gesenkt, schwerer Bot gewinnt 24 % statt 2–4 % | 2026-10-31 | #36 |
| W-023 | Offene Runden live unter „Online spielen“ und auf der Startseite (WebSocket zum Verzeichnis, Räume melden sich nur bei Änderung) | 2026-10-31 | #37 |
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
| F-007 | Drachenspiel: Kartenfolge bei „Im Spiel wählen“ in jeder Partie gleich | 2026-11-01 | #45 |
| F-008 | Drachenspiel: Kartentexte widersprechen den Regeln | 2026-11-01 | #45 |
| F-009 | Drachenspiel: Seite wird beim Partiestart leer | 2026-11-01 | #45 |
