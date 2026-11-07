# Tabletop Simulator: Vergleich und Ausbauideen (W-065)

7.11.2026 · Recherche zu [Issue #67](https://github.com/ichthys2k/brett-und-blatt/issues/67)

> Recherchiere das Spiel „Tabletop Simulator“. Was ist es? Welche Funktionen hat es? Wie vergleicht es sich mit „Brett und Blatt“? Welche Funktionen aus „Tabletop Simulator“ könnte man selbst nachbauen? Erstelle eine Liste mit kurzen Ausführungen, was man machen könnte, was es bringen würde und wie kompliziert das wäre.

## Kurzfassung

Tabletop Simulator (TTS) ist ein **Spieltisch ohne Regeln**: ein 3D-Sandkasten mit Physik, in dem Menschen Karten, Figuren und Würfel von Hand bewegen und die Regeln selbst kennen müssen. Brett & Blatt ist das Gegenteil: **jedes Spiel kennt seine Regeln**, prüft jeden Zug, hat Bots und läuft ohne Installation auf dem Handy. Die beiden Ansätze ergänzen sich eher, als dass sie konkurrieren.

Nachbauen lohnt sich nicht die 3D-Physik, sondern einige Werkzeuge rund um den Tisch. Meine Empfehlung in dieser Reihenfolge:

1. **Zeigen auf dem Tisch** (Ping auf ein Feld oder eine Karte, online für alle sichtbar), klein.
2. **Partie nachspielen** (Wiederholung einer beendeten Partie Zug für Zug), klein bis mittel.
3. **Tisch auf dem großen Bildschirm, Hand auf dem Handy** (Fernseher oder Beamer zeigt den offenen Tisch), mittel.
4. **Freier Kartentisch** als eigenes Spiel ohne Regeln (Karten, Würfel, Steine frei bewegen, verdeckte Hand), groß, aber der eigentliche Kern von TTS.

Bewusst nicht nachbauen: Physik und 3D, Lua-Skripte von Fremden, Workshop mit Hochladen beliebiger Inhalte, Bezahl-Marktplatz, Sprachchat (siehe [discord.md](discord.md), Konzept E).

## Was Tabletop Simulator ist

- **Herkunft:** Von Berserk Games, finanziert 2014 über Kickstarter, erschienen im Juni 2015 auf Steam. Gebaut mit Unity. Kostet einmalig (um 20 €), jede Person am Tisch braucht eine eigene Lizenz.
- **Plattformen:** Windows, macOS, Linux, dazu VR (SteamVR). Kein Handy, kein Browser. Seit Version 14 (8.1.2026) läuft es auf Unity 6, Windows nur noch 64-Bit ab Windows 10, macOS nativ auf Apple Silicon ([Patch-Notizen v14](https://tabletopsimulator.com/news/patch-notes/v14-0-public-beta-engine-upgrade-unity-6-lts-copy)).
- **Grundidee:** Ein physikalisch simulierter Tisch. Objekte lassen sich greifen, werfen, drehen, umdrehen, stapeln, mischen. Es gibt keine eingebauten Regeln: Wer schummeln will, kann schummeln. Berühmt ist der Knopf zum Umwerfen des Tisches.
- **Inhalte:** Grundausstattung mit Klassikern (Schach, Dame, Backgammon, Poker, Domino, Mahjong, Puzzles), offizielle DLCs von Verlagen (etwa Scythe oder Root) und vor allem der **Steam Workshop** mit sehr vielen Fan-Modulen. Viele davon sind ungenehmigte Nachbauten kommerzieller Spiele, eine rechtliche Grauzone.
- **Ausblick 2026:** Berserk hat am 2.1.2026 eine kostenlose Version 2.0 angekündigt: neue Oberfläche mit „Play Mode“ und „Edit Mode“, besser für das Steam Deck, mehr Leistung, stabileres Online-Spiel, überarbeitetes VR, dazu ein **Creator Marketplace** für bezahlte Mods. Ein Termin für 2.0 ist nicht genannt ([PC Gamer](https://www.pcgamer.com/games/sim/tabletop-simulator-announces-a-free-2-0-update-that-includes-a-ui-overhaul-and-a-marketplace-for-paid-mods)).

## Funktionen im Überblick

| Bereich | Was TTS bietet |
| --- | --- |
| Tisch und Objekte | Physik, greifen, werfen, drehen, umdrehen, stapeln, Ausrichtung am Raster und an Andockpunkten, verschiedene Tische und Räume |
| Karten | Eigene Kartensätze aus einem Bildraster (bis 70 Karten je Bild), mischen, austeilen (auch von unten), Kartenfächer, Zustände je Karte |
| Würfel und Zubehör | Würfel W4 bis W20 mit eigenen Seiten, Beutel (auch unendliche Beutel), Zähler, Rechner, Uhren, Lineal und Messwerkzeug, Zeichnen auf dem Tisch |
| Verdeckte Informationen | **Handbereiche** je Spielerfarbe (nur der Besitzer sieht die Karten), **verborgene Zonen** (Nebel des Krieges), Mischzonen, die alles Hineingelegte zufällig verteilen |
| Mehrspieler | Bis 10 Plätze als Farben, dazu Zuschauer (grau) und Spielleitung (schwarz), Teams, Zugreihenfolge, Rechte der Raumleitung, Text- und Sprachchat, Zeiger aller Spieler sichtbar, Wechsel der Raumleitung bei Verbindungsabbruch |
| Hot-Seat | Mehrere an einem Rechner, Hand wird beim Wechsel verdeckt |
| Zeit | **Zurückspulen** (der Tisch wird regelmäßig gesichert, man kann Sekunden oder Minuten zurück), Speichern und Laden ganzer Tische, Cloud-Speicher für eigene Bilder und Modelle |
| Regeln und Hilfe | Notizblock, Regelhefte als PDF im Spiel, Lesezeichen |
| Automatik | **Lua-Skripte** je Objekt (Knöpfe, eigene Oberflächen in XML, Auswertung, Austeilen) bis hin zu vollständig geskripteten Spielen |
| Bauen | Eigene 3D-Modelle und Bilder einbinden, Spiel im Workshop veröffentlichen |

## Vergleich mit Brett & Blatt

| | Tabletop Simulator | Brett & Blatt |
| --- | --- | --- |
| Regeln | keine, die Menschen achten selbst darauf (außer bei Skript-Modulen) | jedes Spiel prüft jeden Zug (`legalMoves`, `isLegal`) |
| Bots | keine (höchstens in einzelnen Skript-Modulen) | jedes Spiel mit Bot in drei Stufen, Tipp-Knopf |
| Allein spielen | kaum sinnvoll | Kernfall |
| Geräte | PC und VR, Installation über Steam | Browser, Handy zuerst, PWA, Hoch- und Querformat |
| Kosten | Kauf je Person, DLCs, bald bezahlte Mods | frei, AGPL-3.0, kein Konto |
| Spiele | ein Sandkasten für alles, Tausende Fan-Module | 55 ausgearbeitete Spiele, jedes eigens gebaut |
| Neues Spiel | Bilder hochladen, in Minuten spielbar | Programmieren (`corepack pnpm neues-spiel`), Tage |
| Verdecktes | Handbereiche und Zonen, aber jeder Rechner hat den ganzen Tisch | Sichten je Platz (`playerView`), der Seed geht nie an den Browser, echte Geheimhaltung |
| Online | Steam-Lobby, ein Rechner ist Gastgeber | Spieleserver (Cloudflare, EU), Emoji-Raumcode, Link, QR, Wiedereinstieg, Bot-Ersatz |
| Zeit | Uhren als Objekt, Zurückspulen | Zeitlimits je Spiel, Zurücknehmen lokal, Fernpartien (Go) |
| Gesellschaft | Text- und Sprachchat, sichtbare Zeiger | Emoji-Reaktionen und Schnellnachrichten, bewusst kein freier Chat |
| Schule | ungeeignet (Steam-Konto, Kauf, Inhalte ungeprüft) | Klassenspiele bis 30, Mathe-Pakete, Übungslink und QR für die Tafel |
| Turniere | nein | WM-Form, K.-o., Schweizer System |

**Kurz:** TTS gewinnt bei Freiheit und Menge (jedes Spiel, sofort, mit eigenen Bildern). Brett & Blatt gewinnt bei allem, was Regeln voraussetzt: Bots, Allein-Spiel, Fairness, Geheimhaltung, Handy, Schule, Kinder und Kosten.

## Ideen zum Nachbauen

Aufwand: **klein** bis 3 Tage, **mittel** 1 bis 2 Wochen, **groß** mehr als 2 Wochen.

### 1. Zeigen auf dem Tisch

- **Was:** Lange drücken (oder Rechtsklick) auf ein Feld, eine Karte oder einen Stein setzt einen kurzen Ring, den alle im Raum sehen, mit Farbe und Bild des Zeigenden. Ähnlich den sichtbaren Zeigern in TTS, aber als Einzelsignal statt ständiger Mausbewegung.
- **Nutzen:** „Schau mal hier“ ohne Chat. Hilft beim Erklären, beim Lernen mit einem Elternteil und in der Klasse. Passt zur Regel „kein freier Chat“.
- **Wie:** Neues flüchtiges Signal neben den Emoji-Reaktionen (Platz, Ziel als Spiel-eigener Schlüssel), Rate begrenzen. Jedes Spiel muss melden, welche Stellen zeigbar sind; Start mit den Rasterspielen über `GridBoard`/`NetBoard`, dann Karten über `CardFan`.
- **Aufwand:** klein für Bretter, mittel für alle Spiele.

### 2. Partie nachspielen

- **Was:** Nach dem Ende eine beendete Partie Zug für Zug vor- und zurückspulen, mit allen Karten offen. Entspricht dem Zurückspulen in TTS, aber ohne die Partie zu ändern.
- **Nutzen:** Aus Fehlern lernen („Warum hat der Bot gewonnen?“), Streit klären, schöne Partien zeigen. Für Schach gibt es mit Chronik und PGN schon einen Teil.
- **Wie:** Der Spielstand ist reines JSON und deterministisch: Seed plus Zugliste ergibt jede Stellung. Nach Partieende darf der Server den Seed herausgeben. Allgemeiner Abspieler in `Play.tsx` mit Schieberegler, der das vorhandene Spielfeld mit `playerView` eines gewählten Platzes oder einer offenen Gesamtsicht füttert.
- **Aufwand:** klein bis mittel. Offene Frage: Gesamtsicht ohne Geheimnisse gibt es heute nicht als eigene Funktion.

### 3. Tisch auf dem großen Bildschirm, Hand auf dem Handy

- **Was:** Ein Gerät (Fernseher, Beamer, Tablet in der Tischmitte) zeigt nur den offenen Tisch: Stich, Ablage, Brett, Punkte. Die Handys der Mitspieler zeigen nur die eigene Hand. Das ist der Handbereich von TTS, übertragen auf echte Geräte.
- **Nutzen:** Hoch für Familienabende und Klassen. Ersetzt in vielen Fällen den Übergabe-Bildschirm beim Hot-Seat.
- **Wie:** Ein besonderer Zuschauerplatz „Tisch“ im Raum, der eine öffentliche Sicht bekommt (Zuschauer gibt es schon). Je Spiel eine Anordnung ohne eigene Hand; Klassenspiele mit Tafel sind dafür schon ein Vorbild. Start mit Mau-Mau, Eins! und den Stichspielen.
- **Aufwand:** mittel für den Rahmen, je Spiel klein.

### 4. Freier Kartentisch (Sandkasten)

- **Was:** Ein eigenes Spiel ohne Regeln: Kartensätze (52, 32, 2 × 24 bayerisch, Eins!-Satz), Würfel, Spielsteine und ein paar Bretter. Karten frei auf den Tisch legen, umdrehen, stapeln, mischen, austeilen, in die eigene verdeckte Hand nehmen. Zurücknehmen für alle.
- **Nutzen:** Hausregeln und Spiele, die es (noch) nicht gibt, online spielen, etwa Rommé, Canasta oder ein selbst erfundenes Spiel. Deckt den Hauptgrund ab, warum Leute TTS nutzen.
- **Wie:** Passt in die vorhandene Schnittstelle: Zustand als JSON mit Objekten und Positionen, Züge wie `move`, `flip`, `shuffle`, `deal`, `takeToHand`; die Hand bleibt über `playerView` geheim, Mischen über den Seed-Rng. Kein Bot, `legalMoves` liefert nur Beispiele (`isLegal`). Oberfläche mit `usePointerDrag` und `PlayingCard`. Schwierig: freie Positionen auf Handy-Größe, viele gleichzeitige Züge (wie Kartenblitz mit `stillValid`).
- **Aufwand:** groß (etwa 2 bis 3 Wochen für eine gute erste Fassung mit Karten; Bretter danach).

### 5. Eigene Kartensätze und Inhaltspakete

- **Was:** Lehrkräfte oder Eltern legen eigene Paare, Quartett-Karten oder Bingo-Felder im Browser an (Text und Emoji, später Bilder) und teilen sie per Code oder QR. Vorbild sind die eigenen Kartensätze aus einem Bildraster in TTS.
- **Nutzen:** Hoch für die Schule (eigener Wortschatz, eigenes Thema) und schnell neue Inhalte ohne Programmieren.
- **Wie:** Die Inhaltspakete unter `content/` haben schon ein festes Format. Ein Editor erzeugt dasselbe JSON; gespeichert wird lokal und auf Wunsch auf dem Spieleserver (Durable Object, ähnlich `BackupVault`). Freitext läuft durch `isBlockedText`. Bilder erst später, weil sie Speicher und Prüfung brauchen.
- **Aufwand:** mittel (ohne Bilder), groß mit Bildern.

### 6. Online zurücknehmen mit Zustimmung

- **Was:** Im Online-Spiel „Zug zurücknehmen?“ fragen; die anderen stimmen zu oder lehnen ab. In TTS kann jeder zurückspulen, hier nur mit Einverständnis.
- **Nutzen:** Freundliche Partien mit Fehlklick werden nicht verdorben. Mittel.
- **Wie:** Wie das Remis-Angebot (`draw-offer.ts`, `DrawOfferBar`) als allgemeiner Baustein im Raum; nur für Spiele ohne `noUndo` und ohne neu aufgedeckte Geheimnisse seit dem Zug (sonst wäre das Zurücknehmen ein Leck).
- **Aufwand:** klein bis mittel.

### 7. Notizblock je Partie

- **Was:** Ein kleiner eigener Notizzettel zur Partie (TTS hat einen Notizblock), für Merkhilfen wie gespielte Trümpfe oder Verdachte bei Wölfe im Schafspelz.
- **Nutzen:** Klein bis mittel, vor allem bei Deduktionsspielen und langen Partien.
- **Wie:** Nur auf dem Gerät (`localStorage` je Partie), nichts geht an den Server, deshalb kein Chat-Problem.
- **Aufwand:** klein.

### 8. Tisch speichern und Wochen später weiterspielen

- **Was:** Online-Partien beliebiger Spiele pausieren und mit denselben Leuten später fortsetzen, wie das Speichern ganzer Tische in TTS.
- **Nutzen:** Lange Spiele (Marktplatz, Doppelkopf-Serien, Turniere über Wochen). Mittel.
- **Wie:** Räume werden heute nach 24 Stunden gelöscht, Go-Fernpartien bleiben 30 Tage. Die längere Lebensdauer allgemein als Raumoption anbieten und den Wiedereinstieg über den Spielerausweis (W-052) nutzen. Achtung Gratis-Kontingent der Durable Objects.
- **Aufwand:** klein bis mittel.

### 9. Spielhelfer für echte Brettspiele

- **Was:** Einfache Tischwerkzeuge ohne Spiel: Würfel (auch mehrere und eigene Seiten), Münze, Sanduhr, Zufallszahl, Startspieler auslosen, Punktezettel für beliebige Spiele.
- **Nutzen:** Brett & Blatt wird auch beim analogen Spieleabend nützlich. Mittel.
- **Wie:** Eigene Seite mit `Die3D` und vorhandenen Bausteinen, offline.
- **Aufwand:** klein.

### 10. Weitere Tische und Räume

- **Was:** Mehrere Tischoberflächen (Filz, Holz, Stein) zur Wahl, wie die Tische und Räume in TTS.
- **Nutzen:** klein, reine Stimmung. Das Aussehen „Taverne“ deckt das teilweise ab.
- **Wie:** Weitere Flächen je Rubrik in `look.css`, Kontraste über `tests/look.test.ts`.
- **Aufwand:** klein.

## Bewusst nicht nachbauen

| Funktion in TTS | Warum nicht |
| --- | --- |
| 3D und Physik, Würfel werfen auf dem Tisch | Schwer auf Handys, kein Nutzen für regelgeführte Spiele; `Die3D` reicht |
| Lua-Skripte von Fremden | Fremder Code auf dem Server oder in den Browsern anderer ist ein Sicherheitsrisiko |
| Workshop mit beliebigen Uploads | Urheberrecht (die meisten TTS-Module sind ungenehmigte Nachbauten), Jugendschutz, Prüfaufwand |
| Bezahl-Marktplatz | Widerspricht freier Software und dem Jugendschutz-Grundsatz des Projekts |
| Sprach- und Textchat | Bewusste Entscheidung gegen freien Chat; Sprachkanal-Link siehe [discord.md](discord.md) |
| VR | Kein Publikum dafür, sehr großer Aufwand |
| Tisch umwerfen | Witzig, aber in einem Spiel mit Regeln nur ein anderes Wort für Aufgeben |

## Nächste Schritte

Wenn Cornelius einzelne Ideen will, bekommt jede ein eigenes Issue mit `status: Idee`. Am meisten verspreche ich mir von 1 (Zeigen), 2 (Nachspielen) und 3 (Tisch auf dem großen Bildschirm); 4 (Freier Kartentisch) wäre ein eigenes Vorhaben.

## Quellen

- [PC Gamer, 2.1.2026: Ankündigung von Version 2.0](https://www.pcgamer.com/games/sim/tabletop-simulator-announces-a-free-2-0-update-that-includes-a-ui-overhaul-and-a-marketplace-for-paid-mods)
- [Tabletop Simulator, Patch-Notizen v14.0 (8.1.2026)](https://tabletopsimulator.com/news/patch-notes/v14-0-public-beta-engine-upgrade-unity-6-lts-copy)
- [Tabletop Simulator Knowledge Base: Zonen](https://kb.tabletopsimulator.com/game-tools/zone-tools/)
- [Tabletop Simulator API: Objekte und Skripte](https://api.tabletopsimulator.com/object)
