# Konsolen-Oberfläche (Vorhaben #607)

Eine zweite, zuschaltbare Darstellung der Web-App für Controller, Handheld (Steam Deck) und Fernseher: Bibliothek mit Regalen und großen Kacheln, feste Tastenbelegung, durchgängig bedienbar vom Start bis in die Partie. Die klassische Oberfläche bleibt unverändert und Standard. Die Schritte stehen als Unter-Issues von [#607](https://github.com/ichthys2k/brett-und-blatt/issues/607); **Status und Freigabe stehen nur dort**. Maße, Farben und Tasten: [`konsole-styleguide.md`](konsole-styleguide.md).

Auftrag (Cornelius, 20.11.2026): eine Oberfläche in der Art des Steam Deck, als Option ein- und ausschaltbar, einschließlich der Spiele; so durchgeplant, dass günstigere KI-Modelle die Issues übernehmen können.

## Festlegungen

1. **Eigene Gestaltung, keine Kopie.** Übernommen wird die Bedienlogik der Gattung (Regale, Bibliothek, Spielseite, Schnellmenü, Tastenleiste), nicht Aussehen, Symbole, Schriften oder Klänge eines Herstellers.
2. **Eine Logik, zwei Darstellungen.** Die Konsole ersetzt nur den Weg zum Spiel (Hauptmenü, Spielübersicht, Partie-Vorbereitung). Spieltisch und Spiele bleiben eine Fassung. Seltene Bereiche (Klassen, Turniere, Lernen, Pass, Betreiber) bleiben klassisch.
3. **Gleiche Adressen** in beiden Darstellungen: `#/`, `#/einzelspieler`, `#/neu/<id>`, `#/partie`.
4. **Schalter** unter Optionen (`#/ton`, „Oberfläche“), gespeichert in `brett-und-blatt:oberflaeche`; Startparameter `?modus=konsole` / `?modus=klassisch` gilt nur für den Aufruf.
5. ~~Nur im Querformat ab 700 × 360 px~~ – seit #637 (21.11.2026) gilt die Konsole in jeder Fenstergröße; im Hochformat stehen die Reiter als Leiste unten (Styleguide Abschnitt 9).
6. **Beide Aussehen** („Schlicht“, „Taverne“, hell, dunkel, erhöhter Kontrast) über die vorhandenen Farbvariablen.
7. **Keine neuen Bilder, keine neuen Klänge.** Kacheln nutzen Wappen und Kulissen, nie größer als die Datei.
8. **Feste Tastenbelegung**, B verlässt nie eine laufende Partie (Tabelle im Styleguide).
9. **Controller-Eignung je Spiel** in drei Stufen (`direct`, `carousel`, `cursor`), gemessen und als Abzeichen gezeigt.
10. **Nicht im Umfang:** VR-App, Text-Client, SNES, Server und Protokoll, Spielregeln und Bots, Navigationsklänge, eigene Konsolen-Fassungen von Lobby, Klassen, Turnieren, Lernen und Pass, die Kacheln „Weitere Spiele“, eine Steam-Veröffentlichung.

## Aufbau

```
App.tsx ── Screen()
            ├─ useActiveShell() === 'console' ?  consoleScreen(route)  ── null → klassischer Bildschirm
            │                                      ├─ menu   → ConsoleHome     (K4)
            │                                      ├─ home   → ConsoleLibrary  (K5)
            │                                      ├─ setup  → ConsoleGame     (K6; bei ?autostart=1 klassisch)
            │                                      └─ online, board, sound, pass → klassische Seite im ConsoleFrame (K9)
            └─ sonst: klassische Bildschirme wie bisher
```

| Baustein | Datei | Schritt |
|---|---|---|
| Darstellung wählen und auflösen | `apps/web/src/lib/shellCore.ts`, `shell.ts` | K1 |
| Weiche | `apps/web/src/console/screens.tsx` (`consoleScreen`) | K1 |
| Spielkatalog (Rubriken, Filter, Suche) | `apps/web/src/lib/gameCatalog.ts`, `mathPresets.ts`, `rubriken.ts` | K2a |
| Partie-Vorbereitung | `apps/web/src/lib/setupDraftCore.ts`, `setupDraft.ts`, `useSetupDraft.ts`, `components/SetupForm.tsx` | K2b |
| Tastenhinweise je Bildschirm | `packages/ui/src/input/ButtonPrompt.tsx`, `promptStack.ts` | K3a |
| Regler, Listen, Aufklapper per Controller | `packages/ui/src/input/FocusZone.tsx`, `formControls.ts` | K3c |
| Rahmen, Kachel, Regal, Anfangsfokus | `apps/web/src/console/ConsoleFrame.tsx`, `GameTile.tsx`, `Shelf.tsx`, `useInitialFocus.ts`, `consoleTabs.ts`, `console.css` | K3b |
| Start, Bibliothek, Spielseite | `apps/web/src/console/ConsoleHome.tsx`, `ConsoleLibrary.tsx`, `ConsoleGame.tsx` | K4–K6 |
| Fokus und B am Spieltisch | `apps/web/src/screens/Play.tsx`, `apps/web/src/lib/turnFocus.ts` | K7 |
| Controller-Eignung | `scripts/controller-audit.mjs`, `apps/web/src/lib/controllerGrades.json`, `controllerGrade.ts`, [`konsole-eignung.md`](konsole-eignung.md) | K0, K8 |
| Einmaliger Hinweis | `apps/web/src/components/ConsoleOffer.tsx`, `lib/consoleOffer.ts` | K10 |
| Proben | `scripts/controller-probe.mjs`, `scripts/konsole-probe.mjs`, `scripts/lib/virtual-pad.mjs` | K0, K11 |

Die Navigation innerhalb der Konsolen-Bildschirme kommt vollständig aus der vorhandenen Controller-Schicht (#533–#542, `packages/ui/src/input/`): `GlobalSpatialNavigator` bewegt den Fokus räumlich über alle fokussierbaren Elemente und rollt sie ins Bild, A löst `click()` aus, B geht zurück. Die Konsole ergänzt nur: LB/RB für die Reiter (`ConsoleFrame`), X für die Suche, Y für Lieblingsspiele, den Anfangsfokus je Bildschirm.

## Schritte

| Glied | Issue | Inhalt | Braucht |
|---|---|---|---|
| K0 | [#608](https://github.com/ichthys2k/brett-und-blatt/issues/608) | Controller-Eignung aller Spiele messen, Daten fürs Abzeichen | – |
| K1 | [#609](https://github.com/ichthys2k/brett-und-blatt/issues/609) | Schalter, Startparameter, Weiche | – |
| K2a | [#610](https://github.com/ichthys2k/brett-und-blatt/issues/610) | Spielkatalog aus `Home.tsx` herauslösen | – |
| K2b | [#611](https://github.com/ichthys2k/brett-und-blatt/issues/611) | Partie-Vorbereitung aus `Setup.tsx` herauslösen | – |
| K3a | [#612](https://github.com/ichthys2k/brett-und-blatt/issues/612) | Tastenhinweise je Bildschirm | – |
| K3c | [#613](https://github.com/ichthys2k/brett-und-blatt/issues/613) | Schieberegler, Auswahllisten, Aufklapper per Controller | – |
| K3b | [#614](https://github.com/ichthys2k/brett-und-blatt/issues/614) | Rahmen, Maße, Kachel, Regal, Anfangsfokus | K1, K3a |
| K4 | [#615](https://github.com/ichthys2k/brett-und-blatt/issues/615) | Start-Bildschirm mit Regalen | K2a, K3b |
| K5 | [#616](https://github.com/ichthys2k/brett-und-blatt/issues/616) | Bibliothek | K0, K2a, K3b, K4 |
| K6 | [#617](https://github.com/ichthys2k/brett-und-blatt/issues/617) | Spielseite | K2b, K3b, K3c, K4 |
| K7 | [#618](https://github.com/ichthys2k/brett-und-blatt/issues/618) | Spieltisch mit Controller | (K0, K3a) |
| K8a | [#619](https://github.com/ichthys2k/brett-und-blatt/issues/619) | Strategie- und Brettspiele (12) | K0, K7 |
| K8b | [#620](https://github.com/ichthys2k/brett-und-blatt/issues/620) | Karten- und Stichspiele (17) | K0, K7 |
| K8c | [#621](https://github.com/ichthys2k/brett-und-blatt/issues/621) | Lege-, Würfel- und Familienspiele (13) | K0, K7 |
| K8d | [#622](https://github.com/ichthys2k/brett-und-blatt/issues/622) | Wort-, Quiz-, Klassen-, Rechen- und Echtzeitspiele (15) | K0, K7, K3c |
| K9 | [#623](https://github.com/ichthys2k/brett-und-blatt/issues/623) | Klassische Seiten im Konsolen-Rahmen | K3b, K3c |
| K10 | [#624](https://github.com/ichthys2k/brett-und-blatt/issues/624) | Hinweis „Controller erkannt“ | K1, K4–K6 |
| K11 | [#625](https://github.com/ichthys2k/brett-und-blatt/issues/625) | Probe in der CI, Anleitung Steam Deck, Doku | alle |

```
K0 ─────────────┬──────────────────────────► K5
K1 ──┐          │                    K7 ──► K8a, K8b, K8c, K8d
K3a ─┴► K3b ──► K4 ──► K5, K6 ──► K10 ──► K11
K2a ───────────► K4, K5
K2b ───────────────────► K6
K3c ───────────────────► K6, K8d, K9
```

**Empfohlene Reihenfolge der Freigabe:** zuerst K0, K1, K2a, K2b, K3a, K3c (unabhängig voneinander, ohne sichtbare Änderung), dann K3b und K7, dann K4, danach K5, K6 und K8a–d nebeneinander, zuletzt K9, K10, K11. Eine erste benutzbare Fassung steht nach K6.

**Welche Schritte welche Sorgfalt brauchen:** K2a, K3a, K3c, K4, K5, K10 sind klar umrissen und klein. K8a–d sind Fleißarbeit nach festem Verfahren, aber je Spiel mit eigenem Urteil. K0 (Messwerkzeug), K2b (Umbau von `Setup.tsx`), K3b (Gestaltung), K6 und K7 (Eingriff in `Play.tsx`) sind die anspruchsvollsten; dort lohnt ein stärkeres Modell oder eine genauere Abnahme.

**Überschneidungen:** K8a–d fassen Spielordner an, die auch „Platz am Bildschirm“ (#482: #488–#490, #496) und das Drachenspiel (#425) anfassen. Nie zwei Aufträge gleichzeitig am selben Spiel.

## Spielgruppen für K8

| Schritt | Spiele |
|---|---|
| K8a | `chess`, `four-player-chess`, `checkers`, `dragon-towers`, `go`, `gomoku`, `mill`, `reversi`, `chinese-checkers`, `four-in-a-row`, `ultimate-tic-tac-toe`, `tic-tac-toe` |
| K8b | `skat`, `schafkopf`, `doppelkopf`, `binokel`, `poker`, `uno`, `mau-mau`, `elevens`, `market-stalls`, `drachenspiel`, `color-sorter`, `solitaire`, `quartett`, `black-peter`, `ligretto`, `speed`, `president` |
| K8c | `ludo`, `marketplace`, `turnip-patch`, `dominoes`, `color-and-shape`, `battleship`, `maexle`, `kniffel`, `low-flight`, `pairs`, `bingo`, `grafschaft`, `scrabble` |
| K8d | `word-salad`, `hangman`, `category-sprint`, `describe-duel`, `who-am-i`, `bible-quiz`, `estimate`, `majority`, `timeline`, `symbol-match`, `wolves-sheep`, `duck-rally`, `target-number`, `factor-grid`, `number-wall` |

Das waren alle 57 fertigen Spiele am 20.11.2026. Seit dem 21.11.2026 ist auch `mole-tunnels` (Maulwurfsgänge) freigeschaltet; es bringt eigene Controller-Bedienung mit und wird mit den übrigen gemessen. Ein neues Spiel kommt in die passende Gruppe bzw. misst seine Eignung beim Anlegen selbst (Regel ab K11).

## Bekannte Lücken der Controller-Schicht (Stand 20.11.2026)

Beim Planen aufgefallen, jeweils einem Schritt zugeordnet:

- B führt per `history.back()` aus einer laufenden Partie (`GlobalSpatialNavigator`) → K7.
- Nach einem Bot-Zug liegt der Fokus oft auf `<body>`; der nächste Druck fokussiert die Kopfzeile statt des Spielfelds → K7.
- Schieberegler lassen sich nicht verstellen (Links/Rechts bewegt den Fokus), `<select>` nicht umschalten, `<summary>` nicht erreichen → K3c.
- Die Tastenleiste zeigt überall dieselben fünf Einträge → K3a.
- Für Y (`secondary`) gibt es noch keinen Verbraucher und keine Tastatur-Taste → K4 nutzt Y für Lieblingsspiele; zu jedem Kurzbefehl gibt es einen sichtbaren Knopf.
- Die Bildschirmtastatur kennt kein Leerzeichen, Komma, Punkt → bei Bedarf in K8d.
- Eigene SVG-Bretter und anklickbare `<div>`s einiger Spiele sind nicht fokussierbar → K8a–d (Vorsortierung durch K0).
- Die Controller-Probe läuft nicht in der CI → K11.

## Offene Entscheidungen für Cornelius

- **Name im Menü:** „Konsole“ ist der Arbeitsname des Schalters. Alternativen: „Sofa“, „Großbild“, „Controller“.
- **Reiter oben:** Start, Bibliothek, Online, Optionen. Turniere, Lernen und Pass stehen im Regal „Mehr“.
- **Echtzeitspiele** (`ligretto`, `speed`, `symbol-match`, `duck-rally`): ehrlich als eingeschränkt kennzeichnen statt umbauen.
- **Später denkbar, nicht geplant:** Navigationsklänge (brauchen die Klangauswahl), breite Titelbilder je Spiel (Stilbibel, privates Grafik-Repo), eine Konsolen-Fassung der Online-Lobby, Erkennung des Controller-Typs für PlayStation- und Nintendo-Symbole.

## Umgesetzte Schritte

Jeder Schritt trägt hier nach der Umsetzung Datum, Issue und die wichtigsten Dateien ein (ausführlich in `docs/CHRONIK.md`).

- **K1 (#609, 21.11.2026):** Schalter „Oberfläche“ unter Optionen, Startparameter `?modus=konsole|klassisch`, `data-shell="console"`, Weiche `consoleScreen` – `apps/web/src/lib/shellCore.ts`, `shell.ts`, `apps/web/src/console/screens.tsx`.
- **K2a (#610, 21.11.2026):** Spielkatalog ohne Oberfläche – `apps/web/src/lib/gameCatalog.ts`, `mathPresets.ts`, `categoryOf` in `rubriken.ts`.
- **K3a (#612, 21.11.2026):** Tastenhinweise je Bildschirm – `usePromptItems`, `PromptProvider` (`packages/ui/src/input/ButtonPrompt.tsx`, `promptStack.ts`).
- **K3c (#613, 21.11.2026):** Schieberegler, Auswahllisten und Aufklapper per Controller – `packages/ui/src/input/formControls.ts`, `FocusZone.tsx`.
- **K2b (#611, 21.11.2026):** Partie-Vorbereitung als `useSetupDraft` und `SetupForm` – `apps/web/src/lib/setupDraftCore.ts`, `setupDraft.ts`, `useSetupDraft.ts`, `components/SetupForm.tsx`.
- **K0 (#608, 21.11.2026):** Messwerkzeug und Daten – `scripts/controller-audit.mjs`, `scripts/lib/virtual-pad.mjs`, `apps/web/src/lib/controllerGrades.json`, Bericht [`konsole-eignung.md`](konsole-eignung.md).
- **K3b (#614, 21.11.2026):** Rahmen, Kachel, Regal, Anfangsfokus – `apps/web/src/console/`. Mindesthöhe der Konsole 360 px statt 400 px (sonst fiele Handy quer 844 × 390 heraus).
- **K4 (#615, 21.11.2026):** Start mit Regalen – `console/ConsoleHome.tsx`.
- **K5 (#616, 21.11.2026):** Bibliothek – `console/ConsoleLibrary.tsx`.
- **K6 (#617, 21.11.2026):** Spielseite – `console/ConsoleGame.tsx`.
- **K7 (#618, 21.11.2026):** Spieltisch mit Controller – `lib/turnFocus.ts`, `screens/Play.tsx`.
- **K9 (#623, 21.11.2026):** Klassische Seiten und Lobby im Rahmen – `console/ClassicInFrame.tsx`.
- **K10 (#624, 21.11.2026):** Hinweis „Controller erkannt“ – `components/ConsoleOffer.tsx`.
- **K8 (#619–#622, 21.11.2026, Durchgang 1):** SVG-Bretter mit Controller (Fokus und A in `FocusZone.tsx`), Würfel bei Nicht ärgern!, Menü-Fokus am Spieltisch, Tastenleiste kein Ziel; Neumessung in [`konsole-eignung.md`](konsole-eignung.md).
- **K11 (#625, 21.11.2026):** `scripts/konsole-probe.mjs`, beide Proben in der CI, [`../steam-deck.md`](../steam-deck.md).
- **K8 Durchgang 2 (#619–#622, 21.11.2026):** Fenster mit Controller (`ModalFocus.tsx`), Bereichsvorrang der Pfeile, Fokus-Rettung am Spieltisch, Bildschirmtastatur nur für Textfelder, Go-SGF-Fenster, Rollabstand der Konsole, gezielter Messlauf; Online-Partie aus der Konsole durchgespielt.

## Offen (Stand 21.11.2026, nach K8 Durchgang 2)

- **Am Gerät prüfen (#625):** Steam Deck und echter Controller; die Anleitung trägt bis dahin einen Warnkasten. Das kann nur jemand mit dem Gerät.
- **SGF-Code bei Go per Bildschirmtastatur:** Die Bildschirmtastatur hat keine Klammern und kein Semikolon; eine Partie lädt man mit dem Controller über den Dateidialog.
- **Echtzeit und Texteingabe:** Enten-Rallye, Fix gefunden!, Ligretto und Speed laufen gegen die Uhr; Kategorien-Sprint, Schätzmeister und Beschreib-Duell brauchen die Bildschirmtastatur. Beides ist bedienbar, aber im Nachteil gegenüber Finger und Tastatur.
- **Messung:** Der gezielte Lauf meldet bei einigen Spielen „nicht angesteuert“, wo Stichproben von Hand einen Weg fanden; die Zahl ist ein Hinweis, kein Beweis.
- **Controller-Probe:** scheiterte einmal direkt nach einem Bau und war danach immer grün; Ursache unklar.
