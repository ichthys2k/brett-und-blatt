# Konsole überall – die Konsolen-Oberfläche wird Standard (Vorhaben #635)

Stand: 21.11.2026 (U1–U5 umgesetzt; die Konsole ist Standard). Vorgänger: [Konsolen-Oberfläche](konsole.md) (Vorhaben #607, umgesetzt). Maße, Muster und Bausteine: [Styleguide](konsole-styleguide.md), Abschnitte 9–13.

> Mir gefällt das Steam UI sehr gut. Ich möchte, dass es der neue Standard wird. Und ich möchte auch, dass alle UI-Elemente im gesamten Spiel, also nicht nur Start und Bibliothek, sondern auch Online und auch die Optionen, neu aufgesetzt werden und ein UI haben, das Ähnliches wie das von SteamOS. Das betrifft alle UI-Elemente in allen Menüs. Außerdem möchte ich später dann auch innerhalb der einzelnen Spiele eine durchgängige UI haben, die sich an SteamOS orientiert. Das aber erst in der nächsten Phase. (Cornelius, 21.11.2026)

Der maßgebliche Stand der Aufgaben steht in den Issues (#635 und Unter-Issues). Diese Seite erklärt den Zusammenhang und sammelt, was umgesetzt ist.

## 1. Worum es geht

Heute sind Start, Bibliothek und Spielseite in der Konsolen-Oberfläche neu gebaut. Alle anderen Menüs (rund 15 000 Zeilen in `apps/web/src/screens/` und `components/`) sind klassische Seiten, teils im Konsolen-Rahmen (`ClassicInFrame`), teils ganz ohne. Die Konsole gilt nur im Querformat ab 700 × 360 px und muss eingeschaltet werden.

**Phase 1 (dieses Vorhaben):** Die Konsole wird Standard auf jedem Gerät, und jede Menüseite außerhalb der Partie wird in ihrer Formensprache neu gebaut.

**Phase 2 (später, eigenes Vorhaben):** die Oberfläche in der Partie – Spieltisch-Rahmen, Menü der Partie, Siegerehrung, Lernrunde und die Oberflächen der einzelnen Spiele. Phase 1 bereitet das vor, weil die Bausteine in `packages/ui` liegen. Was unterwegs für Phase 2 auffällt, kommt in Abschnitt 7.

## 2. Festlegungen

Cornelius kann jede vor der Freigabe ändern; sie stehen auch in #635.

1. **Standard für alle, auch am Handy hochkant.** Die Mindestgröße fällt weg; die Konsole bekommt ein Hochformat (Leiste unten, Kacheln zweispaltig, Einstellungen einspaltig).
2. **Klassisch bleibt als Option**, solange umgebaut wird. Über das Entfernen entscheidet Cornelius am Ende (U16).
3. **Früh umstellen:** Der Standard wechselt nach Bausteinen, Hochformat und Navigation (U4). Noch nicht umgebaute Seiten erscheinen bis dahin klassisch im Rahmen.
4. **Eigene Gestaltung in der Art von SteamOS:** Aufbau und Bedienlogik übernehmen (Hauptreiter, Unterreiter, Einstellungsseiten mit Kategorien und Zeilen, Listen mit einer Hauptaktion, Fenster mit Aktionen unten, Schnellzugriff); Farben, Schrift und Bilder bleiben die von Brett & Blatt. Kein Nachbau von Valves Grafiken, Symbolen oder Schriften.
5. **Sieben Seitenmuster, ein Satz Bausteine** (`Kns…`). Keine Seite erfindet eigene Knöpfe, Karten oder Fenster.
6. **Bausteine in `packages/ui/src/konsole/`**, damit Phase 2 sie in den Spielen nutzen kann.
7. **Fünf Hauptreiter** mit Unterreitern (Abschnitt 3). Alle Adressen bleiben.
8. **Schnellzugriff** auf Start ☰ in den Menüs.
9. **Nichts geht verloren.** Jede Funktion der klassischen Seite gibt es auf der neuen; Logik wird herausgelöst und geteilt, nicht abgeschrieben.
10. **Nicht im Umfang:** die Partie (Phase 2), Tisch-Bildschirm, Beamer- und eingebettete Ansichten, VR-App, Text-Client, SNES, Server und Protokoll, neue Bilder und Klänge.

## 3. Navigation

| Hauptreiter | Unterreiter | Seiten heute |
|---|---|---|
| 🏠 Start `#/` | – | `ConsoleHome` |
| 🎲 Bibliothek `#/einzelspieler` | Spiele · Lernen · Helfer | `ConsoleLibrary`, `ConsoleGame`; `Learn`, `Library`, `Collection`, `PackView`, Editoren; `Helpers` |
| 🌐 Online `#/online` | Spielen · Schwarzes Brett · Turniere · Klassen · Vereine | `Online`, `Room` (Lobby); `Board`; `Tournaments`, `Tournament`, `Series`; `Classes`, `ClassLearning`; `Org` |
| 🪪 Pass `#/pass` | Pass · Konto | `Pass`, `PassView`; `Account` |
| ⚙️ Optionen `#/ton` | – (Kategorien in der Seite) | `SoundSettings`; dazu Rechtliches und Betreiber |

LB/RB wechselt die Hauptreiter; Unterreiter erreicht das Steuerkreuz. Start ☰ öffnet den Schnellzugriff (Lautstärke, Musik, Pass, Weiterspielen). Ohne Rahmen bleiben Partie, Tisch-Bildschirm, Beamer, eingebettete Ansichten.

## 4. Schritte

Jeder Schritt ist ein Unter-Issue von #635 mit Ziel, Stand, Umsetzung, „Nicht ändern“, Prüfen und „Fertig, wenn“. Freigegeben (`status: Ready`) wird jeder einzeln.

| Schritt | Issue | Inhalt | Braucht | Anspruch |
|---|---|---|---|---|
| U1 | #636 | Bausteine in `packages/ui/src/konsole/`, Schauseite `#/bausteine` | – | hoch |
| U2 | #637 | Hochformat: Rahmen, Start, Bibliothek, Spielseite; Mindestgröße weg | U1 | hoch |
| U3 | #638 | Fünf Hauptreiter, Unterreiter, Schnellzugriff; jede Route im Rahmen | U1 (U2) | hoch |
| U4 | #639 | Konsole wird Standard, einmaliger Hinweis | U1–U3 | mittel |
| U5 | #640 | Optionen als Einstellungsseite mit sieben Kategorien | U1–U3 | mittel |
| U6 | #641 | Online: Übersicht, offene Runden, eröffnen, beitreten | U1–U3 | mittel |
| U7 | #642 | Lobby im Raum | U1–U3 (U6) | hoch |
| U8 | #643 | Schwarzes Brett | U1–U3 | niedrig |
| U9 | #644 | Pass und Konto | U1–U3 | mittel |
| U10a | #645 | Turniere: Übersicht, Anlegen, Beitreten | U1–U3 (U6) | mittel |
| U10b | #646 | Turnierseite (drei PRs) | U10a | hoch |
| U10c | #647 | Serien | U10b | niedrig |
| U11 | #648 | Klassen und Vereine (zwei PRs; Unterreiter „Klassen“ und „Vereine“) | U1–U3 (U6) | mittel |
| U12a | #649 | Lernen: Pakete und Start der Lernrunde | U1–U3 | mittel |
| U12b | #650 | Sammlung und Editoren (zwei PRs) | U12a | mittel |
| U13 | #651 | Spielhelfer | U1–U3 | niedrig |
| U14 | #652 | Spielseite vervollständigen, Rechtliches, Betreiber, Rest | U1–U3 | niedrig |
| U15 | #653 | Meldungen, Rückfragen, Zustände, Tastatur | U1–U4 | mittel |
| U16 | #654 | Gesamtprobe, Barrierefreiheit, Aufräumen, Doku, Entscheidungsvorlage | alle | mittel |

**Reihenfolge:** U1 → U2 → U3 → U4 nacheinander. Danach sind U5–U15 voneinander unabhängig und können parallel laufen (Ausnahmen in der Spalte „Braucht“). Empfohlen nach Nutzen: U5, U6, U7, U9, dann der Rest. U16 zum Schluss.

**Für günstigere Modelle:** „Anspruch niedrig/mittel“ ist nach dem Verfahren unten gut machbar. Bei „hoch“ (U1, U2, U3, U7, U10b) lohnt ein stärkeres Modell oder eine genaue Durchsicht des PR, weil alle anderen Schritte darauf bauen bzw. die Seite viele Rollen und Zustände hat.

## 5. Verfahren je Seiten-Schritt (U5–U15)

1. **Bestandsliste:** klassische Seite in allen Zuständen und Rollen öffnen, jede Funktion aufschreiben, als Kommentar ins Issue. Das ist die Abnahmeliste.
2. **Muster zuordnen** (Styleguide Abschnitt 10; das Issue schlägt es vor).
3. **Logik herauslösen** in einen Hook oder nach `lib/` – eigener Commit ohne sichtbare Änderung, Bildvergleich der klassischen Seite.
4. **Neu bauen** unter `apps/web/src/console/`, in `consoleScreen` eintragen; `ClassicInFrame` für die Route entfällt.
5. **Abnahmeliste abhaken**, mit Finger (390 × 844) und mit Controller (1280 × 800).
6. **Proben:** `corepack pnpm check`, Rauchtest, `controller-probe.mjs`, `konsole-probe.mjs` (um die neue Seite erweitern).
7. **Doku:** `docs/CHRONIK.md` und Abschnitt 6 hier.

## 6. Umgesetzte Schritte

Jeder Schritt trägt hier Datum, PR und die wichtigsten Dateien ein.

- **U1 Bausteine (#636, 21.11.2026):** `packages/ui/src/konsole/` (Bausteine, `konsole.css`, reine Logik `logic.ts`), Schauseite `/?modus=konsole#/bausteine` (`apps/web/src/console/Gallery.tsx`). Start, Bibliothek und Spielseite nutzen die Bausteine, unverändertes Aussehen. Nebenbei: die räumliche Navigation (`spatialNav.ts`) springt mit „runter“ nicht mehr über Zeilen hinweg, die über die volle Breite gehen.
- **U2 Hochformat (#637, 21.11.2026):** `knsLayout`/`knsColumns` (`packages/ui/src/konsole/layout.ts`), `useKnsLayout`, Leiste unten im Rahmen, Hochformat für Start, Bibliothek (Fenster „Spielerzahl“) und Spielseite; die Konsole gilt in jeder Fenstergröße.
- **U3 Navigation (#638, 21.11.2026):** Navigationsplan `console/consoleTabs.ts` (fünf Hauptreiter, Unterreiter), Unterreiter im Rahmen, Schnellzugriff `console/QuickAccess.tsx`; jede Menü-Route steht im Rahmen (`screens/classicScreen.tsx` + `ClassicInFrame`).
- **U4 Konsole wird Standard (#639, 21.11.2026):** ohne gespeicherte Wahl gilt die Konsole; „Klassisch“ wird als `klassisch` gespeichert; einmaliger Hinweis `components/ShellNotice.tsx` statt des Angebots „Controller erkannt“.
- **U5 Optionen (#640, 21.11.2026):** `console/ConsoleOptions.tsx` mit sieben Kategorien, Adresse `#/ton?bereich=…`.

## 7. Phase 2 – Vormerkungen

Wird in U15 und U16 gefüllt. Schon bekannt:

- Spieltisch-Rahmen (`Play.tsx`): Seitenleiste, Kopfzeile, Menü „⋯“, Schublade, Tipp, Zugliste.
- Menü der Partie, Regeln in der Partie, Ergebnis und Siegerehrung, Revanche/Abstimmung im Raum, Chat.
- Lernrunde (Karte, Antwort, Bewertung).
- Je Spiel: Knöpfe, Anzeigen und Fenster der Spiel-Oberflächen (`packages/games/<id>/src/ui/`) auf die Bausteine umstellen – 56 Spiele, vermutlich rubrikweise.
- Tisch-Bildschirm und Beamer-Ansichten.

## 8. Risiken

- **Hochformat ist neu** für die Konsole und der häufigste Fall (Handy). Deshalb U2 vor dem Standardwechsel und „Hochformat zuerst prüfen“ in jedem Schritt.
- **Mischzustand** zwischen U4 und dem letzten Seiten-Schritt: neue und klassische Seiten nebeneinander im selben Rahmen. Vertretbar, weil alles benutzbar bleibt; U5–U7 und U9 zuerst verkürzen ihn für die meistbenutzten Wege.
- **Doppelte Pflege**, solange „Klassisch“ bleibt: jede neue Funktion braucht zwei Darstellungen. Herausgelöste Hooks halten das klein; U16 legt die Entscheidung vor.
- **Unterricht und Direktlinks:** Adressen, QR-Codes und `autostart` bleiben (U4 prüft sie ausdrücklich).
- **Größe des Start-Bündels:** seltene Seiten nachladen (U16 misst).
